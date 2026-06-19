type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type ProxyResult = {
  provider: "bhuvan" | "mosdac";
  proxied: true;
  status: number;
  contentType: string;
  data: JsonValue;
};

const MOSDAC_FALLBACK_CATALOG = [
  { id: "3RIMG_L1B_STD", name: "INSAT-3DR L1B Standard Imagery", updated: "T-00:15" },
  { id: "3DIMG_L2G_RAIN", name: "Rainfall Product (Half-hourly)", updated: "T-00:30" },
  { id: "SCAT_L2B_OCEAN", name: "Scatsat-1 Ocean Wind Vectors", updated: "T-02:10" },
  { id: "SMOS_L3_SM", name: "Soil Moisture (Global)", updated: "T-06:00" },
];

async function readResponse(res: Response): Promise<{ contentType: string; data: JsonValue }> {
  const contentType = res.headers.get("content-type") ?? "text/plain";
  const text = await res.text();
  if (contentType.includes("application/json")) {
    try {
      return { contentType, data: JSON.parse(text) as JsonValue };
    } catch {
      return { contentType, data: text };
    }
  }

  try {
    return { contentType, data: JSON.parse(text) as JsonValue };
  } catch {
    return { contentType, data: text };
  }
}

function requireSecret(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${name} is not configured. Add it in project secrets, then retry this proxy call.`);
  }
  return value;
}

export async function proxyBhuvanGeocode(place: string): Promise<ProxyResult> {
  const token = requireSecret(process.env.BHUVAN_TOKEN, "BHUVAN_TOKEN");
  const url = new URL("https://bhuvan-app1.nrsc.gov.in/api/geocoding/curl_geocode_api.php");
  url.searchParams.set("a", place);
  url.searchParams.set("h", "M");
  url.searchParams.set("token", token);

  const res = await fetch(url, { headers: { Accept: "application/json, text/plain;q=0.9" } });
  const { contentType, data } = await readResponse(res);
  if (!res.ok) {
    throw new Error(`Bhuvan proxy failed with HTTP ${res.status}.`);
  }

  return { provider: "bhuvan", proxied: true, status: res.status, contentType, data };
}

export async function proxyMosdacCatalog(datasetId?: string): Promise<ProxyResult> {
  const username = requireSecret(process.env.MOSDAC_USERNAME, "MOSDAC_USERNAME");
  const password = requireSecret(process.env.MOSDAC_PASSWORD, "MOSDAC_PASSWORD");
  const catalogUrl = process.env.MOSDAC_CATALOG_URL;

  if (!catalogUrl) {
    return {
      provider: "mosdac",
      proxied: true,
      status: 200,
      contentType: "application/json",
      data: {
        configured: false,
        authenticatedAs: username,
        catalog: MOSDAC_FALLBACK_CATALOG,
        note: "MOSDAC credentials are stored server-side. Add MOSDAC_CATALOG_URL when the portal gives you the dataset API endpoint.",
      },
    };
  }

  const url = new URL(catalogUrl);
  if (datasetId) url.searchParams.set("dataset_id", datasetId);

  const basicAuth = btoa(`${username}:${password}`);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain;q=0.9",
      Authorization: `Basic ${basicAuth}`,
    },
  });
  const { contentType, data } = await readResponse(res);
  if (!res.ok) {
    throw new Error(`MOSDAC proxy failed with HTTP ${res.status}.`);
  }

  return { provider: "mosdac", proxied: true, status: res.status, contentType, data };
}
