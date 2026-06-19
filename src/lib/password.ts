import { z } from "zod";

// Strong password policy — enforced client-side; HIBP leaked-password check is enforced server-side by Lovable Cloud.
export const PASSWORD_RULES = [
  { id: "length", label: "At least 12 characters", test: (s: string) => s.length >= 12 },
  { id: "upper",  label: "An uppercase letter (A–Z)", test: (s: string) => /[A-Z]/.test(s) },
  { id: "lower",  label: "A lowercase letter (a–z)", test: (s: string) => /[a-z]/.test(s) },
  { id: "digit",  label: "A number (0–9)", test: (s: string) => /\d/.test(s) },
  { id: "symbol", label: "A symbol (!@#$ etc.)", test: (s: string) => /[^A-Za-z0-9]/.test(s) },
  { id: "nospace",label: "No leading/trailing spaces", test: (s: string) => s.trim() === s && s.length > 0 },
] as const;

export function scorePassword(pw: string) {
  const passed = PASSWORD_RULES.filter((r) => r.test(pw)).length;
  return { passed, total: PASSWORD_RULES.length, ok: passed === PASSWORD_RULES.length };
}

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password is too long")
  .refine((s) => /[A-Z]/.test(s), "Add an uppercase letter")
  .refine((s) => /[a-z]/.test(s), "Add a lowercase letter")
  .refine((s) => /\d/.test(s), "Add a number")
  .refine((s) => /[^A-Za-z0-9]/.test(s), "Add a symbol")
  .refine((s) => s.trim() === s, "Remove leading/trailing spaces");

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email").max(254);
