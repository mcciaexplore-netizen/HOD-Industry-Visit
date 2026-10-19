import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listVisitsForHod } from "@/lib/visits";

export default async function MyVisitsPage() {
  const user = await requireUser();
  const visits = await listVisitsForHod(user.id);

  return (
    <AppShell user={user}>
      <p className="section-label">History</p>
      <h1 className="mt-0.5 text-2xl font-bold">My visits</h1>

      {visits.length === 0 ? (
        <div className="card mt-4 p-8 text-center">
          <p className="text-muted">You haven&apos;t reported any visits yet.</p>
          <Link href="/" className="btn btn-primary mt-4">
            Report a visit
          </Link>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {visits.map((v) => (
            <li key={v.id}>
              <Link href={`/visits/${v.id}`} className="card block p-4 transition hover:border-brand/40">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="min-w-0 truncate text-base font-bold">{v.companyName}</h2>
                  <span className="shrink-0 text-xs text-muted">{formatDate(v.createdAt)}</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{v.purpose}</p>
                <p className="mt-2 text-xs font-medium text-brand">
                  {v.photoCount} photo{v.photoCount === 1 ? "" : "s"}
                  {v.accompanyingMembers.length > 0 && ` · ${v.accompanyingMembers.length} member${v.accompanyingMembers.length === 1 ? "" : "s"}`}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
