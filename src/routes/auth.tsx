import { createFileRoute, Link, redirect, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Satellite, Mail, Lock, Eye, EyeOff, Loader2, Check, X, ArrowRight, AlertTriangle } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { PASSWORD_RULES, scorePassword, emailSchema, passwordSchema } from "@/lib/password";

type Mode = "signin" | "signup" | "forgot";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — OrbitGuard" },
      { name: "description", content: "Sign in or create an OrbitGuard account to access the mission console." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: (search.redirect as "/" | undefined) ?? "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<Mode>(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => { setError(null); setInfo(null); }, [mode]);

  const pwScore = useMemo(() => scorePassword(password), [password]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) throw new Error(parsedEmail.error.issues[0].message);
      if (password.length === 0) throw new Error("Enter your password");

      const { error } = await supabase.auth.signInWithPassword({
        email: parsedEmail.data,
        password,
      });
      if (error) throw error;
      navigate({ to: (search.redirect as "/" | undefined) ?? "/" });
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) throw new Error(parsedEmail.error.issues[0].message);
      const parsedPw = passwordSchema.safeParse(password);
      if (!parsedPw.success) throw new Error(parsedPw.error.issues[0].message);

      const { error } = await supabase.auth.signUp({
        email: parsedEmail.data,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: displayName.trim() || undefined },
        },
      });
      if (error) throw error;
      setInfo("Account created. Check your inbox to verify your email, then sign in.");
      setMode("signin");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null); setLoading(true);
    try {
      const parsedEmail = emailSchema.safeParse(email);
      if (!parsedEmail.success) throw new Error(parsedEmail.error.issues[0].message);

      const { error } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setInfo("If that email exists, a reset link is on its way. Check your inbox.");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (result.redirected) return;
      navigate({ to: (search.redirect as "/" | undefined) ?? "/" });
    } catch (e) {
      setError(friendlyAuthError(e));
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="starfield" />
      <div className="absolute inset-0 -z-10 opacity-50" style={{
        background: "radial-gradient(700px 420px at 50% 25%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 60%)",
      }} />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
        <Link to="/welcome" className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl glow-border" style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}>
            <Satellite className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="font-display tracking-widest glow-text">ORBITGUARD</div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Mission Access</div>
          </div>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
          className="w-full rounded-2xl border border-border/60 glass p-6"
        >
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-border bg-secondary/30 p-1">
            <TabBtn active={mode === "signin"} onClick={() => setMode("signin")}>Sign in</TabBtn>
            <TabBtn active={mode === "signup"} onClick={() => setMode("signup")}>Create account</TabBtn>
          </div>

          {info && (
            <div className="mb-4 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">{info}</div>
          )}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{error}</span>
            </div>
          )}

          {mode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-3">
              <p className="text-xs text-muted-foreground">Enter your email and we'll send a secure password reset link.</p>
              <Field label="Email" icon={Mail}>
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@orbitguard.io" />
              </Field>
              <PrimaryBtn loading={loading}>Send reset link</PrimaryBtn>
              <button type="button" onClick={() => setMode("signin")} className="block w-full text-center text-xs text-muted-foreground hover:text-foreground">
                ← Back to sign in
              </button>
            </form>
          ) : mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-3">
              <Field label="Email" icon={Mail}>
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@orbitguard.io" />
              </Field>
              <Field label="Password" icon={Lock}>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-10`} placeholder="••••••••••••" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>
              <div className="flex justify-end">
                <button type="button" onClick={() => setMode("forgot")} className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground hover:text-primary">
                  Forgot password?
                </button>
              </div>
              <PrimaryBtn loading={loading}>Sign in <ArrowRight className="h-4 w-4" /></PrimaryBtn>
              <Divider />
              <GoogleBtn onClick={handleGoogle} loading={loading} label="Continue with Google" />
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-3">
              <Field label="Display name (optional)">
                <input type="text" autoComplete="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} className={inputCls} placeholder="Commander" />
              </Field>
              <Field label="Email" icon={Mail}>
                <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@orbitguard.io" />
              </Field>
              <Field label="Password" icon={Lock}>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputCls} pr-10`} placeholder="Create a strong password" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <PasswordChecklist password={password} score={pwScore} />

              <PrimaryBtn loading={loading} disabled={!pwScore.ok}>Create account</PrimaryBtn>
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                By creating an account you agree to OrbitGuard's terms. Passwords are checked against known data breaches.
              </p>
              <Divider />
              <GoogleBtn onClick={handleGoogle} loading={loading} label="Sign up with Google" />
            </form>
          )}
        </motion.div>

        <Link to="/welcome" className="mt-6 text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground">
          ← Back to launch
        </Link>
      </main>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-1 focus:ring-primary/40";

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </span>
      {children}
    </label>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded px-3 py-1.5 text-xs font-mono uppercase tracking-wider transition ${active ? "bg-primary/20 text-primary glow-border" : "text-muted-foreground hover:text-foreground"}`}>
      {children}
    </button>
  );
}

function PrimaryBtn({ children, loading, disabled }: { children: React.ReactNode; loading?: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={loading || disabled}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/20 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-primary glow-border transition hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  );
}

function Divider() {
  return (
    <div className="my-2 flex items-center gap-2 text-[10px] font-mono uppercase text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function GoogleBtn({ onClick, loading, label }: { onClick: () => void; loading?: boolean; label: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2.5 text-xs font-mono uppercase tracking-widest hover:bg-secondary/70 disabled:opacity-50">
      <GoogleIcon /> {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.9 32.1 29.4 35 24 35c-6.1 0-11-4.9-11-11s4.9-11 11-11c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c2.8 0 5.4 1 7.4 2.8l5.7-5.7C33.6 6.5 29 4.5 24 4.5c-7.2 0-13.4 4.1-16.7 10.2z"/>
      <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.9 12.9-5l-6-5c-1.9 1.4-4.3 2.2-6.9 2.2-5.4 0-9.9-2.9-11.3-7l-6.5 5C8.5 39.4 15.6 43.5 24 43.5z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.7-3.6 5l6 5c-.4.4 6.3-4.6 6.3-14 0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

function PasswordChecklist({ password, score }: { password: string; score: { passed: number; total: number; ok: boolean } }) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/20 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Password strength</span>
        <span className="text-[10px] font-mono" style={{ color: score.ok ? "var(--success)" : score.passed >= 4 ? "var(--warning)" : "var(--destructive)" }}>
          {score.passed}/{score.total}
        </span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
        <div className="h-full transition-all" style={{
          width: `${(score.passed / score.total) * 100}%`,
          background: score.ok ? "var(--success)" : score.passed >= 4 ? "var(--warning)" : "var(--destructive)",
        }} />
      </div>
      <ul className="space-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password);
          return (
            <li key={r.id} className="flex items-center gap-2 text-[11px]">
              {ok ? <Check className="h-3 w-3 text-[color:var(--success)]" /> : <X className="h-3 w-3 text-muted-foreground" />}
              <span className={ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function friendlyAuthError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login")) return "Wrong email or password.";
  if (msg.includes("email not confirmed")) return "Verify your email first — check your inbox.";
  if (msg.includes("user already registered")) return "That email already has an account. Try signing in.";
  if (msg.includes("rate limit") || msg.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  if (msg.includes("pwned") || msg.includes("compromised") || msg.includes("breach")) return "This password has appeared in a known data breach. Please choose a different one.";
  if (msg.includes("weak")) return "Password is too weak.";
  return raw || "Something went wrong. Please try again.";
}
