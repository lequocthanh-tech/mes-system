/* Hallmark · component: QualitySummaryTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useQuality } from '../../context/QualityContext';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Percent, 
  Package, 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  Wrench, 
  CheckCheck
} from 'lucide-react';

export const QualitySummaryTab: React.FC = () => {
  const { batchRecords, activeCapaTicket, resolveCapaTicket } = useQuality();

  const [showCapaModal, setShowCapaModal] = useState<boolean>(false);
  const [dispatchToast, setDispatchToast] = useState<string | null>(null);

  const totalBatches = batchRecords.length;
  const passedBatches = batchRecords.filter((b) => b.status === 'PASS').length;
  const failedBatches = batchRecords.filter((b) => b.status === 'FAIL' || b.disposition === 'QUARANTINED').length;
  const firstPassYield = totalBatches > 0 ? (passedBatches / totalBatches) * 100 : 88.9;
  const totalVolumeProduced = batchRecords.reduce((acc, b) => acc + b.totalProduced, 0) || 43200;

  // Recipe specific metrics
  const uhtBatches = batchRecords.filter((b) => b.recipeId === 'RCP-MILK-UHT-01');
  const uhtPassed = uhtBatches.filter((b) => b.status === 'PASS').length;
  const uhtRate = uhtBatches.length > 0 ? (uhtPassed / uhtBatches.length) * 100 : 80.0;

  const chocoBatches = batchRecords.filter((b) => b.recipeId === 'RCP-CHOCO-02');
  const chocoPassed = chocoBatches.filter((b) => b.status === 'PASS').length;
  const chocoRate = chocoBatches.length > 0 ? (chocoPassed / chocoBatches.length) * 100 : 100.0;

  const handleDispatchMaintOrder = () => {
    resolveCapaTicket(activeCapaTicket.ticketId);
    setDispatchToast('Work order #WO-MAINT-402 successfully dispatched to Maintenance execution queue.');
    setTimeout(() => setDispatchToast(null), 5000);
    setShowCapaModal(false);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Toast Notification */}
      {dispatchToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{dispatchToast}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold uppercase">DISPATCHED</span>
        </div>
      )}

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: First-Pass Yield */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              First-Pass Yield (FPY %)
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              {firstPassYield.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400">
              {passedBatches} of {totalBatches} batches compliant
            </span>
          </div>
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Total Volume Produced */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              Total Inspected Volume
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {totalVolumeProduced.toLocaleString()} L
            </span>
            <span className="text-[10px] text-slate-400">
              Across all formulation lines
            </span>
          </div>
          <div className="w-10 h-10 bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Quarantined Batches */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              Quarantined Batches
            </span>
            <span className="text-2xl font-bold text-rose-700 mt-1 block">
              {failedBatches} Batch
            </span>
            <span className="text-[10px] text-rose-600 font-semibold">
              Batch #10 (QAR-2026-010)
            </span>
          </div>
          <div className="w-10 h-10 bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Quality Performance Level */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              Quality Performance Index
            </span>
            <span className="text-2xl font-bold text-blue-700 mt-1 block">
              GRADE A-
            </span>
            <span className="text-[10px] text-slate-400">
              98.2% Parameter Conformity
            </span>
          </div>
          <div className="w-10 h-10 bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left: Recipe Conformity Breakdown (Pareto) */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              Pareto Defect & Quality Pass Rates
            </span>
            <span className="text-[10px] text-slate-500">BY RECIPE CODE</span>
          </div>

          <div className="space-y-4 pt-1">
            {/* RCP-CHOCO-02 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800">
                  RCP-CHOCO-02 (Chocolate Flavored Dairy v1.0)
                </span>
                <span className="font-bold text-emerald-700">
                  {chocoRate.toFixed(1)}% PASS ({chocoPassed}/{chocoBatches.length})
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 border border-slate-200">
                <div className="h-full bg-emerald-600" style={{ width: `${chocoRate}%` }} />
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                0 Critical Defects • High Viscosity & Dosing Accuracy
              </span>
            </div>

            {/* RCP-MILK-UHT-01 */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-800">
                  RCP-MILK-UHT-01 (Fresh Pasteurized UHT Milk v1.2)
                </span>
                <span className="font-bold text-amber-700">
                  {uhtRate.toFixed(1)}% PASS ({uhtPassed}/{uhtBatches.length})
                </span>
              </div>
              <div className="w-full h-3 bg-slate-100 border border-slate-200">
                <div className="h-full bg-amber-600" style={{ width: `${uhtRate}%` }} />
              </div>
              <span className="text-[10px] text-rose-600 mt-0.5 block font-semibold">
                1 Defect: Pasteurization Temp Kill Hold CCP-1 (Batch #10 / QAR-2026-010)
              </span>
            </div>
          </div>
        </div>

        {/* Right: Critical Defect Root Cause & CAPA Management */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-slate-700" />
              Quality Root Cause & Corrective Actions (CAPA)
            </span>
            <span className={`text-[10px] px-2 py-0.5 font-bold ${
              activeCapaTicket.status === 'RESOLVED'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-rose-100 text-rose-800 animate-pulse'
            }`}>
              {activeCapaTicket.status === 'RESOLVED' ? 'TICKET #CAPA-101 RESOLVED' : 'OPEN TICKET #CAPA-101'}
            </span>
          </div>

          <div className="space-y-3 text-[11px] text-slate-700">
            <div className="p-3 bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-rose-700">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  {activeCapaTicket.title}
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  Ref: {activeCapaTicket.reportCode} / {activeCapaTicket.orderId}
                </span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                {activeCapaTicket.rootCause}
              </p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 space-y-1.5">
              <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                Prescribed Corrective & Preventive Action
              </div>
              <p className="text-emerald-800 leading-relaxed">
                {activeCapaTicket.correctiveAction}
              </p>
            </div>

            {/* Action Button to Open Ticket Modal */}
            <div className="pt-1 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowCapaModal(true)}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
              >
                <Wrench className="w-3.5 h-3.5 text-slate-300" />
                <span>Open Ticket #CAPA-101</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-white border border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>STATISTICAL PROCESS CONTROL (SPC) & CONTINUOUS QUALITY VERIFICATION</span>
        </div>
        <div>
          <span>ISO 22000 / HACCP COMPLIANCE AUDIT READY</span>
        </div>
      </div>

      {/* CAPA Ticket Inspection & Maintenance Dispatch Modal */}
      {showCapaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 shadow-2xl max-w-2xl w-full p-6 space-y-5 font-mono text-xs">
            <div className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900 uppercase">
                    CAPA Ticket {activeCapaTicket.ticketId}
                  </h3>
                  <span className={`px-2 py-0.5 text-[10px] font-bold ${
                    activeCapaTicket.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {activeCapaTicket.status}
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">
                  CORRECTIVE AND PREVENTIVE ACTION WORKFLOW • ISA-95 LEVEL 3
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCapaModal(false)}
                className="h-8 px-3 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xs"
              >
                ✕ Close
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 text-[11px]">
                <div><strong>Work Order:</strong> {activeCapaTicket.orderId}</div>
                <div><strong>Inspection Report:</strong> {activeCapaTicket.reportCode}</div>
                <div><strong>Equipment Impact:</strong> LINE-01 Sterilizer (TC-201 / H-201)</div>
                <div><strong>Severity:</strong> <span className="text-rose-700 font-bold">{activeCapaTicket.severity} (CCP BREACH)</span></div>
                <div><strong>Assigned Module:</strong> {activeCapaTicket.assignedModule}</div>
                <div><strong>Target Work Order:</strong> WO-MAINT-402</div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <span className="font-bold text-[11px] block uppercase">Defect Root Cause Investigation:</span>
                <p className="leading-relaxed">
                  {activeCapaTicket.rootCause}
                </p>
              </div>

              <div className="p-3 bg-slate-100 border border-slate-300 text-slate-800 space-y-1">
                <span className="font-bold text-[11px] block uppercase">Corrective Maintenance Directives:</span>
                <p className="leading-relaxed">
                  {activeCapaTicket.correctiveAction}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCapaModal(false)}
                className="h-9 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs uppercase rounded-xs"
              >
                Close
              </button>
              {activeCapaTicket.status !== 'RESOLVED' ? (
                <button
                  type="button"
                  onClick={handleDispatchMaintOrder}
                  className="h-9 px-4 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs uppercase flex items-center gap-1.5 rounded-xs"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>Dispatch Maintenance Work Order #WO-MAINT-402</span>
                </button>
              ) : (
                <div className="h-9 px-4 bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs uppercase flex items-center gap-1.5 rounded-xs">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Work Order #WO-MAINT-402 Dispatched</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
