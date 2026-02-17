/**
 * SOW Phase 2: Token Generation.
 * GET /api/embed-token?reportId=...&workspaceId=... — returns embedUrl + accessToken for Power BI embed.
 * If POWERBI_WORKSPACE_ID is not set or report not found, returns 503.
 */

import { env } from "@/config/env";
import { getEmbedToken } from "@/lib/powerbi/embed-token";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportId = searchParams.get("reportId");
  const workspaceId = searchParams.get("workspaceId") ?? env.powerBi.workspaceId ?? "";
  const rolesParam = searchParams.get("roles"); // comma-separated RLS roles
  const roles = rolesParam ? rolesParam.split(",").map((r) => r.trim()).filter(Boolean) : undefined;

  if (!reportId) {
    return NextResponse.json(
      { error: "Missing reportId query parameter" },
      { status: 400 }
    );
  }

  try {
    const result = await getEmbedToken(reportId, workspaceId, roles);
    if (!result) {
      return NextResponse.json(
        {
          error: "Power BI workspace or report not configured. Set POWERBI_WORKSPACE_ID and ensure the report exists.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
