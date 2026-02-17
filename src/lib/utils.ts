/**
 * Merge class names for Tailwind. Add tailwind-merge later for conflict handling.
 */
export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
