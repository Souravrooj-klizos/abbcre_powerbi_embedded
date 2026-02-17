# How login, permissions & RLS work (per SOW)

Diagrams: **ER diagram** (database), **flowcharts**, and **sequence diagram**. Who logs in, who sets permissions, how RLS is used.

---

## 1. ER diagram — database (lookup tables)

```mermaid
erDiagram
  User ||--o{ UserReportRole : "has"
  PowerBIReport ||--o{ UserReportRole : "has"
  User {
    string id PK
    string email UK
    string name
    string createdAt
    string updatedAt
  }
  PowerBIReport {
    string id PK
    string reportId
    string workspaceId
    string name
    string createdAt
    string updatedAt
  }
  UserReportRole {
    string id PK
    string userId FK
    string powerbiReportId FK
    string roleName
    string createdAt
  }
```

**Relations:** One user can have many report-role assignments. One report can be assigned to many users (with same or different roles). `UserReportRole` is the lookup: “user X can see report Y with RLS role Z.”

---

## 2. System architecture flowchart

```mermaid
flowchart TB
  subgraph "Browser"
    UI[Reports page / iframe]
  end

  subgraph "Next.js app"
    API_reports["/api/reports"]
    API_embed["/api/embed-token"]
    API_auth["/api/auth/azure-token"]
  end

  subgraph "External"
    DB[(Neon PostgreSQL)]
    Azure[Azure AD]
    PBI[Power BI Service]
  end

  UI -->|"List reports"| API_reports
  API_reports --> DB
  UI -->|"Get embed token"| API_embed
  API_embed --> API_auth
  API_auth --> Azure
  API_embed --> PBI
  UI -->|"Load report"| PBI
```

---

## 3. High-level: who does what

```mermaid
flowchart LR
  subgraph "Client / AB&BCRE (out of scope or manual)"
    A[Analyst] -->|"Publish .pbix, define RLS roles in Power BI"| PBI[Power BI Service]
    B[Whoever manages users] -->|"Assign user ↔ report ↔ role (e.g. in DB)"| DB[(Lookup DB)]
  end

  subgraph "What we build (Portal)"
    U[Web user] -->|"1. Login"| Portal[Next.js Portal]
    Portal -->|"2. Who is this user?"| Auth[Auth / Session]
    Auth -->|"3. Which reports + roles?"| DB
    Portal -->|"4. Get embed token (with RLS roles)"| API[Our API]
    API -->|"5. Token + roles"| PBI
    PBI -->|"6. Filtered report (RLS applied)"| Portal
    Portal -->|"7. Show report"| U
  end
```

| Who | Responsibility |
|-----|----------------|
| **Client’s analyst** | Build reports in Power BI; define **RLS roles** in the .pbix (e.g. "Region_EMEA", "Viewer"). |
| **Whoever manages users** | Assign which **web user** can see which **report** and with which **role** (stored in our lookup DB; today can be manual/script, later optional admin UI). |
| **Web user** | Logs in to the portal and sees only the reports (and rows) they are allowed to see. |
| **Our portal** | Identifies the user, reads permissions from DB, requests embed token with the right RLS roles, and shows the report. |

---

## 4. End-to-end flow: login → report with RLS

```mermaid
sequenceDiagram
  participant U as Web user
  participant Portal as Next.js Portal
  participant DB as Lookup DB (Neon)
  participant API as Our API (embed token)
  participant Azure as Azure AD
  participant PBI as Power BI Service

  U->>Portal: 1. Login (future: NextAuth / client auth)
  Portal->>Portal: 2. Session: who is this user? (e.g. user id)

  U->>Portal: 3. Open Reports page
  Portal->>API: 4. GET /api/reports (with user id from session)
  API->>DB: 5. Query: reports + RLS roles for this user
  DB-->>API: 6. List of (reportId, workspaceId, roleName)
  API-->>Portal: 7. Reports list

  Portal->>API: 8. GET /api/embed-token?reportId=&workspaceId=&roles=...
  API->>Azure: 9. Get Azure AD token (Service Principal)
  Azure-->>API: 10. Access token
  API->>PBI: 11. Generate embed token (with identities/roles for RLS)
  PBI-->>API: 12. Embed token + embed URL
  API-->>Portal: 13. Embed token + URL

  Portal->>Portal: 14. Render iframe with embed URL + token
  Portal->>PBI: 15. Load report (token in iframe)
  PBI->>PBI: 16. Apply RLS: filter rows by role
  PBI-->>U: 17. Show filtered report
```

So: **login** identifies the user, **DB** holds “who can see which report with which role”, **embed token** is requested with those **RLS roles**, and **Power BI** applies RLS and returns the filtered report.

---

## 5. Where permissions and RLS are set

```mermaid
flowchart TB
  subgraph "Defined in Power BI (by client's analyst)"
    RLS[RLS roles in .pbix e.g. Region_EMEA, Viewer]
    RLS -->|"Filter rules (DAX)"| Data[Dataset rows]
  end

  subgraph "Stored in our DB (lookup table)"
    User[(User)]
    Report[(PowerBIReport)]
    Map[(UserReportRole)]
    User --> Map
    Report --> Map
    Map -->|"roleName = RLS role name"| RLS
  end

  subgraph "Who fills the lookup?"
    Human[Client / Admin] -->|"Assign user ↔ report ↔ role"| Map
  end
```

- **RLS** = defined in Power BI (which role sees which rows). We never create or edit .pbix (out of scope).
- **Who sees which report and with which role** = stored in our DB (`User`, `PowerBIReport`, `UserReportRole`). Who fills that (manual, script, or future admin UI) is up to the client.

---

## 6. One-page overview (simplified)

```mermaid
flowchart LR
  subgraph "Setup (once)"
    A[Analyst: RLS in Power BI] --> PBI[Power BI]
    B[Assign user ↔ report ↔ role] --> DB[(DB)]
  end

  subgraph "Every time a user opens a report"
    U[User logs in] --> Portal[Portal]
    Portal --> DB
    DB -->|"reportId, roleName"| Portal
    Portal --> API[Get embed token with role]
    API --> PBI
    PBI -->|"Filtered by RLS"| U
  end
```

---

## 7. Summary table (per SOW)

| What | Where | Who |
|------|--------|-----|
| **Who can log in** | Auth (future: NextAuth / client auth) | Web users (AB&BCRE’s users) |
| **Who can see which report** | Lookup DB (`UserReportRole`) | Set by client (manual/script or future admin) |
| **Which RLS role is used per user/report** | Same lookup (`UserReportRole.roleName`) | Same as above |
| **Definition of RLS (which rows each role sees)** | Power BI (.pbix) | Client’s analyst |
| **Applying RLS** | Power BI Service | We pass role names in embed token; Power BI filters rows |

---

*Diagrams use Mermaid. You can view them in GitHub, VS Code (with a Mermaid extension), or any Markdown viewer that supports Mermaid.*
