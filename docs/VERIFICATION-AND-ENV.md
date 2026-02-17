# Verification vs SOW + How .env & database work

Use this to confirm the project matches the SOW and to understand required env vars and DB usage.

---

## 1. SOW verification — are we going correctly?

**Yes.** The implementation matches the SOW. Checklist below.

### Phase 1: Infrastructure & Environment Setup

| SOW item | Status | Notes |
|----------|--------|------|
| Azure AD App Registration | ✅ Done | You created it; credentials in `.env` |
| Service Principal, API credentials | ✅ Done | `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` in `.env` |
| Power BI "Embedded" workspace | ⏳ Client | Client creates workspace; you’ll set `POWERBI_WORKSPACE_ID` when they provide it |
| Service Principal as Admin on workspace | ⏳ Client | Client does this in Power BI |
| Tenant settings for API access | ⏳ Client | Client enables in Power BI admin |

### Phase 2: Backend (Next.js API)

| SOW item | Status | Implementation |
|----------|--------|----------------|
| Authentication with Azure AD (Service Principal) | ✅ Done | `getAzureAccessToken()` in `src/lib/auth/azure.ts`; used by embed token |
| Embed tokens from Power BI REST API | ✅ Done | `getEmbedToken()` in `src/lib/powerbi/embed-token.ts`; `GET /api/embed-token` |
| User-to-Data Mapping (lookup table) | ✅ Done | Prisma schema: `User`, `PowerBIReport`, `UserReportRole`; `GET /api/reports` reads by user |

### Phase 3: Frontend (Next.js/React)

| SOW item | Status | Implementation |
|----------|--------|----------------|
| Embed component | ✅ Done | `ReportEmbed` (iframe); can switch to `powerbi-client-react` when report is live |
| Dynamic report by user permissions | ✅ Done | Reports page → `/api/reports` → list + embed by user |
| UI integration (report container) | ✅ Done | Layout, header/footer, styled report area |

### Phase 4: Security & Testing

| SOW item | Status | Notes |
|----------|--------|------|
| RLS structure for client analysts | ⏳ Pending | Doc in `docs/` (e.g. DIAGRAM, AUTH-AND-PERMISSIONS); can add short “RLS role naming” doc for client |
| System verification (auth, correct report, RLS) | ⏳ After PBI | Once `POWERBI_WORKSPACE_ID` + sample report exist |

**Out of scope:** No .pbix or report design — correct.

---

## 2. What you need in `.env`

Copy from `.env.example` to `.env` and fill these. Next.js and Prisma both read `.env`.

### Required for the app to run (Phase 2/3)

| Variable | Purpose | Example / where to get it |
|----------|---------|---------------------------|
| `AZURE_CLIENT_ID` | Service Principal (Power BI API) | Azure Portal → App Registration → Overview |
| `AZURE_CLIENT_SECRET` | Same | App Registration → Certificates & secrets → create secret, copy **Value** |
| `AZURE_TENANT_ID` | Same | Azure Portal → Microsoft Entra ID → Overview (or App Registration) |
| `DATABASE_URL` | PostgreSQL (lookup table) | Neon/Supabase/your Postgres; e.g. `postgresql://user:pass@host/db?sslmode=require` |

### Required when Power BI is ready (Phase 1 complete)

| Variable | Purpose | Example / where to get it |
|----------|---------|---------------------------|
| `POWERBI_WORKSPACE_ID` | Workspace (group) that has reports | Power BI Service → open workspace → URL has `/groups/{this-guid}/` |

### Optional / already have defaults in `.env.example`

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | App base URL (e.g. `http://localhost:3000`) |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_FOOTER_*`, `NEXT_PUBLIC_NAV_*` | Site copy and links |
| `NEXT_PUBLIC_MOCK_USER_ID`, `NEXT_PUBLIC_MOCK_USER_HEADER_NAME` | Dev mock user (e.g. `demo`, `x-mock-user-id`) |
| `SEED_*`, `MOCK_USER_HEADER` | Seed and mock user resolution (optional overrides) |
| `PRISMA_LOG` | Set to `error` for less log noise |

**Minimum to run now:** `AZURE_*` (3) + `DATABASE_URL`. Add `POWERBI_WORKSPACE_ID` when client gives it.

---

## 3. How the database works

- **Role:** Store the **user → report → RLS role** mapping (SOW “User-to-Data Mapping”).
- **Who uses it:** Next.js API routes (Prisma). Not Power BI.
- **When:** On each “list reports” and “get embed token” flow: we need the current user id (from session or mock), then we read from the DB which reports and roles that user has.

**Tables (Prisma schema):**

| Table | Purpose |
|-------|--------|
| `User` | Web users (id, email, name). |
| `PowerBIReport` | Power BI reports we expose (reportId, workspaceId, name). |
| `UserReportRole` | Lookup: which user can see which report with which RLS role (userId, powerbiReportId, roleName). |

**Flow:**

1. User is identified (session or mock header).
2. `GET /api/reports` → query `UserReportRole` (+ `PowerBIReport`) for that user → return list of reports and `roleName`.
3. Frontend asks for embed token with that `reportId` and `roleName`.
4. `GET /api/embed-token` → Azure token → Power BI embed token with role → Power BI applies RLS.

**Creating users and permissions:** Insert into `User`; then insert into `UserReportRole` (and ensure the report exists in `PowerBIReport`). See `docs/AUTH-AND-PERMISSIONS.md` and seed route.

---

## 4. Quick verification checklist

- [ ] `.env` exists (copy from `.env.example`), contains at least `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`, `DATABASE_URL`.
- [ ] `npx prisma generate` and `npx prisma migrate dev` run successfully.
- [ ] `npm run dev` starts; Home and Reports load.
- [ ] `GET /api/health` returns OK.
- [ ] `GET /api/reports/seed` run once; then Reports page shows at least one (placeholder) report.
- [ ] When client provides workspace + report: set `POWERBI_WORKSPACE_ID`, add report to DB, then embed will work for real.

---

**Summary:** You are aligned with the SOW. Phases 2 and 3 are implemented; Phase 1 (Azure) is done on your side; Power BI workspace and Phase 4 testing depend on client. The database holds the user–report–role lookup; `.env` holds Azure, DB, and optional app/config vars as above.
