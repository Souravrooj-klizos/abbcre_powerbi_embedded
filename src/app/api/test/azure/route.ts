/**
 * Test API: verify Azure AD (Service Principal) credentials.
 * GET /api/test/azure
 * Returns { ok: true, message } if token is obtained, else { ok: false, error }.
 */

import { getAzureAccessToken } from "@/lib/auth/azure";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = await getAzureAccessToken();
    return NextResponse.json({
      ok: true,
      message: "Azure AD token obtained successfully.",
      tokenLength: token?.length ?? 0,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 }
    );
  }
}
