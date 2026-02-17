/**
 * One-time seed: create a sample user and report so /api/reports and embed have data.
 * GET /api/reports/seed — run once after migrations. Safe to call multiple times (upsert).
 * All values come from env (see src/config/env.ts and .env.example).
 */

import { prisma } from "@/lib/db/prisma";
import { env } from "@/config/env";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const workspaceId = env.powerBi.workspaceId || env.seed.placeholderWorkspaceId;
    const demoEmail = env.seed.demoUserEmail;
    const reportId = env.powerBi.defaultReportId || env.seed.placeholderReportId;
    const reportName = env.powerBi.defaultReportId
      ? "Power BI Report"
      : env.seed.placeholderReportName;
    const roleName = env.seed.defaultRlsRole;

    const user = await prisma.user.upsert({
      where: { email: demoEmail },
      create: {
        email: demoEmail,
        name: "Demo User",
      },
      update: {},
    });

    const report = await prisma.powerBIReport.upsert({
      where: {
        workspaceId_reportId: {
          workspaceId,
          reportId,
        },
      },
      create: {
        reportId,
        workspaceId,
        name: reportName,
      },
      update: {},
    });

    await prisma.userReportRole.upsert({
      where: {
        userId_powerbiReportId_roleName: {
          userId: user.id,
          powerbiReportId: report.id,
          roleName,
        },
      },
      create: {
        userId: user.id,
        powerbiReportId: report.id,
        roleName,
      },
      update: {},
    });

    return NextResponse.json({
      ok: true,
      message: `Seed complete. Use header "${env.mockUserHeader}: ${user.id}" or "${env.mockUserHeader}: demo" when calling /api/reports`,
      userId: user.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
