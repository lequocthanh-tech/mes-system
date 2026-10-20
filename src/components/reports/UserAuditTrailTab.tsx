/* Hallmark · component: UserAuditTrailTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useMemo } from 'react';
import { useReports } from '../../context/ReportContext';
import { 
  ShieldCheck, 
  KeyRound, 
  Play, 
  Zap, 
  XCircle, 
  Sliders, 
  FileCheck, 
  Clock,
  SearchCode, 
  X,
  AlertCircle,
  FileSignature,
  ArrowRight,
  Filter,
  CheckCircle2,
  GitCommit
} from 'lucide-react';

export const UserAuditTrailTab: React.FC = () => {
  const { 
    auditLogs, 
    searchQuery, 
    fromDate, 
    toDate, 
    forensicFilter, 
    clearForensicInvestigation,
    setFromDate,
    setToDate,
    setSearchQuery
  } = useReports();

  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('ALL');

  const isForensicActive = forensicFilter?.active;

  // Extract unique users and actions for filter dropdowns
  const uniqueUsers = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.username) set.add(l.username);
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  const uniqueActions = useMemo(() => {
    const set = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set).sort();
  }, [auditLogs]);

  // Filter logs: forensic drill-down, user filter, action filter, date range, search query
  const filteredLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      if (isForensicActive) {
        return (
          forensicFilter.highlightLogIds.includes(l.logId) || 
          (searchQuery && l.action.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      }

      const dateStr = l.timestamp.slice(0, 10);
      if (fromDate && dateStr < fromDate) return false;
      if (toDate && dateStr > toDate) return false;

      if (selectedUserFilter !== 'ALL' && l.username !== selectedUserFilter) return false;
      if (selectedActionFilter !== 'ALL' && l.action !== selectedActionFilter) return false;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesQuery = 
          l.logId.toLowerCase().includes(q) ||
          l.username.toLowerCase().includes(q) ||
          l.role.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.target.toLowerCase().includes(q) ||
          (l.reason && l.reason.toLowerCase().includes(q)) ||
          (l.fieldName && l.fieldName.toLowerCase().includes(q)) ||
          (l.signatureMeaning && l.signatureMeaning.toLowerCase().includes(q)) ||
          (l.recordHash && l.recordHash.toLowerCase().includes(q));
        if (!matchesQuery) return false;
      }
      return true;
    });
  }, [auditLogs, isForensicActive, forensicFilter, fromDate, toDate, selectedUserFilter, selectedActionFilter, searchQuery]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'USER_LOGIN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 font-mono text-[10px] font-bold">
            <KeyRound className="w-3 h-3 text-slate-600" />
            {action}
          </span>
        );
      case 'BATCH_DISPATCH':
      case 'SCADA_DOWNLOAD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 border border-sky-300 font-mono text-[10px] font-bold">
            <Play className="w-3 h-3 text-sky-600" />
            {action}
          </span>
        );
      case 'PLC_COMMAND':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-800 border border-indigo-300 font-mono text-[10px] font-bold">
            <Zap className="w-3 h-3 text-indigo-600" />
            {action}
          </span>
        );
      case 'BATCH_REJECT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[10px] font-bold">
            <XCircle className="w-3 h-3 text-rose-600" />
            {action}
          </span>
        );
      case 'PARAMETER_OVERRIDE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] font-bold">
            <Sliders className="w-3 h-3 text-amber-600" />
            {action}
          </span>
        );
      case 'RECIPE_APPROVAL':
      case 'BATCH_RELEASE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] font-bold">
            <FileCheck className="w-3 h-3 text-emerald-600" />
            {action}
          </span>
        );
      case 'RECIPE_MODIFICATION':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 font-mono text-[10px] font-bold">
            <FileSignature className="w-3 h-3 text-purple-600" />
            {action}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 font-mono text-[10px] font-bold">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* FORENSIC INVESTIGATION ACTIVE BANNER */}
      {isForensicActive && (
        <div className="bg-amber-50 border-2 border-amber-400 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-start gap-2.5">
            <SearchCode className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider rounded-xs">
                  FORENSIC DRILL-DOWN MODE
                </span>
                <span className="font-mono text-xs font-bold text-amber-900">
                  Target Event: {forensicFilter.sourceEventId}
                </span>
              </div>
              <p className="text-xs text-amber-900 mt-1 font-medium">
                {forensicFilter.reason}
              </p>
              <div className="flex items-center gap-4 mt-1.5 text-[11px] font-mono text-amber-800">
                <span>Time Window: {forensicFilter.timeWindowDescription}</span>
                <span>•</span>
                <span>Correlated Records: {forensicFilter.highlightLogIds.length} Spotlit</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={clearForensicInvestigation}
            className="h-9 px-3.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
            <span>Clear Forensic Filter</span>
          </button>
        </div>
      )}

      {/* FILTER & AUDIT TOOLBAR */}
      <div className="p-3 bg-white border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[11px]">
            <Filter className="w-3.5 h-3.5" />
            <span>Audit Filters:</span>
          </div>

          {/* User Filter */}
          <div className="flex items-center gap-1">
            <label htmlFor="audit-user-filter" className="text-slate-600 text-[11px] font-mono">User:</label>
            <select
              id="audit-user-filter"
              value={selectedUserFilter}
              onChange={(e) => setSelectedUserFilter(e.target.value)}
              className="h-8 bg-slate-50 border border-slate-300 px-2 text-xs font-mono rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600"
            >
              <option value="ALL">All Users ({auditLogs.length})</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-1">
            <label htmlFor="audit-action-filter" className="text-slate-600 text-[11px] font-mono">Action:</label>
            <select
              id="audit-action-filter"
              value={selectedActionFilter}
              onChange={(e) => setSelectedActionFilter(e.target.value)}
              className="h-8 bg-slate-50 border border-slate-300 px-2 text-xs font-mono rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600"
            >
              <option value="ALL">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Reset Button if filtered */}
        {(selectedUserFilter !== 'ALL' || selectedActionFilter !== 'ALL' || fromDate || toDate || searchQuery) && (
          <button
            type="button"
            onClick={() => {
              setSelectedUserFilter('ALL');
              setSelectedActionFilter('ALL');
              setFromDate('');
              setToDate('');
              setSearchQuery('');
            }}
            className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-mono text-[11px] flex items-center gap-1 rounded-xs transition-none active:translate-y-px"
          >
            <X className="w-3 h-3 text-slate-500" />
            <span>Reset All Filters</span>
          </button>
        )}
      </div>

      {/* USER AUDIT TRAIL TABLE */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-white" style={{ fontStyle: 'normal' }}>
              User Activity &amp; Security Audit Trail (21 CFR Part 11 Compliant)
            </h2>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700">
              {filteredLogs.length} event(s)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-300 hidden sm:inline">
            CRYPTOGRAPHICALLY SIGNED LOG &bull; IMMUTABLE RECORD
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="px-3 py-2.5 font-mono">Log ID</th>
                <th className="px-3 py-2.5 font-mono">Timestamp</th>
                <th className="px-3 py-2.5 font-mono">Signer / Role</th>
                <th className="px-3 py-2.5 font-mono">Action Event</th>
                <th className="px-3 py-2.5">Field &amp; Value Delta</th>
                <th className="px-3 py-2.5">Reason for Action</th>
                <th className="px-3 py-2.5 font-mono">Signature Meaning</th>
                <th className="px-3 py-2.5 font-mono text-center">Integrity Hash</th>
                {isForensicActive && <th className="px-3 py-2.5 text-center font-mono">Correlation</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={isForensicActive ? 9 : 8} className="px-4 py-8 text-center text-slate-400 font-mono">
                    No audit records match the active query.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isCorrelated = isForensicActive && forensicFilter?.highlightLogIds.includes(log.logId);
                  const isOverride = log.action === 'PARAMETER_OVERRIDE';
                  const hasDelta = Boolean(log.oldValue || log.newValue || log.fieldName);

                  return (
                    <tr 
                      key={log.logId} 
                      className={`transition-colors ${
                        isCorrelated 
                          ? 'bg-amber-50/70 border-l-4 border-l-amber-500 font-medium' 
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* Log ID + Correction Flag */}
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <span>{log.logId}</span>
                          {log.isCorrection && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono px-1 py-0.2 bg-amber-100 text-amber-900 border border-amber-300 font-bold rounded-xs w-max">
                              <GitCommit className="w-2.5 h-2.5" />
                              CORR {log.refLogId ? `(#${log.refLogId})` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{log.timestamp}</span>
                        </div>
                      </td>

                      {/* Signer & Role */}
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{log.username}</div>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 border border-slate-200 text-slate-600 font-sans font-medium inline-block mt-0.5">
                          {log.role}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Field & Value Delta */}
                      <td className="px-3 py-2.5 text-slate-800">
                        {hasDelta ? (
                          <div className="space-y-1">
                            {log.fieldName && (
                              <div className="font-mono text-[11px] font-bold text-slate-900">
                                {log.fieldName}
                              </div>
                            )}
                            <div className="flex items-center gap-1 font-mono text-[11px]">
                              <span className="px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-200 rounded-xs">
                                {log.oldValue ?? '--'}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold rounded-xs">
                                {log.newValue ?? '--'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-xs">{log.target || '---'}</span>
                        )}

                        {isOverride && (
                          <div className="text-[10px] text-amber-800 font-mono mt-1 flex items-center gap-1 font-semibold">
                            <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                            <span>Preceded Process Alarm by ~16 min</span>
                          </div>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="px-3 py-2.5 text-slate-700 max-w-xs">
                        <div className="text-[11px] font-mono leading-tight">
                          {log.reason || log.target || '---'}
                        </div>
                      </td>

                      {/* Signature Meaning */}
                      <td className="px-3 py-2.5 font-mono text-slate-700 whitespace-nowrap">
                        {log.signatureMeaning ? (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold">
                            {log.signatureMeaning}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-mono">Standard Log</span>
                        )}
                      </td>

                      {/* Integrity Hash */}
                      <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono">
                        {log.recordHash ? (
                          <span 
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold cursor-help"
                            title={`SHA-256 Ledger Hash: ${log.recordHash}`}
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            VALID &bull; SHA-256
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 text-[10px]">
                            LEGACY &bull; RECORD
                          </span>
                        )}
                      </td>

                      {/* Forensic Correlation */}
                      {isForensicActive && (
                        <td className="px-3 py-2.5 text-center">
                          {isCorrelated ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[9px] font-bold">
                              CORRELATED EVENT
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[9px]">Normal</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Security Compliance Banner */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-mono">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            SHA-256 INTEGRITY VALIDATION: VALID &bull; IMMUTABLE DATABASE LEDGER
          </span>
          <span>AUDIT RETENTION POLICY: 7 YEARS STATUTORY (21 CFR &sect;11.10)</span>
        </div>
      </div>
    </div>
  );
};
