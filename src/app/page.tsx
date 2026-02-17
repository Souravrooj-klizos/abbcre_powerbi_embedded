import Link from "next/link";

export default function Home() {
  return (
    <main className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground mb-2">
        AB&BCRE Power BI Portal
      </h1>
      <p className="text-gray-600 dark:text-gray-400 max-w-xl mb-8">
        Power BI Embedded integration (App Owns Data). View reports based on your permissions.
      </p>
      <Link
        href="/reports"
        className="inline-flex items-center px-5 py-2.5 rounded-lg bg-abbcre-primary text-white font-medium hover:opacity-90 transition"
      >
        Go to Reports
      </Link>
    </main>
  );
}
