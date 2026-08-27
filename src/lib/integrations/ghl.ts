// Go High Level (GHL) contact sync — every opt-in form submission on a published Landing Page
// is upserted here as a Contact and tagged, which is what fires any Workflow/Automation the
// member has built in their own GHL account with a "Tag added" trigger. Uses a Private
// Integration token (generated inside the member's own GHL sub-account under
// Settings > Private Integrations) rather than a full OAuth Marketplace app — no external app
// registration/approval needed, the member just pastes in a token + their Location ID.

const GHL_API_BASE = "https://services.leadconnectorhub.com";
// GHL's REST API is versioned via this header, not the URL — pin it so a future GHL API change
// doesn't silently alter behavior underneath us.
const GHL_API_VERSION = "2021-07-28";

export type GhlUpsertResult = { ok: true } | { ok: false; error: string };

export async function upsertGhlContact(params: {
  apiToken: string;
  locationId: string;
  name: string;
  email: string;
  phone: string;
  tags: string[];
}): Promise<GhlUpsertResult> {
  const trimmedName = params.name.trim();
  const [firstName, ...rest] = trimmedName.split(/\s+/).filter(Boolean);
  const lastName = rest.join(" ");

  try {
    const res = await fetch(`${GHL_API_BASE}/contacts/upsert`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.apiToken}`,
        Version: GHL_API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        locationId: params.locationId,
        firstName: firstName || trimmedName || undefined,
        lastName: lastName || undefined,
        email: params.email || undefined,
        phone: params.phone || undefined,
        tags: params.tags,
        source: "Pitch Perfect AI",
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, error: `GHL API ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error calling Go High Level" };
  }
}
