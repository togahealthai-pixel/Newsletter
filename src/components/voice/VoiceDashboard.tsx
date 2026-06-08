"use client";

import { useState, useEffect } from "react";
import { PieChart, Pie, Tooltip, ResponsiveContainer } from "recharts";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; textColor: string }> = {
  lifted:               { label: "Lifted",            color: "#22c55e", bg: "bg-emerald-50", border: "border-emerald-100", textColor: "text-emerald-700" },
  not_lifted:           { label: "Not Lifted",         color: "#f87171", bg: "bg-red-50",     border: "border-red-100",     textColor: "text-red-600"     },
  inactivity:           { label: "Inactivity",         color: "#f59e0b", bg: "bg-amber-50",   border: "border-amber-100",   textColor: "text-amber-700"   },
  max_duration_reached: { label: "Max Duration",       color: "#8b5cf6", bg: "bg-violet-50",  border: "border-violet-100",  textColor: "text-violet-700"  },
  pending:              { label: "Pending",             color: "#94a3b8", bg: "bg-gray-50",    border: "border-gray-200",    textColor: "text-gray-600"    },
};

const SENTIMENT_COLORS: Record<string, string> = {
  Positive: "#22c55e",
  Neutral:  "#3b82f6",
  Negative: "#ef4444",
  Unknown:  "#9ca3af",
  "Not Called": "#e2e8f0",
};

interface VoiceStats {
  total: number;
  statusCounts: Record<string, number>;
  sentimentCounts: Record<string, number>;
  recentCalls: Record<string, unknown>[];
}

const WEBHOOKS = {
  deleteInactivity:  process.env.NEXT_PUBLIC_VOICE_DELETE_INACTIVITY_URL || "",
  notLiftedToNull:   process.env.NEXT_PUBLIC_VOICE_NOTLIFTED_TO_NULL_URL || "",
  statusChangeToNull: process.env.NEXT_PUBLIC_VOICE_ALLSTATUS_TO_NULL_URL || "",
};

function formatDisplayDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default function VoiceDashboard() {
  const [stats, setStats] = useState<VoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inactivityDone, setInactivityDone] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStats = () => {
    setLoading(true);
    setError("");
    fetch("/api/supabase/voice-stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStats(data);
      })
      .catch(() => setError("Failed to load voice stats"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStats(); }, []);

  const handleRefresh = () => loadStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <svg className="animate-spin w-5 h-5 mr-3" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Loading voice analytics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <button onClick={handleRefresh} className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Exclude pending (null status) from pie — only show rows that were actually called
  const STATUS_PIE_KEYS = ["lifted", "not_lifted", "inactivity", "max_duration_reached"];
  const statusPieData = STATUS_PIE_KEYS
    .map((k) => ({ key: k, value: stats?.statusCounts[k] ?? 0 }))
    .filter(({ value }) => value > 0)
    .map(({ key, value }) => ({ name: STATUS_CONFIG[key].label, value, fill: STATUS_CONFIG[key].color }));

  const sentimentPieData = Object.entries(stats?.sentimentCounts || {})
    .filter(([k, v]) => k !== "Not Called" && v > 0)
    .map(([k, v]) => ({ name: k, value: v, fill: SENTIMENT_COLORS[k] || "#94a3b8" }));

  const callWebhook = async (key: keyof typeof WEBHOOKS, label: string) => {
    const url = WEBHOOKS[key];
    if (!url) { setActionMsg({ type: "error", text: `${label} webhook URL not configured yet.` }); return; }
    setActionLoading(key);
    setActionMsg(null);
    try {
      await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      // Both true (deleted) and false (nothing to delete) paths are treated as success
      setActionMsg({ type: "success", text: `${label} completed successfully.` });
      if (key === "deleteInactivity") setInactivityDone(true);
      handleRefresh();
    } catch (e) {
      setActionMsg({ type: "error", text: e instanceof Error ? e.message : "Something went wrong" });
    } finally {
      setActionLoading(null);
    }
  };

  const calledTotal = (stats?.statusCounts.lifted || 0) + (stats?.statusCounts.not_lifted || 0) + (stats?.statusCounts.inactivity || 0);
  const liftRate = calledTotal > 0 ? (((stats?.statusCounts.lifted || 0) / calledTotal) * 100).toFixed(1) : "0.0";

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voice Agent Dashboard</h1>
          <p className="text-gray-500 mt-1">Phone outreach analytics from <span className="font-medium text-gray-700">phonenumber</span> table</p>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Scorecards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Total */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Total Leads</p>
            <span className="bg-indigo-100 p-2 rounded-xl">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-indigo-700">{stats?.total.toLocaleString()}</p>
        </div>

        {/* Lifted */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Lifted</p>
            <span className="bg-emerald-100 p-2 rounded-xl">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
          </div>
          <div className="flex items-end gap-2">
            <p className="text-3xl font-bold text-emerald-700">{stats?.statusCounts.lifted ?? 0}</p>
            <span className="mb-1 text-sm font-semibold text-emerald-400">{liftRate}% lift rate</span>
          </div>
        </div>

        {/* Not Lifted */}
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Not Lifted</p>
            <span className="bg-red-100 p-2 rounded-xl">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-red-600">{stats?.statusCounts.not_lifted ?? 0}</p>
        </div>

        {/* Inactivity */}
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Inactivity</p>
            <span className="bg-amber-100 p-2 rounded-xl">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-amber-700">{stats?.statusCounts.inactivity ?? 0}</p>
        </div>

        {/* Max Duration */}
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Max Duration</p>
            <span className="bg-violet-100 p-2 rounded-xl">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-3xl font-bold text-violet-700">{stats?.statusCounts.max_duration_reached ?? 0}</p>
        </div>
      </div>

      {/* Pie charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Status distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Call Status Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" />
              <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px", color: "#f9fafb", fontSize: "12px" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-3">
            {statusPieData.map((item) => {
              const calledTotal = statusPieData.reduce((s, i) => s + i.value, 0);
              const pct = calledTotal > 0 ? Math.round((item.value / calledTotal) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.fill }} />
                    <span className="text-gray-600">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{item.value.toLocaleString()}</span>
                    <span className="text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sentiment distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-sm font-semibold text-gray-700 mb-4">Caller Sentiment</p>
          {sentimentPieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={sentimentPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value" />
                  <Tooltip contentStyle={{ background: "#1f2937", border: "none", borderRadius: "8px", color: "#f9fafb", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-3">
                {sentimentPieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: item.fill }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No sentiment data yet</div>
          )}
        </div>
      </div>

      {/* Recent calls table */}
      {(stats?.recentCalls?.length ?? 0) > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-700">Recent Calls</p>
            <span className="text-xs text-gray-400">Latest 5</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">Name</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">Number</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3 pr-4">Sentiment</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats?.recentCalls.map((call) => {
                  const st = String(call.status || "").toLowerCase();
                  const cfg = STATUS_CONFIG[st];
                  const sentiment = String(call.user_sentiment || "—");
                  const sentColor = SENTIMENT_COLORS[sentiment] || "#94a3b8";
                  return (
                    <tr key={String(call.id)} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 pr-4 font-medium text-gray-800">{String(call.Name || "—")}</td>
                      <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{String(call.number || "—")}</td>
                      <td className="py-3 pr-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${(cfg || STATUS_CONFIG.pending).bg} ${(cfg || STATUS_CONFIG.pending).textColor}`}>
                          {(cfg || STATUS_CONFIG.pending).label}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {call.user_sentiment ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: sentColor }}>
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: sentColor }} />
                            {sentiment}
                          </span>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="py-3 text-xs text-gray-500">
                        {call.created_at ? formatDisplayDate(String(call.created_at)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Action buttons — bottom right */}
      <div className="mt-6 flex flex-col items-end gap-3">
        {/* Feedback message */}
        {actionMsg && (
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${actionMsg.type === "success" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {actionMsg.text}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Step 1: Remove Inactivity — always visible */}
          <button
            onClick={() => callWebhook("deleteInactivity", "Remove Inactivity")}
            disabled={actionLoading !== null || inactivityDone}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
              inactivityDone
                ? "bg-gray-100 text-gray-400 border border-gray-200"
                : "bg-amber-500 hover:bg-amber-600 text-white"
            }`}
          >
            {actionLoading === "deleteInactivity" ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            )}
            {inactivityDone ? "Inactivity Removed ✓" : "Remove Inactivity"}
          </button>

          {/* Step 2: Appear only after inactivity is removed */}
          {inactivityDone && (
            <>
              <button
                onClick={() => callWebhook("notLiftedToNull", "Not Lifted → Null")}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "notLiftedToNull" ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                )}
                Not Lifted → Null
              </button>

              <button
                onClick={() => callWebhook("statusChangeToNull", "Status Change → Null")}
                disabled={actionLoading !== null}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === "statusChangeToNull" ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                All Status → Null
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
