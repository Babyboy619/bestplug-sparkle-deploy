import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuthUser } from "@/hooks/use-auth-user";
import { SiteFrame } from "@/components/site-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/metadata";
import { z } from "zod";
import "@lovable.dev/cloud-auth-js/styles.css";
export const Route = createFileRoute("/auth")({
  validateSearch: z.object({ mode: z.enum(["signin", "signup"]).optional() }),
  head: () => pageHead("Your account", "Sign in or create your BESTPLUG MARKETPLACE account."),
  component: AuthPage,
});
function AuthPage() {
  const { mode: requestedMode } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">(
    requestedMode === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { user } = useAuthUser();
  const navigate = useNavigate();
  useEffect(() => {
    setMode(requestedMode === "signup" ? "signup" : "signin");
  }, [requestedMode]);
  useEffect(() => {
    if (user) void navigate({ to: "/wallet" });
  }, [user, navigate]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const result =
        mode === "signin"
          ? await supabase.auth.signInWithPassword({ email, password })
          : mode === "signup"
            ? await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: { display_name: name },
                  emailRedirectTo: window.location.origin + "/auth",
                },
              })
            : await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin + "/reset-password",
              });
      if (result.error) throw result.error;
      if (mode === "signup") setMessage("Check your email to verify your account, then sign in.");
      if (mode === "reset") setMessage("Check your email for a password reset link.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function social(provider: "google" | "lovable") {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) setMessage(result.error.message);
    setBusy(false);
  }
  return (
    <SiteFrame>
      <main className="min-h-[65vh]">
        <div className="auth-panel">
          <p className="text-xs uppercase text-primary">BESTPLUG MARKETPLACE</p>
          <h1 className="section-heading mt-3">
            {mode === "signup"
              ? "Get plugged in."
              : mode === "reset"
                ? "Reset your password."
                : "Welcome back."}
          </h1>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            {mode === "signup" && (
              <label className="block text-sm">
                Name
                <Input
                  className="mt-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
            )}
            <label className="block text-sm">
              Email
              <Input
                className="mt-2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>
            {mode !== "reset" && (
              <label className="block text-sm">
                Password
                <Input
                  className="mt-2"
                  type="password"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
              </label>
            )}
            <Button className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </Button>
          </form>
          {message && (
            <p role="status" className="mt-4 text-sm leading-6 text-primary">
              {message}
            </p>
          )}
          {mode !== "reset" && (
            <div className="mt-5 space-y-3 border-t border-border pt-5">
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={() => void social("google")}
              >
                Continue with Google
              </Button>
              <Button
                className="lovable-auth-button w-full"
                disabled={busy}
                onClick={() => void social("lovable")}
              >
                Continue with Lovable
              </Button>
            </div>
          )}
          <div className="mt-5 flex flex-wrap justify-between gap-2">
            <Button
              variant="link"
              className="h-auto px-0 text-xs"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setMessage("");
              }}
            >
              {mode === "signin" ? "Create an account" : "Back to sign in"}
            </Button>
            {mode === "signin" && (
              <Button
                variant="link"
                className="h-auto px-0 text-xs"
                onClick={() => setMode("reset")}
              >
                Forgot password?
              </Button>
            )}
          </div>
          <Link to="/products" className="mt-5 block text-center text-xs text-muted-foreground">
            Back to marketplace
          </Link>
        </div>
      </main>
    </SiteFrame>
  );
}
