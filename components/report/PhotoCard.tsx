"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { toLocalInputValue, type GeoFix } from "@/lib/image";
import { PinIcon } from "../icons";

export type DraftPhoto = {
  key: string;
  blob: Blob;
  previewUrl: string;
  source: "camera" | "upload";
  capturedAt: Date;
  fix: GeoFix | null;
  /** Set once uploaded, so a retried submit doesn't upload it again. */
  blobUrl?: string;
};

type Props = {
  photo: DraftPhoto;
  disabled: boolean;
  onRemove: () => void;
  onTimeChange: (localValue: string) => void;
  onLocate: () => Promise<string | null>;
  onClearLocation: () => void;
};

export function PhotoCard({ photo, disabled, onRemove, onTimeChange, onLocate, onClearLocation }: Props) {
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const isCamera = photo.source === "camera";
  const validTime = !Number.isNaN(photo.capturedAt.getTime());

  async function locate() {
    setLocating(true);
    setLocError(await onLocate());
    setLocating(false);
  }

  return (
    <li className="flex gap-3 rounded-xl border border-line bg-surface p-2.5">
      <a href={photo.previewUrl} target="_blank" rel="noreferrer" className="shrink-0">
        <img src={photo.previewUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
      </a>
      <div className="min-w-0 flex-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              isCamera ? "bg-brand/10 text-brand" : "bg-teal/10 text-[#0b6e6e]"
            }`}
          >
            {isCamera && <PinIcon className="h-3 w-3" />}
            {isCamera ? "Camera" : "Uploaded"}
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label="Remove photo"
            className="-mt-1 -mr-1 flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-danger"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {isCamera ? (
          <div className="mt-1 space-y-0.5 text-xs text-muted">
            <p className="text-ink">{formatDateTime(photo.capturedAt)}</p>
            {photo.fix && (
              <p className="truncate">
                {photo.fix.latitude.toFixed(5)}, {photo.fix.longitude.toFixed(5)} · ±{Math.round(photo.fix.accuracy)} m
              </p>
            )}
          </div>
        ) : (
          <div className="mt-1.5 space-y-1.5">
            <label className="block text-xs text-muted">
              Date and time taken
              <input
                type="datetime-local"
                className="field mt-0.5 !px-2 !py-1.5 !text-sm"
                value={validTime ? toLocalInputValue(photo.capturedAt) : ""}
                max={toLocalInputValue(new Date())}
                onChange={(e) => onTimeChange(e.target.value)}
                disabled={disabled}
                aria-invalid={!validTime ? true : undefined}
              />
            </label>
            {photo.fix ? (
              <p className="flex items-center gap-1 text-xs text-muted">
                <PinIcon className="h-3 w-3 shrink-0 text-brand" />
                <span className="truncate">
                  {photo.fix.latitude.toFixed(5)}, {photo.fix.longitude.toFixed(5)}
                </span>
                <button type="button" onClick={onClearLocation} disabled={disabled} className="ml-auto shrink-0 font-medium text-brand hover:underline">
                  Clear
                </button>
              </p>
            ) : (
              <button type="button" onClick={locate} disabled={disabled || locating} className="text-xs font-medium text-brand hover:underline disabled:opacity-60">
                {locating ? "Getting location…" : "+ Add my current location (optional)"}
              </button>
            )}
            {locError && <p className="text-xs text-danger">{locError}</p>}
          </div>
        )}
      </div>
    </li>
  );
}
