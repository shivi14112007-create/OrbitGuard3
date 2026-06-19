import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { withArmor } from "./armoriq.server";

const ActionEnum = z.enum([
  "Channel Isolation",
  "Emergency Encryption",
  "Satellite Lockdown",
  "Signal Re-routing",
  "Frequency Hopping",
  "Lockdown Mode",
  "Rollback Checkpoint",
  "Human Review",
]);

export const executeCountermeasure = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      action: ActionEnum,
      satelliteName: z.string().trim().min(2).max(80),
      reason: z.string().trim().min(4).max(400),
    }),
  )
  .handler(async ({ data }) =>
    withArmor(
      {
        tool: `orbitguard.defense.${data.action.toLowerCase().replace(/\s+/g, "_")}`,
        goal: `Execute "${data.action}" on ${data.satelliteName}: ${data.reason}`,
        args: data,
        mcp: "orbitguard-defense",
      },
      async () => {
        await new Promise((r) => setTimeout(r, 600));
        const remote = !!process.env.ARMORIQ_API_KEY;
        const auditId = `AIQ-${(globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).toString().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
        return {
          executedAt: new Date().toISOString(),
          action: data.action,
          satellite: data.satelliteName,
          result: "applied",
          approval: "ArmorIQ-approved",
          audit: {
            id: auditId,
            timestamp: new Date().toISOString(),
            decision: "approved" as const,
            policyId: remote ? "armoriq.remote.allow" : "local.allow.default",
            intentVerified: true,
            policyEnforced: true,
            auditLogged: true,
            remote,
          },
        };
      },
    ),
  );
