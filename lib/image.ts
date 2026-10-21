// Browser-only helpers for the report form: resize, stamp, encode, locate.
import { JPEG_QUALITY, MAX_LONG_EDGE, TIME_ZONE } from "./limits";

export type GeoFix = { latitude: number; longitude: number; accuracy: number };

type Drawable = { source: CanvasImageSource; width: number; height: number; close?: () => void };

/** Decode a picked/captured file. EXIF orientation is applied for display only; its date and GPS are ignored. */
async function decodeFile(file: Blob): Promise<Drawable> {
  if ("createImageBitmap" in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>, e.g. older Safari
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    throw new Error("This image could not be read. Please choose a JPEG or PNG photo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Draw onto `canvas`, scaling the long edge down to MAX_LONG_EDGE. */
function drawScaled(d: Drawable, canvas: HTMLCanvasElement): void {
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(d.width, d.height));
  canvas.width = Math.round(d.width * scale);
  canvas.height = Math.round(d.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(d.source, 0, 0, canvas.width, canvas.height);
}

export function drawVideoFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): void {
  drawScaled({ source: video, width: video.videoWidth, height: video.videoHeight }, canvas);
}

export async function drawFile(file: Blob, canvas: HTMLCanvasElement): Promise<void> {
  const d = await decodeFile(file);
  try {
    drawScaled(d, canvas);
  } finally {
    d.close?.();
  }
}

export function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the photo."))), "image/jpeg", JPEG_QUALITY),
  );
}

export async function compressFile(file: Blob): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await drawFile(file, canvas);
  return canvasToJpeg(canvas);
}

const stampTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

/** Burns a strip along the bottom: company, date and time, coordinates. */
export function stampCanvas(canvas: HTMLCanvasElement, opts: { companyName: string; capturedAt: Date; fix: GeoFix }): void {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const font = Math.max(14, Math.round(Math.min(width, height) * 0.032));
  const pad = Math.round(font * 0.7);
  const lineH = Math.round(font * 1.3);
  const lines = [
    opts.companyName.trim() || "Industry visit",
    `${stampTime.format(opts.capturedAt)} IST`,
    `Lat ${opts.fix.latitude.toFixed(6)}, Lng ${opts.fix.longitude.toFixed(6)}  ±${Math.round(opts.fix.accuracy)} m`,
  ];
  const stripH = pad * 2 + lineH * lines.length;

  ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
  ctx.fillRect(0, height - stripH, width, stripH);
  ctx.fillStyle = "#176dae";
  ctx.fillRect(0, height - stripH, Math.max(4, Math.round(font * 0.25)), stripH);

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  const maxW = width - pad * 3;
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? "700" : "500"} ${font}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    let text = line;
    while (text.length > 4 && ctx.measureText(text).width > maxW) text = text.slice(0, -2);
    if (text !== line) text = `${text.trimEnd()}…`;
    ctx.fillText(text, pad * 2, height - stripH + pad + i * lineH);
  });
}

export class LocationError extends Error {
  constructor(
    message: string,
    public denied: boolean,
  ) {
    super(message);
  }
}

function currentPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, options));
}

/**
 * Tries a GPS-grade fix first. Laptops and indoor phones often can't get one,
 * so on timeout or "unavailable" it falls back to a network (Wi-Fi) fix, whose
 * accuracy is still recorded on the photo.
 */
export async function getLocation(maximumAge = 0): Promise<GeoFix> {
  if (!("geolocation" in navigator)) throw new LocationError("This browser cannot share your location.", false);
  let pos: GeolocationPosition;
  try {
    pos = await currentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge });
  } catch (first) {
    const err = first as GeolocationPositionError;
    if (err.code === err.PERMISSION_DENIED) throw deniedError();
    try {
      pos = await currentPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: Math.max(maximumAge, 60_000) });
    } catch (second) {
      const err2 = second as GeolocationPositionError;
      if (err2.code === err2.PERMISSION_DENIED) throw deniedError();
      throw new LocationError(
        "Couldn't get your location. Check that Location is turned on (on a Mac: System Settings › Privacy & Security › Location Services, and allow your browser), then tap Retry.",
        false,
      );
    }
  }
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

function deniedError() {
  return new LocationError(
    "Location permission is blocked. Allow location for this site in your browser settings (and turn on Location on your phone), then tap Retry.",
    true,
  );
}

/** "yyyy-MM-ddTHH:mm" in the device's local time, for <input type="datetime-local">. */
export function toLocalInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
