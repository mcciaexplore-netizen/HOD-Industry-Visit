"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/lib/auth";
import { signInWithEmail } from "@/lib/auth/email-login";

export async function signIn(_prev: { error: string } | null, formData: FormData): Promise<{ error: string } | null> {
  let result: Awaited<ReturnType<typeof signInWithEmail>>;
  try {
    result = await signInWithEmail(String(formData.get("email") ?? ""));
  } catch (err) {
    console.error("Sign-in failed:", err);
    const detail = process.env.NODE_ENV !== "production" && err instanceof Error ? ` (${err.message})` : "";
    return { error: `Sign-in is unavailable right now. Please try again later.${detail}` };
  }
  if (!result.ok) return { error: result.error };
  redirect("/");
}

export async function signOut() {
  await endSession();
  redirect("/login");
}
