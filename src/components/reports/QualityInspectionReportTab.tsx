/* Hallmark · component: QualityInspectionReportTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useReports } from '../../context/ReportContext';
import { 
  Award, 
  CheckCircle2, 
  AlertOctagon, 
  ClipboardCheck, 
  UserCheck, 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  SearchCode, 
  ShieldAlert 
} from 'lucide-react';

export const QualityInspectionReportTab: React.FC = () => {
  const {
    qualityRecords,
    qualityDetails,
    selectedQualityId,
    selectQualityReport,
    triggerForensicInvestigation,
    fromDate,
    toDate,
    searchQuery,
  } = useReports();

  const [showVarianceChart, setShowVarianceChart] = useState<boolean>(true);

  const filteredQualityRecords = qualityRecords.filter((q) => {
    const dateStr = q.inspectedAt.slice(0, 10);
    if (fromDate && dateStr < fromDate) return false;
    if (toDate && dateStr > toDate) return false;
    if (searchQuery) {
      const s = searchQuery.toLowerCase();
      return (
        q.qualityId.toLowerCase().includes(s) ||
        q.reportId.toLowerCase().includes(s) ||
        q.certifiedBy.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const currentDetails = qualityDetails.filter((d) => d.qualityId === selectedQualityId);
  const currentRecord = qualityRecords.find((q) => q.qualityId === selectedQualityId);

  return (
    <div className="space-y-6">
      {/* 1. VISUAL QUALITY TOLERANCE & CCP DEVIATION PROFILES (COLLAPSIBLE DRAWER) */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Visual Quality Tolerance &amp; CCP Deviation Profiles
            </span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
              INSPECTION: {selectedQualityId}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowVarianceChart(!showVarianceChart)}
            className="h-9 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 border border-slate-300 rounded-xs flex items-center gap-1.5 transition-colors hallmark-focus"
          >
            <span>{showVarianceChart ? 'Collapse Chart' : 'Expand Chart'}</span>
            {showVarianceChart ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showVarianceChart && (
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
                  Horizontal Parameter Variance &amp; Critical Limit Deviation
                </h3>
                <p className="text-[11px] text-slate-500">
                  Critical limits centered at 0.00%. Solid rose red indicates out-of-spec CCP breach.
                </p>
              </div>

              {selectedQualityId === 'QLT-10' && (
                <button
                  type="button"
                  onClick={() => triggerForensicInvestigation('QLT-10', 'QUALITY_DEVIATION')}
                  className="h-9 px-3.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 rounded-xs shadow-xs hallmark-focus transition-all"
                >
                  <SearchCode className="w-4 h-4" />
                  <span>Inspect Root-Cause in Audit Trail</span>
                </button>
              )}
            </div>

            {/* Horizontal Tolerance Variance Bars */}
            <div className="space-y-3 pt-2">
              {currentDetails.length === 0 ? (
                <div className="p-6 text-center text-slate-400 font-mono text-xs">
                  No telemetry parameters loaded for inspection {selectedQualityId}.
                </div>
              ) : (
                currentDetails.map((param) => {
                  const numDiff = parseFloat(param.deviationDiff.replace('%', ''));
                  const isOutOfSpec = param.evaluation === 'OUT OF SPEC';
                  // Normalize bar length for visual range -6% to +6%
                  const absValue = Math.min(Math.abs(numDiff), 6.0);
                  const barWidthPercent = (absValue / 6.0) * 45; // max 45% on either side of center

                  return (
                    <div key={param.detailId} className="bg-slate-50 border border-slate-200 p-3 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{param.parameterName}</span>
                          <span className="text-[11px] font-mono text-slate-500">
                            (SP: {param.setpoint} → PV: {param.actualValue})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500">
                            Band: {param.toleranceBand}
                          </span>
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 border ${
                              isOutOfSpec
                                ? 'bg-rose-100 text-rose-800 border-rose-300'
                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            }`}
                          >
                            {param.deviationDiff} [{param.evaluation}]
                          </span>
                        </div>
                      </div>

                      {/* Visual Centered Horizontal Tolerance Axis */}
                      <div className="relative h-6 bg-slate-200 border border-slate-300 flex items-center overflow-hidden">
                        {/* 0.0% Center Line */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-600 z-20" />

                        {/* Safe ±2% Target Window Overlay */}
                        <div 
                          className="absolute h-full bg-emerald-50/70 border-x border-emerald-400/80 z-10"
                          style={{
                            left: `${50 - (2.0 / 6.0) * 45}%`,
                            width: `${(4.0 / 6.0) * 45}%`
                          }}
                        />

                        {/* Deviation Bar */}
                        {numDiff < 0 ? (
                          // Negative Deviation (left of center)
                          <div
                            className={`absolute h-4 right-1/2 rounded-l-xs transition-all ${
                              isOutOfSpec ? 'bg-rose-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${barWidthPercent}%` }}
                          />
                        ) : (
                          // Positive Deviation (right of center)
                          <div
                            className={`absolute h-4 left-1/2 rounded-r-xs transition-all ${
                              isOutOfSpec ? 'bg-rose-600' : 'bg-emerald-600'
                            }`}
                            style={{ width: `${barWidthPercent}%` }}
                          />
                        )}

                        {/* Axis Scale Markers */}
                        <div className="absolute inset-0 flex justify-between px-2 text-[8px] font-mono text-slate-500 pointer-events-none items-center">
                          <span>-6.0%</span>
                          <span>-2.0%</span>
                          <span className="font-bold text-slate-700">0.0%</span>
                          <span>+2.0%</span>
                          <span>+6.0%</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. QUALITY SUMMARY TABLE */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
              Quality Inspection Summary (QA/QC Archive)
            </h2>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700">
              {filteredQualityRecords.length} inspection(s)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-300">
            CLICK ROW TO INSPECT TOLERANCE EVALUATION
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="px-3 py-2.5 font-mono">Quality ID</th>
                <th className="px-3 py-2.5 font-mono">Report ID</th>
                <th className="px-3 py-2.5 text-center font-mono">Overall Status</th>
                <th className="px-3 py-2.5 font-mono text-right">Average Deviation (%)</th>
                <th className="px-3 py-2.5 font-mono">Inspected Timestamp</th>
                <th className="px-3 py-2.5 font-mono">Certified By</th>
                <th className="px-3 py-2.5 text-center">Contextual Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredQualityRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-mono">
                    No quality inspection records match the active query.
                  </td>
                </tr>
              ) : (
                filteredQualityRecords.map((rec) => {
                  const isSelected = selectedQualityId === rec.qualityId;
                  const isFail = rec.status === 'FAIL';

                  return (
                    <tr
                      key={rec.qualityId}
                      onClick={() => selectQualityReport(rec.qualityId)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-sky-50 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        {isSelected && <span className="w-1.5 h-1.5 bg-sky-600 rounded-full" />}
                        {rec.qualityId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 font-semibold">
                        {rec.reportId}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold border ${
                            isFail
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {isFail ? (
                            <AlertOctagon className="w-3 h-3 text-rose-600" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          )}
                          {rec.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-right text-slate-900">
                        {rec.avgDeviation.toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">
                        {rec.inspectedAt}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-[11px] flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        {rec.certifiedBy}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectQualityReport(rec.qualityId);
                            }}
                            className="h-7 px-2.5 text-[10px] font-semibold border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xs hallmark-focus"
                          >
                            Details
                          </button>
                          {isFail && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerForensicInvestigation(rec.qualityId, 'QUALITY_DEVIATION');
                              }}
                              className="h-7 px-2.5 text-[10px] font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xs shadow-xs hallmark-focus flex items-center gap-1"
                              title="Jump to correlated logs in User Audit Trail"
                            >
                              <SearchCode className="w-3 h-3" />
                              <span>Forensic Audit</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. QUALITY PARAMETER TOLERANCE BREAKDOWN TABLE */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
              Quality Parameter Tolerance Breakdown
            </h2>
            {currentRecord && (
              <span className="px-2 py-0.5 bg-slate-800 text-sky-400 text-[10px] font-mono font-bold border border-slate-700">
                INSPECTION: {currentRecord.qualityId} (BATCH: {currentRecord.reportId})
              </span>
            )}
          </div>

          {currentRecord && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-slate-300">Auditor: {currentRecord.certifiedBy}</span>
              <span
                className={`px-2 py-0.5 text-[10px] font-bold border ${
                  currentRecord.status === 'FAIL'
                    ? 'bg-rose-900/60 text-rose-300 border-rose-600'
                    : 'bg-emerald-900/60 text-emerald-300 border-emerald-600'
                }`}
              >
                OVERALL: {currentRecord.status}
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="px-3 py-2.5 font-mono">Detail ID</th>
                <th className="px-3 py-2.5 font-mono">Quality ID</th>
                <th className="px-3 py-2.5">Parameter / Material Name</th>
                <th className="px-3 py-2.5 font-mono text-right">Setpoint</th>
                <th className="px-3 py-2.5 font-mono text-right">Actual Value</th>
                <th className="px-3 py-2.5 font-mono text-right">Deviation Diff (%)</th>
                <th className="px-3 py-2.5 font-mono text-center">Tolerance Band</th>
                <th className="px-3 py-2.5 text-center font-mono">Evaluation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {currentDetails.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400 font-mono">
                    No parameter tolerance details for inspection {selectedQualityId}.
                  </td>
                </tr>
              ) : (
                currentDetails.map((item) => {
                  const isOutOfSpec = item.evaluation === 'OUT OF SPEC';

                  return (
                    <tr
                      key={item.detailId}
                      className={`hover:bg-slate-50 transition-colors ${
                        isOutOfSpec ? 'bg-rose-50/50' : ''
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {item.detailId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {item.qualityId}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                        {item.parameterName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-right">
                        {item.setpoint}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 text-right">
                        {item.actualValue}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right font-bold">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] ${
                            isOutOfSpec
                              ? 'text-rose-700 bg-rose-100 border border-rose-300 font-bold'
                              : 'text-emerald-700 bg-emerald-100 border border-emerald-300'
                          }`}
                        >
                          {item.deviationDiff}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-center font-bold">
                        {item.toleranceBand}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-[10px] font-bold border ${
                            isOutOfSpec
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          }`}
                        >
                          {item.evaluation}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {currentRecord && currentRecord.status === 'FAIL' && (
          <div className="p-4 bg-rose-50 border-t border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-900">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Quarantine Action Notice (HACCP Critical Control Point Breach):</strong>
                <span>
                  Temperature sterilization deviation exceeded allowable ±2.0% tolerance band. Automated interlock has marked batch {currentRecord.reportId} for quarantine review.
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => triggerForensicInvestigation('QLT-10', 'QUALITY_DEVIATION')}
              className="h-9 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold uppercase tracking-wider text-xs flex items-center gap-1.5 rounded-xs shrink-0 shadow-xs hallmark-focus transition-all"
            >
              <SearchCode className="w-4 h-4" />
              <span>Inspect Root-Cause in Audit Trail</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
