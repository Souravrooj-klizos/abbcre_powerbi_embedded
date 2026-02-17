/**
 * SOW Phase 3: Reports page — dynamic report container based on user permissions.
 * Power BI report + ArcGIS map with bi-directional filter sync.
 *
 * How sync works:
 *   1. User clicks a data point in Power BI → ArcGIS map filters to matching features.
 *   2. User clicks a feature on the ArcGIS map → Power BI report filters to that record.
 *   3. Shared state is managed by MapReportFilterProvider (React Context).
 */

import { ReportList } from "./ReportList";
import { ArcGISMapWrapper } from "@/components/maps/ArcGISMapWrapper";
import { FilterSyncProvider } from "./FilterSyncProvider";

export default function ReportsPage() {
  return (
    <FilterSyncProvider>
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Reports</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Select a report below. The correct report loads based on your
          permissions (user-to-report mapping).
        </p>
        <ReportList />

        {/* ArcGIS Map — syncs filters with the Power BI report above */}
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            ArcGIS Map
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
            Click a data point in the report to filter the map, or click a
            feature on the map to filter the report.
          </p>
          <ArcGISMapWrapper height="600px" />
        </section>
      </main>
    </FilterSyncProvider>
  );
}
