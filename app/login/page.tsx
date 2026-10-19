import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col px-4 pt-14 pb-10">
      <img src="/mccia-logo.png" alt="MCCIA" width={268} height={72} className="mx-auto h-12 w-auto" />
      <div className="card mt-8 p-6">
        <p className="section-label">HOD Industry Visit</p>
        <h1 className="mt-1 text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Use the email address registered with MCCIA.</p>
        <LoginForm />
      </div>
    </main>
  );
}
