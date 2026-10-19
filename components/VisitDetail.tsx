import { formatDateTime, mapsUrl } from "@/lib/format";
import type { VisitDetailData } from "@/lib/visits";
import { PinIcon } from "./icons";

export function VisitDetail({ visit, showHod = false }: { visit: VisitDetailData; showHod?: boolean }) {
  const located = visit.photos.find((p) => p.latitude !== null && p.longitude !== null);
  return (
    <div className="space-y-4">
      <div>
        <p className="section-label">Industry Visit</p>
        <h1 className="mt-0.5 text-2xl font-bold break-words">{visit.companyName}</h1>
        <p className="mt-1 text-sm text-muted">Submitted {formatDateTime(visit.createdAt)}</p>
        {located && (
          <a
            href={mapsUrl(located.latitude!, located.longitude!)}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary mt-3 !min-h-0 !py-2 text-sm"
          >
            <PinIcon className="h-4 w-4" /> Open in Google Maps
          </a>
        )}
      </div>

      {showHod && (
        <section className="card p-4">
          <p className="section-label">Reported By</p>
          <p className="mt-1.5 font-medium">{visit.hodName}</p>
          <p className="text-sm text-muted">
            {visit.department || "No department"} · {visit.hodEmail}
          </p>
        </section>
      )}

      <section className="card p-4">
        <p className="section-label">Accompanying Members</p>
        {visit.accompanyingMembers.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {visit.accompanyingMembers.map((m) => (
              <li key={m} className="chip !pr-3">
                {m}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-sm text-muted">None</p>
        )}
      </section>

      <section className="card p-4">
        <p className="section-label">Purpose of Visit</p>
        <p className="mt-1.5 whitespace-pre-wrap break-words">{visit.purpose}</p>
      </section>

      <section className="card p-4">
        <p className="section-label">Photos ({visit.photos.length})</p>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visit.photos.map((p) => {
            const hasLoc = p.latitude !== null && p.longitude !== null;
            return (
              <li key={p.id} className="overflow-hidden rounded-xl border border-line">
                <a href={p.blobUrl} target="_blank" rel="noreferrer">
                  <img src={p.blobUrl} alt={`Photo at ${visit.companyName}`} loading="lazy" className="aspect-[4/3] w-full bg-background object-cover" />
                </a>
                <div className="space-y-1 p-3 text-sm">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.source === "camera" ? "bg-brand/10 text-brand" : "bg-teal/10 text-[#0b6e6e]"
                    }`}
                  >
                    {p.source === "camera" && <PinIcon className="h-3 w-3" />}
                    {p.source === "camera" ? "Camera" : "Uploaded"}
                  </span>
                  <p>{formatDateTime(p.capturedAt)}</p>
                  {hasLoc && (
                    <a href={mapsUrl(p.latitude!, p.longitude!)} target="_blank" rel="noreferrer" className="block truncate text-brand hover:underline">
                      {p.latitude!.toFixed(5)}, {p.longitude!.toFixed(5)}
                      {p.accuracyM !== null && ` · ±${Math.round(p.accuracyM)} m`}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
