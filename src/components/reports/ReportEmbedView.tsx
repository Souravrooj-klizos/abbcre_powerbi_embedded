"use client";

/**
 * Client-only Power BI embed view with bi-directional filter sync.
 * The ArcGIS map is rendered as a toggleable overlay panel inside
 * the report container — replacing the "ArcGIS not supported" area.
 *
 * Power BI → ArcGIS:
 *   1. `dataSelected` event — captures clicks on chart data points.
 *   2. `rendered` event — polls active page filters after re-renders.
 *
 * ArcGIS → Power BI:
 *   Watches activeFilters with source="arcgis" and calls report.setFilters().
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PowerBIEmbed } from "powerbi-client-react";
import { models, Report, service } from "powerbi-client";
import type { EventHandler } from "powerbi-client-react";
import dynamic from "next/dynamic";
import {
  useMapReportFilters,
  type FilterEntry,
} from "@/context/MapReportFilterContext";
import { FIELD_MAPPINGS } from "@/config/filter-mapping";

const ArcGISMapWrapper = dynamic(
  () =>
    import("@/components/maps/ArcGISMapWrapper").then(
      (m) => m.ArcGISMapWrapper,
    ),
  { ssr: false },
);

export type ReportEmbedViewProps = {
  reportId: string;
  embedUrl: string;
  accessToken: string;
};

export function ReportEmbedView({
  reportId,
  embedUrl,
  accessToken,
}: ReportEmbedViewProps) {
  const reportRef = useRef<Report | null>(null);
  const { activeFilters, setFilters } = useMapReportFilters();
  const renderedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const [mapPosition, setMapPosition] = useState<"right" | "bottom" | "overlay">("right");

  // ── Helper: push a table/column/value triplet into the filter list ──
  const pushFilter = useCallback(
    (
      filters: FilterEntry[],
      table: string,
      column: string,
      value: string | number,
    ) => {
      const mapping = FIELD_MAPPINGS.find(
        (m) => m.powerbiTable === table && m.powerbiColumn === column,
      );
      const field = mapping?.arcgisField ?? column;

      const existing = filters.find((f) => f.field === field);
      if (existing) {
        if (!existing.values.includes(value)) {
          existing.values.push(value);
        }
      } else {
        filters.push({
          field,
          powerbiTable: table,
          powerbiColumn: column,
          values: [value],
          source: "powerbi",
        });
      }
    },
    [],
  );

  // ── Power BI → ArcGIS: capture data selections (chart clicks) ───────
  const handleDataSelected = useCallback(
    (event?: service.ICustomEvent<unknown>) => {
      if (!event?.detail) return;

      // Log the raw payload so we can debug field names
      console.log("[PowerBI] dataSelected payload:", JSON.stringify(event.detail, null, 2));

      const detail = event.detail as {
        dataPoints?: Array<{
          identity?: Array<{
            target?: { table?: string; column?: string };
            equals?: string | number;
          }>;
          values?: Array<{
            target?: { table?: string; column?: string };
            value?: string | number;
            formattedValue?: string;
          }>;
        }>;
      };

      const dataPoints = detail.dataPoints;
      if (!dataPoints || dataPoints.length === 0) {
        setFilters([]);
        return;
      }

      const newFilters: FilterEntry[] = [];

      for (const dp of dataPoints) {
        // Extract from identity (dimension keys — typically table/column/value)
        for (const id of dp.identity ?? []) {
          const table = id.target?.table;
          const column = id.target?.column;
          const value = id.equals;
          if (table && column && value !== undefined) {
            pushFilter(newFilters, table, column, value);
          }
        }

        // Extract from values (measure/category values)
        for (const v of dp.values ?? []) {
          const table = v.target?.table;
          const column = v.target?.column;
          const value = v.value ?? v.formattedValue;
          if (table && column && value !== undefined) {
            pushFilter(newFilters, table, column, value);
          }
        }
      }

      if (newFilters.length > 0) {
        console.log("[PowerBI] Pushing filters to ArcGIS:", newFilters);
        setFilters(newFilters);
      }
    },
    [setFilters, pushFilter],
  );

  // ── Power BI → ArcGIS: poll active filters after report re-renders ──
  const pollActiveFilters = useCallback(async () => {
    const report = reportRef.current;
    if (!report) return;

    try {
      const pages = await report.getPages();
      const activePage = pages.find((p) => p.isActive);
      if (!activePage) return;

      // Get page-level filters (applied by slicers, filter pane, etc.)
      const pageFilters = await activePage.getFilters();
      if (!pageFilters || pageFilters.length === 0) return;

      const newFilters: FilterEntry[] = [];

      for (const f of pageFilters) {
        // Only handle BasicFilter with "In" operator (slicer selections)
        if (f.filterType !== models.FilterType.Basic) continue;

        const basicFilter = f as models.IBasicFilter;
        const target = basicFilter.target as
          | { table?: string; column?: string }
          | undefined;
        const table = target?.table;
        const column = target?.column;
        const values = basicFilter.values;

        if (!table || !column || !values || values.length === 0) continue;

        for (const val of values) {
          if (val !== undefined && val !== null) {
            pushFilter(
              newFilters,
              table,
              column,
              val as string | number,
            );
          }
        }
      }

      if (newFilters.length > 0) {
        console.log("[PowerBI] Slicer/filter-pane filters →", newFilters);
        setFilters(newFilters);
      }
    } catch (err) {
      // Silently ignore — report may not be fully loaded yet
      console.debug("[PowerBI] Could not poll filters:", err);
    }
  }, [setFilters, pushFilter]);

  const handleRendered = useCallback(() => {
    // Debounce: rendered fires many times; wait 500ms after last one
    if (renderedTimerRef.current) clearTimeout(renderedTimerRef.current);
    renderedTimerRef.current = setTimeout(() => {
      pollActiveFilters();
    }, 500);
  }, [pollActiveFilters]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (renderedTimerRef.current) clearTimeout(renderedTimerRef.current);
    };
  }, []);

  // ── ArcGIS → Power BI: apply incoming filters to the report ─────────
  useEffect(() => {
    const report = reportRef.current;
    if (!report) return;

    const arcgisFilters = activeFilters.filter((f) => f.source === "arcgis");

    if (arcgisFilters.length === 0) {
      report.removeFilters().catch(() => {});
      return;
    }

    const pbiFilters: models.IBasicFilter[] = arcgisFilters
      .filter((f) => f.powerbiTable && f.powerbiColumn)
      .map((f) => ({
        $schema: "http://powerbi.com/product/schema#basic",
        filterType: models.FilterType.Basic,
        target: {
          table: f.powerbiTable!,
          column: f.powerbiColumn!,
        },
        operator: "In",
        values: f.values,
      }));

    if (pbiFilters.length > 0) {
      report.setFilters(pbiFilters).catch((err) => {
        console.error("[PowerBI] Failed to apply filters from ArcGIS:", err);
      });
    }
  }, [activeFilters]);

  // ── Embed configuration ─────────────────────────────────────────────
  const embedConfig: models.IReportEmbedConfiguration = {
    type: "report",
    id: reportId,
    embedUrl,
    accessToken,
    tokenType: models.TokenType.Embed,
    settings: {
      panes: {
        filters: { expanded: false, visible: true },
      },
      background: models.BackgroundType.Transparent,
    },
  };

  const eventHandlers = new Map<string, EventHandler>([
    ["dataSelected", handleDataSelected],
    ["rendered", handleRendered],
    [
      "loaded",
      () => {
        console.log("[PowerBI] Report loaded — filter sync enabled");
      },
    ],
  ]);

  const isOverlay = mapPosition === "overlay";
  const isSideBySide = mapPosition === "right";
  const isStacked = mapPosition === "bottom";

  return (
    <div className="space-y-0">
      {/* Toolbar: map controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded-t-lg">
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="font-medium">ArcGIS Map</span>
          <span className="text-gray-400">|</span>
          <span>Filter sync active</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Position toggle buttons */}
          <div className="flex items-center border border-gray-300 rounded overflow-hidden text-xs">
            <button
              onClick={() => setMapPosition("right")}
              className={`px-2 py-1 transition ${isSideBySide ? "bg-indigo-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
              title="Side by side"
            >
              &#x25EB; Split
            </button>
            <button
              onClick={() => setMapPosition("bottom")}
              className={`px-2 py-1 transition border-l border-gray-300 ${isStacked ? "bg-indigo-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
              title="Map below report"
            >
              &#x25A3; Stack
            </button>
            <button
              onClick={() => setMapPosition("overlay")}
              className={`px-2 py-1 transition border-l border-gray-300 ${isOverlay ? "bg-indigo-500 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
              title="Map overlays report"
            >
              &#x29C9; Overlay
            </button>
          </div>

          {/* Show/hide toggle */}
          <button
            onClick={() => setMapVisible((v) => !v)}
            className={`ml-2 px-3 py-1 text-xs rounded transition font-medium ${
              mapVisible
                ? "bg-indigo-500 text-white hover:bg-indigo-600"
                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            {mapVisible ? "Hide Map" : "Show Map"}
          </button>
        </div>
      </div>

      {/* Report + Map container */}
      <div
        className={`relative border border-t-0 border-gray-200 rounded-b-lg overflow-hidden bg-white shadow-sm ${
          isSideBySide && mapVisible ? "flex" : ""
        }`}
        style={{ minHeight: 500 }}
      >
        {/* Power BI Report */}
        <div
          className={
            isSideBySide && mapVisible
              ? "flex-1 min-w-0"
              : "w-full"
          }
        >
          <PowerBIEmbed
            embedConfig={embedConfig}
            eventHandlers={eventHandlers}
            getEmbeddedComponent={(embedded) => {
              reportRef.current = embedded as Report;
            }}
            cssClassName={`w-full ${isSideBySide && mapVisible ? "min-h-[600px]" : "aspect-video min-h-[500px]"}`}
          />
        </div>

        {/* ArcGIS Map */}
        {mapVisible && (
          <>
            {/* Side-by-side mode */}
            {isSideBySide && (
              <div
                className="border-l border-gray-200 bg-gray-50"
                style={{ width: "45%", minWidth: 350 }}
              >
                <ArcGISMapWrapper height="100%" className="h-full" />
              </div>
            )}

            {/* Stacked mode (below report) */}
            {isStacked && (
              <div className="border-t border-gray-200">
                <ArcGISMapWrapper height="500px" />
              </div>
            )}

            {/* Overlay mode (floating on top of report) */}
            {isOverlay && (
              <div
                className="absolute bottom-3 right-3 rounded-lg shadow-2xl border border-gray-300 overflow-hidden bg-white"
                style={{
                  width: "50%",
                  minWidth: 320,
                  maxWidth: 700,
                  height: "55%",
                  minHeight: 300,
                  zIndex: 20,
                }}
              >
                <div className="flex items-center justify-between px-2 py-1 bg-gray-100 border-b border-gray-200 text-xs text-gray-600">
                  <span className="font-medium">ArcGIS Map</span>
                  <button
                    onClick={() => setMapVisible(false)}
                    className="text-gray-400 hover:text-gray-700 text-sm leading-none"
                    title="Close map overlay"
                  >
                    ✕
                  </button>
                </div>
                <ArcGISMapWrapper height="calc(100% - 28px)" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
