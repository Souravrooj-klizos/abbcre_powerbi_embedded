"use client";

import { ReportEmbed } from "@/components/reports/ReportEmbed";
import { site } from "@/config/site";
import { useEffect, useState } from "react";

type Report = {
  id: string;
  reportId: string;
  workspaceId: string;
  name: string | null;
  roleName: string;
};

export function ReportList() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selected, setSelected] = useState<Report | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports", {
      headers: { [site.mockUserHeaderName]: site.mockUserId },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.reports && data.reports.length > 0) {
          setReports(data.reports);
          setSelected(data.reports[0]);
        } else {
          setMessage(
            data.message ??
              "No reports assigned. Run GET /api/reports/seed once, then use x-mock-user-id with the returned userId."
          );
        }
      })
      .catch(() => setMessage("Failed to load reports."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 p-6 text-gray-500">
        Loading reports…
      </div>
    );
  }

  if (message) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <p className="mb-4">{message}</p>
        <p className="text-sm">
          For dev: call <code className="bg-amber-100 px-1 rounded">GET /api/reports/seed</code> once,
          then reload. The seed creates a demo user and a placeholder report.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelected(r)}
            className={`px-4 py-2 rounded-lg border transition ${
              selected?.id === r.id
                ? "bg-abbcre-primary text-white border-abbcre-primary"
                : "bg-white border-gray-300 hover:border-abbcre-primary text-gray-700"
            }`}
          >
            {r.name ?? r.reportId}
          </button>
        ))}
      </div>
      {selected && (
        <ReportEmbed
          reportId={selected.reportId}
          workspaceId={selected.workspaceId}
        />
      )}
    </div>
  );
}
