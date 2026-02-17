/**
 * SOW Phase 2: User-to-Data Mapping.
 * GET /api/reports — list reports the current user is allowed to see (from DB lookup).
 * For now uses mock user id from header or query; replace with real auth (NextAuth) later.
 */

import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

import { env } from "@/config/env";

// Mock: get current user id. Replace with session (NextAuth) or your auth.
// Supports special value "demo" → resolve to seed demo user by email (from env).
async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  const headerName = env.mockUserHeader;
  const header = request.headers.get(headerName);
  const url = request.nextUrl.searchParams.get("userId");
  const raw = header ?? url;
  if (!raw) return null;
  const demoEmail = env.seed.demoUserEmail;
  if (raw === "demo" && demoEmail) {
    const u = await prisma.user.findUnique({ where: { email: demoEmail } });
    return u?.id ?? null;
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const userId = await getCurrentUserId(request);

  if (!userId) {
    return NextResponse.json(
      {
        reports: [],
        message: `No user context. Send ${env.mockUserHeader} header or ?userId= for dev.`,
      },
      { status: 200 }
    );
  }

  try {
    // Find user's report roles and include report details
    const roles = await prisma.userReportRole.findMany({
      where: { userId },
      include: {
        report: true,
      },
    });

    const reports = roles.map((r) => ({
      id: r.report.id,
      reportId: r.report.reportId,
      workspaceId: r.report.workspaceId,
      name: r.report.name,
      roleName: r.roleName,
    }));

    // Dedupe by report id (same report can have multiple roles)
    const byReportId = new Map(reports.map((r) => [r.reportId, r]));
    const unique = Array.from(byReportId.values());

    // Prefer the report that matches .env (POWERBI_WORKSPACE_ID + POWERBI_DEFAULT_REPORT_ID) so embed token works
    const workspaceId = env.powerBi.workspaceId;
    const defaultReportId = env.powerBi.defaultReportId;
    const sorted =
      workspaceId && defaultReportId
        ? [...unique].sort((a, b) => {
            const aMatch = a.workspaceId === workspaceId && a.reportId === defaultReportId ? 1 : 0;
            const bMatch = b.workspaceId === workspaceId && b.reportId === defaultReportId ? 1 : 0;
            return bMatch - aMatch; // matching report first
          })
        : unique;

    return NextResponse.json({ reports: sorted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
