/* Hallmark · component: FoodSafetyTraceabilityTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { 
  GitFork, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Layers, 
  ShieldAlert, 
  Lock, 
  RefreshCw, 
  FileCheck,
  UserCheck
} from 'lucide-react';
import { 
  BackwardTraceabilityData, 
  ForwardTraceabilityData, 
  AffectedBatchRecord 
} from '../../types/report';
import * as api from '../../services/api';

export const FoodSafetyTraceabilityTab: React.FC = () => {
  // Mode selection: 'backward' = Batch Genealogy, 'forward' = Ingredient Recall Radar
  const [traceMode, setTraceMode] = useState<'backward' | 'forward'>('backward');

  // Mode A: Backward Traceability State
  const [orderCodeInput, setOrderCodeInput] = useState<string>('WO-2026-004');
  const [backwardData, setBackwardData] = useState<BackwardTraceabilityData | null>(null);
  const [isBackwardLoading, setIsBackwardLoading] = useState<boolean>(false);
  const [backwardError, setBackwardError] = useState<string | null>(null);

  // Mode B: Forward Traceability State
  const [selectedMaterial, setSelectedMaterial] = useState<string>('RAW_MILK');
  const [inboundDateFilter, setInboundDateFilter] = useState<string>('');
  const [lotKeywordFilter, setLotKeywordFilter] = useState<string>('');
  const [forwardData, setForwardData] = useState<ForwardTraceabilityData | null>(null);
  const [isForwardLoading, setIsForwardLoading] = useState<boolean>(false);
  const [forwardError, setForwardError] = useState<string | null>(null);

  // Quarantine Modal / In-flight state
  const [quarantiningOrder, setQuarantiningOrder] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);

  // Load initial backward trace on mount
  useEffect(() => {
    fetchBackwardTrace('WO-2026-004');
  }, []);

  const fetchBackwardTrace = async (orderCode: string) => {
    if (!orderCode.trim()) return;
    setIsBackwardLoading(true);
    setBackwardError(null);
    try {
      const data = await api.getBackwardTraceability(orderCode.trim());
      setBackwardData(data);
    } catch (err: any) {
      setBackwardError(err.message || 'Failed to retrieve batch genealogy');
      setBackwardData(null);
    } finally {
      setIsBackwardLoading(false);
    }
  };

  const fetchForwardTrace = async () => {
    setIsForwardLoading(true);
    setForwardError(null);
    try {
      const data = await api.getForwardTraceability(
        selectedMaterial,
        inboundDateFilter.trim() || undefined,
        lotKeywordFilter.trim() || undefined
      );
      setForwardData(data);
    } catch (err: any) {
      setForwardError(err.message || 'Failed to execute recall impact analysis');
      setForwardData(null);
    } finally {
      setIsForwardLoading(false);
    }
  };

  const handleQuarantine = async (orderCode: string) => {
    setQuarantiningOrder(orderCode);
    try {
      await api.quarantineBatch(
        orderCode,
        `ISO 22000 / HACCP Emergency Containment - Raw Lot Contamination (${selectedMaterial})`,
        'qa_supervisor_01'
      );
      setActionSuccessNotice(`Batch [${orderCode}] immediately quarantined in SQL Server and FDA 21 CFR Part 11 audit ledger.`);
      setTimeout(() => setActionSuccessNotice(null), 5000);

      // Locally update forwardData
      if (forwardData) {
        const updatedBatches = forwardData.affected_batches.map((b: AffectedBatchRecord) =>
          b.order_code === orderCode
            ? { ...b, quality_status: 'FAIL', disposition: 'QUARANTINED', status: 'QUARANTINE' }
            : b
        );
        setForwardData({ ...forwardData, affected_batches: updatedBatches });
      }

      // Locally update backwardData if matching
      if (backwardData && backwardData.order_code === orderCode) {
        setBackwardData({
          ...backwardData,
          batch_info: {
            ...backwardData.batch_info,
            quality_status: 'FAIL',
            disposition: 'QUARANTINED',
            status: 'QUARANTINE',
          },
        });
      }
    } catch (err: any) {
      alert(`Quarantine failed: ${err.message || err}`);
    } finally {
      setQuarantiningOrder(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Notification */}
      {actionSuccessNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-4 py-3 text-xs font-mono font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{actionSuccessNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessNotice(null)}
            className="text-slate-500 hover:text-slate-900 font-bold px-2 py-1"
          >
            ×
          </button>
        </div>
      )}

      {/* TOP HEADER & MODE SELECTOR */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold">
              FOOD SAFETY &amp; QUALITY ASSURANCE
            </span>
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">
              HACCP • ISO 22000 • BI-DIRECTIONAL GENEALOGY RADAR
            </span>
          </div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2" style={{ fontStyle: 'normal' }}>
            <GitFork className="w-5 h-5 text-slate-800" />
            BI-DIRECTIONAL FOOD SAFETY TRACEABILITY CENTER
          </h2>
          <p className="text-xs text-slate-600 mt-0.5">
            Full ingredient genealogy tree &amp; rapid recall containment blast radius for physical plant lots
          </p>
        </div>

        {/* Dual Mode Switcher */}
        <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xs">
          <button
            type="button"
            onClick={() => {
              setTraceMode('backward');
              if (!backwardData) fetchBackwardTrace(orderCodeInput);
            }}
            className={`h-9 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all rounded-xs hallmark-focus ${
              traceMode === 'backward'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-700" />
            <span>Mode A: Batch Genealogy</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTraceMode('forward');
              if (!forwardData) fetchForwardTrace();
            }}
            className={`h-9 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all rounded-xs hallmark-focus ${
              traceMode === 'forward'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
            <span>Mode B: Recall Radar</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          MODE A: BACKWARD TRACEABILITY (BATCH GENEALOGY)
          ========================================================================= */}
      {traceMode === 'backward' && (
        <div className="space-y-6">
          {/* Query Filter Strip */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px] uppercase">
                    Target Work Order / Report Code
                  </label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      value={orderCodeInput}
                      onChange={(e) => setOrderCodeInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchBackwardTrace(orderCodeInput)}
                      placeholder="e.g. WO-2026-004, RPT-2026-004"
                      className="pl-8 pr-3 h-9 border border-slate-300 font-mono text-xs w-64 rounded-xs bg-white hallmark-focus"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fetchBackwardTrace(orderCodeInput)}
                  disabled={isBackwardLoading}
                  className="h-9 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBackwardLoading ? 'animate-spin' : ''}`} />
                  <span>Inspect Genealogy</span>
                </button>
              </div>

              {/* Quick Select Preset Pills */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-[11px] text-slate-500 font-mono uppercase mr-1">Recent Batches:</span>
                {['WO-2026-004', 'WO-2026-001', 'WO-2026-002', 'WO-2026-003'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setOrderCodeInput(code);
                      fetchBackwardTrace(code);
                    }}
                    className={`h-7 px-2.5 text-[11px] font-mono border rounded-xs transition-all ${
                      orderCodeInput === code
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {backwardError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-950 p-4 text-xs font-mono">
              <span className="font-bold">[ERROR]</span> {backwardError}
            </div>
          )}

          {/* Batch Genealogy Cards */}
          {backwardData && (
            <div className="space-y-6">
              {/* Batch Metadata Strip */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Batch ID Card */}
                <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Batch Identifier</div>
                  <div className="text-sm font-mono font-bold text-slate-900">{backwardData.batch_info.order_code}</div>
                  <div className="text-xs text-slate-600 font-mono flex items-center gap-1">
                    <FileCheck className="w-3.5 h-3.5 text-slate-500" />
                    <span>{backwardData.batch_info.report_code}</span>
                  </div>
                </div>

                {/* 2. Recipe & Volume */}
                <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Recipe &amp; Volume</div>
                  <div className="text-sm font-bold text-slate-900 truncate">{backwardData.batch_info.recipe_applied}</div>
                  <div className="text-xs text-slate-600 font-mono">
                    Output: <span className="font-bold text-slate-900">{backwardData.batch_info.total_produced.toLocaleString()} L</span>
                  </div>
                </div>

                {/* 3. QA Disposition */}
                <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Quality Disposition</div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold font-mono border ${
                        backwardData.batch_info.quality_status === 'PASS'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-rose-50 text-rose-800 border-rose-300'
                      }`}
                    >
                      {backwardData.batch_info.quality_status === 'PASS' ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                      )}
                      {backwardData.batch_info.quality_status}
                    </span>
                    <span className="text-xs font-mono text-slate-600 uppercase font-semibold">
                      {backwardData.batch_info.disposition}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-slate-400" />
                    <span>Sign-off: {backwardData.batch_info.sign_off_by}</span>
                  </div>
                </div>

                {/* 4. Customer Allocation */}
                <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-1">
                  <div className="text-[10px] text-slate-500 uppercase font-mono">Assigned Customer</div>
                  <div className="text-sm font-bold text-slate-900 truncate flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                    <span className="truncate">{backwardData.customer.customer_name}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono truncate">
                    {backwardData.customer.customer_code} • {backwardData.customer.phone}
                  </div>
                </div>
              </div>

              {/* Raw Material Genealogy Breakdown Table */}
              <div className="bg-white border border-slate-200 shadow-xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
                      Consumed Ingredients &amp; Inbound Lot Genealogy Ledger
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    ISA-88 INGREDIENTS CONSUMED: {backwardData.ingredients.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold font-mono text-[11px]">
                        <th className="px-3 py-2.5">Material Code</th>
                        <th className="px-3 py-2.5">Material Name</th>
                        <th className="px-3 py-2.5 text-right">Recipe Share</th>
                        <th className="px-3 py-2.5 text-right">Setpoint</th>
                        <th className="px-3 py-2.5 text-right">Actual Consumed</th>
                        <th className="px-3 py-2.5 text-right">Deviation</th>
                        <th className="px-3 py-2.5">Matched Inbound Intake Lots</th>
                        <th className="px-3 py-2.5">Approved Supplier</th>
                        <th className="px-3 py-2.5">Receipt Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {backwardData.ingredients.map((ing) => {
                        const topLot = ing.inbound_lots.length > 0 ? ing.inbound_lots[0] : null;
                        return (
                          <tr key={ing.material_code} className="hover:bg-slate-50">
                            <td className="px-3 py-3 font-bold text-slate-900">
                              <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300">
                                {ing.material_code}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-800 font-sans font-medium">
                              {ing.material_name}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-700 font-bold">
                              {ing.percentage.toFixed(1)}%
                            </td>
                            <td className="px-3 py-3 text-right text-slate-600">
                              {ing.target_value.toLocaleString()} {ing.unit}
                            </td>
                            <td className="px-3 py-3 text-right text-slate-900 font-bold">
                              {ing.actual_value.toLocaleString()} {ing.unit}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <span
                                className={`px-1.5 py-0.5 text-[10px] font-bold ${
                                  Math.abs(ing.deviation_percent) <= 1.0
                                    ? 'text-emerald-700 bg-emerald-50'
                                    : 'text-amber-700 bg-amber-50'
                                }`}
                              >
                                {ing.deviation_percent >= 0 ? `+${ing.deviation_percent}%` : `${ing.deviation_percent}%`}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-slate-900 font-bold">
                              {topLot ? (
                                <div className="space-y-0.5">
                                  <span className="text-slate-900 font-bold">{topLot.lot_number}</span>
                                  <div className="text-[10px] text-slate-500 font-normal">
                                    Lot Qty: {topLot.quantity.toLocaleString()} {ing.unit}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400">--</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-slate-700 font-sans">
                              {topLot ? topLot.supplier : '--'}
                            </td>
                            <td className="px-3 py-3 text-slate-600">
                              {topLot ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {topLot.input_time}
                                </span>
                              ) : (
                                '--'
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODE B: FORWARD TRACEABILITY (INGREDIENT RECALL RADAR)
          ========================================================================= */}
      {traceMode === 'forward' && (
        <div className="space-y-6">
          {/* Query Filter Strip */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="flex flex-wrap items-end gap-3 text-xs">
                {/* Material Select */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px] uppercase">
                    Contaminated Ingredient
                  </label>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="h-9 px-3 border border-slate-300 font-mono text-xs rounded-xs bg-white hallmark-focus"
                  >
                    <option value="RAW_MILK">RAW_MILK — Fresh Raw Milk (Sữa tươi nguyên liệu)</option>
                    <option value="SUGAR">SUGAR — Refined Cane Sugar (Đường tinh luyện)</option>
                    <option value="ADDITIVE">ADDITIVE — Flavor &amp; Vitamins (Phụ gia &amp; Vi chất)</option>
                  </select>
                </div>

                {/* Inbound Date Picker */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px] uppercase">
                    Inbound Delivery Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={inboundDateFilter}
                    onChange={(e) => setInboundDateFilter(e.target.value)}
                    className="h-9 px-3 border border-slate-300 font-mono text-xs rounded-xs bg-white hallmark-focus"
                  />
                </div>

                {/* Lot Keyword */}
                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px] uppercase">
                    Lot # or Supplier Keyword
                  </label>
                  <input
                    type="text"
                    value={lotKeywordFilter}
                    onChange={(e) => setLotKeywordFilter(e.target.value)}
                    placeholder="e.g. LOT-MILK-20260908-A, Moc Chau..."
                    className="h-9 px-3 border border-slate-300 font-mono text-xs w-56 rounded-xs bg-white hallmark-focus"
                  />
                </div>

                <button
                  type="button"
                  onClick={fetchForwardTrace}
                  disabled={isForwardLoading}
                  className="h-9 px-4 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isForwardLoading ? 'animate-spin' : ''}`} />
                  <span>Run Recall Analysis</span>
                </button>
              </div>
            </div>
          </div>

          {forwardError && (
            <div className="bg-rose-50 border border-rose-300 text-rose-950 p-4 text-xs font-mono">
              <span className="font-bold">[ERROR]</span> {forwardError}
            </div>
          )}

          {/* Forward Recall Radar Output */}
          {forwardData && (
            <div className="space-y-6">
              {/* HIGH-CONTRAST RECALL IMPACT SUMMARY BANNER */}
              <div className="bg-[#FFF1F2] border-2 border-[#FDA4AF] p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-rose-700 text-white flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-950">
                      HACCP EMERGENCY RECALL BLAST RADIUS
                    </div>
                    <div className="text-sm font-extrabold text-[#881337] mt-0.5">
                      ALERT: {forwardData.summary.total_batches_affected} Batches affected · {forwardData.summary.total_volume_liters.toLocaleString()} L total volume · {forwardData.summary.total_customers_impacted} Customers impacted
                    </div>
                    <div className="text-[11px] text-rose-900 mt-0.5 font-sans">
                      Material trace target: <span className="font-mono font-bold">{forwardData.material_code}</span> · Immediate customer recall communication required
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="px-3 py-1.5 bg-white border border-rose-300 rounded-xs text-center font-mono">
                    <div className="text-[10px] text-rose-700 uppercase leading-none">Affected Batches</div>
                    <div className="text-sm font-bold text-rose-950">{forwardData.summary.total_batches_affected}</div>
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-rose-300 rounded-xs text-center font-mono">
                    <div className="text-[10px] text-rose-700 uppercase leading-none">Total Liters</div>
                    <div className="text-sm font-bold text-rose-950">{forwardData.summary.total_volume_liters.toLocaleString()} L</div>
                  </div>
                </div>
              </div>

              {/* Impacted Batches Table */}
              <div className="bg-white border border-slate-200 shadow-xs">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-700" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
                      Affected Downstream Finished Batches &amp; Recall Dispatch
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    TOTAL TARGETED: {forwardData.affected_batches.length} BATCHES
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold font-mono text-[11px]">
                        <th className="px-3 py-2.5">Affected Batch ID</th>
                        <th className="px-3 py-2.5">Recipe Applied</th>
                        <th className="px-3 py-2.5">Customer Name &amp; Contact</th>
                        <th className="px-3 py-2.5 font-mono">Production Date</th>
                        <th className="px-3 py-2.5 text-right font-mono">Volume (L)</th>
                        <th className="px-3 py-2.5 text-center font-mono">QA Disposition</th>
                        <th className="px-3 py-2.5 text-center">Recall Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                      {forwardData.affected_batches.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-slate-400 font-mono">
                            Zero batches impacted by this material query. Nominal condition.
                          </td>
                        </tr>
                      ) : (
                        forwardData.affected_batches.map((b) => {
                          const isQuarantined = b.disposition === 'QUARANTINED' || b.status === 'QUARANTINE';

                          return (
                            <tr key={b.order_code} className={`hover:bg-slate-50 ${isQuarantined ? 'bg-rose-50/40' : ''}`}>
                              <td className="px-3 py-3 font-bold text-slate-900">
                                <div>{b.order_code}</div>
                                <div className="text-[10px] text-slate-500 font-normal">{b.report_code}</div>
                              </td>
                              <td className="px-3 py-3 text-slate-800 font-sans font-medium">
                                {b.recipe_applied}
                              </td>
                              <td className="px-3 py-3 font-sans">
                                <div className="font-bold text-slate-900">{b.customer_name}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {b.customer_email} • {b.customer_phone}
                                </div>
                              </td>
                              <td className="px-3 py-3 text-slate-600">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {b.production_date}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right text-slate-900 font-bold">
                                {b.volume_liters.toLocaleString()} L
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border ${
                                    isQuarantined
                                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                                      : b.quality_status === 'PASS'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                      : 'bg-amber-50 text-amber-800 border-amber-300'
                                  }`}
                                >
                                  {isQuarantined && <Lock className="w-3 h-3 text-rose-700" />}
                                  {b.disposition}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                {isQuarantined ? (
                                  <span className="px-2 py-1 bg-slate-100 border border-slate-300 text-slate-600 font-mono text-[10px] font-bold inline-flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-slate-500" />
                                    QUARANTINED
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleQuarantine(b.order_code)}
                                    disabled={quarantiningOrder === b.order_code}
                                    className="h-7 px-3 bg-rose-700 hover:bg-rose-800 text-white font-mono text-[10px] font-bold uppercase rounded-xs transition-all hallmark-focus active:translate-y-px inline-flex items-center gap-1"
                                    title="Quarantine this batch immediately and record FDA 21 CFR Part 11 audit log"
                                  >
                                    <Lock className="w-3 h-3" />
                                    <span>Quarantine Batch</span>
                                  </button>
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
          )}
        </div>
      )}
    </div>
  );
};

export default FoodSafetyTraceabilityTab;
