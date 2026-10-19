import { asc, desc } from "drizzle-orm";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hods } from "@/lib/db/schema";
import { ActiveToggle, AddHodForm, ImportHodsForm } from "./HodForms";

export default async function HodsPage() {
  const user = await requireAdmin();
  const people = await db.select().from(hods).orderBy(desc(hods.active), asc(hods.department), asc(hods.name));

  return (
    <AppShell user={user} wide>
      <p className="section-label">Admin</p>
      <h1 className="mt-0.5 text-2xl font-bold">HODs</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AddHodForm />
        <ImportHodsForm />
      </div>

      <div className="card mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Department</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {people.map((h) => (
              <tr key={h.id} className={h.active ? "" : "text-muted"}>
                <td className="px-4 py-3 font-medium whitespace-nowrap">{h.name}</td>
                <td className="px-4 py-3">{h.email}</td>
                <td className="px-4 py-3">{h.department}</td>
                <td className="px-4 py-3 capitalize">{h.role === "admin" ? "Admin" : "HOD"}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${h.active ? "bg-success/10 text-[#0f7a3d]" : "bg-background text-muted"}`}>
                    {h.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <ActiveToggle id={h.id} active={h.active} isSelf={h.id === user.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
