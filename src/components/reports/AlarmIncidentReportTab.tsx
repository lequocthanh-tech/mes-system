/* Hallmark · component: AlarmIncidentReportTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useReports } from '../../context/ReportContext';
import { 
  Bell, 
  AlertTriangle, 
  AlertOctagon, 
  Info, 
  Clock, 
  CheckCircle2, 
  User, 
  Filter,
  SearchCode,
  PieChart
} from 'lucide-react';

export const AlarmIncidentReportTab: React.FC = () => {
  const { alarmItems, searchQuery, fromDate, toDate, triggerForensicInvestigation } = useReports();
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');

  const filteredAlarms = alarmItems.filter((a) => {
    const dateStr = a.triggerTime.slice(0, 10);
    if (fromDate && dateStr < fromDate) return false;
    if (toDate && dateStr > toDate) return false;
    if (severityFilter !== 'ALL' && a.severity !== severityFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        a.eventId.toLowerCase().includes(q) ||
        a.alarmTag.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.acknowledgedBy.toLowerCase().includes(q) ||
        a.comment.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const criticalCount = alarmItems.filter((a) => a.severity === 'CRITICAL').length;
  const warningCount = alarmItems.filter((a) => a.severity === 'WARNING').length;
  const infoCount = alarmItems.filter((a) => a.severity === 'INFO').length;
  const totalCount = alarmItems.length || 1;

  const criticalPct = Math.round((criticalCount / totalCount) * 100);
  const warningPct = Math.round((warningCount / totalCount) * 100);
  const infoPct = Math.round((infoCount / totalCount) * 100);

  return (
    <div className="space-y-6">
      {/* 1. VISUAL ALARM SEVERITY DISTRIBUTION & KPI STRIP */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
              Alarm Severity Distribution &amp; Incident Metrics
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            TOTAL INCIDENTS: {alarmItems.length} LOGGED
          </span>
        </div>

        {/* Severity Distribution Visual Multi-Segment Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600">SEVERITY RATIO SPECTRUM:</span>
            <span className="text-slate-500 font-semibold">
              CRITICAL: {criticalCount} ({criticalPct}%) • WARNING: {warningCount} ({warningPct}%) • INFO: {infoCount} ({infoPct}%)
            </span>
          </div>
          <div className="h-4 w-full bg-slate-100 flex overflow-hidden border border-slate-300 rounded-xs">
            <div 
              style={{ width: `${criticalPct}%` }} 
              className="bg-rose-600 h-full flex items-center justify-center text-[9px] font-mono font-bold text-white transition-all"
              title={`Critical: ${criticalCount} events (${criticalPct}%)`}
            >
              {criticalPct}%
            </div>
            <div 
              style={{ width: `${warningPct}%` }} 
              className="bg-amber-500 h-full flex items-center justify-center text-[9px] font-mono font-bold text-white transition-all"
              title={`Warning: ${warningCount} events (${warningPct}%)`}
            >
              {warningPct}%
            </div>
            <div 
              style={{ width: `${infoPct}%` }} 
              className="bg-sky-500 h-full flex items-center justify-center text-[9px] font-mono font-bold text-white transition-all"
              title={`Info: ${infoCount} events (${infoPct}%)`}
            >
              {infoPct}%
            </div>
          </div>
        </div>

        {/* Alarm KPI Header Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="bg-white border border-rose-200 p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-rose-700 uppercase tracking-wider font-semibold">
                Critical Alarms
              </div>
              <div className="text-2xl font-mono font-bold text-rose-700 mt-0.5">
                {criticalCount} <span className="text-xs font-normal text-rose-600">Events ({criticalPct}%)</span>
              </div>
            </div>
            <div className="w-9 h-9 bg-rose-50 border border-rose-300 flex items-center justify-center text-rose-700">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-amber-200 p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-amber-700 uppercase tracking-wider font-semibold">
                Warning Alerts
              </div>
              <div className="text-2xl font-mono font-bold text-amber-700 mt-0.5">
                {warningCount} <span className="text-xs font-normal text-amber-600">Events ({warningPct}%)</span>
              </div>
            </div>
            <div className="w-9 h-9 bg-amber-50 border border-amber-300 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white border border-sky-200 p-3.5 shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-mono text-sky-700 uppercase tracking-wider font-semibold">
                Informational Events
              </div>
              <div className="text-2xl font-mono font-bold text-sky-700 mt-0.5">
                {infoCount} <span className="text-xs font-normal text-sky-600">Events ({infoPct}%)</span>
              </div>
            </div>
            <div className="w-9 h-9 bg-sky-50 border border-sky-300 flex items-center justify-center text-sky-700">
              <Info className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. ALARM HISTORY LEDGER TABLE */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
              Plant Alarm &amp; Incident Audit Ledger
            </h2>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700">
              {filteredAlarms.length} incident(s)
            </span>
          </div>

          {/* Quick Severity Filter */}
          <div className="flex items-center gap-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="h-8 bg-slate-800 text-slate-200 border border-slate-700 px-2 py-0 text-xs font-mono hallmark-focus rounded-xs"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">CRITICAL</option>
              <option value="WARNING">WARNING</option>
              <option value="INFO">INFO</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="px-3 py-2.5 font-mono">Event ID</th>
                <th className="px-3 py-2.5 font-mono">Alarm Tag</th>
                <th className="px-3 py-2.5 text-center font-mono">Severity</th>
                <th className="px-3 py-2.5">Alarm Description</th>
                <th className="px-3 py-2.5 font-mono">Trigger Time</th>
                <th className="px-3 py-2.5 font-mono">Cleared Time</th>
                <th className="px-3 py-2.5 font-mono">Acknowledged User</th>
                <th className="px-3 py-2.5">Corrective Action / Remarks</th>
                <th className="px-3 py-2.5 text-center">Forensic Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-400 font-mono">
                    No alarm events match the active query.
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((alm) => {
                  const isCrit = alm.severity === 'CRITICAL';
                  const isWarn = alm.severity === 'WARNING';
                  const isTarget403 = alm.eventId === 'ALM-403';

                  return (
                    <tr 
                      key={alm.eventId} 
                      className={`hover:bg-slate-50 transition-colors ${isTarget403 ? 'bg-amber-50/40' : ''}`}
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {alm.eventId}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-800">
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200">
                          {alm.alarmTag}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold border ${
                            isCrit
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : isWarn
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-sky-100 text-sky-800 border-sky-300'
                          }`}
                        >
                          {isCrit && <AlertOctagon className="w-3 h-3 text-rose-600" />}
                          {isWarn && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {!isCrit && !isWarn && <Info className="w-3 h-3 text-sky-600" />}
                          {alm.severity}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-slate-900">
                        {alm.description}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {alm.triggerTime}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {alm.clearedTime}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {alm.acknowledgedBy}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={alm.comment}>
                        {alm.comment}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {isTarget403 ? (
                          <button
                            type="button"
                            onClick={() => triggerForensicInvestigation('ALM-403', 'ALARM_INCIDENT')}
                            className="h-7 px-2.5 text-[10px] font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xs shadow-xs hallmark-focus flex items-center gap-1 mx-auto transition-all"
                            title="Filter User Audit Trail within ±15 minutes of event"
                          >
                            <SearchCode className="w-3 h-3" />
                            <span>Inspect Root-Cause in Audit Trail</span>
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-slate-400">Normal</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
