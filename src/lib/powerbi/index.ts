/**
 * Power BI API client and embed token generation.
 * Will use Azure AD token + Power BI REST API (Reports, Embed Token).
 */

export const POWERBI_SCOPE = "https://analysis.windows.net/powerbi/api/.default";

// Placeholder: implement getEmbedToken(reportId, workspaceId, roles?) using
// 1. Azure AD client credentials → access token
// 2. Power BI REST API → embed token
export async function getEmbedToken(
  _reportId: string,
  _workspaceId: string,
  _roles?: string[]
): Promise<{ embedUrl: string; accessToken: string } | null> {
  return null;
}
