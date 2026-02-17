# SOW: Portal, dashboard & roles — what to build

The SOW does **not** use the words "admin", "client portal", or "superadmin". It describes one integration and one kind of user experience. Below is what the SOW implies and what to do.

---

## What the SOW actually says

| SOW wording | Meaning |
|-------------|--------|
| "Client's **web users**" | People who use the AB&BCRE web app (abbcre.com or this portal). |
| "**User-to-Data Mapping**" | Map each web user to which Power BI reports (and RLS roles) they can see. |
| "**correct report** loads for the **correct user**" | Each user only sees reports they are allowed to see. |
| "**logged-in user's permissions**" | Report list and embed are driven by who is logged in. |

So the SOW describes:

- **One portal** where **web users** log in and see **their** reports (no separate "admin" or "client" or "superadmin" portals in the text).

---

## What you have now (fits the SOW)

| Item | Status |
|------|--------|
| **Single portal** | One app: Home + Reports. |
| **Reports page** | Acts as the **dashboard**: list of reports for the current user + embed. |
| **User → reports** | Stored in DB (`User`, `PowerBIReport`, `UserReportRole`). |
| **Who is the user?** | Right now: mock (e.g. `x-mock-user-id: demo`). Later: replace with real login (e.g. NextAuth, or client’s existing auth). |

So: **one dashboard/portal for “web users”** with report list + embed. No admin/superadmin/client split is required by the SOW.

---

## Do you need Admin / Client / Superadmin?

The SOW does **not** require:

- A separate **admin** portal
- A **client** vs **internal** portal
- A **superadmin** role

You only **need** to add these if the **client** asks for them (e.g. "we need an admin to assign reports to users" or "we have clients vs internal staff").

---

## Recommended approach

### 1. Build to the SOW as written (current direction)

- **One portal** = one Next.js app.
- **One “dashboard”** = the **Reports** page: user sees only their reports and the embed.
- **Roles** = RLS roles in Power BI (e.g. "Region_EMEA") stored in `UserReportRole.roleName`, not “admin/client/superadmin” in the app.

No need to add admin/client/superadmin unless the client explicitly asks.

### 2. If the client wants “admin” or “client” or “superadmin”

**Clarify with the client:**

- **Who** are “web users”? (e.g. AB&BCRE staff only, or also external clients?)
- Do they need a **separate admin area** to:
  - Assign reports to users, or
  - Manage users/reports in the DB?
- Do they need **different dashboards** for different types (e.g. “client view” vs “internal view”)?

Then you can add:

- **Option A:** Same app, different **routes** (e.g. `/reports` for everyone, `/admin` for admins only), with role checks.
- **Option B:** Same Reports page for everyone; “admin” = someone who can use an internal tool or DB/backend to manage `User` / `UserReportRole` (no extra UI in this app).
- **Option C:** Separate “admin portal” (e.g. `/admin` with user/report management) if they insist on a dedicated admin UI.

### 3. Naming that matches the SOW

- **Portal** = the whole Next.js app (what you have).
- **Dashboard** = the Reports page (list of reports + embed).
- **Web users** = whoever logs in and sees reports (no “admin/client/superadmin” in the SOW).

You can keep calling it “Power BI Portal” or “Reports dashboard” in the UI and in docs.

---

## Summary

| Question | Answer |
|----------|--------|
| What does the SOW require? | One portal for web users; each user sees only their reports (user-to-data mapping). |
| Admin / client / superadmin? | **Not in the SOW.** Add only if the client asks. |
| What to build now? | Keep the current single portal + Reports dashboard; add real auth when the client provides it; add admin/client/superadmin only after client confirms they need it. |

So: **stick to one portal and one dashboard (Reports)** unless the client explicitly asks for admin, client, or superadmin roles or separate areas.
