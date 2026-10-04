import { useState, useEffect, useCallback } from "react";
import { superAdminGet } from "@/lib/superAdminHttp";
import { logger } from "@/lib/logger";

import { ShieldCheck, Search, Filter, RefreshCw, Eye, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AuditLogEntry {
  id: number;
  actor: number | null;
  actorEmail: string | null;
  actionType: string;
  targetModel: string;
  targetId: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  ipAddress: string | null;
  userAgent: string;
  createdAt: string;
}

interface AuditLogResponse {
  results: AuditLogEntry[];
  count: number;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const data = await superAdminGet<any>(`/super-admin/audit-logs/${query}`);
      const rawList = data?.results || (Array.isArray(data) ? data : []);
      const mappedList: AuditLogEntry[] = rawList.map((item: any) => ({
        id: item.id,
        actor: item.actor,
        actorEmail: item.actor_email || item.actorEmail || null,
        actionType: item.action_type || item.actionType || "UNKNOWN",
        targetModel: item.target_model || item.targetModel || "—",
        targetId: item.target_id || item.targetId || "",
        oldValue: item.old_value || item.oldValue || {},
        newValue: item.new_value || item.newValue || {},
        ipAddress: item.ip_address || item.ipAddress || null,
        userAgent: item.user_agent || item.userAgent || "",
        createdAt: item.created_at || item.createdAt || new Date().toISOString(),
      }));

      setLogs(mappedList);
    } catch (e) {
      logger.error("Failed to load audit logs", e);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadgeColor = (action: string) => {
    if (action.includes("DELETE") || action.includes("SUSPEND")) return "bg-red-500/10 text-red-400 border-red-500/20";
    if (action.includes("CREATE") || action.includes("SUCCESS")) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    if (action.includes("UPDATE") || action.includes("ROLE")) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    return "bg-blue-500/10 text-blue-400 border-blue-500/20";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 shrink-0 text-red-500" />
            Audit Log Registry
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Immutable, read-only system event logs. Updates or deletions are forbidden by kernel architecture.
          </p>
        </div>

        <Button
          onClick={fetchLogs}
          variant="outline"
          size="sm"
          className="self-start sm:self-auto shrink-0 bg-slate-900 border-slate-800 text-slate-300 hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 me-2 ${loading ? "animate-spin" : ""}`} />
          Refresh Logs
        </Button>
      </div>

      {/* Filter & Search */}
      <div className="flex gap-3 sm:gap-4 bg-slate-900/60 p-3 sm:p-4 border border-slate-800/80 rounded-2xl">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <Input
            placeholder="Search action type, target model, IP or actor email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
            className="bg-slate-950 border-slate-800 pl-10 text-xs"
          />
        </div>
        <Button onClick={fetchLogs} size="sm" className="shrink-0 bg-red-600 hover:bg-red-700 text-white text-xs px-5">
          Filter
        </Button>
      </div>

      {/* Table */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl overflow-hidden shadow-xl">
        {/* Mobile: card list (a 7-column table would hide most of the data) */}
        <ul className="md:hidden divide-y divide-slate-800/60 text-xs">
          {loading ? (
            <li className="p-8 text-center text-slate-500">Loading immutable logs...</li>
          ) : logs.length === 0 ? (
            <li className="p-8 text-center text-slate-500">No audit records found matching your filters.</li>
          ) : (
            logs.map((log) => (
              <li key={log.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="outline" className={`font-mono text-[10px] ${getActionBadgeColor(log.actionType)}`}>
                    {log.actionType}
                  </Badge>
                  <span className="text-[11px] text-slate-400 font-mono text-end">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="font-sans text-slate-200 break-all">
                  {log.actorEmail || log.actor || "System/Anonymous"}
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px]">
                  <div className="min-w-0">
                    <dt className="text-slate-500">Target Model</dt>
                    <dd className="text-slate-300 break-all">{log.targetModel}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-slate-500">Target ID</dt>
                    <dd className="text-slate-300 break-all">{log.targetId || "—"}</dd>
                  </div>
                  <div className="min-w-0 col-span-2">
                    <dt className="text-slate-500">IP Address</dt>
                    <dd className="text-slate-300 break-all">{log.ipAddress || "—"}</dd>
                  </div>
                </dl>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedLog(log)}
                  className="-ms-2 text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                >
                  <Eye className="w-3.5 h-3.5 me-1" /> View JSON
                </Button>
              </li>
            ))
          )}
        </ul>

        {/* Tablet / desktop: table, scrolls horizontally instead of clipping columns */}
        <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
            <tr>
              <th className="p-4">Timestamp</th>
              <th className="p-4">Actor</th>
              <th className="p-4">Action</th>
              <th className="p-4">Target Model</th>
              <th className="p-4">Target ID</th>
              <th className="p-4">IP Address</th>
              <th className="p-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Loading immutable logs...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  No audit records found matching your filters.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="p-4 text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="p-4 font-sans text-slate-200">
                    {log.actorEmail || log.actor || "System/Anonymous"}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={`font-mono text-[10px] ${getActionBadgeColor(log.actionType)}`}>
                      {log.actionType}
                    </Badge>
                  </td>
                  <td className="p-4 text-slate-400">{log.targetModel}</td>
                  <td className="p-4 text-slate-400">{log.targetId || "—"}</td>
                  <td className="p-4 text-slate-400">{log.ipAddress || "—"}</td>
                  <td className="p-4 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedLog(log)}
                      className="text-slate-400 hover:text-white hover:bg-slate-800 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 me-1" /> View JSON
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Inspect Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent size="lg" className="bg-slate-900 border-slate-800 text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-base">
              <Lock className="w-4 h-4 text-red-500" />
              Audit Log Detail #{selectedLog?.id}
            </DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="flex-1 overflow-y-auto overscroll-contain space-y-4 text-xs font-mono py-2 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800/60 [&>div]:break-all">
                <div><span className="text-slate-500">Action:</span> {selectedLog.actionType}</div>
                <div><span className="text-slate-500">Target Model:</span> {selectedLog.targetModel}</div>
                <div><span className="text-slate-500">Actor:</span> {selectedLog.actorEmail || selectedLog.actor}</div>
                <div><span className="text-slate-500">IP Address:</span> {selectedLog.ipAddress}</div>
              </div>

              <div className="space-y-2">
                <label className="text-slate-400 text-[11px] font-semibold uppercase">Old State Payload (Masked)</label>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-amber-400 text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedLog.oldValue, null, 2)}
                </pre>
              </div>

              <div className="space-y-2">
                <label className="text-slate-400 text-[11px] font-semibold uppercase">New State Payload (Masked)</label>
                <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-emerald-400 text-[11px] overflow-x-auto">
                  {JSON.stringify(selectedLog.newValue, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
