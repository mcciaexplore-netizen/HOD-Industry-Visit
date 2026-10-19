import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BackLink } from "@/components/BackLink";
import { VisitDetail } from "@/components/VisitDetail";
import { requireAdmin } from "@/lib/auth";
import { getVisitDetail } from "@/lib/visits";

export default async function AdminVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const visit = await getVisitDetail(id);
  if (!visit) notFound();

  return (
    <AppShell user={user}>
      <BackLink href="/admin">All reports</BackLink>
      <VisitDetail visit={visit} showHod />
    </AppShell>
  );
}
