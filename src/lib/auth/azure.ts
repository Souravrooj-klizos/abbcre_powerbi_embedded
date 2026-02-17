/**
 * Azure AD token for Service Principal (client credentials).
 * Used by the backend to call Power BI REST API.
 * SOW Phase 2: Authentication Service.
 */

import { env } from "@/config/env";

const AZURE_TOKEN_URL = (tenantId: string) =>
  `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

const POWERBI_SCOPE = "https://analysis.windows.net/powerbi/api/.default";

export async function getAzureAccessToken(): Promise<string> {
  const { clientId, clientSecret, tenantId } = env.azure;

  if (!clientId || !clientSecret || !tenantId) {
    throw new Error("Missing Azure AD env: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: POWERBI_SCOPE,
    grant_type: "client_credentials",
  });

  const res = await fetch(AZURE_TOKEN_URL(tenantId), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Azure AD token failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
