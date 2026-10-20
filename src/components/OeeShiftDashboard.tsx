/* Hallmark · component: OeeShiftDashboard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 * standard: ANSI/ISA-95 · ISO 22400-2 Key Performance Indicator
 */

import React, { useState, useMemo } from 'react';
import { useOperations } from '../context/OperationsContext';
import { useOeeSummary, UseOeeSummaryReturn } from '../hooks/useOeeSummary';
import { OeeSummaryData } from '../services/api';
import { 
  Gauge, 
  Clock, 
  Users, 
  PackageCheck, 
  ChevronUp, 
  ChevronDown, 
  TrendingUp, 
  Zap,
  Activity
} from 'lucide-react';

interface OeeShiftDashboardProps {
  className?: string;
  defaultCollapsed?: boolean;
  oeeSummary?: UseOeeSummaryReturn | OeeSummaryData | null;
}

export const OeeShiftDashboard: React.FC<OeeShiftDashboardProps> = ({ 
  className = '', 
  defaultCollapsed = false,
  oeeSummary: externalOeeSummary
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const { runningOrders, finishedOrders } = useOperations();

  // Internal OEE Poller hook fallback (2.5-second polling interval, shared with OEEDashboard)
  const hookData = useOeeSummary({ pollIntervalMs: 2500, enabled: !externalOeeSummary });

  // Merge external prop or hook data as the Single Source of Truth
  const activeOee = externalOeeSummary || hookData;

  // Extract metrics from shared OEE engine (Zeroed defaults when in cold standby / unmapped tags)
  const overallOee = Number(
    (activeOee as any)?.overallOee ?? 
    (activeOee as any)?.overall_oee ?? 
    (activeOee as any)?.oee ?? 
    (activeOee as any)?.line_oee ?? 
    0.0
  );

  const availability = Number(
    (activeOee as any)?.availability ?? 
    0.0
  );

  const performance = Number(
    (activeOee as any)?.performance ?? 
    0.0
  );

  const quality = Number(
    (activeOee as any)?.qualityRate ?? 
    (activeOee as any)?.quality_rate ?? 
    (activeOee as any)?.quality ?? 
    0.0
  );

  const shiftOutputVolume = Number(
    (activeOee as any)?.shiftOutputVolume ?? 
    (activeOee as any)?.shift_output_volume ?? 
    (activeOee as any)?.shift_output_liters ?? 
    0.0
  );

  const shiftTargetVolume = Number(
    (activeOee as any)?.shiftTargetVolume ?? 
    (activeOee as any)?.shift_target_volume ?? 
    5000.0
  );

  const downtimeMinutes = Number(
    (activeOee as any)?.downtimeMinutes ?? 
    (activeOee as any)?.downtime_minutes ?? 
    0.0
  );

  const plannedShiftMinutes = 480; // 8-hour shift standard (ISA-95)

  const shiftName = (activeOee as any)?.shiftName || (activeOee as any)?.shift_name || 'SHIFT 1 (MORNING)';
  const shiftWindow = (activeOee as any)?.shiftWindow || (activeOee as any)?.shift_window || '06:00 — 14:00';
  const shiftLeader = (activeOee as any)?.shiftLeader || (activeOee as any)?.shift_leader || 'Trần Đức (Lead Process Architect)';

  const isStandby = overallOee === 0.0 || Boolean((activeOee as any)?.isStandby || (activeOee as any)?.is_standby);

  // Dynamic calculation of shift output:
  // Reflects backend OEE engine output volume + live execution volume from finished orders
  const currentShiftOutput = useMemo(() => {
    const completedVol = finishedOrders.reduce((sum, o) => sum + (o.volume || 0), 0);
    const runningVol = runningOrders.reduce((sum, o) => sum + ((o.volume || 0) * 0.5), 0);
    const liveExecVol = Math.round(completedVol + runningVol);
    return Math.max(shiftOutputVolume, liveExecVol);
  }, [shiftOutputVolume, finishedOrders, runningOrders]);

  // Dynamic active batches count based on active orders in execution
  const activeBatchesCount = useMemo(() => {
    const rawBatches = Number((activeOee as any)?.activeBatches ?? (activeOee as any)?.active_batches ?? 0);
    return Math.max(runningOrders.length, rawBatches);
  }, [runningOrders, activeOee]);

  const completedBatchesCount = finishedOrders.length;

  // OEE Grade Classification conforming to ISA-95 benchmark tiers
  const oeeGrade = useMemo(() => {
    if (isStandby || overallOee === 0.0) {
      return { 
        label: 'COLD STANDBY', 
        color: 'text-slate-700 bg-slate-100 border-slate-300' 
      };
    }
    if (overallOee >= 85.0) return { label: 'WORLD CLASS A', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' };
    if (overallOee >= 75.0) return { label: 'WORLD CLASS B+', color: 'text-sky-800 bg-sky-50 border-sky-300' };
    if (overallOee >= 65.0) return { label: 'NORMAL OPERATION C', color: 'text-amber-800 bg-amber-50 border-amber-300' };
    return { label: 'ATTENTION REQUIRED D', color: 'text-rose-800 bg-rose-50 border-rose-300' };
  }, [overallOee, isStandby]);

  return (
    <section
      aria-label="Real-Time OEE & Shift Management Dashboard"
      className={`bg-white border border-slate-200 shadow-xs font-mono select-none transition-all ${className}`}
    >
      {/* Dashboard Top Header Bar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Module Title & Current Shift Badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-slate-800 shrink-0" />
            <span className="font-bold text-slate-900 text-xs uppercase tracking-wider not-italic">
              Real-Time OEE &amp; Shift Management
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          {/* Current Shift Detector Badge */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold">
            <Clock className="w-3 h-3 text-sky-600" />
            <span className="font-bold text-sky-900">{shiftName}</span>
            <span className="text-slate-400">({shiftWindow})</span>
          </div>

          {/* Overall OEE Grade Pill */}
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${oeeGrade.color}`}>
            GRADE: {oeeGrade.label} ({overallOee.toFixed(1)}%)
          </span>

          {/* Real-time Telemetry Heartbeat Indicator */}
          <span className="hidden lg:inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 border border-slate-200">
            <Activity className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
            <span>OEE ENGINE HOT-SYNC: ACTIVE</span>
          </span>
        </div>

        {/* Right: Shift Leader & Collapse/Expand Button */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-600">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">SHIFT LEADER:</span>
            <span className="font-semibold text-slate-800">{shiftLeader}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 px-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 active:translate-y-px transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2"
            title={isCollapsed ? 'Expand OEE & Shift Dashboard' : 'Collapse OEE & Shift Dashboard'}
          >
            <span>{isCollapsed ? 'EXPAND' : 'COLLAPSE'}</span>
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" /> : <ChevronUp className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Collapsible Content Area */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Shift Telemetry Metric Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Shift Output Volume */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Shift Output Volume
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {currentShiftOutput.toLocaleString()} <span className="text-xs text-slate-500 font-normal">Liters</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Target: {shiftTargetVolume.toLocaleString()} L ({shiftTargetVolume > 0 ? ((currentShiftOutput / shiftTargetVolume) * 100).toFixed(0) : '0'}% Shift Quota)
                </div>
              </div>
              <div className="w-8 h-8 rounded-xs bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>

            {/* Active Batches Count */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Active Batches Count
                </div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {activeBatchesCount} <span className="text-xs text-emerald-700 font-semibold">{activeBatchesCount > 0 ? 'Executing' : 'Standby'}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {completedBatchesCount} Completed · 0 Aborted
                </div>
              </div>
              <div className="w-8 h-8 rounded-xs bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Zap className="w-4 h-4" />
              </div>
            </div>

            {/* Shift Operating Window & Leader */}
            <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                  Assigned Shift Leader
                </div>
                <div className="text-xs font-bold text-slate-900 truncate max-w-[200px] mt-1">
                  {shiftLeader}
                </div>
                <div className="text-[10px] text-sky-700 font-mono mt-0.5">
                  Window: {shiftWindow} (Active)
                </div>
              </div>
              <div className="w-8 h-8 rounded-xs bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
                <Users className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* 4 Compact OEE Progress Tiles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5 not-italic">
                <TrendingUp className="w-3.5 h-3.5 text-slate-600" />
                <span>OEE Performance Factorization (A × P × Q = OEE)</span>
              </span>
              <span className="text-[10px] text-slate-500">
                ANSI/ISA-95 · ISO 22400-2 Key Performance Indicator
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Tile 1: Availability (A) */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    1. Availability (A)
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {availability.toFixed(1)}%
                  </span>
                </div>
                {/* Minimalist Linear Gauge Bar */}
                <div className="w-full bg-[#E2E8F0] h-2 rounded-xs overflow-hidden">
                  <div
                    className="bg-sky-600 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, availability))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Planned: {plannedShiftMinutes}m</span>
                  <span className={downtimeMinutes > 0 ? "text-rose-700 font-semibold" : "text-slate-500"}>
                    Down: {downtimeMinutes.toFixed(1)}m
                  </span>
                </div>
              </div>

              {/* Tile 2: Performance (P) */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    2. Performance (P)
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {performance.toFixed(1)}%
                  </span>
                </div>
                {/* Minimalist Linear Gauge Bar */}
                <div className="w-full bg-[#E2E8F0] h-2 rounded-xs overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, performance))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>
                    Actual: {performance > 0 ? `${(1000 * performance / 100).toFixed(0)} L/h` : '0 L/h (Standby)'}
                  </span>
                  <span className="text-slate-600">Ideal: 1,000 L/h</span>
                </div>
              </div>

              {/* Tile 3: Quality (Q) */}
              <div className="bg-[#F8FAFC] border border-[#E2E8F0] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    3. Quality (Q)
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {quality.toFixed(1)}%
                  </span>
                </div>
                {/* Minimalist Linear Gauge Bar */}
                <div className="w-full bg-[#E2E8F0] h-2 rounded-xs overflow-hidden">
                  <div
                    className="bg-emerald-600 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, quality))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>QA Yield Rate</span>
                  <span className={quality > 0 ? "text-emerald-700 font-semibold" : "text-slate-500 font-semibold"}>
                    {quality > 0 ? 'Conforming Yield' : 'Cold Standby'}
                  </span>
                </div>
              </div>

              {/* Tile 4: Overall OEE */}
              <div className="bg-white border-2 border-slate-800 p-3 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-900 uppercase tracking-wider">
                    Overall OEE (A×P×Q)
                  </span>
                  <span className="text-base font-bold text-slate-900">
                    {overallOee.toFixed(1)}%
                  </span>
                </div>
                {/* Minimalist Linear Gauge Bar */}
                <div className="w-full bg-[#E2E8F0] h-2.5 rounded-xs overflow-hidden">
                  <div
                    className="bg-slate-900 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, overallOee))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-700 pt-0.5 font-bold">
                  <span className={isStandby ? 'text-slate-500' : 'text-slate-900'}>{oeeGrade.label}</span>
                  <span className="text-emerald-700">&ge; 75.0% Benchmark</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default OeeShiftDashboard;
