import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { fetchLiveSatellites } from "./nasa.server";
import { SATELLITES, INITIAL_THREATS } from "./mock-data";
import { computeTrust, synthSample } from "./threat-engine";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

export const askSecurityAgent = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      messages: z.array(MessageSchema).min(1).max(40),
    }),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return {
        text: "AI gateway key missing. Configure LOVABLE_API_KEY to enable the security agent.",
        grounding: null as null | string,
      };
    }

    // Build live grounding context for the agent.
    let nasa: Awaited<ReturnType<typeof fetchLiveSatellites>> = [];
    try { nasa = await fetchLiveSatellites(); } catch { nasa = []; }

    const fleet = SATELLITES.map((s) => {
      const r = computeTrust(synthSample(s), s);
      return `${s.name} [${s.orbit}] trust=${r.trustScore} state=${r.state} threats=${r.threats.map(t => `${t.type}(${t.confidence}%)`).join(",") || "none"}`;
    }).join("\n");

    const recentThreats = INITIAL_THREATS.slice(0, 6).map(t =>
      `${t.id} ${t.type} on ${t.satellite} sev=${t.severity} conf=${t.confidence}% status=${t.status}`,
    ).join("\n");

    const nasaCtx = nasa.length
      ? nasa.slice(0, 6).map(s => `${s.name} alt=${s.altitudeKm.toFixed(0)}km vel=${s.velocityKmS.toFixed(2)}km/s lat=${s.lat.toFixed(2)} lon=${s.lon.toFixed(2)}`).join("\n")
      : "NASA TLE feed unavailable in this turn.";

    const grounding = `LIVE NASA POSITIONS:\n${nasaCtx}\n\nFLEET TRUST:\n${fleet}\n\nRECENT THREATS:\n${recentThreats}`;

    const system = `You are OrbitGuard Copilot, an autonomous AI analyst for a Satellite Security Operations Center (SatSecOps) used by ISRO/NASA/ESA-class operators.

Capabilities:
- Explain spoofing, jamming, replay, and command-injection threats with reasons.
- Recommend mitigations (channel isolation, OTAR re-key, signal re-routing, lockdown).
- Reference ArmorIQ for approval gating of any destructive action.
- Cite the live grounding context below when answering — never invent satellite names.

Style: concise, mission-control tone, bullet points, include confidence % when relevant.

GROUNDING CONTEXT:
${grounding}`;

    const gateway = createLovableAiGatewayProvider(apiKey);
    try {
      const result = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        system,
        messages: data.messages.map(m => ({ role: m.role, content: m.content })),
      });
      return { text: result.text, grounding };
    } catch (err) {
      const msg = (err as Error).message ?? "";
      if (msg.includes("429")) return { text: "Rate limit reached on the AI gateway. Try again shortly.", grounding };
      if (msg.includes("402")) return { text: "AI gateway credits exhausted. Top up in Settings → Plans & credits.", grounding };
      return { text: `AI gateway error: ${msg}`, grounding };
    }
  });
