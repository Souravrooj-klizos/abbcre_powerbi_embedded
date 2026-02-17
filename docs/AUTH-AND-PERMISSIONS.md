# How we know the user is authentic and what their permissions (RLS) are

Short answers: **authentic** = from login/session (we don’t have real login yet); **permissions/RLS** = from the DB lookup table. Below is how it works and how to create users.

---

## 1. How we know the user is authentic (today vs later)

| Today | Later (when you add real login) |
|-------|----------------------------------|
| We **don’t** verify identity. We trust a dev header: `x-mock-user-id: demo` or `?userId=...`. | User logs in (e.g. NextAuth, or client’s auth) → we get a **session** with **user id** (and maybe email). |
| Anyone who sends the header can pretend to be that user. | Only someone who passed login gets a session; we use **session user id** everywhere. |

So: **“User is authentic”** = we trust the **session** (or, for now, the mock header). Once you add a real login (e.g. NextAuth), the app will use the session’s user id and stop using the mock header.

---

## 2. How we know their permissions (RLS)

Permissions are **not** in the login response. They come from **our database**.

1. We know **who** the user is → **user id** (from session, or mock header today).
2. We look up **what they can see** in the **lookup table** → `UserReportRole` (and `PowerBIReport`).
3. That gives us: **reportId**, **workspaceId**, **roleName** (the RLS role name we send to Power BI).

Flow in code:

- **`/api/reports`**  
  - Input: current user id (from session or mock).  
  - Query: `UserReportRole` where `userId = current user`, include `PowerBIReport`.  
  - Output: list of reports + **roleName** per report (that’s the RLS role for Power BI).

- **`/api/embed-token`**  
  - Input: `reportId`, `workspaceId`, `roles` (e.g. the **roleName** from the list above).  
  - We request an embed token **with that role** → Power BI applies RLS (filters rows by that role).

So: **“Their permission (RLS)”** = we read it from **`UserReportRole.roleName`** for that user and that report, then pass it to Power BI when getting the embed token.

---

## 3. How to create users and set permissions

Users and permissions live in **our DB** (Neon/PostgreSQL), not in Power BI.

### Create a user

Add a row to the **`User`** table (e.g. via Prisma, SQL, or a future “sign up” / admin UI):

```ts
// Example: create user (e.g. in a seed script or admin API)
await prisma.user.create({
  data: {
    email: "john@abbcre.com",
    name: "John Doe",
  },
});
```

Or raw SQL:

```sql
INSERT INTO "User" (id, email, name, "createdAt", "updatedAt")
VALUES ('cuid-here', 'john@abbcre.com', 'John Doe', NOW(), NOW());
```

(Use a real `cuid()` or UUID for `id`.)

### Give them permission to a report (and RLS role)

1. You need a **report** in **`PowerBIReport`** (one row per Power BI report you want to show).
2. Then add a row in **`UserReportRole`** linking that user to that report and the **RLS role name**:

```ts
// Example: let this user see this report with RLS role "Viewer"
await prisma.userReportRole.create({
  data: {
    userId: user.id,
    powerbiReportId: report.id,  // our PowerBIReport.id (from DB)
    roleName: "Viewer",          // must match an RLS role name in the Power BI .pbix
  },
});
```

So:

- **Create user** = insert into `User`.
- **Set permission (and RLS)** = insert into `UserReportRole` with the right **roleName** (same name the analyst defined in Power BI for that report’s RLS).

---

## 4. Where RLS role names come from

| Where | Who sets it | Purpose |
|-------|-------------|---------|
| **Power BI (.pbix)** | Client’s analyst | Defines **which rows** each role can see (DAX filters). |
| **Our DB (`UserReportRole.roleName`)** | You / client / script / future admin | Stores **which role** we use for this user + report when calling Power BI. |

The **same string** (e.g. `"Viewer"`, `"Region_EMEA"`) must exist:

1. In Power BI as an RLS role on the report’s dataset, and  
2. In our DB as `UserReportRole.roleName` for that user and report.

Then we pass that `roleName` in the embed token request so Power BI can apply the right RLS.

---

## 5. Summary

| Question | Answer |
|----------|--------|
| How do we know the user is **authentic**? | **Today:** we don’t; we use a mock header. **Later:** login (e.g. NextAuth) gives a session; we use the session’s user id. |
| How do we **create** users? | Insert into **`User`** (e.g. via Prisma, SQL, or a sign-up/admin flow). |
| How do we know their **permissions (RLS)**? | Read **`UserReportRole`** for that user id → get **reportId**, **workspaceId**, **roleName**; pass **roleName** to Power BI when getting the embed token. |
| Who sets RLS role names? | **Analyst** in Power BI (defines the role). **You/client** in our DB (set `UserReportRole.roleName` to that same name). |

If you want, next step can be: add a **login page** (e.g. NextAuth) and replace the mock header with the session user id in `/api/reports` and the Reports page.
