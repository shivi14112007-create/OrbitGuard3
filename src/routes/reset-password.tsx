import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Satellite, Lock, Eye, EyeOff, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_RULES, passwordSchema, scorePassword } from "@/lib/password";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — OrbitGuard" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Supabase emits a "PASSWORD_RECOVERY" event after the user follows the email link.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "INITIAL_SESSION" && session)) {
        setRecoveryReady(true);
      }
      setReady(true);
    });
    // Fallback: if no event fires within 1.5s, still let the user try.
    const t = setTimeout(() => setReady(true), 1500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const pwScore = useMemo(() => scorePassword(password), [password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      // Sign out so they explicitly sign back in with the new password.
      await supabase.auth.signOut();
      setTimeout(() => navigate({ to: "/auth" }), 1800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/pwned|breach|compromised/i.test(msg) ? "This password has appeared in a known data breach. Please choose a different one." : msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="starfield" />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
        <Link to="/welcome" className="mb-6 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl glow-border" style={{ background: "color-mix(in oklab, var(--primary) 18%, transparent)" }}>
            <Satellite className="h-6 w-6 text-primary" />
          </div>
          <div>
            <div className="font-display tracking-widest glow-text">ORBITGUARD</div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground">Password Reset</div>
          </div>
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full rounded-2xl border border-border/60 glass p-6">
          {done ? (
            <div className="space-y-2 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[color:var(--success)]" />
              <h1 className="font-display text-xl">Password updated</h1>
              <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
            </div>
          ) : !ready ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : !recoveryReady ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs" style={{ color: "var(--warning)" }}>
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>This page must be opened via the reset link in your email. The link expires after a short time — request a new one if needed.</span>
              </div>
              <Link to="/auth" search={{ mode: "forgot" }} className="block w-full rounded-md border border-primary/40 bg-primary/15 px-4 py-2 text-center font-mono text-xs uppercase tracking-widest text-primary hover:bg-primary/25">
                Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <h1 className="font-display text-xl">Choose a new password</h1>
              <p className="text-xs text-muted-foreground">Must meet OrbitGuard's strong-password policy.</p>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{error}</span>
                </div>
              )}

              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground"><Lock className="h-3 w-3" /> New password</span>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 pr-10 text-sm outline-none focus:border-primary" />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Toggle">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-muted-foreground"><Lock className="h-3 w-3" /> Confirm password</span>
                <input type={showPw ? "text" : "password"} autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>

              <div className="rounded-md border border-border/60 bg-secondary/20 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Strength</span>
                  <span className="text-[10px] font-mono" style={{ color: pwScore.ok ? "var(--success)" : pwScore.passed >= 4 ? "var(--warning)" : "var(--destructive)" }}>{pwScore.passed}/{pwScore.total}</span>
                </div>
                <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
                  <div className="h-full transition-all" style={{ width: `${(pwScore.passed / pwScore.total) * 100}%`, background: pwScore.ok ? "var(--success)" : pwScore.passed >= 4 ? "var(--warning)" : "var(--destructive)" }} />
                </div>
                <ul className="grid grid-cols-1 gap-1 text-[11px]">
                  {PASSWORD_RULES.map((r) => {
                    const ok = r.test(password);
                    return (
                      <li key={r.id} className={ok ? "text-foreground" : "text-muted-foreground"}>
                        {ok ? "✓" : "•"} {r.label}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <button type="submit" disabled={loading || !pwScore.ok || password !== confirm}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary/40 bg-primary/20 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-primary glow-border hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}
