import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { ADMIN_PAGE_SIZE, filterOptions, filtersFromSearchParams, listVisitsForAdmin, type AdminFilters } from "@/lib/visits";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toQuery(filters: AdminFilters, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filters, ...extra })) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export default async function AdminPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const filters = filtersFromSearchParams(sp);
  const page = Math.max(1, Number(Array.isArray(sp.page) ? sp.page[0] : sp.page) || 1);
  const [{ rows, total }, options] = await Promise.all([listVisitsForAdmin(filters, page), filterOptions()]);
  const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <AppShell user={user} wide>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-label">Admin</p>
          <h1 className="mt-0.5 text-2xl font-bold">All reports</h1>
        </div>
        <a href={`/api/admin/export${toQuery(filters)}`} className="btn btn-primary">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4v12M7 11l5 5 5-5M4 20h16" />
          </svg>
          Export to Excel
        </a>
      </div>

      <form method="get" className="card mt-4 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="text-xs font-semibold text-muted lg:col-span-2">
          Search
          <input name="q" defaultValue={filters.q} placeholder="Company, purpose, member, HOD" className="field mt-1 !py-2 !text-sm" />
        </label>
        <label className="text-xs font-semibold text-muted">
          HOD
          <select name="hod" defaultValue={filters.hod ?? ""} className="field mt-1 !py-2 !text-sm">
            <option value="">All HODs</option>
            {options.hods.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">
          Department
          <select name="dept" defaultValue={filters.dept ?? ""} className="field mt-1 !py-2 !text-sm">
            <option value="">All departments</option>
            {options.departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted lg:col-span-2">
          Company
          <input name="company" defaultValue={filters.company} className="field mt-1 !py-2 !text-sm" />
        </label>
        <label className="text-xs font-semibold text-muted">
          From
          <input type="date" name="from" defaultValue={filters.from} className="field mt-1 !py-2 !text-sm" />
        </label>
        <label className="text-xs font-semibold text-muted">
          To
          <input type="date" name="to" defaultValue={filters.to} className="field mt-1 !py-2 !text-sm" />
        </label>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4 lg:justify-end">
          {hasFilters && (
            <Link href="/admin" className="btn btn-ghost">
              Clear
            </Link>
          )}
          <button type="submit" className="btn btn-secondary">
            Apply filters
          </button>
        </div>
      </form>

      <p className="mt-4 text-sm text-muted">
        {total} report{total === 1 ? "" : "s"}
        {hasFilters && " matching filters"}
      </p>

      {rows.length === 0 ? (
        <div className="card mt-3 p-8 text-center text-muted">No reports found.</div>
      ) : (
        <>
          {/* Phone: cards */}
          <ul className="mt-3 space-y-3 md:hidden">
            {rows.map((v) => (
              <li key={v.id}>
                <Link href={`/admin/visits/${v.id}`} className="card block p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="min-w-0 truncate text-base font-bold">{v.companyName}</h2>
                    <span className="shrink-0 text-xs text-muted">{formatDateTime(v.createdAt)}</span>
                  </div>
                  <p className="mt-0.5 text-sm">
                    {v.hodName} <span className="text-muted">· {v.department}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{v.purpose}</p>
                  <p className="mt-2 text-xs font-medium text-brand">{v.photoCount} photos</p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="card mt-3 hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
                <tr>
                  <th className="px-4 py-3 font-semibold">Submitted</th>
                  <th className="px-4 py-3 font-semibold">HOD</th>
                  <th className="px-4 py-3 font-semibold">Department</th>
                  <th className="px-4 py-3 font-semibold">Company</th>
                  <th className="px-4 py-3 font-semibold">Purpose</th>
                  <th className="px-4 py-3 text-right font-semibold">Photos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((v) => (
                  <tr key={v.id} className="hover:bg-background">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(v.createdAt)}</td>
                    <td className="px-4 py-3">{v.hodName}</td>
                    <td className="px-4 py-3 text-muted">{v.department}</td>
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/admin/visits/${v.id}`} className="text-brand hover:underline">
                        {v.companyName}
                      </Link>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-muted">
                      <span className="line-clamp-2">{v.purpose}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{v.photoCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-center gap-3 text-sm">
              {page > 1 ? (
                <Link href={`/admin${toQuery(filters, { page: String(page - 1) })}`} className="btn btn-secondary !min-h-0 !py-2">
                  Previous
                </Link>
              ) : null}
              <span className="text-muted">
                Page {page} of {pages}
              </span>
              {page < pages ? (
                <Link href={`/admin${toQuery(filters, { page: String(page + 1) })}`} className="btn btn-secondary !min-h-0 !py-2">
                  Next
                </Link>
              ) : null}
            </nav>
          )}
        </>
      )}
    </AppShell>
  );
}
