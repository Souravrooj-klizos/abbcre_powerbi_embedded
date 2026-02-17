import { NextResponse } from "next/server";

/**
 * Health check for load balancers / monitoring.
 * GET /api/health
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
