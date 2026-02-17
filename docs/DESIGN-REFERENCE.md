# Design reference — AB&BCRE

Reference project for branding and layout: **abbcre-new-zilla** (main AB&BCRE site in this repo).

## Brand

| Token | Value | Usage |
|-------|--------|--------|
| Primary | `#0d4477` | Header background, primary buttons, links |
| Secondary | `#5289BC` | Accents, icons |

Defined in `tailwind.config.ts` as `abbcre.primary` and `abbcre.secondary`, and in `src/app/globals.css` as CSS variables.

## Copy and URLs

All user-facing text and links are driven by env (no hardcoding):

- **App name:** `NEXT_PUBLIC_APP_NAME`
- **Footer copyright:** `NEXT_PUBLIC_FOOTER_COPYRIGHT`
- **Footer links:** `NEXT_PUBLIC_FOOTER_PRIVACY_URL`, `NEXT_PUBLIC_FOOTER_TERMS_URL`
- **Nav labels:** `NEXT_PUBLIC_NAV_HOME_LABEL`, `NEXT_PUBLIC_NAV_REPORTS_LABEL`

See `.env.example` and `src/config/site.ts`.
