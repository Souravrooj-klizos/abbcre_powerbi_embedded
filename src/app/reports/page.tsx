/**
 * SOW Phase 3: Reports page — dynamic report container based on user permissions.
 * Lists reports from /api/reports and embeds the selected one (or first).
 * Also includes the ArcGIS map (loaded via OAuth 2.0) to replace the
 * unsupported "ArcGIS for Power BI" embedded visual.
 */

import { ReportList } from "./ReportList";
import { ArcGISMapWrapper } from "@/components/maps/ArcGISMapWrapper";

export default function ReportsPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Reports</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        Select a report below. The correct report loads based on your permissions (user-to-report mapping).
      </p>
      <ReportList />

      {/* ArcGIS Map — replaces the unsupported "ArcGIS for Power BI" visual */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          📍 ArcGIS Map
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
          This map displays the same geographic data from your Power BI report.
          Sign in to ArcGIS when prompted.
        </p>
        <ArcGISMapWrapper height="600px" />
      </section>
    </main>
  );
}
