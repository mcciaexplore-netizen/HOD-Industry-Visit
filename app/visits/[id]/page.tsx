import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { BackLink } from "@/components/BackLink";
import { VisitDetail } from "@/components/VisitDetail";
import { requireUser } from "@/lib/auth";
import { getVisitDetail } from "@/lib/visits";

export default async function MyVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const visit = await getVisitDetail(id);
  // HODs only see their own reports.
  if (!visit || visit.hodId !== user.id) notFound();

  return (
    <AppShell user={user}>
      <BackLink href="/visits">My visits</BackLink>
      <VisitDetail visit={visit} />
    </AppShell>
  );
}
