/**
 * Site copy and URLs from env. Use NEXT_PUBLIC_* so client components can read them.
 */

function getPublicEnv(key: string, fallback: string): string {
  const v = process.env[key];
  return (v !== undefined && v !== "") ? v : fallback;
}

export const site = {
  appName: getPublicEnv("NEXT_PUBLIC_APP_NAME", "AB&B | Power BI Portal"),
  footer: {
    copyright: getPublicEnv("NEXT_PUBLIC_FOOTER_COPYRIGHT", "AB&B Commercial Real Estate"),
    privacyUrl: getPublicEnv("NEXT_PUBLIC_FOOTER_PRIVACY_URL", "https://abbcre.com/privacy-policy/"),
    termsUrl: getPublicEnv("NEXT_PUBLIC_FOOTER_TERMS_URL", "#"),
  },
  nav: {
    homeLabel: getPublicEnv("NEXT_PUBLIC_NAV_HOME_LABEL", "Home"),
    reportsLabel: getPublicEnv("NEXT_PUBLIC_NAV_REPORTS_LABEL", "Reports"),
  },
  /** For dev: mock user id value sent in header to /api/reports (e.g. "demo"). */
  mockUserId: getPublicEnv("NEXT_PUBLIC_MOCK_USER_ID", "demo"),
  /** Header name for mock user (must match server MOCK_USER_HEADER). */
  mockUserHeaderName: getPublicEnv("NEXT_PUBLIC_MOCK_USER_HEADER_NAME", "x-mock-user-id"),
} as const;
