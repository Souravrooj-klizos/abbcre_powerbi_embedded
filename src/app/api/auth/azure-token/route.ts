/**
 * SOW Phase 2: Authentication Service.
 * GET /api/auth/azure-token — returns Azure AD access token (for backend use; don’t expose to frontend for Power BI embed).
 * This route is for testing/health; the embed token API uses Azure token internally.
 */

import { getAzureAccessToken } from "@/lib/auth/azure";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = await getAzureAccessToken();
    return NextResponse.json({
      ok: true,
      tokenLength: token.length,
      message: "Azure AD token obtained. Use /api/embed-token for report embed.",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
