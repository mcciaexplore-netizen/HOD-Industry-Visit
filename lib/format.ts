import { TIME_ZONE } from "./limits";

const dateTime = new Intl.DateTimeFormat("en-IN", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const dateOnly = new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, day: "2-digit", month: "short", year: "numeric" });

export function formatDateTime(d: Date | string): string {
  return dateTime.format(new Date(d));
}

export function formatDate(d: Date | string): string {
  return dateOnly.format(new Date(d));
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
