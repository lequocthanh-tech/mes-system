/* Hallmark · component: QualityOverviewTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useQuality } from '../../context/QualityContext';
import { 
  Filter, 
  Eye, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Lock, 
  CheckCheck, 
  Layers 
} from 'lucide-react';
import { BatchQualityRecord, BatchDisposition } from '../../types/quality';

export const QualityOverviewTab: React.FC = () => {
  const {
    filteredBatchRecords,
    selectedReportId,
    setSelectedReportId,
    viewBatchDetail,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    applyDateFilter,
  } = useQuality();

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PASS' | 'FAIL'>('ALL');

  const handleRowClick = (batch: BatchQualityRecord) => {
    setSelectedReportId(batch.reportId);
  };

  const handleRowDoubleClick = (batch: BatchQualityRecord) => {
    viewBatchDetail(batch.reportId);
  };

  const handleViewDetailClick = () => {
    viewBatchDetail(selectedReportId);
  };

  const displayedBatches = filteredBatchRecords.filter((b) => {
    if (statusFilter === 'PASS') return b.status === 'PASS';
    if (statusFilter === 'FAIL') return b.status === 'FAIL' || b.disposition === 'QUARANTINED';
    return true;
  });

  const getDispositionBadge = (disposition: BatchDisposition) => {
    switch (disposition) {
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-emerald-100/70 text-emerald-800 border border-emerald-300">
            <CheckCheck className="w-3 h-3 text-emerald-700" />
            RELEASED
          </span>
        );
      case 'QUARANTINED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-rose-100/70 text-rose-800 border border-rose-300">
            <Lock className="w-3 h-3 text-rose-700" />
            QUARANTINED
          </span>
        );
      case 'PENDING_REVIEW':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-amber-100/70 text-amber-800 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-700" />
            PENDING REVIEW
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Filter Bar (Batch Filter) */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: Date Range Selectors & Quick Preset Filter */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-slate-700">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="font-bold text-[11px] uppercase tracking-wider">
                Date Range:
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              />
            </div>

            <button
              type="button"
              onClick={applyDateFilter}
              className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </div>

          {/* Quick Filter Presets */}
          <div className="flex items-center border border-slate-300 rounded-xs overflow-hidden h-9">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 h-full text-xs font-bold uppercase tracking-wider transition-colors ${
                statusFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              All Batches
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PASS')}
              className={`px-3 h-full text-xs font-bold uppercase tracking-wider border-l border-slate-300 transition-colors ${
                statusFilter === 'PASS'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-white text-slate-700 hover:bg-emerald-50'
              }`}
            >
              Pass Only
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('FAIL')}
              className={`px-3 h-full text-xs font-bold uppercase tracking-wider border-l border-slate-300 transition-colors ${
                statusFilter === 'FAIL'
                  ? 'bg-rose-700 text-white'
                  : 'bg-white text-slate-700 hover:bg-rose-50'
              }`}
            >
              Fail / Quarantined
            </button>
          </div>
        </div>

        {/* Right: Inspection Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleViewDetailClick}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-900 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
            title="Open comprehensive batch quality inspection breakdown"
          >
            <Eye className="w-3.5 h-3.5 text-slate-700" />
            <span>View Inspection Detail</span>
          </button>
        </div>
      </div>

      {/* Batch Quality Records Table */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-slate-900 uppercase tracking-wide">
              ISA-95 Level 3 Batch Quality Inspection Log
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Click row to select • Double-click to open inspection matrix
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Report ID</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Work Order</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Recipe & Version</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Start Time</th>
                <th className="py-2.5 px-3 border-r border-slate-200">End Time</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right w-28">Volume (L)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right w-28">Avg Deviation</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">QA Status</th>
                <th className="py-2.5 px-3 text-center w-36">Disposition / Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {displayedBatches.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No batch quality records found matching the active filter criteria.
                  </td>
                </tr>
              ) : (
                displayedBatches.map((batch) => {
                  const isSelected = selectedReportId === batch.reportId;
                  const isPass = batch.status === 'PASS';

                  return (
                    <tr
                      key={batch.reportId}
                      onClick={() => handleRowClick(batch)}
                      onDoubleClick={() => handleRowDoubleClick(batch)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#E0F2FE] text-slate-900 font-semibold border-l-4 border-l-sky-600'
                          : isPass
                          ? 'hover:bg-emerald-50/40'
                          : 'bg-rose-50/20 hover:bg-rose-50/40'
                      }`}
                    >
                      {/* Report ID */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold font-mono text-slate-900">
                        {batch.reportCode || `QAR-2026-${batch.reportId.toString().padStart(3, '0')}`}
                      </td>

                      {/* Work Order */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-mono font-semibold text-slate-700">
                        {batch.orderId}
                      </td>

                      {/* Recipe & Version */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-900">{batch.recipeId}</span>
                          <span className="text-[10px] text-slate-500">({batch.recipeVersion || 'v1.0'})</span>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">— {batch.recipeName}</span>
                        </div>
                      </td>

                      {/* Start Time */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 font-mono">
                        {batch.startTime}
                      </td>

                      {/* End Time */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 font-mono">
                        {batch.endTime}
                      </td>

                      {/* Volume (L) */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold font-mono text-slate-900">
                        {batch.totalProduced.toLocaleString()} L
                      </td>

                      {/* Avg Deviation (%) */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold font-mono">
                        <span className={isPass ? 'text-emerald-700' : 'text-rose-700'}>
                          {batch.avgError > 0 ? `+${batch.avgError.toFixed(2)}%` : `${batch.avgError.toFixed(2)}%`}
                        </span>
                      </td>

                      {/* QA Status */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                        {isPass ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs font-bold text-[10px] bg-[#DCFCE7] text-[#166534] border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3 text-[#166534]" />
                            PASS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-xs font-bold text-[10px] bg-[#FEE2E2] text-[#991B1B] border border-rose-300 animate-pulse">
                            <AlertTriangle className="w-3 h-3 text-[#991B1B]" />
                            FAIL
                          </span>
                        )}
                      </td>

                      {/* Disposition / Action */}
                      <td className="py-2.5 px-3 text-center">
                        {getDispositionBadge(batch.disposition || (isPass ? 'RELEASED' : 'QUARANTINED'))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <span>SELECTED: <strong className="text-slate-800">QAR-2026-{selectedReportId.toString().padStart(3, '0')}</strong></span>
            <span>•</span>
            <span>SHOWING: <strong className="text-slate-800">{displayedBatches.length}</strong> OF {filteredBatchRecords.length} INSPECTIONS</span>
          </div>
          <div className="flex items-center gap-2">
            <span>AUDIT COMPLIANCE: HACCP / ISO 22000 CCP INTERLOCKED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
