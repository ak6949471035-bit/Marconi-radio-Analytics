import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Search, Play, Pause, Star, Youtube, Heart } from "lucide-react";

import { fetchFavoriteTracks, unfavoriteTrack } from "../data/api";
import type { FetchFavoriteTracksParams, TrackResponse } from "../data/api";
import { useAudioPlayer } from "../components/AudioPlayerContext";
import EmptyState from "../components/EmptyState";

interface FavoritesSearch {
  query?: string;
  from?: string;
  to?: string;
}

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [{ title: "Favorite Tracks | Station Tracker" }],
  }),
  validateSearch: (search: Record<string, unknown>): FavoritesSearch => ({
    query: search.query as string | undefined,
    from: search.from as string | undefined,
    to: search.to as string | undefined,
  }),
  component: FavoritesPage,
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
}function FavoritesPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { playingId, toggle } = useAudioPlayer();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState(search.query || "");
  const [from, setFrom] = useState(search.from || "");
  const [to, setTo] = useState(search.to || "");

  const [tracks, setTracks] = useState<TrackResponse[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchParams: FetchFavoriteTracksParams = {
    query: search.query,
    from: search.from,
    to: search.to,
  };

  const hasLoadedMore = useRef(false);

  const {
    data: tracksData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["favorite-tracks", fetchParams],
    queryFn: () => fetchFavoriteTracks(fetchParams),
  });

  useEffect(() => {
    if (!tracksData) return;

    setTracks((prev) => {
      if (!hasLoadedMore.current || prev.length === 0) {
        return tracksData.tracks;
      }

      const existingIds = new Set(prev.map((t) => t.id));
      const newTracks = tracksData.tracks.filter((t) => !existingIds.has(t.id));
      return [...newTracks, ...prev];
    });

    if (!hasLoadedMore.current) {
      setHasMore(tracksData.tracks.length >= 100);
    }
  }, [tracksData]);

  const prevParamsRef = useRef(fetchParams);
  useEffect(() => {
    const paramsChanged =
      JSON.stringify(prevParamsRef.current) !== JSON.stringify(fetchParams);
    if (paramsChanged) {
      hasLoadedMore.current = false;
      prevParamsRef.current = fetchParams;
    }
  }, [fetchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/favorites",
      search: {
        query: query || undefined,
        from: from || undefined,
        to: to || undefined,
      },
    });
  };

  const handleLoadMore = async () => {
    if (tracks.length === 0) return;
    const lastTrack = tracks[tracks.length - 1];
    if (!lastTrack.favoriteAt) return; // Safety check - should not happen for favorites
    setLoadingMore(true);
    try {
      const data = await fetchFavoriteTracks({
        ...fetchParams,
        favoritedBefore: lastTrack.favoriteAt,
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
    const originalFavoriteAt = track.favoriteAt;

    // Optimistic remove from UI
    setTracks((prev) => prev.filter((t) => t.id !== track.id));

    try {
      await unfavoriteTrack(track.id);
      // Refresh favorites query in background
      queryClient.invalidateQueries({ queryKey: ["favorite-tracks"] });
    } catch (error) {
      // Rollback on error
      setTracks((prev) => {
        const exists = prev.find((t) => t.id === track.id);
        if (exists) return prev;
        return [
          ...prev,
          {
            ...track,
            favoriteAt: originalFavoriteAt,
          },
        ];
      });
    }
  };

  const formatDate = (dateStr: string) => {
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
      <h1 className="text-3xl font-bold mb-6">Favorite Tracks</h1>

      {/* Filter row (same fields as tracks page, without station + auto-update) */}
      <form
        onSubmit={handleSearch}
        className="flex flex-wrap gap-4 mb-6 items-end"
      >
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
            placeholder="Search favorite tracks..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Search button */}
        <button type="submit" className="btn btn-primary btn-sm">
          <Search className="h-4 w-4" />
          Search
        </button>
      </form>

      {isLoading && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {error && (
        <div className="flex justify-center py-12">
          <div className="alert alert-error max-w-md">
            <span>Failed to load favorite tracks. Is the backend running?</span>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {tracks.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="No favorite tracks yet"
              description="Favorite tracks from the stations or tracks page to see them here."
            />
          ) : (
            <>
              <div className="overflow-x-auto border border-base-300 rounded-box">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th />
                      <th>Title</th>
                      <th>Artist</th>
                      <th>Album</th>
                      <th>Year</th>
                      <th>Genre</th>
                      <th>Total plays</th>
                      <th>Favorited</th>
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
                          <td className="font-medium">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-circle"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleFavorite(track);
                                }}
                                title="Remove from favorites"
                              >
                                <Star
                                  className="h-4 w-4 text-yellow-400"
                                  fill="currentColor"
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
                          <td className="text-sm tabular-nums">
                            {(track.totalPlays ?? 0).toLocaleString()}
                          </td>
                          <td className="text-sm whitespace-nowrap">
                            {track.favoriteAt
                              ? formatDate(track.favoriteAt)
                              : formatDate(track.createdAt)}
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
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

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
    </div>
  );
}
