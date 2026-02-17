# Why we need a database (Power BI doesn’t do this)

Power BI does **not** know who your **web users** are or which report/role each of them gets. That’s why the SOW asks for a **lookup table** (our DB).

---

## What Power BI knows vs what it doesn’t

| Power BI has | Power BI does **not** have |
|--------------|----------------------------|
| Workspaces, reports, datasets | A list of “your” app users (people who log into abbcre.com) |
| RLS **role definitions** (e.g. “Viewer”, “Region_EMEA”) and which **rows** each role sees | Who (which of your users) is allowed to see which report |
| Ability to **apply** RLS when we pass a role in the embed token | The mapping: “User John → Report A → role Viewer” |

So: Power BI has **reports + RLS rules**. It does **not** have “which of our website users can open which report and with which role.” That mapping has to live somewhere → **our database**.

---

## What the SOW says

> **User-to-Data Mapping:** Creation of the **database logic (Lookup Table)** to map the **Client's web users** to specific **Power BI Report IDs** and **Security Roles**.

So the contract explicitly requires:

- **Web users** = people who use your app (abbcre.com / this portal).
- **Lookup** = for each web user, which Power BI report(s) they can see and with which **security/RLS role**.
- That lookup is **database logic** (our DB), not something Power BI provides.

---

## Flow in one picture

```
Your app users (e.g. John, Jane)  →  live in YOUR system (our DB: User table)
         ↓
Who can see which report?        →  stored in OUR DB (UserReportRole: John → Report A → "Viewer")
         ↓
When John opens the app          →  we read DB → "John can see Report A with role Viewer"
         ↓
We ask Power BI for embed token  →  we pass role "Viewer"; Power BI applies RLS (filters rows)
         ↓
Power BI returns the report      →  John sees only the rows allowed for "Viewer"
```

Power BI never sees “John” or your user list. It only sees: “Give me an embed token for Report A with role **Viewer**.” So we need the DB to know: “For this logged-in user (John), use Report A and role Viewer.”

---

## Short answer

| Question | Answer |
|----------|--------|
| Why can’t Power BI do everything? | Power BI doesn’t manage your **web users** or the **mapping** “user → report → role.” It only has reports and RLS definitions. |
| Why do we need the DB? | To store **who** (our users) can see **which report** and with **which RLS role**. That’s the “User-to-Data Mapping” in the SOW. |
| Does Power BI have a user list? | It has **Power BI users** (e.g. Pro license). Our **portal users** (people on abbcre.com) are separate and live in our app + DB. |

So: **DB = lookup table** so we know, for each of *our* users, which Power BI report and which role to use. Power BI then only does: “embed this report and apply this role (RLS).”
