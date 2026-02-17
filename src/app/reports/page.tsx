/**
 * SOW Phase 3: Reports page — dynamic report container based on user permissions.
 * Power BI report + ArcGIS map with bi-directional filter sync.
 *
 * Layout: The ArcGIS map is embedded inside the report area as a toggleable
 * overlay panel, positioned where the native "ArcGIS for Power BI not supported"
 * error would appear. This gives the appearance of a single integrated view.
 */

import { ReportList } from "./ReportList";
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
      </main>
    </FilterSyncProvider>
  );
}
