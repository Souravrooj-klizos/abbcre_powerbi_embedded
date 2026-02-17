/**
 * Comprehensive diagnostic endpoint for Power BI Embedded setup.
 * GET /api/test/powerbi-diagnose
 *
 * Runs each step independently and reports exactly where the failure is:
 *  1. Azure AD token (client credentials)
 *  2. List workspaces (to verify SP has access to Power BI Service)
 *  3. Get specific workspace
 *  4. List reports in workspace
 *  5. Get specific report
 *  6. Generate embed token
 */

import { getAzureAccessToken } from "@/lib/auth/azure";
import { env } from "@/config/env";
import { NextResponse } from "next/server";

const POWERBI_API = "https://api.powerbi.com/v1.0/myorg";

async function pbiFetch(token: string, url: string, init?: RequestInit) {
    return fetch(url, {
        ...init,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            ...(init?.headers ?? {}),
        },
    });
}

type StepResult = {
    step: string;
    ok: boolean;
    detail?: unknown;
    error?: string;
    status?: number;
    rawBody?: string;
    fix?: string;
};

export async function GET() {
    const steps: StepResult[] = [];
    const workspaceId = env.powerBi.workspaceId;
    const reportId = env.powerBi.defaultReportId;

    // ─── Step 0: env check ──────────────────────────────
    if (!workspaceId || !reportId) {
        steps.push({
            step: "0_env_check",
            ok: false,
            error: "Missing POWERBI_WORKSPACE_ID or POWERBI_DEFAULT_REPORT_ID in .env",
            fix: "Set both values in .env file. Get Workspace ID from Power BI workspace URL, Report ID from the report URL.",
        });
        return NextResponse.json({ steps }, { status: 400 });
    }
    steps.push({
        step: "0_env_check",
        ok: true,
        detail: { workspaceId, reportId },
    });

    // ─── Step 1: Azure AD token ────────────────────────
    let accessToken = "";
    try {
        accessToken = await getAzureAccessToken();
        steps.push({
            step: "1_azure_ad_token",
            ok: true,
            detail: { tokenLength: accessToken.length },
        });
    } catch (e) {
        steps.push({
            step: "1_azure_ad_token",
            ok: false,
            error: e instanceof Error ? e.message : String(e),
            fix: "Check AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID in .env. Make sure the app registration exists in Azure AD.",
        });
        return NextResponse.json({ ok: false, steps });
    }

    // ─── Step 2: List groups (workspaces) — proves SP can call Power BI API ──
    try {
        const res = await pbiFetch(accessToken, `${POWERBI_API}/groups?$top=5`);
        const body = await res.text();
        if (res.ok) {
            const data = JSON.parse(body);
            const workspaces = (data.value ?? []).map((w: { id: string; name: string }) => ({
                id: w.id,
                name: w.name,
            }));
            steps.push({
                step: "2_list_workspaces",
                ok: true,
                detail: { count: workspaces.length, workspaces },
            });
        } else {
            steps.push({
                step: "2_list_workspaces",
                ok: false,
                status: res.status,
                rawBody: body.substring(0, 500),
                error:
                    res.status === 401
                        ? "Azure AD token is not accepted by Power BI (401 Unauthorized)."
                        : res.status === 403
                            ? "Service Principal is forbidden from listing workspaces (403)."
                            : `Power BI returned ${res.status}.`,
                fix:
                    "1) In Azure Portal → Entra ID → Groups → create Security group (e.g. 'Power BI API Apps') → add your app as member.\n" +
                    "2) In Power BI Admin Portal → Tenant settings → Developer settings → 'Allow service principals to use Power BI APIs' → Enabled for that security group.\n" +
                    "3) Also enable 'Embed content in apps' (under Embed settings) for the same security group.\n" +
                    "4) Wait up to 15 minutes for changes to propagate.",
            });
        }
    } catch (e) {
        steps.push({
            step: "2_list_workspaces",
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }

    // ─── Step 3: Get specific workspace ─────────────────
    try {
        const res = await pbiFetch(accessToken, `${POWERBI_API}/groups/${workspaceId}`);
        const body = await res.text();
        if (res.ok) {
            const data = JSON.parse(body);
            steps.push({
                step: "3_get_workspace",
                ok: true,
                detail: { id: data.id, name: data.name, type: data.type, isOnDedicatedCapacity: data.isOnDedicatedCapacity },
            });
        } else {
            steps.push({
                step: "3_get_workspace",
                ok: false,
                status: res.status,
                rawBody: body.substring(0, 500),
                error: `Cannot access workspace ${workspaceId} (${res.status}).`,
                fix:
                    "In Power BI → open the workspace → Access → Add your app (search by app name from Azure AD) as Admin or Member.\n" +
                    "Make sure the workspace is a 'new experience' (V2) workspace, not a classic one.",
            });
        }
    } catch (e) {
        steps.push({
            step: "3_get_workspace",
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }

    // ─── Step 4: List reports in workspace ──────────────
    try {
        const res = await pbiFetch(accessToken, `${POWERBI_API}/groups/${workspaceId}/reports`);
        const body = await res.text();
        if (res.ok) {
            const data = JSON.parse(body);
            const reports = (data.value ?? []).map((r: { id: string; name: string; datasetId: string }) => ({
                id: r.id,
                name: r.name,
                datasetId: r.datasetId,
            }));
            const targetFound = reports.some((r: { id: string }) => r.id === reportId);
            steps.push({
                step: "4_list_reports",
                ok: true,
                detail: { count: reports.length, targetReportFound: targetFound, reports },
            });
            if (!targetFound) {
                steps.push({
                    step: "4b_report_not_in_workspace",
                    ok: false,
                    error: `Report ${reportId} was NOT found in workspace ${workspaceId}. The report might be in a different workspace.`,
                    fix: "Double-check POWERBI_DEFAULT_REPORT_ID and POWERBI_WORKSPACE_ID in .env. Open the report in Power BI Service and copy the IDs from the URL.",
                });
            }
        } else {
            steps.push({
                step: "4_list_reports",
                ok: false,
                status: res.status,
                rawBody: body.substring(0, 500),
                error: `Cannot list reports in workspace (${res.status}).`,
                fix: "If 500: Service Principal not allowed by Power BI Tenant. See step 2 fix.\n" +
                    "If 403: Service Principal not added to the workspace. See step 3 fix.\n" +
                    "If 404: Workspace ID is incorrect.",
            });
        }
    } catch (e) {
        steps.push({
            step: "4_list_reports",
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }

    // ─── Step 5: Get specific report ────────────────────
    let datasetId: string | undefined;
    try {
        const res = await pbiFetch(
            accessToken,
            `${POWERBI_API}/groups/${workspaceId}/reports/${reportId}`
        );
        const body = await res.text();
        if (res.ok) {
            const data = JSON.parse(body);
            datasetId = data.datasetId;
            steps.push({
                step: "5_get_report",
                ok: true,
                detail: { id: data.id, name: data.name, datasetId: data.datasetId, embedUrl: data.embedUrl },
            });
        } else {
            steps.push({
                step: "5_get_report",
                ok: false,
                status: res.status,
                rawBody: body.substring(0, 500),
                error: `Cannot get report (${res.status}).`,
                fix:
                    res.status === 500
                        ? "This 500 almost always means the tenant has NOT allowed Service Principals. Complete step 2 fix."
                        : res.status === 404
                            ? "Report not found. Check the report ID."
                            : res.status === 403
                                ? "Service Principal cannot access. Add it to workspace as Admin."
                                : `Unexpected ${res.status}. Check the raw body for details.`,
            });
        }
    } catch (e) {
        steps.push({
            step: "5_get_report",
            ok: false,
            error: e instanceof Error ? e.message : String(e),
        });
    }

    // ─── Step 6: Generate Embed Token (V2) ──────────────
    if (datasetId) {
        try {
            const tokenBody = {
                reports: [{ id: reportId }],
                datasets: [{ id: datasetId }],
            };
            const res = await pbiFetch(accessToken, `${POWERBI_API}/GenerateToken`, {
                method: "POST",
                body: JSON.stringify(tokenBody),
            });
            const body = await res.text();
            if (res.ok) {
                const data = JSON.parse(body);
                steps.push({
                    step: "6_generate_embed_token",
                    ok: true,
                    detail: { tokenLength: data.token?.length ?? 0, expiration: data.expiration },
                });
            } else {
                steps.push({
                    step: "6_generate_embed_token",
                    ok: false,
                    status: res.status,
                    rawBody: body.substring(0, 500),
                    error: `Embed token generation failed (${res.status}).`,
                    fix:
                        "Possible causes:\n" +
                        "- Workspace not assigned to a Power BI Embedded capacity (A/EM/F SKU).\n" +
                        "- For development without capacity, use legacy GenerateToken endpoint.\n" +
                        "- Service principal not Admin on workspace.\n" +
                        "- 'Embed content in apps' not enabled in Power BI tenant settings.",
                });
            }
        } catch (e) {
            steps.push({
                step: "6_generate_embed_token",
                ok: false,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }

    const allOk = steps.every((s) => s.ok);
    return NextResponse.json(
        {
            ok: allOk,
            summary: allOk
                ? "All checks passed! Power BI Embedded is fully configured."
                : `Failed at: ${steps
                    .filter((s) => !s.ok)
                    .map((s) => s.step)
                    .join(", ")}`,
            sdkInfo: {
                scope: "https://analysis.windows.net/powerbi/api/.default",
                apiBase: "https://api.powerbi.com/v1.0/myorg",
                clientLib: "powerbi-client + powerbi-client-react (NOT Fabric SDK)",
                embeddingModel: "App Owns Data (Service Principal)",
            },
            steps,
        },
        { status: allOk ? 200 : 502 }
    );
}
