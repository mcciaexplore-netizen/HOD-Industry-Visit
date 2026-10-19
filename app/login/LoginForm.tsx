"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <form action={action} className="mt-5 space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          className="field"
          aria-invalid={state?.error ? true : undefined}
          aria-describedby={state?.error ? "email-error" : undefined}
        />
        {state?.error && (
          <p id="email-error" role="alert" className="error-text">
            {state.error}
          </p>
        )}
      </div>
      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? "Signing in…" : "Continue"}
      </button>
    </form>
  );
}
