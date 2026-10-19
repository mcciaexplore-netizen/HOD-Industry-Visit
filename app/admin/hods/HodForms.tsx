"use client";

import { useActionState, useTransition } from "react";
import { addHod, importHods, setHodActive, type ActionResult } from "./actions";

function Feedback({ state }: { state: ActionResult }) {
  if (!state) return null;
  return (
    <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-success/10 text-[#0f7a3d]" : "bg-red-50 text-danger"}`}>
      {state.message}
    </p>
  );
}

export function AddHodForm() {
  const [state, action, pending] = useActionState(addHod, null);
  return (
    <form action={action} className="card p-4">
      <p className="section-label">Add HOD</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <input name="name" required placeholder="Full name" className="field !py-2 !text-sm" />
        <input name="email" type="email" required placeholder="Email" autoCapitalize="none" className="field !py-2 !text-sm" />
        <input name="department" placeholder="Department" className="field !py-2 !text-sm" />
        <select name="role" defaultValue="hod" className="field !py-2 !text-sm">
          <option value="hod">HOD</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary mt-3 w-full sm:w-auto">
        {pending ? "Saving…" : "Save HOD"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ImportHodsForm() {
  const [state, action, pending] = useActionState(importHods, null);
  return (
    <form action={action} className="card p-4">
      <p className="section-label">Bulk import (CSV)</p>
      <p className="mt-1 text-sm text-muted">
        Columns: <code className="rounded bg-background px-1">name,email,department</code> with an optional 4th column{" "}
        <code className="rounded bg-background px-1">role</code> (hod or admin). Existing emails are updated and re-activated.
      </p>
      <input name="file" type="file" accept=".csv,text/csv" className="mt-3 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:font-semibold file:text-brand" />
      <textarea name="csv" rows={3} placeholder="…or paste CSV here" className="field mt-3 !text-sm font-mono" />
      <button type="submit" disabled={pending} className="btn btn-secondary mt-3 w-full sm:w-auto">
        {pending ? "Importing…" : "Import"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ActiveToggle({ id, active, isSelf }: { id: string; active: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  if (isSelf) return <span className="text-xs text-muted">You</span>;
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setHodActive(id, !active))}
      className={`btn !min-h-0 !px-3 !py-1.5 text-xs ${active ? "btn-ghost border border-line" : "btn-secondary"}`}
    >
      {pending ? "…" : active ? "Deactivate" : "Activate"}
    </button>
  );
}
