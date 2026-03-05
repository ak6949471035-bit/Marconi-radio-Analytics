import asyncio
import json
import random
import re
import subprocess

from sqlalchemy import select, and_
from db import async_session, get_station
from models import AlertEvent, AlertRule, Play, Station, Track
from subprocess import Popen, PIPE
import shazamio
from datetime import datetime, timedelta, timezone
from util import read_limited_bytes


def normalize_title(title: str) -> str:
    """Strip version/remix/edition info from a track title for comparison."""
    # Remove content in brackets [...] e.g. [Felix Jaehn Remix]
    result = re.sub(r"\[.*?\]", "", title)
    # Remove content in parentheses (...) e.g. (Club Mix), (Extended)
    result = re.sub(r"\(.*?\)", "", result)
    # Remove "Pt." / "Part" suffixes with roman or arabic numerals
    result = re.sub(r"\bPt\.?\s*[IVX\d]+\b", "", result, flags=re.IGNORECASE)
    result = re.sub(r"\bPart\s*[IVX\d]+\b", "", result, flags=re.IGNORECASE)
    # Collapse whitespace, lowercase, strip
    return " ".join(result.split()).lower().strip()


def normalize_artist(artist: str | None) -> str:
    """Extract primary artist name, stripping features/collaborations."""
    if not artist:
        return ""
    # Split on common feature/collaboration separators and take the first part
    result = re.split(
        r"(?:\s+(?:feat\.?|ft\.?|&|x)\s+|,\s+)", artist, maxsplit=1, flags=re.IGNORECASE
    )[0]
    return result.lower().strip()


def is_same_track(a: Track, b: Track) -> bool:
    """Check if two tracks are the same song, even if they are different versions."""
    if a.id == b.id:
        return True

    norm_title_a = normalize_title(a.title)
    norm_title_b = normalize_title(b.title)

    # Don't match on empty normalized titles
    if not norm_title_a or not norm_title_b:
        return False

    return norm_title_a == norm_title_b and normalize_artist(
        a.artist
    ) == normalize_artist(b.artist)


async def track_station(station_id: int):
    await asyncio.sleep(random.randint(1, 10))
    
    while True:
        try:
            async with async_session() as session:
                station = await get_station(session, station_id)
                if not station or not station.enabled:
                    return

                print(f"Tracking station {station.name}")

                await fetch_station(station_id)
                await asyncio.sleep(station.interval + random.randint(0, 1))

        except asyncio.CancelledError:
            print(f"Cancelled tracking station {station_id}")
            return
        except Exception as ex:
            print(ex)


async def fetch_station(station_id: int):
    now = datetime.now(timezone.utc)

    async with async_session() as session:
        station = await get_station(session, station_id)

        try:
            audio = await fetch_audio(station)

            track = await get_track_info(audio)
            if track is not None:
                cutoff = now - timedelta(minutes=10)
                recent_tracks = await session.scalars(
                    select(Track)
                    .join(Play, Play.track_id == Track.id)
                    .where(
                        Play.station_id == station_id,
                        Play.created_at >= cutoff,
                    )
                )
                recent_tracks_list = list(recent_tracks.all())
                same_track_recently = any(
                    is_same_track(t, track) for t in recent_tracks_list
                )

                if not same_track_recently:
                    existing_track = await session.get(Track, track.id)
                    if existing_track is None:
                        track.created_at = now
                        session.add(track)
                        await session.flush()
                        target_track = track
                    else:
                        # Keep confidence score fresh for existing tracks.
                        existing_track.confidence_score = track.confidence_score
                        target_track = existing_track

                    play = Play()
                    play.station_id = station_id
                    play.track_id = track.id
                    play.created_at = now
                    session.add(play)
                    await _evaluate_alert_rules(
                        session=session,
                        station=station,
                        track=target_track,
                        now=now,
                    )

            station.last_run_at = now
            station.error_message = None

        except Exception as ex:
            print(ex)
            station.error_message = f"Error while fetching station: {ex}"
        finally:
            await session.commit()
    pass


async def fetch_audio(station: Station) -> bytes:
    try:
        ffmpeg = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(station.skip_seconds),
            "-i",
            station.url,
            "-t",
            "20",
            "-c:a",
            "libmp3lame",
            "-f",
            "mp3",
            "-",
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        # Load up to 10MB of audio (without hanging indefinitely)
        audio = await asyncio.wait_for(
            read_limited_bytes(ffmpeg.stdout, 10 * 1024 * 1024), timeout=60
        )

        # Wait for the process to complete and get return code
        return_code = await asyncio.wait_for(ffmpeg.wait(), timeout=60)

        if return_code != 0:
            raise Exception(
                f"Failed to fetch station (ffmpeg exit code: {return_code})"
            )

        # Check if we actually got any data
        if not audio:
            raise Exception("No audio data received from station")

        return audio

    except TimeoutError as ex:
        print(ex)
        raise Exception(f"Timeout while fetching station: {ex}")
    finally:
        try:
            ffmpeg.kill()
        except ProcessLookupError:
            pass


async def get_track_info(audio: bytes) -> Track | None:
    shazam = shazamio.Shazam()
    result = await shazam.recognize(audio)

    t = result.get("track")
    if t is None:
        print("No track info found")
        return None

    track = Track()

    track.id = int(t["key"])
    track.title = t["title"]
    track.artist = t.get("subtitle")
    track.shazam_url = t.get("url")

    sections = t.get("sections", [])
    for section in sections:
        if section.get("type") == "SONG":
            metadata = section.get("metadata", [])
            for item in metadata:
                if item.get("title") == "Album":
                    track.album = item.get("text")
                elif item.get("title") == "Released":
                    track.year = int(item.get("text"))

    track.cover_url = t.get("images", {}).get("coverart")
    if not track.cover_url:
        track.cover_url = t.get("images", {}).get("coverarthq")

    track.genre = t.get("genres", {}).get("primary")

    hub_actions = t.get("hub", {}).get("actions", [])
    for action in hub_actions:
        if action.get("type") == "uri" and action.get("uri", "").startswith(
            "https://audio-ssl.itunes.apple.com"
        ):
            track.preview_url = action["uri"]
            break

    matches = result.get("matches", []) or []
    metadata_signals = sum(
        1
        for value in (track.artist, track.album, track.year, track.genre, track.cover_url)
        if value
    )
    # Approximate confidence score (0-100) from Shazam response richness.
    track.confidence_score = min(100.0, 35.0 + len(matches) * 10.0 + metadata_signals * 6.0)

    return track


async def _evaluate_alert_rules(session, station: Station, track: Track, now: datetime):
    rules_result = await session.execute(
        select(AlertRule).where(
            and_(
                AlertRule.enabled.is_(True),
                (AlertRule.station_id.is_(None) | (AlertRule.station_id == station.id)),
            )
        )
    )
    rules = rules_result.scalars().all()
    if not rules:
        return

    haystack = " ".join(
        filter(None, [track.title, track.artist, track.album, track.genre])
    ).lower()

    for rule in rules:
        q = (rule.query or "").strip().lower()
        if not q or q not in haystack:
            continue

        recent_event_stmt = (
            select(AlertEvent)
            .where(AlertEvent.rule_id == rule.id)
            .order_by(AlertEvent.created_at.desc())
            .limit(1)
        )
        recent_event = (await session.execute(recent_event_stmt)).scalar_one_or_none()
        cooldown_minutes = max(rule.min_interval_minutes or 0, 0)
        if recent_event and recent_event.created_at >= now - timedelta(minutes=cooldown_minutes):
            continue

        event = AlertEvent(
            rule_id=rule.id,
            station_id=station.id,
            track_id=track.id,
            message=f'Rule "{rule.name}" matched "{track.title}" on {station.name}',
            metadata_json=json.dumps(
                {
                    "ruleQuery": rule.query,
                    "station": station.name,
                    "trackTitle": track.title,
                    "trackArtist": track.artist,
                }
            ),
            created_at=now,
        )
        session.add(event)
