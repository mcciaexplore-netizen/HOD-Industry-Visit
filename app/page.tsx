import { AppShell } from "@/components/AppShell";
import { ReportForm } from "@/components/report/ReportForm";
import { requireUser } from "@/lib/auth";

export default async function ReportPage() {
  const user = await requireUser();
  return (
    <AppShell user={user}>
      <ReportForm />
    </AppShell>
  );
}
