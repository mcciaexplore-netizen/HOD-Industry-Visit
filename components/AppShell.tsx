import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { NavLinks } from "./NavLinks";

export function AppShell({ user, children, wide = false }: { user: CurrentUser; children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className={`mx-auto flex items-center justify-between gap-3 px-4 py-2.5 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <img src="/mccia-logo.png" alt="MCCIA" width={268} height={72} className="h-8 w-auto" />
            <span className="hidden border-l border-line pl-2.5 font-heading text-sm font-bold text-navy sm:inline">HOD Industry Visit</span>
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm text-muted md:inline">{user.name}</span>
            <form action={signOut}>
              <button type="submit" className="btn btn-ghost !min-h-0 !px-2.5 !py-1.5 text-sm">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <NavLinks isAdmin={user.role === "admin"} wide={wide} />
      </header>
      <main className={`mx-auto w-full px-4 py-5 ${wide ? "max-w-6xl" : "max-w-2xl"}`}>{children}</main>
    </>
  );
}
