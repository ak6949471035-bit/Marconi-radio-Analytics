import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Music,
  Play,
  Pause,
  EllipsisVertical,
  Plus,
  Star,
  Radio,
  Youtube,
} from "lucide-react";
import { useState } from "react";
import {
  fetchStations,
  createStation,
  updateStation,
  deleteStation,
  favoriteTrack,
  unfavoriteTrack,
} from "../data/api";
import { useAudioPlayer } from "../components/AudioPlayerContext";
import StationDialog from "../components/StationDialog";
import DeleteConfirmDialog from "../components/DeleteConfirmDialog";
import EmptyState from "../components/EmptyState";
import type { StationResponse } from "../data/api";
import type { StationFormData } from "../components/StationDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Stations | Station Tracker" }],
  }),
  component: StationsPage,
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
}function StationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["stations"],
    queryFn: fetchStations,
    refetchInterval: 10_000,
  });

  const { playingId, toggle, stop } = useAudioPlayer();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<StationResponse | null>(
    null
  );
  const [deleteTarget, setDeleteTarget] = useState<StationResponse | null>(
    null
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["stations"] });

  type UpdateStationVariables = {
    id: number;
    data: StationFormData;
    urlChanged: boolean;
  };

  const createMutation = useMutation({
    mutationFn: createStation,
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: UpdateStationVariables) =>
      updateStation(id, data),
    onSuccess: (_data, { id, urlChanged }: UpdateStationVariables) => {
      if (urlChanged && playingId === `station-${id}`) {
        stop();
      }
      invalidate();
      setDialogOpen(false);
      setEditingStation(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteStation,
    onSuccess: (_data, id) => {
      if (playingId === `station-${id}`) {
        stop();
      }
      invalidate();
      setDeleteTarget(null);
    },
  });

  const handleAdd = () => {
    setEditingStation(null);
    setDialogOpen(true);
  };

  const handleEdit = (station: StationResponse) => {
    setEditingStation(station);
    setDialogOpen(true);
  };

  const handleDialogSubmit = (formData: StationFormData) => {
    if (editingStation) {
      const urlChanged = editingStation.url !== formData.url;
      updateMutation.mutate({ id: editingStation.id, data: formData, urlChanged });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingStation(null);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="alert alert-error max-w-md">
          <span>Failed to load stations. Is the backend running?</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Stations</h1>
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
      {data?.stations.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No stations yet"
          description="Get started by adding your first radio station to track music."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {data?.stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              isPlaying={playingId === `station-${station.id}`}
              onTogglePlay={() =>
                toggle(`station-${station.id}`, station.url, {
                  stationName: station.name,
                  ...(station.currentTrack && {
                    title: station.currentTrack.title,
                    artist: station.currentTrack.artist,
                    album: station.currentTrack.album,
                    year: station.currentTrack.year,
                    genre: station.currentTrack.genre,
                    coverUrl: station.currentTrack.coverUrl,
                  }),
                })
              }
              onEdit={() => handleEdit(station)}
              onDelete={() => setDeleteTarget(station)}
            />
          ))}
        </div>
      )}

      <StationDialog
        station={editingStation}
        open={dialogOpen}
        onClose={handleDialogClose}
        onSubmit={handleDialogSubmit}
      />

      <DeleteConfirmDialog
        title="Delete Station"
        message={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This will also delete all tracked songs for this station. This action cannot be undone.`}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}

function StationCard({
  station,
  isPlaying,
  onTogglePlay,
  onEdit,
  onDelete,
}: {
  station: StationResponse;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const queryClient = useQueryClient();
  const track = station.currentTrack;
  const isFavorite = !!track?.favoriteAt;
  const [showShazamDetails, setShowShazamDetails] = useState(false);

  return (
    <div
      className={`relative flex flex-col bg-base-200 rounded-box shadow-md hover:shadow-lg hover:scale-[1.02] transition-all duration-200 overflow-hidden ${isFavorite ? "ring-2 ring-amber-400" : ""}`}
    >
      <div
        className="w-full aspect-square relative cursor-pointer group"
        onClick={onTogglePlay}
      >
        {track?.coverUrl ? (
          <img
            src={track.coverUrl}
            alt={`${track.title} cover`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-base-300 flex items-center justify-center">
            <Music className="h-8 w-8 opacity-30" />
          </div>
        )}
        <div
          className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity ${
            isPlaying ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isPlaying ? (
            <Pause className="h-8 w-8 text-white fill-white" />
          ) : (
            <Play className="h-8 w-8 text-white fill-white" />
          )}
        </div>
      </div>
      <div className="flex-1 min-w-0 p-3 pb-4 flex flex-col gap-1">
        <div className="flex items-start justify-between gap-1">
          <div className="flex items-center gap-2 min-w-0">
            {station.logoUrl ? (
              <img
                src={station.logoUrl}
                alt={`${station.name} logo`}
                className="w-7 h-7 rounded-md object-cover border border-base-300 shrink-0"
              />
            ) : (
              <div className="w-7 h-7 rounded-md bg-base-300 shrink-0" />
            )}
            <Link
              to="/tracks"
              search={{ stationIds: String(station.id) }}
              className="text-base font-semibold hover:underline leading-snug truncate"
            >
              {station.name}
            </Link>
          </div>
          <div className="dropdown dropdown-end shrink-0">
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
                <button onClick={onEdit}>Edit</button>
              </li>
              <li>
                <button className="text-error" onClick={onDelete}>
                  Delete
                </button>
              </li>
            </ul>
          </div>
        </div>
        {track ? (
          <>
            <p className="text-sm font-medium leading-snug">{track.title}</p>
            {track.artist && <p className="text-sm opacity-80">Artist: {track.artist}</p>}
            {track.album && <p className="text-sm opacity-70">Album: {track.album}</p>}
            {track.year && <p className="text-sm opacity-70">Year: {track.year}</p>}
            {track.genre && <p className="text-sm opacity-70">Genre: {track.genre}</p>}
            {track.shazamUrl && (
              <button
                type="button"
                className="inline-flex items-center gap-2 text-xs text-info hover:underline w-fit"
                onClick={() => setShowShazamDetails(true)}
              >
                <InfoIcon className="w-4 h-4" />
                Track details
              </button>
            )}
          </>
        ) : (
          <p className="text-sm opacity-40 italic">No track detected</p>
        )}
        {station.errorMessage && (
          <p className="text-xs text-error">{station.errorMessage}</p>
        )}
      </div>
      {track && (
        <>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle absolute bottom-2 right-2"
            onClick={async (e) => {
              e.stopPropagation();
              try {
                if (track.favoriteAt) {
                  await unfavoriteTrack(track.id);
                } else {
                  await favoriteTrack(track.id);
                }
                queryClient.invalidateQueries({ queryKey: ["stations"] });
                queryClient.invalidateQueries({ queryKey: ["tracks"] });
                queryClient.invalidateQueries({ queryKey: ["favorite-tracks"] });
              } catch {
                // ignore error; other views will reflect true state
              }
            }}
            title={
              track.favoriteAt ? "Remove from favorites" : "Add to favorites"
            }
          >
            <Star
              className="h-4 w-4"
              strokeWidth={2.2}
              color={track.favoriteAt ? "#facc15" : "#e5e7eb"}
              fill={track.favoriteAt ? "#facc15" : "none"}
            />
          </button>
          <ShazamDetailsDialog
            open={showShazamDetails}
            onClose={() => setShowShazamDetails(false)}
            stationName={station.name}
            logoUrl={station.logoUrl}
            track={track}
          />
        </>
      )}
    </div>
  );
}

function ShazamDetailsDialog({
  open,
  onClose,
  stationName,
  logoUrl,
  track,
}: {
  open: boolean;
  onClose: () => void;
  stationName: string;
  logoUrl: string | null;
  track: NonNullable<StationResponse["currentTrack"]>;
}) {
  return (
    <dialog className={`modal ${open ? "modal-open" : ""}`}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-3">Track details</h3>
        <div className="flex items-start gap-3 mb-3">
          {track.coverUrl ? (
            <img
              src={track.coverUrl}
              alt={track.title}
              className="w-20 h-20 rounded-lg object-cover border border-base-300"
            />
          ) : (
            <div className="w-20 h-20 rounded-lg bg-base-300" />
          )}
          <div className="min-w-0">
            <p className="font-semibold leading-tight">{track.title}</p>
            {track.artist && <p className="text-sm opacity-80">{track.artist}</p>}
            <div className="flex items-center gap-2 mt-2">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={stationName}
                  className="w-5 h-5 rounded object-cover border border-base-300"
                />
              ) : (
                <div className="w-5 h-5 rounded bg-base-300" />
              )}
              <span className="text-xs opacity-70">{stationName}</span>
            </div>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <p><span className="opacity-70">Album:</span> {track.album ?? "-"}</p>
          <p><span className="opacity-70">Year:</span> {track.year ?? "-"}</p>
          <p><span className="opacity-70">Genre:</span> {track.genre ?? "-"}</p>
          <p>
            <span className="opacity-70">Quality:</span>{" "}
            {track.confidenceScore != null ? `${Math.round(track.confidenceScore)}%` : "-"}
          </p>
        </div>
        <div className="modal-action">
          {track.shazamUrl && (
            <a
              href={track.shazamUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-info btn-sm"
            >
              <InfoIcon className="w-4 h-4" />
              Open Info
            </a>
          )}
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
              `${track.title} ${track.artist ?? ""}`.trim()
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            <Youtube className="w-4 h-4 text-[#FF0000]" />
            YouTube
          </a>
          <button type="button" className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
