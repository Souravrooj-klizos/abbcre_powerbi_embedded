/**
 * Power BI Embed Token — App owns data (not User owns data).
 * Backend uses Azure AD Service Principal to get an embed token; web users do not sign in to Power BI.
 * Uses Generate Token V2 API (embed for your customers). Requires V2 workspace.
 * RLS roles are optional; for now we do not pass identities/roles.
 */

import { getAzureAccessToken } from "@/lib/auth/azure";
import { env } from "@/config/env";

const POWERBI_API_BASE = "https://api.powerbi.com/v1.0/myorg";

export type EmbedTokenResponse = {
  embedUrl: string;
  accessToken: string;
  reportId: string;
  expiration?: string;
};

async function powerBiFetch(
  accessToken: string,
  url: string,
  options?: { method?: string; body?: string }
): Promise<Response> {
  return fetch(url, {
    method: options?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options?.body && { "Content-Type": "application/json" }),
    },
    ...(options?.body && { body: options.body }),
  });
}

export type ReportMetadataResult =
  | { ok: true; datasetId?: string; embedUrl?: string }
  | { ok: false; status: number; body: string };

/**
 * Get report metadata (datasetId, embedUrl) from workspace.
 * Exported for diagnostics (e.g. /api/test/powerbi).
 */
export async function getReportInGroup(
  accessToken: string,
  workspaceId: string,
  reportId: string
): Promise<ReportMetadataResult> {
  const url = `${POWERBI_API_BASE}/groups/${workspaceId}/reports/${reportId}`;
  const res = await powerBiFetch(accessToken, url);
  const body = await res.text();
  if (!res.ok) {
    console.error(`[PowerBI] getReportInGroup FAILED — status=${res.status}, url=${url}`);
    console.error(`[PowerBI] Response body: ${body}`);
    return { ok: false, status: res.status, body };
  }
  try {
    const data = JSON.parse(body) as { datasetId?: string; embedUrl?: string };
    return { ok: true, datasetId: data.datasetId, embedUrl: data.embedUrl };
  } catch {
    return { ok: false, status: res.status, body };
  }
}

/**
 * Request an embed token using Generate Token V2 API (recommended for app owns data).
 * Falls back to legacy GenerateTokenInGroup if V2 returns 501/500 and we have no dataset.
 */
export async function getEmbedToken(
  reportId: string,
  workspaceId: string,
  roles?: string[]
): Promise<EmbedTokenResponse | null> {
  const workspace = workspaceId || env.powerBi.workspaceId;
  if (!workspace) return null;

  const accessToken = await getAzureAccessToken();

  // 1) Get report details (datasetId, embedUrl) for V2 API
  const reportMeta = await getReportInGroup(accessToken, workspace, reportId);
  if (!reportMeta.ok) {
    if (reportMeta.status === 403 || reportMeta.status === 404) return null;
    throw new Error(
      `Power BI report access failed: ${reportMeta.status} ${reportMeta.body}. ` +
      "Ensure the Service Principal is Admin (or Member) on the workspace."
    );
  }
  const embedUrl =
    reportMeta.embedUrl ??
    `https://app.powerbi.com/reportEmbed?reportId=${reportId}&groupId=${workspace}`;

  // 2) Generate Token V2 — required for "embed for your customers" / service principal
  const v2Body: {
    reports: { id: string }[];
    datasets: { id: string }[];
    identities?: { username: string; roles: string[]; datasets: string[] }[];
  } = {
    reports: [{ id: reportId }],
    datasets: reportMeta.datasetId ? [{ id: reportMeta.datasetId }] : [],
  };
  if (roles && roles.length > 0 && reportMeta.datasetId) {
    v2Body.identities = [
      { username: "app", roles, datasets: [reportMeta.datasetId] },
    ];
  }

  const v2Res = await powerBiFetch(accessToken, `${POWERBI_API_BASE}/GenerateToken`, {
    method: "POST",
    body: JSON.stringify(v2Body),
  });

  if (v2Res.ok) {
    const data = (await v2Res.json()) as { token: string; expiration: string };
    return {
      embedUrl,
      accessToken: data.token,
      reportId,
      expiration: data.expiration,
    };
  }

  const v2Text = await v2Res.text();

  // Fallback: legacy GenerateTokenInGroup (some tenants still use it)
  if (v2Res.status === 500 || v2Res.status === 501) {
    const legacyUrl = `${POWERBI_API_BASE}/groups/${workspace}/reports/${reportId}/GenerateToken`;
    const legacyBody: { accessLevel?: string; allowSaveAs?: boolean; identities?: { roles: string[]; username: string }[] } = {
      accessLevel: "View",
      allowSaveAs: false,
    };
    if (roles && roles.length > 0) {
      legacyBody.identities = [{ roles, username: "app" }];
    }
    const legacyRes = await powerBiFetch(accessToken, legacyUrl, {
      method: "POST",
      body: JSON.stringify(legacyBody),
    });
    if (legacyRes.ok) {
      const data = (await legacyRes.json()) as { token: string; expiration: string; embedUrl?: string };
      return {
        embedUrl: data.embedUrl ?? embedUrl,
        accessToken: data.token,
        reportId,
        expiration: data.expiration,
      };
    }
  }

  if (v2Res.status === 404 || v2Res.status === 403) return null;
  const hint =
    v2Res.status === 500
      ? " Ensure Power BI admin has 'Allow service principals to use Power BI APIs' enabled and the Service Principal is Admin on the workspace (V2)."
      : "";
  throw new Error(`Power BI embed token failed: ${v2Res.status} ${v2Text}.${hint}`);
}
