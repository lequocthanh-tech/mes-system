/* Hallmark · component: OeeShiftDashboard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useOperations } from '../context/OperationsContext';
import { useQuality } from '../context/QualityContext';
import { 
  Gauge, 
  Clock, 
  Users, 
  PackageCheck, 
  ChevronUp, 
  ChevronDown, 
  TrendingUp, 
  Zap 
} from 'lucide-react';

interface OeeShiftDashboardProps {
  className?: string;
  defaultCollapsed?: boolean;
}

export const OeeShiftDashboard: React.FC<OeeShiftDashboardProps> = ({ 
  className = '', 
  defaultCollapsed = false 
}) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(defaultCollapsed);
  const { currentBatchState, runningOrders, finishedOrders } = useOperations();
  const { batchRecords } = useQuality();

  // Dynamic Downtime Accumulation (when active batch is HELD or system in downtime)
  const [downtimeMinutes, setDowntimeMinutes] = useState<number>(27.8);
  const plannedShiftMinutes = 480; // 8-hour shift standard (ISA-95)

  useEffect(() => {
    if (currentBatchState === 'HELD') {
      const interval = setInterval(() => {
        setDowntimeMinutes((prev) => Number((prev + 0.1).toFixed(1)));
      }, 6000); // add 0.1 min every 6 seconds of hold
      return () => clearInterval(interval);
    }
  }, [currentBatchState]);

  // Current Shift Detection based on ISA-95 shift boundaries
  const currentShift = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) {
      return {
        id: 'SHIFT_1',
        title: 'SHIFT 1 (MORNING)',
        window: '06:00 — 14:00',
        leader: 'Trần Đức (Lead Process Architect)',
        plannedVol: 5000,
      };
    } else if (hour >= 14 && hour < 22) {
      return {
        id: 'SHIFT_2',
        title: 'SHIFT 2 (AFTERNOON)',
        window: '14:00 — 22:00',
        leader: 'Nguyễn Văn Supervisor (QA Lead)',
        plannedVol: 5000,
      };
    } else {
      return {
        id: 'SHIFT_3',
        title: 'SHIFT 3 (NIGHT)',
        window: '22:00 — 06:00',
        leader: 'Lê Văn Night Lead (Senior Automation Eng)',
        plannedVol: 4000,
      };
    }
  }, []);

  // 1. Availability (A) Calculation: (PlannedTime - Downtime) / PlannedTime * 100
  const availability = useMemo(() => {
    const avail = ((plannedShiftMinutes - downtimeMinutes) / plannedShiftMinutes) * 100;
    return Math.min(100, Math.max(0, Number(avail.toFixed(1))));
  }, [downtimeMinutes, plannedShiftMinutes]);

  // 2. Performance (P) Calculation: (ActualBatchRate / IdealBatchRate) * 100
  // Ideal Rate = 1000 L/h, simulated active rate = 965.0 L/h (96.5%)
  const idealBatchRate = 1000;
  const actualBatchRate = 965.0;
  const performance = useMemo(() => {
    const perf = (actualBatchRate / idealBatchRate) * 100;
    return Math.min(100, Math.max(0, Number(perf.toFixed(1))));
  }, [actualBatchRate, idealBatchRate]);

  // 3. Quality (Q) Calculation: First-Pass Yield from Quality module (88.9%)
  const quality = useMemo(() => {
    if (batchRecords && batchRecords.length > 0) {
      const passed = batchRecords.filter((b) => b.status === 'PASS').length;
      return Number(((passed / batchRecords.length) * 100).toFixed(1));
    }
    return 88.9;
  }, [batchRecords]);

  // 4. Overall OEE Calculation: A * P * Q
  const overallOee = useMemo(() => {
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100;
    return Number(oee.toFixed(1));
  }, [availability, performance, quality]);

  // OEE Grade Classification
  const oeeGrade = useMemo(() => {
    if (overallOee >= 85.0) return { label: 'WORLD CLASS A', color: 'text-emerald-700 bg-emerald-50 border-emerald-300' };
    if (overallOee >= 75.0) return { label: 'WORLD CLASS B+', color: 'text-sky-800 bg-sky-50 border-sky-300' };
    if (overallOee >= 65.0) return { label: 'NORMAL OPERATION C', color: 'text-amber-800 bg-amber-50 border-amber-300' };
    return { label: 'ATTENTION REQUIRED D', color: 'text-rose-800 bg-rose-50 border-rose-300' };
  }, [overallOee]);

  // Current Shift Output Volume (L)
  const currentShiftOutput = useMemo(() => {
    const completedVol = finishedOrders.reduce((sum, o) => sum + (o.volume || 0), 0);
    const runningVol = runningOrders.reduce((sum, o) => sum + ((o.volume || 0) * 0.5), 0);
    // Baseline shift output: 4,500 L
    return Math.max(4500, Math.round(completedVol + runningVol));
  }, [finishedOrders, runningOrders]);

  const activeBatchesCount = runningOrders.length;
  const completedBatchesCount = finishedOrders.length;

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
            <span className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              Real-Time OEE &amp; Shift Management
            </span>
          </div>

          <span className="text-slate-300 hidden sm:inline">|</span>

          {/* Current Shift Detector Badge */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-300 text-slate-800 text-[11px] font-semibold">
            <Clock className="w-3 h-3 text-sky-600" />
            <span className="font-bold text-sky-900">{currentShift.title}</span>
            <span className="text-slate-400">({currentShift.window})</span>
          </div>

          {/* Overall OEE Grade Pill */}
          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${oeeGrade.color}`}>
            GRADE: {oeeGrade.label} ({overallOee}%)
          </span>
        </div>

        {/* Right: Shift Leader & Collapse/Expand Button */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-600">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">SHIFT LEADER:</span>
            <span className="font-semibold text-slate-800">{currentShift.leader}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-7 px-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center gap-1 active:translate-y-px transition-none"
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
                  Target: {currentShift.plannedVol.toLocaleString()} L ({((currentShiftOutput / currentShift.plannedVol) * 100).toFixed(0)}% Shift Quota)
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
                  {activeBatchesCount} <span className="text-xs text-emerald-700 font-semibold">Executing</span>
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
                  {currentShift.leader}
                </div>
                <div className="text-[10px] text-sky-700 font-mono mt-0.5">
                  Window: {currentShift.window} (Active)
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
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
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
                    style={{ width: `${availability}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Planned: {plannedShiftMinutes}m</span>
                  <span className="text-rose-700 font-semibold">Down: {downtimeMinutes.toFixed(1)}m</span>
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
                    style={{ width: `${performance}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Actual: {actualBatchRate.toFixed(0)} L/h</span>
                  <span className="text-slate-600">Ideal: {idealBatchRate} L/h</span>
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
                    style={{ width: `${quality}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                  <span>Module Quality Yield</span>
                  <span className="text-emerald-700 font-semibold">First-Pass QA</span>
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
                    style={{ width: `${overallOee}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-700 pt-0.5 font-bold">
                  <span>{oeeGrade.label}</span>
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
