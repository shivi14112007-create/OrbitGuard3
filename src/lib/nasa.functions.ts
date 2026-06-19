import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchLiveSatellites, fetchMissionMeta } from "./nasa.server";
import { withArmor } from "./armoriq.server";

export const getLiveSatellites = createServerFn({ method: "GET" }).handler(async () =>
  withArmor(
    {
      tool: "nasa.tle.fetch",
      goal: "Fetch live NASA TLE positions for OrbitGuard fleet overlay",
      args: {},
      mcp: "nasa-tle",
    },
    () => fetchLiveSatellites(),
  ),
);

export const getMissionMeta = createServerFn({ method: "POST" })
  .inputValidator(z.object({ name: z.string().trim().min(2).max(120) }))
  .handler(async ({ data }) =>
    withArmor(
      {
        tool: "nasa.images.search",
        goal: `Fetch mission metadata for ${data.name}`,
        args: { name: data.name },
        mcp: "nasa-images",
      },
      () => fetchMissionMeta(data.name),
    ),
  );
