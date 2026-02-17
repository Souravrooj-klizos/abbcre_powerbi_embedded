/**
 * Server-side and shared env. No secrets here; only keys and safe defaults.
 * Use in API routes and server components. For client, use NEXT_PUBLIC_* only.
 */

function getEnv(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v !== undefined && v !== "") return v;
  if (fallback !== undefined) return fallback;
  return "";
}

/** Azure AD — required for Power BI API */
export const env = {
  azure: {
    clientId: getEnv("AZURE_CLIENT_ID"),
    clientSecret: getEnv("AZURE_CLIENT_SECRET"),
    tenantId: getEnv("AZURE_TENANT_ID"),
  },
  powerBi: {
    workspaceId: getEnv("POWERBI_WORKSPACE_ID"),
    defaultReportId: getEnv("POWERBI_DEFAULT_REPORT_ID"),
  },
  database: {
    url: getEnv("DATABASE_URL"),
  },
  app: {
    url: getEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  },
  /** Dev/seed only: demo user email for mock auth */
  seed: {
    demoUserEmail: getEnv("SEED_DEMO_USER_EMAIL", "demo@abbcre.com"),
    placeholderWorkspaceId: getEnv("SEED_PLACEHOLDER_WORKSPACE_ID", "00000000-0000-0000-0000-000000000000"),
    placeholderReportId: getEnv("SEED_PLACEHOLDER_REPORT_ID", "00000000-0000-0000-0000-000000000001"),
    defaultRlsRole: getEnv("SEED_DEFAULT_RLS_ROLE", "Viewer"),
    placeholderReportName: getEnv("SEED_PLACEHOLDER_REPORT_NAME", "Sample Report (placeholder)"),
  },
  /** Header name for mock user id in dev (e.g. x-mock-user-id). Value "demo" resolves to seed demo user. */
  mockUserHeader: getEnv("MOCK_USER_HEADER", "x-mock-user-id"),
} as const;
