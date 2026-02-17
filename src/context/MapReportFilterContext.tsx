"use client";

/**
 * Shared filter state between Power BI report and ArcGIS map.
 *
 * Flow:
 *   Power BI visual click → dataSelected event → setFilters(source: "powerbi")
 *     → ArcGIS reads activeFilters → applies definitionExpression on layers
 *
 *   ArcGIS map click → feature attributes → setFilters(source: "arcgis")
 *     → Power BI reads activeFilters → applies report.setFilters()
 *
 * Both components ignore filters they themselves emitted (checked via `source`).
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type FilterEntry = {
  /** The field/column name (using the ArcGIS field name as canonical key). */
  field: string;
  /** The Power BI table.column for applying filters back to the report. */
  powerbiTable?: string;
  powerbiColumn?: string;
  /** Filter value(s). */
  values: (string | number)[];
  /** Which side emitted this filter. */
  source: "powerbi" | "arcgis";
};

type MapReportFilterContextType = {
  activeFilters: FilterEntry[];
  setFilters: (filters: FilterEntry[]) => void;
  clearFilters: () => void;
};

const MapReportFilterContext = createContext<MapReportFilterContextType>({
  activeFilters: [],
  setFilters: () => {},
  clearFilters: () => {},
});

export function MapReportFilterProvider({ children }: { children: ReactNode }) {
  const [activeFilters, setActiveFilters] = useState<FilterEntry[]>([]);

  const setFilters = useCallback((filters: FilterEntry[]) => {
    setActiveFilters(filters);
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const value = useMemo(
    () => ({ activeFilters, setFilters, clearFilters }),
    [activeFilters, setFilters, clearFilters],
  );

  return (
    <MapReportFilterContext.Provider value={value}>
      {children}
    </MapReportFilterContext.Provider>
  );
}

export function useMapReportFilters() {
  return useContext(MapReportFilterContext);
}
