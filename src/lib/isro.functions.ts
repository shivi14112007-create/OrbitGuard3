import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { proxyBhuvanGeocode, proxyMosdacCatalog } from "./isro.server";
import { withArmor } from "./armoriq.server";

export const geocodeWithBhuvan = createServerFn({ method: "POST" })
  .inputValidator(z.object({ place: z.string().trim().min(2).max(120) }))
  .handler(async ({ data }) =>
    withArmor(
      {
        tool: "isro.bhuvan.geocode",
        goal: `Resolve coordinates for "${data.place}" via Bhuvan geocoding`,
        args: { place: data.place },
        mcp: "isro-bhuvan",
      },
      () => proxyBhuvanGeocode(data.place),
    ),
  );

export const fetchMosdacCatalog = createServerFn({ method: "POST" })
  .inputValidator(z.object({ datasetId: z.string().trim().max(120).optional() }))
  .handler(async ({ data }) =>
    withArmor(
      {
        tool: "isro.mosdac.catalog",
        goal: data.datasetId
          ? `Fetch MOSDAC catalog entry for dataset ${data.datasetId}`
          : "Fetch full MOSDAC dataset catalog",
        args: { datasetId: data.datasetId ?? null },
        mcp: "isro-mosdac",
      },
      () => proxyMosdacCatalog(data.datasetId),
    ),
  );
