# Power BI Embedded Portal — TODO & Build Tracker

**Client:** AB&BCRE  
**Provider:** Klizo Solutions Pvt. Ltd.  
**Reference (design/brand):** abbcre-new-zilla (sibling project in repo). Use for header/footer style, colors, and copy.

---

## Design reference (abbcre-new-zilla)

| Item        | Reference / value |
|------------|-------------------|
| **Brand primary** | `#0d4477` (header, buttons, links) |
| **Brand secondary** | `#5289BC` (accents, icons) |
| **Site name** | AB&B \| COMMERCIAL REAL ESTATE |
| **Footer** | Copyright, Privacy Policy, Terms & Conditions; tenant portal link as needed |
| **Layout** | Header with nav, main content, footer (container max-width, responsive) |

All site copy and URLs are configurable via env (see [README](../README.md) and `.env.example`).

---

## SOW Phase checklist

### Phase 1: Infrastructure & Environment Setup
- [x] Azure AD App Registration created
- [x] Service Principal credentials (Client ID, Client Secret, Tenant ID) in `.env`
- [ ] Power BI dedicated "Embedded" workspace (client)
- [ ] Service Principal assigned as Admin to workspace (client)
- [ ] Power BI tenant settings: allow API access for Service Principal (client)
- [ ] **POWERBI_WORKSPACE_ID** set when workspace is ready

### Phase 2: Backend Development (Next.js API)
- [x] **Authentication Service:** API route to authenticate with Azure AD (Service Principal) — `/api/auth/azure-token`, used internally by embed token
- [x] **Token Generation:** Embed token from Power BI REST API — `/api/embed-token?reportId=...&workspaceId=...&roles=...`
- [x] **User-to-Data Mapping:** DB lookup (users ↔ report IDs, security roles) — Prisma schema + `/api/reports`, `/api/reports/seed`
- [x] Database: Neon PostgreSQL + Prisma (User, PowerBIReport, UserReportRole)

### Phase 3: Frontend Development (Next.js/React)
- [x] **Embed component:** Report container (iframe) — `ReportEmbed`; ready for `powerbi-client-react` when report is available
- [x] **Dynamic rendering:** Reports page lists reports for user and embeds selected report (permissions from DB)
- [x] **UI integration:** Layout (header/footer), report container styled; AB&BCRE brand colors applied
- [ ] (Optional) Replace iframe with `powerbi-client-react` for full Power BI SDK features once a real report is available

### Phase 4: Security Configuration & Testing
- [ ] RLS structure doc: define role names and how analysts tag reports (for client)
- [ ] System verification with placeholder report: auth → correct report per user → RLS passed to Power BI
- [ ] UAT and deployment

---

## Out of scope (per SOW)
- Report creation/design: no .pbix, charts, or data model work.

---

## Implemented so far (summary)

| Area | What was built |
|------|----------------|
| **Config** | `src/config/env.ts` (server), `src/config/site.ts` (NEXT_PUBLIC_*); no hardcoded values |
| **DB** | Prisma schema (User, PowerBIReport, UserReportRole); Neon connection; seed route |
| **Auth** | Azure AD client-credentials token (`getAzureAccessToken`); used by embed token |
| **Embed token** | `getEmbedToken(reportId, workspaceId, roles)`; returns 503 when workspace not set |
| **APIs** | `GET /api/health`, `GET /api/auth/azure-token`, `GET /api/embed-token`, `GET /api/reports`, `GET /api/reports/seed` |
| **Frontend** | Root layout (Header + Footer), Home, Reports page, ReportEmbed, ReportList; all copy/URLs from config |
| **Design** | AB&BCRE primary/secondary colors; header/footer aligned with abbcre-new-zilla reference |

---

## Next steps (recommended order)
1. Run `npx prisma migrate dev` and `GET /api/reports/seed` once.
2. When client provides **POWERBI_WORKSPACE_ID** and a sample report ID, add the report to DB and test embed.
3. Replace mock user (header / demo) with real auth (e.g. NextAuth) when required.
4. Add RLS role names to seed/DB and pass them in embed token for Phase 4 testing.
