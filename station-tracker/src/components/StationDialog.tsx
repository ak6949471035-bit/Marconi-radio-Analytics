import { useEffect, useRef, useState } from "react";
import type { StationResponse } from "../data/api";
import { uploadStationLogo } from "../data/api";
import { Info } from "lucide-react";

export interface StationFormData {
  name: string;
  url: string;
  logoUrl: string;
  enabled: boolean;
  interval: number;
  skipSeconds: number;
}

interface StationDialogProps {
  station: StationResponse | null;
  open: boolean;
  onClose: () => void;
  onSubmit: (data: StationFormData) => void;
}

const defaults: StationFormData = {
  name: "",
  url: "",
  logoUrl: "",
  enabled: true,
  interval: 60,
  skipSeconds: 0,
};

export default function StationDialog({
  station,
  open,
  onClose,
  onSubmit,
}: StationDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState<StationFormData>(defaults);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(
        station
          ? {
              name: station.name,
              url: station.url,
              logoUrl: station.logoUrl ?? "",
              enabled: station.enabled,
              interval: station.interval,
              skipSeconds: station.skipSeconds,
            }
          : defaults
      );
      setUploadError(null);
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [open, station]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadingLogo(true);
    try {
      const url = await uploadStationLogo(file);
      setForm((prev) => ({ ...prev, logoUrl: url }));
    } catch {
      setUploadError("Logo upload failed. Try another image.");
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  return (
    <dialog ref={dialogRef} className="modal" onClose={onClose}>
      <div className="modal-box">
        <h3 className="font-bold text-lg mb-4">
          {station ? "Edit Station" : "Add Station"}
        </h3>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3"
        >
          <label className="label justify-end">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <label className="label justify-end">
            <span className="label-text">Stream URL</span>
          </label>
          <input
            type="url"
            className="input input-bordered w-full"
            required
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />

          <label className="label justify-end">
            <span className="label-text">Logo</span>
          </label>
          <div className="space-y-2">
            <input
              type="file"
              className="file-input file-input-bordered w-full"
              accept="image/*"
              onChange={handleLogoChange}
              disabled={uploadingLogo}
            />
            <div className="flex items-center gap-2">
              {form.logoUrl ? (
                <>
                  <img
                    src={form.logoUrl}
                    alt="Station logo preview"
                    className="w-10 h-10 rounded object-cover border border-base-300"
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => setForm((prev) => ({ ...prev, logoUrl: "" }))}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <span className="text-xs opacity-60">No logo uploaded</span>
              )}
              {uploadingLogo && (
                <span className="loading loading-spinner loading-sm" />
              )}
            </div>
            {uploadError && <p className="text-xs text-error">{uploadError}</p>}
          </div>

          <label className="label justify-end">
            <span className="label-text">Interval (s)</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            required
            min={30}
            max={86400}
            value={form.interval}
            onChange={(e) =>
              setForm({ ...form, interval: Number(e.target.value) })
            }
          />

          <label className="label justify-end">
            <span className="label-text">Skip first (s)</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            required
            min={0}
            max={90}
            value={form.skipSeconds}
            onChange={(e) =>
              setForm({ ...form, skipSeconds: Number(e.target.value) })
            }
          />

          <div />
          <div className="flex items-start gap-2 text-xs opacity-60">
            <Info className="h-16 w-16 mt-[2px]" aria-hidden="true" />
            <p>
              Controls how many seconds Station Tracker skips before sampling
              the stream for track detection. Some radio stations inject ads at
              the beginning of the stream. Increase this value to optimize track
              recognition.
            </p>
          </div>

          <label className="label justify-end">
            <span className="label-text">Enabled</span>
          </label>
          <div>
            <input
              type="checkbox"
              className="toggle"
              checked={form.enabled}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
          </div>

          <div className="col-span-2 modal-action">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {station ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  );
}
