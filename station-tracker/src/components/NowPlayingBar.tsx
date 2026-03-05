import { Music, Pause, Volume2 } from "lucide-react";
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAudioPlayer } from "./AudioPlayerContext";
import { fetchStations } from "../data/api";
import type { NowPlayingMeta } from "./AudioPlayerContext";

const PAGE_LABEL_BY_PATH: Record<string, string> = {
  "/": "Stations",
  "/tracks": "Tracks",
  "/favorites": "Favorite Tracks",
  "/analytics": "Analytics",
};

function getCurrentPageLabel(pathname: string): string | null {
  return PAGE_LABEL_BY_PATH[pathname] ?? null;
}

function buildTitle(
  meta: NowPlayingMeta | undefined,
  currentPageLabel: string | null
): string {
  let dynamic: string | null = null;

  if (meta) {
    const main = [meta.title, meta.artist].filter(Boolean).join(" - ");
    if (main && meta.stationName) {
      dynamic = `${main} - ${meta.stationName}`;
    } else if (main) {
      dynamic = main;
    } else if (meta.stationName) {
      dynamic = meta.stationName;
    }
  }

  const parts: string[] = [];
  if (dynamic) parts.push(dynamic);
  if (currentPageLabel) parts.push(currentPageLabel);

  if (parts.length > 0) {
    return `${parts.join(" | ")} | Station Tracker`;
  }

  return "Station Tracker";
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const totalSeconds = Math.floor(seconds);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const paddedSecs = secs.toString().padStart(2, "0");
  return `${mins}:${paddedSecs}`;
}

function useDisplayMeta(): NowPlayingMeta | undefined {
  const { nowPlaying } = useAudioPlayer();
  const isStation = nowPlaying?.id.startsWith("station-") ?? false;
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStations,
    refetchInterval: 10_000,
    enabled: isStation,
    refetchIntervalInBackground: true
  });

  if (!nowPlaying) return undefined;

  const stationMatch = nowPlaying.id.match(/^station-(\d+)$/);
  if (stationMatch && stationsData) {
    const stationId = Number(stationMatch[1]);
    const station = stationsData.stations.find((s) => s.id === stationId);
    if (station) {
      const t = station.currentTrack;
      return {
        stationName: station.name,
        title: t?.title,
        artist: t?.artist ?? null,
        album: t?.album ?? null,
        year: t?.year ?? null,
        genre: t?.genre ?? null,
        coverUrl: t?.coverUrl ?? null,
      };
    }
  }

  return nowPlaying.meta;
}

export default function NowPlayingBar() {
  const {
    nowPlaying,
    currentTime,
    duration,
    seek,
    stop,
    volume,
    setVolume,
  } = useAudioPlayer();
  const meta = useDisplayMeta();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const currentPageLabel = getCurrentPageLabel(pathname);
    const title = buildTitle(nowPlaying ? meta : undefined, currentPageLabel);

    // When something is playing, defer the update so we run after
    // the route head has set its own title.
    if (nowPlaying && meta && (meta.title ?? meta.stationName)) {
      const id = setTimeout(() => {
        document.title = title;
      }, 0);
      return () => clearTimeout(id);
    }

    document.title = title;
  }, [nowPlaying, meta, pathname]);

  const hasMeta = meta && (meta.title ?? meta.stationName);
  const isTrackPreview = nowPlaying?.id.startsWith("track-") ?? false;
  const hasSeekableDuration =
    isTrackPreview && Number.isFinite(duration) && duration > 0;

  const detailParts = [
    meta?.artist ?? null,
    meta?.album ?? null,
    meta?.year != null ? String(meta.year) : null,
  ].filter(Boolean);
  const detailLine = detailParts.length > 0 ? detailParts.join(" · ") : null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 transition-[transform,opacity] duration-300 ease-out pointer-events-none"
      style={{
        transform: nowPlaying ? "translateY(0)" : "translateY(100%)",
        opacity: nowPlaying ? 1 : 0,
      }}
    >
      <div
        className="pointer-events-auto bg-base-200 border-t border-base-300 shadow-lg rounded-t-box"
        style={{
          paddingBottom: "env(safe-area-inset-bottom)",
          minHeight: "56px",
        }}
      >
        <div className="flex flex-col gap-1 px-3 py-2 md:flex-row md:gap-2 md:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0 md:flex-1">
            <div className="w-18 h-18 shrink-0 self-center rounded overflow-hidden bg-base-300 flex items-center justify-center">
              {meta?.coverUrl ? (
                <img
                  src={meta.coverUrl}
                  alt={meta.title ? `${meta.title} cover` : "Cover"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Music className="w-7 h-7 opacity-40" />
              )}
            </div>
            <div
              className={`min-w-0 flex flex-col justify-center gap-0.5 py-0.5 md:mr-4 ${
                !hasSeekableDuration ? "flex-1" : "flex-1 md:flex-none"
              }`}
            >
              {meta?.stationName && (
                <p className="text-sm font-medium opacity-90 break-words line-clamp-2">{meta.stationName}</p>
              )}
              {hasMeta ? (
                <>
                  {meta?.title != null && meta.title !== "" && (
                    <p className="font-bold text-sm break-words">{meta.title}</p>
                  )}
                  {detailLine && (
                    <p className="text-xs opacity-80 break-words">{detailLine}</p>
                  )}
                  {meta?.genre != null && meta.genre !== "" && (
                    <span className="badge badge-sm mt-0.5 px-2 w-fit">
                      {meta.genre}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-sm font-bold opacity-80 break-words">
                  Now playing
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={stop}
              className="btn btn-ghost btn-circle btn-sm shrink-0 self-center hidden md:flex md:mr-0.5"
              title="Stop"
            >
              <Pause className="h-4 w-4" />
            </button>
            {hasSeekableDuration && (
              <div className="hidden md:flex items-center gap-2 min-w-0 flex-1 md:-ml-4">
                <span className="text-[11px] tabular-nums opacity-70 w-10 text-right shrink-0">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={Math.min(
                    Math.max(0, Number.isFinite(currentTime) ? currentTime : 0),
                    duration
                  )}
                  onChange={(e) => seek(Number(e.target.value))}
                  className="range range-xs flex-1 min-w-0"
                />
                <span className="text-[11px] tabular-nums opacity-70 w-10 shrink-0">
                  {formatTime(duration)}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={stop}
              className="btn btn-ghost btn-circle btn-sm shrink-0 self-center md:hidden"
              title="Stop"
            >
              <Pause className="h-4 w-4" />
            </button>
            <div className="hidden md:flex items-center gap-2 w-40 shrink-0">
              <Volume2 className="w-4 h-4 opacity-80" />
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="range range-xs flex-1"
                aria-label="Volume"
              />
            </div>
          </div>
          {hasSeekableDuration && (
            <div className="flex md:hidden items-center gap-1.5 w-full mt-2">
              <span className="text-[11px] tabular-nums opacity-70 w-8 text-right shrink-0">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={Math.min(
                  Math.max(0, Number.isFinite(currentTime) ? currentTime : 0),
                  duration
                )}
                onChange={(e) => seek(Number(e.target.value))}
                className="range range-xs flex-1 min-w-0"
              />
              <span className="text-[11px] tabular-nums opacity-70 w-8 shrink-0">
                {formatTime(duration)}
              </span>
            </div>
          )}
          <div className="flex md:hidden items-center gap-2 w-full mt-3">
            <Volume2 className="w-4 h-4 opacity-80" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(volume * 100)}
              onChange={(e) => setVolume(Number(e.target.value) / 100)}
              className="range range-xs flex-1"
              aria-label="Volume"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
