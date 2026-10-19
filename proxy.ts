import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Fast signed-cookie gate. Role and active checks happen server side in
// lib/auth (requireUser / requireAdmin / getCurrentUser).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);

  // The login page decides for itself (it also knows about deactivated HODs).
  if (pathname === "/login") return NextResponse.next();
  if (!session) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|mccia-logo.png).*)"],
};
