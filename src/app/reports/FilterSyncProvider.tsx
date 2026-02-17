"use client";

/**
 * Client-side wrapper that provides the shared filter context
 * to both the Power BI embed and the ArcGIS map.
 */

import { MapReportFilterProvider } from "@/context/MapReportFilterContext";
import type { ReactNode } from "react";

export function FilterSyncProvider({ children }: { children: ReactNode }) {
  return <MapReportFilterProvider>{children}</MapReportFilterProvider>;
}
