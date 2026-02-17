"use client";

/**
 * Client-only Power BI embed view with bi-directional filter sync.
 *
 * Power BI → ArcGIS:
 *   1. `dataSelected` event — captures clicks on chart data points.
 *      Extracts values from both `identity` (dimension keys) and
 *      `values` (measure/column values) arrays.
 *   2. `rendered` event — after any re-render (including slicer changes),
 *      polls active page filters/slicers and pushes matching ones to context.
 *
 * ArcGIS → Power BI:
 *   Watches activeFilters with source="arcgis" and calls report.setFilters().
 */

import { useCallback, useEffect, useRef } from "react";
import { PowerBIEmbed } from "powerbi-client-react";
import { models, Report, service } from "powerbi-client";
import type { EventHandler } from "powerbi-client-react";
import {
  useMapReportFilters,
  type FilterEntry,
} from "@/context/MapReportFilterContext";
import { FIELD_MAPPINGS } from "@/config/filter-mapping";

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

  return (
    <div className="w-full rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm min-h-[500px]">
      <PowerBIEmbed
        embedConfig={embedConfig}
        eventHandlers={eventHandlers}
        getEmbeddedComponent={(embedded) => {
          reportRef.current = embedded as Report;
        }}
        cssClassName="w-full aspect-video min-h-[500px]"
      />
    </div>
  );
}
