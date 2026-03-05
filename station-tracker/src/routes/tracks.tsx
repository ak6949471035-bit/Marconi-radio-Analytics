import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import {
  Search,
  ChevronDown,
  Play,
  Pause,
  EllipsisVertical,
  Youtube,
  Star,
  Music2,
} from "lucide-react";
import {
  fetchTracks,
  fetchStations,
  deleteTrack,
  favoriteTrack,
  unfavoriteTrack,
} from "../data/api";
import { useAudioPlayer } from "../components/AudioPlayerContext";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";
import EmptyState from "../components/EmptyState";
import type { TrackResponse, FetchTracksParams } from "../data/api";

interface TracksSearch {
  stationIds?: string;
  query?: string;
  from?: string;
  to?: string;
}

export const Route = createFileRoute("/tracks")({
  head: () => ({
    meta: [{ title: "Tracks | Station Tracker" }],
  }),
  validateSearch: (search: Record<string, unknown>): TracksSearch => ({
    stationIds: search.stationIds as string | undefined,
    query: search.query as string | undefined,
    from: search.from as string | undefined,
    to: search.to as string | undefined,
  }),
  component: TracksPage,
});

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 10V17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 7H12.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}function TracksPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { playingId, toggle } = useAudioPlayer();

  // Delete track state
  const [deleteTarget, setDeleteTarget] = useState<TrackResponse | null>(null);

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await deleteTrack(deleteTarget.id);
    setTracks((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    queryClient.invalidateQueries({ queryKey: ["tracks"] });
    setDeleteTarget(null);
  };

  // Local form state (only committed to URL on Search)
  const [selectedStationIds, setSelectedStationIds] = useState<number[]>(() =>
    search.stationIds ? search.stationIds.split(",").map(Number) : []
  );
  const [query, setQuery] = useState(search.query || "");
  const [from, setFrom] = useState(search.from || "");
  const [to, setTo] = useState(search.to || "");

  // Auto-update toggle (persisted to localStorage)
  const [autoUpdate, setAutoUpdate] = useState(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem("tracks-auto-update")
        : null;
    return stored === null ? true : stored === "true";
  });

  const handleAutoUpdateChange = (checked: boolean) => {
    setAutoUpdate(checked);
    localStorage.setItem("tracks-auto-update", String(checked));
  };

  // Accumulated tracks and pagination
  const [tracks, setTracks] = useState<TrackResponse[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch stations for the multi-select filter
  const { data: stationsData } = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStations,
  });

  // Build fetch params from URL search params
  const fetchParams: FetchTracksParams = {
    stationIds: search.stationIds,
    query: search.query,
    from: search.from,
    to: search.to,
  };

  // Track whether the user has loaded more pages
  const hasLoadedMore = useRef(false);

  // Fetch tracks based on current URL search params
  const {
    data: tracksData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tracks", fetchParams],
    queryFn: () => fetchTracks(fetchParams),
    refetchInterval: autoUpdate ? 10_000 : false,
  });

  // When query data changes, merge new tracks at the top
  useEffect(() => {
    if (!tracksData) return;

    setTracks((prev) => {
      if (!hasLoadedMore.current || prev.length === 0) {
        // Initial load or fresh search: replace everything
        return tracksData.tracks;
      }

      // Merge: find new tracks not already in the list
      const existingIds = new Set(prev.map((t) => t.id));
      const newTracks = tracksData.tracks.filter((t) => !existingIds.has(t.id));
      return [...newTracks, ...prev];
    });

    if (!hasLoadedMore.current) {
      setHasMore(tracksData.tracks.length >= 100);
    }
  }, [tracksData]);

  // Reset load-more state when search params change
  const prevParamsRef = useRef(fetchParams);
  useEffect(() => {
    const paramsChanged =
      JSON.stringify(prevParamsRef.current) !== JSON.stringify(fetchParams);
    if (paramsChanged) {
      hasLoadedMore.current = false;
      prevParamsRef.current = fetchParams;
    }
  }, [fetchParams]);

  const toggleStation = (id: number) => {
    setSelectedStationIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/tracks",
      search: {
        stationIds:
          selectedStationIds.length > 0
            ? selectedStationIds.join(",")
            : undefined,
        query: query || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
  };

  const handleLoadMore = async () => {
    if (tracks.length === 0) return;
    const lastTrack = tracks[tracks.length - 1];
    setLoadingMore(true);
    try {
      const data = await fetchTracks({
        ...fetchParams,
        createdBefore: lastTrack.createdAt,
      });
      setTracks((prev) => [...prev, ...data.tracks]);
      setHasMore(data.tracks.length >= 100);
      hasLoadedMore.current = true;
    } finally {
      setLoadingMore(false);
    }
  };

  const handlePlayTrack = (track: TrackResponse) => {
    if (!track.previewUrl) return;
    toggle(`track-${track.id}`, track.previewUrl, {
      stationName: track.stationName,
      title: track.title,
      artist: track.artist,
      album: track.album,
      year: track.year,
      genre: track.genre,
      coverUrl: track.coverUrl,
    });
  };

  const handleToggleFavorite = async (track: TrackResponse) => {
    const wasFavorite = !!track.favoriteAt;

    // Optimistic UI update
    setTracks((prev) =>
      prev.map((t) =>
        t.id === track.id
          ? {
              ...t,
              favoriteAt: wasFavorite ? null : new Date().toISOString(),
            }
          : t
      )
    );

    try {
      if (wasFavorite) {
        await unfavoriteTrack(track.id);
      } else {
        await favoriteTrack(track.id);
      }
    } catch (error) {
      // Roll back on error
      setTracks((prev) =>
        prev.map((t) =>
          t.id === track.id
            ? {
                ...t,
                favoriteAt: track.favoriteAt,
              }
            : t
        )
      );
    }
  };

  const formatDate = (dateStr: string) => {
    // Backend returns UTC timestamps without timezone marker — append Z so
    // the browser interprets them as UTC and converts to local time.
    const date = new Date(dateStr.endsWith("Z") ? dateStr : dateStr + "Z");
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return date.toLocaleString([], {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Tracks</h1>

      {/* Filter row */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap gap-4 mb-6 items-end"
      >
        {/* Station multi-select */}
        <div className="flex flex-col gap-1">
          <span className="text-sm">Stations</span>
          <div className="dropdown">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-outline btn-sm gap-1 w-[200px] justify-between"
            >
              <span className="truncate text-left">
                {selectedStationIds.length === 0
                  ? "All stations"
                  : stationsData?.stations
                      .filter((s) => selectedStationIds.includes(s.id))
                      .map((s) => s.name)
                      .join(", ")}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0" />
            </div>
            <div
              tabIndex={0}
              className="dropdown-content bg-base-200 rounded-box z-10 w-56 p-2 shadow max-h-60 overflow-y-auto"
            >
              {stationsData?.stations.map((station) => (
                <label
                  key={station.id}
                  className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded hover:bg-base-300"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selectedStationIds.includes(station.id)}
                    onChange={() => toggleStation(station.id)}
                  />
                  <span className="text-sm">{station.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* From date */}
        <div className="flex flex-col gap-1">
          <span className="text-sm">From</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>

        {/* To date */}
        <div className="flex flex-col gap-1">
          <span className="text-sm">To</span>
          <input
            type="date"
            className="input input-bordered input-sm"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>

        {/* Query */}
        <div className="flex flex-col gap-1">
          <span className="text-sm">Search</span>
          <input
            type="text"
            className="input input-bordered input-sm"
            placeholder="Search tracks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Search button */}
        <button type="submit" className="btn btn-primary btn-sm">
          <Search className="h-4 w-4" />
          Search
        </button>

        {/* Auto-update toggle */}
        <label className="flex items-center gap-2 cursor-pointer self-end pb-1">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={autoUpdate}
            onChange={(e) => handleAutoUpdateChange(e.target.checked)}
          />
          <span className="text-sm">Auto-update</span>
        </label>
      </form>

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="flex justify-center py-12">
          <div className="alert alert-error max-w-md">
            <span>Failed to load tracks. Is the backend running?</span>
          </div>
        </div>
      )}

      {/* Tracks table */}
      {!isLoading && !error && (
        <>
          {tracks.length === 0 ? (
            <EmptyState
              icon={Music2}
              title="No tracks found"
              description="Start tracking stations or adjust your filter to see all tracks."
            />
          ) : (
            <>
              <div className="overflow-x-auto border border-base-300 rounded-box">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th />
                      <th>Station</th>
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Album</th>
                      <th>Year</th>
                      <th>Genre</th>
                      <th>Quality</th>
                      <th>Date</th>
                      <th />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((track) => {
                      const trackKey = `track-${track.id}`;
                      const isPlaying = playingId === trackKey;
                      const hasPreview = !!track.previewUrl;

                      return (
                        <tr
                          key={track.id}
                          className="hover:bg-base-300 transition-colors"
                        >
                          <td className="w-10 p-2">
                            <div
                              className={`relative w-14 h-14 shrink-0 ${
                                hasPreview ? "cursor-pointer" : ""
                              } group`}
                              onClick={() => handlePlayTrack(track)}
                            >
                              {track.coverUrl ? (
                                <img
                                  src={track.coverUrl}
                                  alt=""
                                  className="w-14 h-14 rounded object-cover"
                                />
                              ) : (
                                <div className="w-14 h-14 rounded bg-base-300" />
                              )}
                              {hasPreview && (
                                <div
                                  className={`absolute inset-0 rounded bg-black/40 flex items-center justify-center transition-opacity ${
                                    isPlaying
                                      ? "opacity-100"
                                      : "opacity-0 group-hover:opacity-100"
                                  }`}
                                >
                                  {isPlaying ? (
                                    <Pause className="h-5 w-5 text-white fill-white" />
                                  ) : (
                                    <Play className="h-5 w-5 text-white fill-white" />
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {track.stationLogoUrl ? (
                                <img
                                  src={track.stationLogoUrl}
                                  alt={track.stationName ?? "Station"}
                                  className="w-6 h-6 rounded object-cover border border-base-300"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-base-300" />
                              )}
                              <span>{track.stationName}</span>
                            </div>
                          </td>
                          <td className="font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-circle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(track);
                                }}
                                title={
                                  track.favoriteAt
                                    ? "Remove from favorites"
                                    : "Add to favorites"
                                }
                              >
                                <Star
                                  className="h-4 w-4"
                                  strokeWidth={2.2}
                                  color={track.favoriteAt ? "#facc15" : "#e5e7eb"}
                                  fill={track.favoriteAt ? "#facc15" : "none"}
                                />
                              </button>
                              <span>{track.title}</span>
                            </div>
                          </td>
                          <td>{track.artist}</td>
                          <td>{track.album}</td>
                          <td>{track.year}</td>
                          <td>
                            {track.genre && (
                              <span className="badge badge-sm">{track.genre}</span>
                            )}
                          </td>
                          <td>
                            {track.confidenceScore != null ? (
                              <span className="badge badge-outline">
                                {Math.round(track.confidenceScore)}%
                              </span>
                            ) : (
                              <span className="opacity-40">-</span>
                            )}
                          </td>
                          <td className="text-sm whitespace-nowrap">
                            {formatDate(track.createdAt)}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center gap-2">
                              {track.shazamUrl && (
                                <a
                                  href={track.shazamUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-ghost btn-xs btn-circle"
                                  title="More info"
                                >
                                  <InfoIcon className="w-5 h-5" />
                                </a>
                              )}
                              <a
                                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${track.title} ${track.artist ?? ""}`.trim())}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-xs btn-circle"
                                title="Search on YouTube"
                              >
                                <Youtube className="w-5 h-5 text-[#FF0000]" />
                              </a>
                            </div>
                          </td>
                          <td className="w-10 p-2">
                            <div className="dropdown dropdown-end">
                              <div
                                tabIndex={0}
                                role="button"
                                className="btn btn-ghost btn-xs btn-circle"
                              >
                                <EllipsisVertical className="h-4 w-4" />
                              </div>
                              <ul
                                tabIndex={0}
                                className="dropdown-content menu menu-sm bg-base-100 rounded-box z-10 w-36 p-2 shadow"
                              >
                                <li>
                                  <button
                                    className="text-error"
                                    onClick={() => setDeleteTarget(track)}
                                  >
                                    Delete
                                  </button>
                                </li>
                              </ul>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="flex justify-center mt-6">
                  <button
                    className="btn btn-outline"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore && (
                      <span className="loading loading-spinner loading-sm" />
                    )}
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
      <DeleteConfirmDialog
        title="Delete Track"
        message={`Are you sure you want to delete "${deleteTarget?.title ?? ""}" by ${deleteTarget?.artist ?? "unknown artist"}? This action cannot be undone.`}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
