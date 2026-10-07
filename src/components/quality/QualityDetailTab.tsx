/* Hallmark · component: QualityDetailTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useQuality } from '../../context/QualityContext';
import { 
  FileCheck2, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft, 
  Layers, 
  Scale, 
  Clock, 
  Flame, 
  Lock, 
  CheckCheck, 
  Download, 
  ShieldAlert, 
  UserCheck, 
  FileText,
  ThermometerSnowflake,
  RotateCw
} from 'lucide-react';
import { BatchDisposition } from '../../types/quality';

export const QualityDetailTab: React.FC = () => {
  const { 
    selectedReportId, 
    selectedBatch, 
    currentBatchDetails, 
    hasCriticalFailure,
    dispositionBatch,
    setActiveSubTab 
  } = useQuality();

  const [notes, setNotes] = useState<string>(selectedBatch?.reviewerNotes || '');
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);

  const isPass = selectedBatch?.status === 'PASS';
  const currentDisposition: BatchDisposition = selectedBatch?.disposition || (isPass ? 'RELEASED' : 'QUARANTINED');

  const handleQuarantine = () => {
    const res = dispositionBatch(selectedReportId, 'QUARANTINED', notes);
    setFeedbackMsg({ text: res.message, type: res.success ? 'error' : 'info' });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleApproveRelease = () => {
    const res = dispositionBatch(selectedReportId, 'RELEASED', notes);
    setFeedbackMsg({ text: res.message, type: res.success ? 'success' : 'error' });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleExportCertificate = () => {
    setShowPdfModal(true);
  };

  const getParameterIcon = (phaseId: string, paramName: string) => {
    if (paramName.includes('Temp') || phaseId.includes('HEATING')) {
      return <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />;
    }
    if (phaseId.includes('COOLING')) {
      return <ThermometerSnowflake className="w-3.5 h-3.5 text-sky-600 shrink-0" />;
    }
    if (phaseId.includes('MIXING')) {
      return <RotateCw className="w-3.5 h-3.5 text-indigo-600 shrink-0" />;
    }
    return <Scale className="w-3.5 h-3.5 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Top Breadcrumb & Return Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('overview')}
          className="h-9 flex items-center gap-1.5 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 text-xs font-semibold uppercase tracking-wider transition-all hallmark-focus active:translate-y-px rounded-xs shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Quality Overview</span>
        </button>

        <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
          <span>REPORT: <strong className="text-slate-900">{selectedBatch?.reportCode || `QAR-2026-${selectedReportId.toString().padStart(3, '0')}`}</strong></span>
          <span>•</span>
          <span>WORK ORDER: <strong className="text-slate-900">{selectedBatch?.orderId || 'WO-2026-001'}</strong></span>
          <span>•</span>
          <span>RECIPE: <strong className="text-slate-900">{selectedBatch?.recipeId || 'RCP-MILK-UHT-01'}</strong></span>
        </div>
      </div>

      {/* 1. Batch Information Banner Card */}
      <div className="bg-white border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
        {/* Left: Batch Title & Checked Timestamp */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-slate-900 text-white flex items-center justify-center font-bold text-sm font-mono rounded-xs shadow-xs">
            Q{selectedReportId}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 tracking-tight font-mono not-italic uppercase">
                Batch #{selectedReportId} Quality Verification
              </h2>
              <span className="text-[11px] text-slate-500 font-normal">
                ({selectedBatch?.recipeName} {selectedBatch?.recipeVersion})
              </span>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3 mt-1 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Checked at: <strong className="text-slate-700">{selectedBatch?.checkedAt || '2026-09-07 08:46 AM'}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                Lead Inspector: <strong className="text-slate-700">QA-ENG-LEAD (HACCP Level 3)</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Overall Status Badge & Aggregate Error */}
        <div className="flex items-center gap-5">
          {/* Aggregate Deviation Metric */}
          <div className="text-right border-r border-slate-200 pr-5">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Mean Deviation</span>
            <span className={`text-base font-bold font-mono ${isPass ? 'text-emerald-700' : 'text-rose-700'}`}>
              {selectedBatch ? (selectedBatch.avgError > 0 ? `+${selectedBatch.avgError.toFixed(2)}%` : `${selectedBatch.avgError.toFixed(2)}%`) : '0.00%'}
            </span>
          </div>

          {/* Overall Status Badge */}
          <div>
            {isPass ? (
              <div className="px-4 py-2 bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-2 rounded-xs shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>OVERALL: PASS (COMPLIANT)</span>
              </div>
            ) : (
              <div className="px-4 py-2 bg-rose-50 border border-rose-300 text-rose-800 font-bold text-xs flex items-center gap-2 rounded-xs shadow-xs">
                <AlertTriangle className="w-4 h-4 text-rose-700 animate-pulse" />
                <span>OVERALL: FAIL (OUT OF SPEC)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Critical Deviation Warning (if FAIL or CCP Breach) */}
      {!isPass && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 shadow-xs">
          <Flame className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold uppercase tracking-wider text-[11px] text-rose-900 bg-rose-200/80 px-2 py-0.5 rounded-xs border border-rose-300">
                CRITICAL QUALITY DEFECT IDENTIFIED (CCP-1 BREACH)
              </span>
              <span className="text-[11px] text-rose-700 font-semibold">
                Automatic Quarantine Interlock Engaged
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-800 font-mono">
              Parameter <strong>PH_HEATING (Sterilization Temp)</strong> reached only <strong>131.5 °C</strong> against scripted setpoint <strong>138.0 °C</strong> (Diff: -4.71%, exceeding critical safety tolerance ±1.0%). Batch fails microbiological safety hold criteria under HACCP Annex 4.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Toast Notification */}
      {feedbackMsg && (
        <div className={`p-3 border text-xs flex items-center gap-2 font-mono ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : feedbackMsg.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-900'
            : 'bg-blue-50 border-blue-300 text-blue-900'
        }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* 2. Dynamic Inspection Matrix Table */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-slate-900 uppercase tracking-wide">
              ISA-88 Dynamic Process Parameter Inspection Matrix
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            Automated evaluation of SCADA Historian readback vs Formulation Setpoints
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-36">Phase ID</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Parameter / Material Name</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right w-32">Set Value (SP)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right w-32">Actual Value (PV)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right w-28">Diff %</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Tolerance (±%)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Result</th>
                <th className="py-2.5 px-3 text-center w-40">HACCP Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {currentBatchDetails.map((item) => {
                const isItemPass = item.result === 'PASS';
                const isCcp = item.isCritical;

                return (
                  <tr
                    key={item.qualityId}
                    className={`hover:bg-slate-50 transition-colors ${!isItemPass ? 'bg-rose-50/25' : ''}`}
                  >
                    {/* Phase ID */}
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-800 text-center">
                      <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded-xs text-[10px]">
                        {item.phaseId || `PH_${item.qualityId}`}
                      </span>
                    </td>

                    {/* Parameter / Material Name */}
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">
                      <div className="flex items-center gap-2">
                        {getParameterIcon(item.phaseId || '', item.parameterName)}
                        <span>{item.parameterName}</span>
                      </div>
                    </td>

                    {/* Set Value (SP) */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-blue-700">
                      {item.setValue.toFixed(1)} {item.unit}
                    </td>

                    {/* Actual Value (PV) */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-slate-900">
                      {item.actualValue.toFixed(1)} {item.unit}
                    </td>

                    {/* Diff % */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold">
                      <span className={isItemPass ? 'text-slate-800' : 'text-rose-700 font-bold'}>
                        {item.diffPercent > 0 ? `+${item.diffPercent.toFixed(2)}%` : `${item.diffPercent.toFixed(2)}%`}
                      </span>
                    </td>

                    {/* Tolerance (±%) */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-600">
                      ±{item.tolerancePercent.toFixed(1)}%
                    </td>

                    {/* Result */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                      {isItemPass ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-[#DCFCE7] text-[#166534] border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3 text-[#166534]" />
                          PASS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-[#FEE2E2] text-[#991B1B] border border-rose-300 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-[#991B1B]" />
                          FAIL
                        </span>
                      )}
                    </td>

                    {/* HACCP Category */}
                    <td className="py-2.5 px-3 text-center">
                      {isCcp ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-rose-100 text-rose-800 border border-rose-300">
                          <ShieldAlert className="w-3 h-3 text-rose-700" />
                          CRITICAL (CCP)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-slate-100 text-slate-700 border border-slate-300">
                          STANDARD QUALITY
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Info */}
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>DISPENSING & THERMAL PARAMETER COMPLIANCE MATRIX</span>
          </div>
          <div>
            <span>FORMULA: Diff% = ((PV - SP) / SP) * 100%</span>
          </div>
        </div>
      </div>

      {/* 3. Electronic Batch Release & QA Decision Panel (Bottom Card) */}
      <div className="bg-white border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="border-b border-slate-200 pb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-800" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wide text-xs">
              Electronic Batch Release & QA Disposition Decision Panel
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-slate-500">CURRENT STATUS:</span>
            {currentDisposition === 'RELEASED' ? (
              <span className="px-2 py-0.5 font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xs">
                RELEASED TO PACKAGING
              </span>
            ) : currentDisposition === 'QUARANTINED' ? (
              <span className="px-2 py-0.5 font-bold bg-rose-100 text-rose-800 border border-rose-300 rounded-xs">
                QUARANTINED / HOLD
              </span>
            ) : (
              <span className="px-2 py-0.5 font-bold bg-amber-100 text-amber-800 border border-amber-300 rounded-xs">
                PENDING REVIEW
              </span>
            )}
          </div>
        </div>

        {/* Disposition Form & Reviewer Notes */}
        <div className="space-y-3">
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
            QA Reviewer Notes & Root Cause Observations:
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document QA evaluation, deviation root causes, lab assay results, and disposition rationale..."
            className="w-full bg-slate-50 border border-slate-300 p-3 text-xs font-mono text-slate-800 rounded-xs focus:bg-white focus:border-slate-800 focus:outline-none transition-colors"
          />
        </div>

        {/* Safety Gate Warning on Critical Breach */}
        {hasCriticalFailure && (
          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2 font-mono">
            <Lock className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-bold uppercase tracking-wider">
              RELEASE INTERLOCK ENGAGED:
            </span>
            <span>
              Critical Control Point (CCP) breached. Industrial food safety interlock prevents releasing this batch to packaging.
            </span>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Left: Certificate Export */}
          <button
            type="button"
            onClick={handleExportCertificate}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export QA Certificate (PDF)</span>
          </button>

          {/* Right: Decision Actions (Reject/Quarantine vs Approve/Release) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleQuarantine}
              className="h-9 px-4 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Reject & Quarantine Batch</span>
            </button>

            <button
              type="button"
              onClick={handleApproveRelease}
              disabled={hasCriticalFailure}
              className={`h-9 px-4 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                hasCriticalFailure
                  ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white hallmark-focus active:translate-y-px'
              }`}
              title={hasCriticalFailure ? 'Disabled: CCP parameter failed' : 'Authorize batch for packaging'}
            >
              {hasCriticalFailure ? (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Release Locked (CCP Fail)</span>
                </>
              ) : (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-white" />
                  <span>Approve & Release Batch</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Standard Industrial Batch Certificate Export Modal */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-2xl w-full p-6 space-y-5 font-mono text-xs">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 uppercase">
                  Certificate of Quality Analysis (CoA)
                </h3>
                <span className="text-[10px] text-slate-500">
                  ISO 22000 / HACCP COMPLIANCE RECORD • ISA-95 LEVEL 3 MOM
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="h-8 px-3 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 space-y-2 text-slate-800">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><strong>Certificate Ref:</strong> CoA-2026-{selectedReportId.toString().padStart(4, '0')}</div>
                <div><strong>Inspection Date:</strong> {selectedBatch?.checkedAt}</div>
                <div><strong>Work Order:</strong> {selectedBatch?.orderId}</div>
                <div><strong>Recipe:</strong> {selectedBatch?.recipeId} ({selectedBatch?.recipeName})</div>
                <div><strong>Batch Volume:</strong> {selectedBatch?.totalProduced} L</div>
                <div><strong>Quality Disposition:</strong> <span className={isPass ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{currentDisposition}</span></div>
              </div>

              <div className="mt-3 border-t border-slate-200 pt-2 text-[10px] text-slate-600">
                <strong>Auditor Assessment:</strong> {notes || selectedBatch?.reviewerNotes || 'Standard evaluation recorded.'}
              </div>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>Digital Certificate Signed: SHA-256 Validated • Authorized by Quality Engineering Lead</span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPdfModal(false)}
                className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs uppercase rounded-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`Certificate of Analysis (CoA-2026-${selectedReportId.toString().padStart(4, '0')}) exported to MES Document Store.`);
                  setShowPdfModal(false);
                }}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase flex items-center gap-1.5 rounded-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Certified PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
