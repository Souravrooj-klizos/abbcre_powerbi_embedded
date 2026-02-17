/**
 * Shared TypeScript types for the Power BI Embedded Portal.
 * Extend with report, user, and RLS types as you build.
 */

// Power BI report reference (from DB or API)
export type PowerBIReport = {
  id: string;
  reportId: string; // Power BI report GUID
  workspaceId: string;
  name?: string;
};

// User–report–role mapping (for RLS)
export type UserReportRole = {
  userId: string;
  reportId: string;
  roleName: string;
};
