"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { canvasToJpeg, drawFile, drawVideoFrame, getLocation, LocationError, stampCanvas, type GeoFix } from "@/lib/image";

export type CameraPhoto = { blob: Blob; capturedAt: Date; fix: GeoFix };

type Phase =
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "cameraError"; message: string }
  | { kind: "locating" }
  | { kind: "locationError"; message: string };

type Props = {
  companyName: string;
  /** Set when the browser has no getUserMedia and the phone's camera app was used instead. */
  initialFile?: File;
  onCapture: (photo: CameraPhoto) => void;
  onClose: () => void;
};

const hasLiveCamera = () => typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
const NO_LIVE_CAMERA = "This browser cannot open the camera inside the app.";

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera permission is blocked. Allow camera access for this site in your browser settings, then tap Retry.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is being used by another app. Close it and tap Retry.";
  return "The camera could not be started.";
}

export function CameraCapture({ companyName, initialFile, onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturedAtRef = useRef<Date | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [phase, setPhase] = useState<Phase>(() =>
    initialFile ? { kind: "locating" } : hasLiveCamera() ? { kind: "starting" } : { kind: "cameraError", message: NO_LIVE_CAMERA },
  );
  const [canSwitch, setCanSwitch] = useState(false);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Callers set phase to "starting" first (the mount effect relies on the initial state).
  const startStream = useCallback(
    async (mode: "environment" | "user") => {
      stopStream();
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setPhase({ kind: "live" });
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
      } catch (err) {
        setPhase({ kind: "cameraError", message: cameraErrorMessage(err) });
      }
    },
    [stopStream],
  );

  /** Location is mandatory for camera photos: stamp and hand back only once we have a fix. */
  const locateAndFinish = useCallback(async () => {
    const canvas = canvasRef.current;
    const capturedAt = capturedAtRef.current;
    if (!canvas || !capturedAt) return;
    setPhase({ kind: "locating" });
    try {
      const fix = await getLocation(10_000);
      // Stamp a copy so the clean frame stays available if encoding fails.
      const out = document.createElement("canvas");
      out.width = canvas.width;
      out.height = canvas.height;
      out.getContext("2d")!.drawImage(canvas, 0, 0);
      stampCanvas(out, { companyName, capturedAt, fix });
      const blob = await canvasToJpeg(out);
      stopStream();
      onCapture({ blob, capturedAt, fix });
    } catch (err) {
      setPhase({
        kind: "locationError",
        message: err instanceof LocationError ? err.message : "Could not finish the photo. Please retake it.",
      });
    }
  }, [companyName, onCapture, stopStream]);

  useEffect(() => {
    // Ask for location as soon as the camera opens: this shows the permission
    // prompt early and warms up GPS so the fix at capture is quicker.
    getLocation(60_000).catch((err) => {
      if (err instanceof LocationError && err.denied) setLocationWarning(err.message);
    });

    if (initialFile) {
      capturedAtRef.current = new Date();
      const canvas = canvasRef.current!;
      drawFile(initialFile, canvas)
        .then(locateAndFinish)
        .catch((err: Error) => setPhase({ kind: "cameraError", message: err.message }));
    } else if (hasLiveCamera()) {
      // State only changes after getUserMedia resolves, not synchronously.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startStream("environment");
    }
    return stopStream;
    // Run once on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function shoot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    capturedAtRef.current = new Date();
    drawVideoFrame(video, canvas);
    video.pause();
    locateAndFinish();
  }

  function retake() {
    capturedAtRef.current = null;
    if (initialFile) return onClose();
    restart(facing);
  }

  function restart(mode: "environment" | "user") {
    setPhase({ kind: "starting" });
    startStream(mode);
  }

  function switchCamera() {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    restart(next);
  }

  function onFallbackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    stopStream();
    capturedAtRef.current = new Date();
    setPhase({ kind: "locating" });
    drawFile(file, canvasRef.current!)
      .then(locateAndFinish)
      .catch((err: Error) => setPhase({ kind: "cameraError", message: err.message }));
  }

  const frozen = phase.kind === "locating" || phase.kind === "locationError";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Take photo">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={onClose} className="btn !min-h-0 !px-3 !py-1.5 text-sm text-white/90 hover:bg-white/10">
          Cancel
        </button>
        <span className="text-sm font-medium text-white/80">Photo with location</span>
        <span className="w-16" />
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-contain ${frozen || phase.kind === "cameraError" ? "hidden" : ""} ${facing === "user" ? "-scale-x-100" : ""}`}
        />
        <canvas ref={canvasRef} className={`max-h-full max-w-full object-contain ${frozen ? "" : "hidden"}`} />

        {phase.kind === "starting" && <p className="absolute text-sm text-white/80">Starting camera…</p>}

        {phase.kind === "locating" && (
          <div className="absolute inset-x-4 bottom-4 flex items-center gap-3 rounded-xl bg-black/70 px-4 py-3 text-sm">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Getting your location…
          </div>
        )}

        {phase.kind === "locationError" && (
          <div className="absolute inset-x-4 bottom-4 rounded-xl bg-white p-4 text-ink shadow-lg" role="alert">
            <p className="font-semibold text-danger">Location needed</p>
            <p className="mt-1 text-sm">{phase.message}</p>
            <p className="mt-1 text-xs text-muted">Camera photos cannot be added without location.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={locateAndFinish} className="btn btn-primary flex-1">
                Retry
              </button>
              <button type="button" onClick={retake} className="btn btn-secondary flex-1">
                Retake
              </button>
            </div>
          </div>
        )}

        {phase.kind === "cameraError" && (
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-5 text-ink" role="alert">
            <p className="font-semibold text-danger">Camera unavailable</p>
            <p className="mt-1 text-sm">{phase.message}</p>
            <div className="mt-4 flex flex-col gap-2">
              {hasLiveCamera() && (
                <button type="button" onClick={() => restart(facing)} className="btn btn-primary">
                  Retry
                </button>
              )}
              <label className="btn btn-secondary">
                Use phone camera app
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFallbackFile} />
              </label>
            </div>
          </div>
        )}

        {locationWarning && phase.kind === "live" && (
          <div className="absolute inset-x-4 top-3 rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900" role="status">
            {locationWarning}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-10 px-4 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <span className="w-12" />
        <button
          type="button"
          onClick={shoot}
          disabled={phase.kind !== "live"}
          aria-label="Capture photo"
          className="h-18 w-18 rounded-full border-4 border-white bg-white/20 transition active:scale-95 disabled:opacity-40"
        />
        {canSwitch && phase.kind === "live" ? (
          <button
            type="button"
            onClick={switchCamera}
            aria-label="Switch camera"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 7h-3l-2-3H9L7 7H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Z" />
              <path d="M9 13.5a3 3 0 0 1 5.2-2M15 12.5a3 3 0 0 1-5.2 2" />
              <path d="M14.5 9.5v2h-2M9.5 16.5v-2h2" />
            </svg>
          </button>
        ) : (
          <span className="w-12" />
        )}
      </div>
    </div>
  );
}
