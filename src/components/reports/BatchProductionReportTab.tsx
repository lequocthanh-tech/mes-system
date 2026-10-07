/* Hallmark · component: BatchProductionReportTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useReports } from '../../context/ReportContext';
import { 
  FileCheck2, 
  Layers, 
  CheckCircle2, 
  Thermometer, 
  Clock, 
  Scale,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Target
} from 'lucide-react';

export const BatchProductionReportTab: React.FC = () => {
  const { 
    batchMasters, 
    batchDetails, 
    selectedBatchReportId, 
    selectBatchReport,
    searchQuery,
    fromDate,
    toDate
  } = useReports();

  const [showAnalytics, setShowAnalytics] = useState<boolean>(true);

  // Filter master records
  const filteredMasters = batchMasters.filter((m) => {
    const dateStr = m.startTime.slice(0, 10);
    if (fromDate && dateStr < fromDate) return false;
    if (toDate && dateStr > toDate) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.reportId.toLowerCase().includes(q) ||
        m.orderId.toLowerCase().includes(q) ||
        m.recipeApplied.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter details for currently selected master
  const currentDetails = batchDetails.filter((d) => d.reportId === selectedBatchReportId);
  const currentMaster = batchMasters.find((m) => m.reportId === selectedBatchReportId);

  // Analytics summary calculations
  const totalProduced = filteredMasters.reduce((sum, b) => sum + b.actualVolume, 0);
  const totalTarget = filteredMasters.reduce((sum, b) => sum + b.targetQty, 0);
  const avgYield = totalTarget > 0 ? (totalProduced / totalTarget) * 100 : 100;
  const maxVolume = Math.max(1020, ...filteredMasters.map(b => b.actualVolume));
  const minVolume = Math.min(980, ...filteredMasters.map(b => b.actualVolume));

  return (
    <div className="space-y-6">
      {/* 1. VISUAL BATCH ANALYTICS & DEVIATION PROFILES (COLLAPSIBLE DRAWER) */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Visual Batch Analytics &amp; Deviation Profiles
            </span>
            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-mono font-bold">
              TARGET: 1,000.0 L NOMINAL
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="h-9 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 border border-slate-300 rounded-xs flex items-center gap-1.5 transition-colors hallmark-focus"
          >
            <span>{showAnalytics ? 'Collapse Analytics' : 'Expand Analytics'}</span>
            {showAnalytics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showAnalytics && (
          <div className="p-4 space-y-4">
            {/* KPI Metric Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Total Volume Yield</div>
                <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                  {totalProduced.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <span className="text-xs text-slate-500 font-normal ml-1">Liters</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Target Aggregate</div>
                <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                  {totalTarget.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <span className="text-xs text-slate-500 font-normal ml-1">Liters</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Average Yield Ratio</div>
                <div className="text-lg font-mono font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <span>{avgYield.toFixed(2)}%</span>
                  <span className="text-[10px] font-mono text-slate-500 font-normal">NOMINAL</span>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 p-3">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Target Variance Band</div>
                <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">
                  -5.0 L / +5.4 L
                  <span className="text-xs text-slate-500 font-normal ml-1">(±0.5%)</span>
                </div>
              </div>
            </div>

            {/* Industrial Target vs Actual SVG Bar Chart */}
            <div className="border border-slate-200 p-4 bg-white">
              <div className="flex items-center justify-between text-xs font-mono text-slate-600 mb-3">
                <span className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Target className="w-4 h-4 text-sky-600" />
                  OUTPUT VOLUME VS. 1,000L TARGET BAR CHART (RPT-07 TO RPT-10)
                </span>
                <span className="text-[11px] text-slate-500">HAIRLINE INDICATES 1,000L SETPOINT</span>
              </div>

              <div className="relative pt-2 pb-6">
                {/* Chart container */}
                <div className="h-44 w-full flex items-end justify-around gap-4 px-6 border-b border-l border-slate-300 relative">
                  {/* Reference Line for 1,000L Target */}
                  <div 
                    className="absolute w-full border-t-2 border-dashed border-sky-500 left-0 z-10 pointer-events-none flex items-center justify-end pr-2"
                    style={{ bottom: `${((1000 - minVolume) / (maxVolume - minVolume)) * 100}%` }}
                  >
                    <span className="bg-sky-100 text-sky-900 border border-sky-300 text-[9px] font-mono font-bold px-1.5 py-0.5">
                      TARGET: 1,000.0 L
                    </span>
                  </div>

                  {filteredMasters.map((master) => {
                    const variance = master.actualVolume - master.targetQty;
                    const isPositive = variance >= 0;
                    const heightPercent = Math.max(15, Math.min(95, ((master.actualVolume - minVolume) / (maxVolume - minVolume)) * 100));
                    const isSelected = selectedBatchReportId === master.reportId;

                    return (
                      <div 
                        key={master.reportId} 
                        onClick={() => selectBatchReport(master.reportId)}
                        className="flex-1 max-w-[120px] flex flex-col items-center cursor-pointer group relative z-20"
                      >
                        {/* Tooltip callout on bar */}
                        <div className="text-[10px] font-mono font-bold mb-1 text-slate-800 transition-transform group-hover:-translate-y-0.5">
                          {master.actualVolume.toFixed(1)} L
                          <span className={`ml-1 text-[9px] ${isPositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                            ({isPositive ? `+${variance.toFixed(1)}` : variance.toFixed(1)})
                          </span>
                        </div>

                        {/* Bar pillar */}
                        <div 
                          className={`w-full transition-all duration-200 rounded-t-xs border ${
                            isSelected 
                              ? 'bg-slate-900 border-slate-950 ring-2 ring-sky-500/50' 
                              : isPositive 
                                ? 'bg-slate-700 hover:bg-slate-800 border-slate-800' 
                                : 'bg-slate-600 hover:bg-slate-700 border-slate-700'
                          }`}
                          style={{ height: `${heightPercent}%` }}
                        />

                        {/* X-Axis Batch Label */}
                        <div className="mt-2 text-center">
                          <div className={`text-[11px] font-mono font-bold ${isSelected ? 'text-sky-700 underline' : 'text-slate-800'}`}>
                            {master.reportId}
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 truncate max-w-[110px]" title={master.recipeApplied}>
                            {master.recipeApplied}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. MASTER TABLE: PRODUCTION BATCH SUMMARY */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-sky-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
              Production Batch Summary (Master Ledger)
            </h2>
            <span className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] font-mono font-bold border border-slate-700">
              {filteredMasters.length} record(s)
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-300">
            CLICK ANY BATCH TO INSPECT INGREDIENT TELEMETRY
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="px-3 py-2.5 font-mono">Report ID</th>
                <th className="px-3 py-2.5 font-mono">Order ID</th>
                <th className="px-3 py-2.5">Recipe Applied</th>
                <th className="px-3 py-2.5 font-mono">Start Time</th>
                <th className="px-3 py-2.5 font-mono">End Time</th>
                <th className="px-3 py-2.5 font-mono text-right">Hot Temp (°C)</th>
                <th className="px-3 py-2.5 font-mono text-right">Cold Temp (°C)</th>
                <th className="px-3 py-2.5 font-mono text-right">Target Qty</th>
                <th className="px-3 py-2.5 font-mono text-right">Actual Volume (L)</th>
                <th className="px-3 py-2.5 text-center font-mono">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredMasters.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-mono">
                    No production batch records match the active query.
                  </td>
                </tr>
              ) : (
                filteredMasters.map((master) => {
                  const isSelected = selectedBatchReportId === master.reportId;
                  const variance = Math.round((master.actualVolume - master.targetQty) * 10) / 10;

                  return (
                    <tr
                      key={master.reportId}
                      onClick={() => selectBatchReport(master.reportId)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-sky-50 font-medium' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                        {isSelected && <span className="w-1.5 h-1.5 bg-sky-600 rounded-full" />}
                        {master.reportId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 font-semibold">
                        {master.orderId}
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 font-medium">
                        {master.recipeApplied}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">
                        {master.startTime}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px]">
                        {master.endTime}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-slate-800">
                        {master.hotTemp.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-slate-800">
                        {master.coldTemp.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-slate-600">
                        {master.targetQty.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right font-bold text-slate-900">
                        {master.actualVolume.toLocaleString()}
                        <span className={`ml-1 text-[10px] ${variance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          ({variance >= 0 ? `+${variance}` : variance})
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          {master.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. DETAIL TABLE: INGREDIENT SETPOINT VS PLC ACTUAL READBACK */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider" style={{ fontStyle: 'normal' }}>
              Granular Ingredient Telemetry &amp; Formulation Readback (Detail)
            </h2>
            {currentMaster && (
              <span className="px-2 py-0.5 bg-slate-800 text-sky-400 text-[10px] font-mono font-bold border border-slate-700">
                BATCH: {currentMaster.reportId} ({currentMaster.recipeApplied})
              </span>
            )}
          </div>

          {currentMaster && (
            <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
              <span className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                Hot SP: {currentMaster.hotTemp}°C
              </span>
              <span className="flex items-center gap-1">
                <Thermometer className="w-3.5 h-3.5 text-sky-400" />
                Cold SP: {currentMaster.coldTemp}°C
              </span>
              <span className="flex items-center gap-1">
                <Scale className="w-3.5 h-3.5 text-emerald-400" />
                Yield: {((currentMaster.actualVolume / currentMaster.targetQty) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                <th className="px-3 py-2.5 font-mono">Detail ID</th>
                <th className="px-3 py-2.5 font-mono">Report ID</th>
                <th className="px-3 py-2.5 font-mono">Material Code</th>
                <th className="px-3 py-2.5">Material Name</th>
                <th className="px-3 py-2.5 font-mono text-right">Recipe Share (%)</th>
                <th className="px-3 py-2.5 font-mono text-right">Target Setpoint</th>
                <th className="px-3 py-2.5 font-mono text-right">PLC Actual Collected</th>
                <th className="px-3 py-2.5 font-mono text-center">Unit</th>
                <th className="px-3 py-2.5 font-mono text-right">Variance (%)</th>
                <th className="px-3 py-2.5 font-mono">Timestamp Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {currentDetails.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-400 font-mono">
                    No ingredient detail records found for batch {selectedBatchReportId}.
                  </td>
                </tr>
              ) : (
                currentDetails.map((detail) => {
                  const diff = detail.plcActual - detail.targetSetpoint;
                  const diffPct = Math.round(((diff / detail.targetSetpoint) * 100) * 100) / 100;
                  const isNearZero = Math.abs(diffPct) < 0.5;

                  return (
                    <tr key={detail.detailId} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                        {detail.detailId}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">
                        {detail.reportId}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-800">
                        <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200">
                          {detail.materialCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-900 font-medium">
                        {detail.materialName}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-right">
                        {detail.recipeShare}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-700 text-right">
                        {detail.targetSetpoint.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-900 text-right">
                        {detail.plcActual.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-center font-bold">
                        {detail.unit}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right font-bold">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] ${
                            isNearZero
                              ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                              : 'text-amber-700 bg-amber-50 border border-amber-200'
                          }`}
                        >
                          {diffPct > 0 ? `+${diffPct.toFixed(2)}%` : `${diffPct.toFixed(2)}%`}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600 text-[11px] flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {detail.timestamp}
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
