/**
 * Test API: verify Power BI embed token (workspace + report + Azure).
 * GET /api/test/powerbi
 * Optional query: reportId=...&workspaceId=... (defaults from env)
 * Returns diagnostics: report access (Get Report) then token (GenerateToken).
 */

import { getAzureAccessToken } from "@/lib/auth/azure";
import { env } from "@/config/env";
import { getEmbedToken, getReportInGroup } from "@/lib/powerbi/embed-token";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const reportId = searchParams.get("reportId") ?? env.powerBi.defaultReportId ?? "";
  const workspaceId = searchParams.get("workspaceId") ?? env.powerBi.workspaceId ?? "";

  if (!reportId || !workspaceId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing reportId or workspaceId. Set POWERBI_WORKSPACE_ID and POWERBI_DEFAULT_REPORT_ID in .env, or pass ?reportId=...&workspaceId=...",
      },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getAzureAccessToken();

    // Step 1: Can the Service Principal read the report? (Get Report In Group)
    const reportResult = await getReportInGroup(accessToken, workspaceId, reportId);

    if (!reportResult.ok) {
      const status = reportResult.status;
      const is500 = status === 500;
      const msg =
        status === 403
          ? "Service Principal cannot access this workspace/report (403). Add the app as Admin (or Member) to the workspace in Power BI."
          : status === 404
            ? "Report or workspace not found (404). Check POWERBI_WORKSPACE_ID and report ID."
            : is500
              ? "Power BI returned 500 (Get Report). Usually the tenant has not allowed Service Principals. See checklist in docs/POWERBI-SERVICE-PRINCIPAL-SETUP.md"
              : `Get Report failed: ${status} ${reportResult.body}`;
      return NextResponse.json(
        {
          ok: false,
          step: "report",
          error: msg,
          status,
          rawBody: reportResult.body?.substring(0, 500),
          diagnoseUrl: "/api/test/powerbi-diagnose",
          ...(is500 && {
            checklist: [
              "1. Azure AD: Create a security group and add your app (Service Principal) as a member.",
              "2. Power BI Admin: Tenant settings → Developer settings → 'Allow service principals to use Power BI APIs' → Enabled for that security group.",
              "3. Power BI: Add the Service Principal to the workspace (Workspace → Access → Add the app) as Admin or Member.",
              "4. Use a V2 (new) workspace, not a classic one.",
              "5. Also enable 'Embed content in apps' under Embed settings in the Power BI Admin portal.",
              "6. Wait 15 minutes after making changes for them to propagate.",
            ],
          }),
        },
        { status: 502 }
      );
    }

    // Step 2: Generate embed token (V2 or legacy)
    const result = await getEmbedToken(reportId, workspaceId);
    if (!result) {
      return NextResponse.json(
        {
          ok: false,
          step: "token",
          error:
            "Power BI returned no token (404/403). Check workspace ID, report ID, and that the Service Principal is Admin on the workspace.",
          reportAccess: "ok",
          datasetId: reportResult.datasetId ?? null,
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Power BI embed token obtained successfully.",
      reportId: result.reportId,
      embedUrl: result.embedUrl,
      expiration: result.expiration,
      reportAccess: "ok",
      datasetId: reportResult.datasetId ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    const isReportAccess = message.includes("report access failed");
    return NextResponse.json(
      {
        ok: false,
        step: isReportAccess ? "report" : "token",
        error: message,
      },
      { status: 502 }
    );
  }
}
