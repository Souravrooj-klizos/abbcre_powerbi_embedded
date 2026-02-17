import Link from "next/link";
import { site } from "@/config/site";

export function Header() {
  return (
    <header className="bg-abbcre-primary text-white shadow-md">
      <div className="container mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="font-semibold text-lg tracking-tight">
          {site.appName}
        </Link>
        <nav className="flex items-center gap-6">
          <Link href="/" className="hover:opacity-90 transition">
            {site.nav.homeLabel}
          </Link>
          <Link href="/reports" className="hover:opacity-90 transition">
            {site.nav.reportsLabel}
          </Link>
        </nav>
      </div>
    </header>
  );
}
