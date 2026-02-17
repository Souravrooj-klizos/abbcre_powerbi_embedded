"use client";

/**
 * SOW Phase 3: Embed Component — App owns data.
 * Uses powerbi-client-react via dynamic import (ssr: false) to avoid "self is not defined" in Next.js SSR.
 */ 

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const ReportEmbedView = dynamic(
  () => import("./ReportEmbedView").then((m) => m.ReportEmbedView),
  { ssr: false }
);

export type ReportEmbedProps = {
  reportId: string;
  workspaceId?: string;
  /** Not used for now (no RLS/roles). */
  roles?: string[];
  /** Optional: pre-fetched embed config (e.g. from server component). */
  embedConfig?: { embedUrl: string; accessToken: string } | null;
};

export function ReportEmbed({
  reportId,
  workspaceId,
  embedConfig: initialConfig,
}: ReportEmbedProps) {
  const [config, setConfig] = useState<{ embedUrl: string; accessToken: string } | null>(
    initialConfig ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!initialConfig);

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ reportId });
    if (workspaceId) params.set("workspaceId", workspaceId);
    fetch(`/api/embed-token?${params}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => { throw new Error(d.error ?? res.statusText); });
        return res.json();
      })
      .then((data) => {
        setConfig({ embedUrl: data.embedUrl, accessToken: data.accessToken });
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load embed token");
        setConfig(null);
      })
      .finally(() => setLoading(false));
  }, [reportId, workspaceId, initialConfig]);

  if (loading) {
    return (
      <div className="w-full aspect-video bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
        <p className="text-gray-500">Loading report…</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="w-full aspect-video bg-amber-50 rounded-lg flex items-center justify-center border border-amber-200">
        <p className="text-amber-800 text-center px-4">
          {error ?? "Report not configured. Set POWERBI_WORKSPACE_ID and add a report in Power BI."}
        </p>
      </div>
    );
  }

  return (
    <ReportEmbedView
      reportId={reportId}
      embedUrl={config.embedUrl}
      accessToken={config.accessToken}
    />
  );
}
