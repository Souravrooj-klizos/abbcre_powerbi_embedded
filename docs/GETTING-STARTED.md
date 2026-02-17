# How to start the project

## Prerequisites

- **Node.js** 18+ and **npm**
- **`.env`** with Azure credentials, `DATABASE_URL` (Neon), and optional `POWERBI_WORKSPACE_ID` (see root [README](../README.md) and [.env.example](../.env.example)). Next.js and Prisma both read `.env`.

---

## 1. Install dependencies

From the project root:

```bash
cd powerbi-embedded-portal
npm install
```

---

## 2. Database (first time only)

Generate the client and run migrations (`.env` must exist with `DATABASE_URL`; Next.js and Prisma both read `.env`):

```bash
npx prisma generate
npx prisma migrate dev --name init
```

Seed a demo user and placeholder report (run once, or when you reset DB):

- Either open in browser: **http://localhost:3000/api/reports/seed** (after starting the app),  
- Or run the app first (step 3), then visit that URL.

---

## 3. Start the dev server

```bash
npm run dev
```

The app runs at **http://localhost:3000**.

---

## 4. Open the portal

| What | URL |
|------|-----|
| **Home** | http://localhost:3000 |
| **Reports (dashboard)** | http://localhost:3000/reports |

After seeding, the **Reports** page lists reports for the demo user and shows the embed container (placeholder until Power BI workspace/report is set).

---

## Routes overview

### Pages (UI)

| Route | Description |
|-------|-------------|
| `/` | Home; link to Reports. |
| `/reports` | **Dashboard / portal:** list of reports for the current user and Power BI embed container. |
| (any other path) | 404 → “Page not found” with link back home. |

### API (backend)

| Method | Route | Description |
|--------|--------|-------------|
| GET | `/api/health` | Health check (for load balancers / monitoring). |
| GET | `/api/auth/azure-token` | Test Azure AD token (backend only; used internally by embed token). |
| GET | `/api/embed-token?reportId=...&workspaceId=...&roles=...` | Returns Power BI embed URL + token. 503 if workspace/report not configured. |
| GET | `/api/reports` | List reports for current user. Send header `x-mock-user-id: demo` (or `?userId=...`) for dev. |
| GET | `/api/reports/seed` | One-time seed: demo user + placeholder report. Run once after migrations. |

---

## Quick checklist

1. `npm install`
2. Copy `.env.example` → `.env` and fill Azure + `DATABASE_URL`
3. `npx prisma generate` then `npx prisma migrate dev --name init`
4. `npm run dev`
5. Open **http://localhost:3000/api/reports/seed** once
6. Open **http://localhost:3000/reports** for the dashboard/portal
