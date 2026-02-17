import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-2">404 — Page not found</h1>
      <Link href="/" className="text-blue-600 underline hover:no-underline">
        Return home
      </Link>
    </main>
  );
}
