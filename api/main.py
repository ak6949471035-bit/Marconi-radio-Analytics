import asyncio
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
import json
import logging
import os
from pathlib import Path
import random
from typing import Annotated, Dict, List, Optional
import unicodedata

from fastapi import FastAPI, Query, Response, status, Request, HTTPException
from fastapi import File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel
from sqlalchemy import delete, select, func, and_, or_, cast, String, Integer, case
from sqlalchemy.orm import aliased

from db import async_session, engine
from jobs import track_station
from models import AlertEvent, AlertRule, Play, Station, Track
import uvicorn
from uuid import uuid4

STATIC_DIR = Path(__file__).parent / "static"

logger = logging.getLogger(__name__)


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        by_alias=True,
    )


class CreateStation(CamelModel):
    name: str = Field(min_length=1)
    url: str = Field(min_length=1)
    logo_url: str | None = None
    enabled: bool = Field()
    interval: int = Field(gt=29, lt=86401)
    skip_seconds: int = Field(gt=-1, lt=91)

    @field_validator("logo_url", mode="before")
    @classmethod
    def normalize_logo_url(cls, value: str | None):
        if value is None:
            return None
        value = value.strip()
        return value if value else None


class UpdateStation(CamelModel):
    name: str = Field(min_length=1)
    url: str = Field(min_length=1)
    logo_url: str | None = None
    enabled: bool = Field()
    interval: int = Field(gt=29, lt=86401)
    skip_seconds: int = Field(gt=-1, lt=91)

    @field_validator("logo_url", mode="before")
    @classmethod
    def normalize_logo_url(cls, value: str | None):
        if value is None:
            return None
        value = value.strip()
        return value if value else None


class TracksParams(BaseModel):
    station_ids: Optional[str] = Field(default=None, alias="station-ids")
    query: Optional[str] = Field(default=None)
    from_: Optional[datetime] = Field(default=None, alias="from")
    to: Optional[datetime] = Field(default=None)
    created_before: Optional[datetime] = Field(default=None, alias="created-before")

    def get_station_ids(self) -> Optional[List[int]]:
        if self.station_ids is None:
            return None
        return [int(x.strip()) for x in self.station_ids.split(",")]


class FavoriteTracksParams(BaseModel):
    query: Optional[str] = Field(default=None)
    from_: Optional[datetime] = Field(default=None, alias="from")
    to: Optional[datetime] = Field(default=None)
    favorited_before: Optional[datetime] = Field(default=None, alias="favorited-before")


class AnalyticsParams(BaseModel):
    station_ids: Optional[str] = Field(default=None, alias="station-ids")
    query: Optional[str] = Field(default=None)
    from_: Optional[datetime] = Field(default=None, alias="from")
    to: Optional[datetime] = Field(default=None, alias="to")

    def get_station_ids(self) -> Optional[List[int]]:
        if self.station_ids is None:
            return None
        return [int(x.strip()) for x in self.station_ids.split(",")]


class TrackResponse(CamelModel):
    id: int
    station_id: int | None = None
    station_name: str | None = None
    station_logo_url: str | None = None
    title: str
    artist: str | None = None
    album: str | None = None
    year: int | None = None
    genre: str | None = None
    cover_url: str | None = None
    preview_url: str | None = None
    confidence_score: float | None = None
    shazam_url: str | None = None
    favorite_at: datetime | None = None
    created_at: datetime
    total_plays: int | None = None


class TracksResponse(CamelModel):
    tracks: List[TrackResponse]


class StationResponse(CamelModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        by_alias=True,
        from_attributes=True,
    )

    id: int
    name: str
    url: str
    logo_url: str | None = None
    enabled: bool
    interval: int
    skip_seconds: int
    last_run_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime
    current_track: TrackResponse | None = None


class StationsResponse(CamelModel):
    stations: List[StationResponse]


class AnalyticsTopSongItem(CamelModel):
    title: str
    artist: str | None
    album: str | None
    count: int


class AnalyticsTopArtistItem(CamelModel):
    artist: str | None
    count: int


class AnalyticsTopGenreItem(CamelModel):
    genre: str | None
    count: int


class AnalyticsTopStationItem(CamelModel):
    station_id: int
    station_name: str
    count: int
    songs_per_hour: float | None = None


class AnalyticsTopYearItem(CamelModel):
    year: int | None
    count: int


class AnalyticsHourTopYearsItem(CamelModel):
    hour: int
    years: List[AnalyticsTopYearItem]


class AnalyticsExclusiveSongItem(CamelModel):
    title: str
    artist: str | None
    album: str | None
    count: int


class AnalyticsExclusiveStationSongsItem(CamelModel):
    station_name: str
    songs: List[AnalyticsExclusiveSongItem]


class AnalyticsAllResponse(CamelModel):
    total_plays: int
    unique_tracks: int
    unique_artists: int
    unique_genres: int
    average_confidence_score: float | None = None
    low_confidence_plays: int = 0
    top_songs: List[AnalyticsTopSongItem]
    top_artists: List[AnalyticsTopArtistItem]
    top_genres: List[AnalyticsTopGenreItem]
    top_stations: List[AnalyticsTopStationItem]
    top_years: List[AnalyticsTopYearItem]
    top_years_by_hour: List[AnalyticsHourTopYearsItem]
    exclusive_station_songs: List[AnalyticsExclusiveStationSongsItem]


class UploadResponse(CamelModel):
    url: str


class ApiIdentityResponse(CamelModel):
    role: str
    has_write_access: bool


class AlertRuleCreate(CamelModel):
    name: str = Field(min_length=1)
    query: str = Field(min_length=1)
    station_id: int | None = None
    min_interval_minutes: int = Field(ge=0, le=1440)
    enabled: bool = True


class AlertRuleUpdate(CamelModel):
    name: str = Field(min_length=1)
    query: str = Field(min_length=1)
    station_id: int | None = None
    min_interval_minutes: int = Field(ge=0, le=1440)
    enabled: bool = True


class AlertRuleResponse(CamelModel):
    id: int
    name: str
    query: str
    station_id: int | None
    min_interval_minutes: int
    enabled: bool
    created_at: datetime
    updated_at: datetime


class AlertRulesResponse(CamelModel):
    rules: List[AlertRuleResponse]


class AlertEventResponse(CamelModel):
    id: int
    rule_id: int
    station_id: int
    station_name: str
    track_id: int
    track_title: str
    message: str
    metadata_json: str | None = None
    created_at: datetime


class AlertEventsResponse(CamelModel):
    events: List[AlertEventResponse]


class CompetitivePoint(CamelModel):
    hour: str
    stations: Dict[str, int]


class CompetitiveAnalyticsResponse(CamelModel):
    points: List[CompetitivePoint]


# Represents a running station task
class StationTask:
    id: int
    task: asyncio.Task

    def __init__(self, id: int, task: asyncio.Task):
        self.id = id
        self.task = task


# Holds all currently running station tasks
station_tasks: Dict[int, StationTask] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with async_session() as session:
        stations = await session.scalars(select(Station).where(Station.enabled))

        for station in stations:
            task = asyncio.create_task(track_station(station.id))
            station_tasks[station.id] = StationTask(station.id, task)

        print(f"Started {len(station_tasks)} station tasks")

    yield

    print("Shutting down...")

    for station_task in station_tasks.values():
        station_task.task.cancel()

    if station_tasks:
        await asyncio.gather(
            *[task.task for task in station_tasks.values()], return_exceptions=True
        )

    await engine.dispose()

    print("Shutdown complete")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOADS_DIR = STATIC_DIR / "uploads" / "logos"
API_KEYS: dict[str, str] = {}


def _load_api_keys() -> dict[str, str]:
    raw = os.environ.get("API_KEYS_JSON", "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        keys: dict[str, str] = {}
        if isinstance(parsed, list):
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                key = str(item.get("key", "")).strip()
                role = str(item.get("role", "viewer")).strip().lower()
                if key:
                    keys[key] = role
        return keys
    except Exception:
        logger.exception("Failed to parse API_KEYS_JSON")
        return {}


def _is_write_method(method: str) -> bool:
    return method.upper() in {"POST", "PUT", "PATCH", "DELETE"}


def _has_write_access(role: str) -> bool:
    return role in {"admin", "editor"}


API_KEYS = _load_api_keys()


@app.middleware("http")
async def api_key_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    if not API_KEYS:
        request.state.api_role = "admin"
        return await call_next(request)

    incoming_key = request.headers.get("x-api-key", "").strip()
    role = API_KEYS.get(incoming_key)
    if role is None:
        return Response(
            content='{"message":"Invalid API key"}',
            status_code=status.HTTP_401_UNAUTHORIZED,
            media_type="application/json",
        )

    request.state.api_role = role
    if _is_write_method(request.method) and not _has_write_access(role):
        return Response(
            content='{"message":"Insufficient permissions"}',
            status_code=status.HTTP_403_FORBIDDEN,
            media_type="application/json",
        )

    return await call_next(request)


@app.get("/api/stations", response_model=StationsResponse)
async def get_stations():
    async with async_session() as session:
        LatestPlay = aliased(Play)
        LatestTrack = aliased(Track)

        max_play_dates = (
            select(Play.station_id, func.max(Play.created_at).label("max_date"))
            .group_by(Play.station_id)
            .subquery()
        )

        stmt = (
            select(Station, LatestTrack, LatestPlay)
            .outerjoin(max_play_dates, Station.id == max_play_dates.c.station_id)
            .outerjoin(
                LatestPlay,
                and_(
                    max_play_dates.c.station_id == LatestPlay.station_id,
                    max_play_dates.c.max_date == LatestPlay.created_at,
                ),
            )
            .outerjoin(
                LatestTrack,
                LatestPlay.track_id == LatestTrack.id,
            )
        )

        result = await session.execute(stmt)

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=10)
        stations = []
        for station, track, play in result:
            station_model = StationResponse.model_validate(station)
            # DB timestamps are stored as UTC (naive); make aware for comparison
            play_at = play.created_at if play else None
            if play_at is not None and play_at.tzinfo is None:
                play_at = play_at.replace(tzinfo=timezone.utc)
            if track and play and play_at is not None and play_at >= cutoff:
                station_model.current_track = TrackResponse(
                    id=track.id,
                    station_id=play.station_id,
                    station_name=station.name,
                    station_logo_url=station.logo_url,
                    title=track.title,
                    artist=track.artist,
                    album=track.album,
                    year=track.year,
                    genre=track.genre,
                    cover_url=track.cover_url,
                    preview_url=track.preview_url,
                    confidence_score=track.confidence_score,
                    shazam_url=track.shazam_url,
                    favorite_at=track.favorite_at,
                    created_at=play.created_at,
                )
            stations.append(station_model)

        return StationsResponse(stations=stations)


@app.get("/api/tracks", response_model=TracksResponse)
async def get_tracks(params: Annotated[TracksParams, Query()]):
    async with async_session() as session:
        stmt = (
            select(
                Play,
                Track,
                Station.name.label("station_name"),
                Station.logo_url.label("station_logo_url"),
            )
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )

        station_ids = params.get_station_ids()
        if station_ids:
            stmt = stmt.where(Play.station_id.in_(station_ids))
        if params.query:
            pattern = f"%{params.query}%"
            stmt = stmt.where(
                or_(
                    Station.name.like(pattern),
                    Track.title.like(pattern),
                    Track.artist.like(pattern),
                    Track.album.like(pattern),
                    cast(Track.year, String).like(pattern),
                    Track.genre.like(pattern),
                )
            )
        if params.from_:
            stmt = stmt.where(Play.created_at >= params.from_)
        if params.to:
            stmt = stmt.where(Play.created_at <= params.to)
        if params.created_before:
            stmt = stmt.where(Play.created_at < params.created_before)

        stmt = stmt.order_by(Play.created_at.desc()).limit(100)

        result = await session.execute(stmt)
        tracks = [
            TrackResponse(
                id=track.id,
                station_id=play.station_id,
                station_name=station_name,
                station_logo_url=station_logo_url,
                title=track.title,
                artist=track.artist,
                album=track.album,
                year=track.year,
                genre=track.genre,
                cover_url=track.cover_url,
                preview_url=track.preview_url,
                confidence_score=track.confidence_score,
                shazam_url=track.shazam_url,
                favorite_at=track.favorite_at,
                created_at=play.created_at,
            )
            for play, track, station_name, station_logo_url in result
        ]
        return TracksResponse(tracks=tracks)


@app.get("/api/tracks/favorite", response_model=TracksResponse)
async def get_favorite_tracks(params: Annotated[FavoriteTracksParams, Query()]):
    async with async_session() as session:
        play_count_sq = (
            select(func.count(Play.id))
            .where(Play.track_id == Track.id)
            .scalar_subquery()
        )
        stmt = select(Track, play_count_sq.label("total_plays")).where(
            Track.favorite_at.is_not(None)
        )
        if params.query:
            pattern = f"%{params.query}%"
            stmt = stmt.where(
                or_(
                    Track.title.like(pattern),
                    Track.artist.like(pattern),
                    Track.album.like(pattern),
                    cast(Track.year, String).like(pattern),
                    Track.genre.like(pattern),
                )
            )
        if params.from_:
            stmt = stmt.where(Track.favorite_at >= params.from_)
        if params.to:
            stmt = stmt.where(Track.favorite_at <= params.to)
        if params.favorited_before:
            stmt = stmt.where(Track.favorite_at < params.favorited_before)
        stmt = stmt.order_by(Track.favorite_at.desc()).limit(100)
        result = await session.execute(stmt)
        tracks = [
            TrackResponse(
                id=track.id,
                title=track.title,
                artist=track.artist,
                album=track.album,
                year=track.year,
                genre=track.genre,
                cover_url=track.cover_url,
                preview_url=track.preview_url,
                confidence_score=track.confidence_score,
                shazam_url=track.shazam_url,
                favorite_at=track.favorite_at,
                created_at=track.created_at,
                total_plays=total_plays or 0,
            )
            for track, total_plays in result.all()
        ]
        return TracksResponse(tracks=tracks)


@app.post("/api/tracks/{track_id}/favorite")
async def post_favorite_track(track_id: int, response: Response):
    async with async_session() as session:
        track = await session.get(Track, track_id)
        if not track:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"message": "Track not found"}
        track.favorite_at = datetime.now()
        await session.commit()

        response.status_code = status.HTTP_204_NO_CONTENT


@app.delete("/api/tracks/{track_id}/favorite")
async def delete_favorite_track(track_id: int, response: Response):
    async with async_session() as session:
        track = await session.get(Track, track_id)
        if not track:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"message": "Track not found"}
        track.favorite_at = None
        await session.commit()


@app.post("/api/stations")
async def post_station(create_station: CreateStation, response: Response):
    async with async_session() as session:
        new_station = Station(
            name=create_station.name,
            url=create_station.url,
            logo_url=create_station.logo_url,
            enabled=create_station.enabled,
            interval=create_station.interval,
            skip_seconds=create_station.skip_seconds,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        session.add(new_station)
        await session.commit()

        task = asyncio.create_task(track_station(new_station.id))
        station_tasks[new_station.id] = StationTask(new_station.id, task)

        response.status_code = status.HTTP_201_CREATED
        return {"message": "Station created", "id": new_station.id}


@app.put("/api/stations/{station_id}")
async def put_station(
    station_id: int, update_station: UpdateStation, response: Response
):
    async with async_session() as session:
        station = await session.get(Station, station_id)
        if not station:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"message": "Station not found"}

        station.name = update_station.name
        station.url = update_station.url
        station.logo_url = update_station.logo_url
        station.enabled = update_station.enabled
        station.interval = update_station.interval
        station.skip_seconds = update_station.skip_seconds
        station.updated_at = datetime.now()

        await session.commit()

        if station_id in station_tasks:
            station_tasks[station_id].task.cancel()
            del station_tasks[station_id]

        if station.enabled:
            task = asyncio.create_task(track_station(station.id))
            station_tasks[station.id] = StationTask(station.id, task)

        response.status_code = status.HTTP_204_NO_CONTENT


@app.delete("/api/stations/{station_id}")
async def delete_station(station_id: int, response: Response):
    async with async_session() as session:
        station = await session.get(Station, station_id)
        if not station:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"message": "Station not found"}

        await session.execute(delete(Play).where(Play.station_id == station_id))
        await session.delete(station)
        await session.commit()

        if station_id in station_tasks:
            station_tasks[station_id].task.cancel()
            del station_tasks[station_id]

        response.status_code = status.HTTP_204_NO_CONTENT


@app.delete("/api/tracks/{track_id}")
async def delete_track(track_id: int, response: Response):
    async with async_session() as session:
        track = await session.get(Track, track_id)
        if not track:
            response.status_code = status.HTTP_404_NOT_FOUND
            return {"message": "Track not found"}
        await session.delete(track)
        await session.commit()

        response.status_code = status.HTTP_204_NO_CONTENT


@app.post("/api/uploads/station-logo", response_model=UploadResponse)
async def post_station_logo(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        return Response(
            content='{"message":"Only image uploads are allowed"}',
            status_code=status.HTTP_400_BAD_REQUEST,
            media_type="application/json",
        )

    content = await file.read()
    max_size = 5 * 1024 * 1024
    if len(content) > max_size:
        return Response(
            content='{"message":"Image is too large (max 5MB)"}',
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            media_type="application/json",
        )

    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}:
        suffix = ".png"

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{suffix}"
    out_path = UPLOADS_DIR / filename
    out_path.write_bytes(content)

    return UploadResponse(url=f"/uploads/logos/{filename}")


@app.get("/api/auth/whoami", response_model=ApiIdentityResponse)
async def get_auth_whoami(request: Request):
    role = getattr(request.state, "api_role", "admin")
    return ApiIdentityResponse(role=role, has_write_access=_has_write_access(role))


@app.get("/api/alerts/rules", response_model=AlertRulesResponse)
async def get_alert_rules():
    async with async_session() as session:
        rows = (await session.execute(select(AlertRule).order_by(AlertRule.created_at.desc()))).scalars().all()
        return AlertRulesResponse(
            rules=[
                AlertRuleResponse(
                    id=row.id,
                    name=row.name,
                    query=row.query,
                    station_id=row.station_id,
                    min_interval_minutes=row.min_interval_minutes,
                    enabled=row.enabled,
                    created_at=row.created_at,
                    updated_at=row.updated_at,
                )
                for row in rows
            ]
        )


@app.post("/api/alerts/rules", response_model=AlertRuleResponse, status_code=status.HTTP_201_CREATED)
async def post_alert_rule(payload: AlertRuleCreate):
    async with async_session() as session:
        now = datetime.now()
        row = AlertRule(
            name=payload.name,
            query=payload.query,
            station_id=payload.station_id,
            min_interval_minutes=payload.min_interval_minutes,
            enabled=payload.enabled,
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
        return AlertRuleResponse(
            id=row.id,
            name=row.name,
            query=row.query,
            station_id=row.station_id,
            min_interval_minutes=row.min_interval_minutes,
            enabled=row.enabled,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


@app.put("/api/alerts/rules/{rule_id}", response_model=AlertRuleResponse)
async def put_alert_rule(rule_id: int, payload: AlertRuleUpdate):
    async with async_session() as session:
        row = await session.get(AlertRule, rule_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Rule not found")
        row.name = payload.name
        row.query = payload.query
        row.station_id = payload.station_id
        row.min_interval_minutes = payload.min_interval_minutes
        row.enabled = payload.enabled
        row.updated_at = datetime.now()
        await session.commit()
        return AlertRuleResponse(
            id=row.id,
            name=row.name,
            query=row.query,
            station_id=row.station_id,
            min_interval_minutes=row.min_interval_minutes,
            enabled=row.enabled,
            created_at=row.created_at,
            updated_at=row.updated_at,
        )


@app.delete("/api/alerts/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert_rule(rule_id: int):
    async with async_session() as session:
        row = await session.get(AlertRule, rule_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Rule not found")
        await session.execute(delete(AlertEvent).where(AlertEvent.rule_id == rule_id))
        await session.delete(row)
        await session.commit()


@app.get("/api/alerts/events", response_model=AlertEventsResponse)
async def get_alert_events(limit: int = Query(default=100, ge=1, le=500)):
    async with async_session() as session:
        stmt = (
            select(
                AlertEvent,
                Station.name.label("station_name"),
                Track.title.label("track_title"),
            )
            .join(Station, AlertEvent.station_id == Station.id)
            .join(Track, AlertEvent.track_id == Track.id)
            .order_by(AlertEvent.created_at.desc())
            .limit(limit)
        )
        rows = (await session.execute(stmt)).all()
        return AlertEventsResponse(
            events=[
                AlertEventResponse(
                    id=e.id,
                    rule_id=e.rule_id,
                    station_id=e.station_id,
                    station_name=station_name,
                    track_id=e.track_id,
                    track_title=track_title,
                    message=e.message,
                    metadata_json=e.metadata_json,
                    created_at=e.created_at,
                )
                for e, station_name, track_title in rows
            ]
        )


def _analytics_where(stmt, params: AnalyticsParams, include_station_ids: bool = True):
    """Apply standard analytics filters to a statement that has Play, Track, Station joined."""
    if include_station_ids:
        station_ids = params.get_station_ids()
        if station_ids:
            stmt = stmt.where(Play.station_id.in_(station_ids))
    if params.query:
        pattern = f"%{params.query}%"
        stmt = stmt.where(
            or_(
                Station.name.like(pattern),
                Track.title.like(pattern),
                Track.artist.like(pattern),
                Track.album.like(pattern),
                cast(Track.year, String).like(pattern),
                Track.genre.like(pattern),
            )
        )
    if params.from_:
        stmt = stmt.where(Play.created_at >= params.from_)
    if params.to:
        stmt = stmt.where(Play.created_at <= params.to)
    return stmt


def _normalize_station_name(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).lower()
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def _station_group_key(name: str) -> str | None:
    normalized = _normalize_station_name(name)
    if "diesi" in normalized or "διεση" in normalized:
        return "Diesi"
    if "melodia" in normalized or "μελωδια" in normalized:
        return "Melodia"
    if "menta" in normalized or "μεντα" in normalized:
        return "Menta"
    return None


@app.get("/api/analytics", response_model=AnalyticsAllResponse)
async def get_analytics(params: Annotated[AnalyticsParams, Query()]):
    async with async_session() as session:
        # Summary
        stmt_total = (
            select(func.count(Play.id))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_total = _analytics_where(stmt_total, params)
        total_plays = (await session.execute(stmt_total)).scalar_one()

        stmt_unique = (
            select(func.count(Play.track_id.distinct()))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_unique = _analytics_where(stmt_unique, params)
        unique_tracks = (await session.execute(stmt_unique)).scalar_one()

        stmt_artists_count = (
            select(func.count(Track.artist.distinct()))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_artists_count = _analytics_where(stmt_artists_count, params)
        unique_artists = (await session.execute(stmt_artists_count)).scalar_one()

        stmt_genres_count = (
            select(func.count(Track.genre.distinct()))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_genres_count = _analytics_where(stmt_genres_count, params)
        unique_genres = (await session.execute(stmt_genres_count)).scalar_one()

        stmt_confidence = (
            select(func.avg(Track.confidence_score), func.sum(case((Track.confidence_score < 60, 1), else_=0)))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_confidence = _analytics_where(stmt_confidence, params)
        avg_confidence, low_confidence_plays = (await session.execute(stmt_confidence)).one()

        # Top songs
        stmt_songs = (
            select(
                Track.title,
                Track.artist,
                Track.album,
                func.count(Play.id).label("count"),
            )
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_songs = _analytics_where(stmt_songs, params)
        stmt_songs = (
            stmt_songs.group_by(Play.track_id, Track.title, Track.artist, Track.album)
            .order_by(func.count(Play.id).desc())
            .limit(10)
        )
        rows_songs = (await session.execute(stmt_songs)).all()
        top_songs = [
            AnalyticsTopSongItem(
                title=row[0], artist=row[1], album=row[2], count=row[3]
            )
            for row in rows_songs
        ]

        # Top artists
        stmt_artists = (
            select(Track.artist, func.count(Play.id).label("count"))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_artists = _analytics_where(stmt_artists, params)
        stmt_artists = (
            stmt_artists.group_by(Track.artist)
            .order_by(func.count(Play.id).desc())
            .limit(10)
        )
        rows_artists = (await session.execute(stmt_artists)).all()
        top_artists = [
            AnalyticsTopArtistItem(artist=row[0], count=row[1]) for row in rows_artists
        ]

        # Top genres
        stmt_genres = (
            select(Track.genre, func.count(Play.id).label("count"))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_genres = _analytics_where(stmt_genres, params)
        stmt_genres = (
            stmt_genres.group_by(Track.genre)
            .order_by(func.count(Play.id).desc())
            .limit(10)
        )
        rows_genres = (await session.execute(stmt_genres)).all()
        top_genres = [
            AnalyticsTopGenreItem(genre=row[0], count=row[1]) for row in rows_genres
        ]

        # Top stations
        stmt_stations = (
            select(Station.id, Station.name, func.count(Play.id).label("count"))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_stations = _analytics_where(stmt_stations, params)
        stmt_stations = (
            stmt_stations.group_by(Station.id, Station.name)
            .order_by(func.count(Play.id).desc())
            .limit(10)
        )
        rows_stations = (await session.execute(stmt_stations)).all()

        stmt_time_span = (
            select(func.min(Play.created_at), func.max(Play.created_at))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_time_span = _analytics_where(stmt_time_span, params)
        min_play_at, max_play_at = (await session.execute(stmt_time_span)).one()
        songs_per_hour_base = None
        if min_play_at is not None and max_play_at is not None:
            span_hours = max((max_play_at - min_play_at).total_seconds() / 3600.0, 1.0)
            songs_per_hour_base = span_hours

        top_stations = [
            AnalyticsTopStationItem(
                station_id=row[0],
                station_name=row[1],
                count=row[2],
                songs_per_hour=(
                    round(row[2] / songs_per_hour_base, 2)
                    if songs_per_hour_base is not None
                    else None
                ),
            )
            for row in rows_stations
        ]

        # Plays by year (total plays grouped by track release year)
        stmt_top_years = (
            select(
                Track.year,
                func.count(Play.id).label("count"),
            )
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_top_years = _analytics_where(stmt_top_years, params)
        stmt_top_years = (
            stmt_top_years.group_by(Track.year)
            .order_by(func.count(Play.id).desc())
            .limit(10)
        )
        rows_top_years = (await session.execute(stmt_top_years)).all()
        top_years = [
            AnalyticsTopYearItem(year=row[0], count=row[1]) for row in rows_top_years
        ]

        # Radio clock: top release years for each hour of day
        hour_expr = cast(func.strftime("%H", Play.created_at), Integer)
        stmt_top_years_by_hour = (
            select(hour_expr.label("hour"), Track.year, func.count(Play.id).label("count"))
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt_top_years_by_hour = _analytics_where(stmt_top_years_by_hour, params)
        stmt_top_years_by_hour = (
            stmt_top_years_by_hour.group_by(hour_expr, Track.year)
            .order_by(hour_expr.asc(), func.count(Play.id).desc())
        )
        rows_top_years_by_hour = (await session.execute(stmt_top_years_by_hour)).all()
        top_years_by_hour_map: dict[int, list[AnalyticsTopYearItem]] = defaultdict(list)
        for hour, year, count in rows_top_years_by_hour:
            if len(top_years_by_hour_map[hour]) < 10:
                top_years_by_hour_map[hour].append(
                    AnalyticsTopYearItem(year=year, count=count)
                )
        top_years_by_hour = [
            AnalyticsHourTopYearsItem(hour=hour, years=top_years_by_hour_map[hour])
            for hour in sorted(top_years_by_hour_map)
        ]

        # Songs played by only one of Diesi/Melodia/Menta (and not the other two)
        stmt_target_stations = select(Station.id, Station.name)
        rows_target_stations = (await session.execute(stmt_target_stations)).all()
        station_ids_by_group: dict[str, set[int]] = {"Diesi": set(), "Melodia": set(), "Menta": set()}
        station_name_by_group: dict[str, str] = {
            "Diesi": "Diesi",
            "Melodia": "Melodia",
            "Menta": "Menta",
        }
        station_group_by_id: dict[int, str] = {}
        for station_id, station_name in rows_target_stations:
            group = _station_group_key(station_name)
            if group is None:
                continue
            station_ids_by_group[group].add(station_id)
            station_group_by_id[station_id] = group
            station_name_by_group[group] = station_name

        target_station_ids = (
            station_ids_by_group["Diesi"]
            | station_ids_by_group["Melodia"]
            | station_ids_by_group["Menta"]
        )
        exclusive_station_songs: list[AnalyticsExclusiveStationSongsItem] = []
        if target_station_ids:
            stmt_exclusive_raw = (
                select(
                    Play.station_id,
                    Track.id,
                    Track.title,
                    Track.artist,
                    Track.album,
                    func.count(Play.id).label("count"),
                )
                .select_from(Play)
                .join(Track, Play.track_id == Track.id)
                .join(Station, Play.station_id == Station.id)
                .where(Play.station_id.in_(target_station_ids))
            )
            stmt_exclusive_raw = _analytics_where(
                stmt_exclusive_raw, params, include_station_ids=False
            ).group_by(
                Play.station_id, Track.id, Track.title, Track.artist, Track.album
            )
            rows_exclusive_raw = (await session.execute(stmt_exclusive_raw)).all()

            track_presence: dict[int, dict] = {}
            for station_id, track_id, title, artist, album, count in rows_exclusive_raw:
                group = station_group_by_id.get(station_id)
                if group is None:
                    continue
                if track_id not in track_presence:
                    track_presence[track_id] = {
                        "title": title,
                        "artist": artist,
                        "album": album,
                        "counts": {"Diesi": 0, "Melodia": 0, "Menta": 0},
                    }
                track_presence[track_id]["counts"][group] += count

            for group in ("Diesi", "Melodia", "Menta"):
                songs: list[AnalyticsExclusiveSongItem] = []
                others = [g for g in ("Diesi", "Melodia", "Menta") if g != group]
                for item in track_presence.values():
                    counts = item["counts"]
                    if counts[group] > 0 and all(counts[o] == 0 for o in others):
                        songs.append(
                            AnalyticsExclusiveSongItem(
                                title=item["title"],
                                artist=item["artist"],
                                album=item["album"],
                                count=counts[group],
                            )
                        )
                songs.sort(key=lambda s: s.count, reverse=True)
                exclusive_station_songs.append(
                    AnalyticsExclusiveStationSongsItem(
                        station_name=station_name_by_group[group],
                        songs=songs[:50],
                    )
                )

        return AnalyticsAllResponse(
            total_plays=total_plays or 0,
            unique_tracks=unique_tracks or 0,
            unique_artists=unique_artists or 0,
            unique_genres=unique_genres or 0,
            average_confidence_score=(round(float(avg_confidence), 2) if avg_confidence is not None else None),
            low_confidence_plays=int(low_confidence_plays or 0),
            top_songs=top_songs,
            top_artists=top_artists,
            top_genres=top_genres,
            top_stations=top_stations,
            top_years=top_years,
            top_years_by_hour=top_years_by_hour,
            exclusive_station_songs=exclusive_station_songs,
        )


@app.get("/api/analytics/competitive", response_model=CompetitiveAnalyticsResponse)
async def get_competitive_analytics(params: Annotated[AnalyticsParams, Query()]):
    async with async_session() as session:
        hour_bucket = func.strftime("%Y-%m-%d %H:00", Play.created_at)
        stmt = (
            select(
                hour_bucket.label("hour"),
                Station.name.label("station_name"),
                func.count(Play.id).label("count"),
            )
            .select_from(Play)
            .join(Track, Play.track_id == Track.id)
            .join(Station, Play.station_id == Station.id)
        )
        stmt = _analytics_where(stmt, params).group_by(hour_bucket, Station.name).order_by(hour_bucket.asc())
        rows = (await session.execute(stmt)).all()

        grouped: dict[str, dict[str, int]] = defaultdict(dict)
        for hour, station_name, count in rows:
            grouped[str(hour)][station_name] = count

        points = [
            CompetitivePoint(hour=hour, stations=stations)
            for hour, stations in grouped.items()
        ]
        return CompetitiveAnalyticsResponse(points=points)


# SPA static file serving – must be defined after all API routes
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    # Try to serve the exact static file if it exists
    file_path = (STATIC_DIR / full_path).resolve()
    if file_path.is_file() and str(file_path).startswith(str(STATIC_DIR.resolve())):
        return FileResponse(file_path)
    # Fall back to the SPA shell for client-side routing
    shell = STATIC_DIR / "_shell.html"
    if shell.is_file():
        return FileResponse(shell)
    return Response(status_code=404)


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
