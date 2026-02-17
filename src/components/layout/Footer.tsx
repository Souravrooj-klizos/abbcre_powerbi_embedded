import { site } from "@/config/site";

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-auto">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} {site.footer.copyright}
          </p>
          <ul className="flex items-center gap-4 text-sm">
            <li>
              <a
                href={site.footer.privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-abbcre-primary hover:underline"
              >
                Privacy Policy
              </a>
            </li>
            <li>
              <a href={site.footer.termsUrl} className="text-abbcre-primary hover:underline">
                Terms & Conditions
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
