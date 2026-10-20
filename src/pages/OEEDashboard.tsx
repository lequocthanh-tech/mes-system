/* Hallmark · component: OEEDashboard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Gauge,
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Sliders,
  Cpu,
  Flame,
  Snowflake,
  RotateCw,
  Info,
  ShieldCheck,
  ChevronRight,
  BarChart3,
  Layers,
  Settings
} from 'lucide-react';
import {
  getOeeSummary,
  getEquipmentOee,
  getOeeLosses,
  getOeeTagMappings,
  getModuleTagMappings,
  OeeSummaryData,
  EquipmentOeeItem,
  OeeLossesData
} from '../services/api';
import { OeeTagMappingModal } from '../components/oee/OeeTagMappingModal';

export const OEEDashboard: React.FC = () => {
  const [shiftHours, setShiftHours] = useState<number>(8);
  const [summary, setSummary] = useState<OeeSummaryData | null>(null);
  const [equipmentList, setEquipmentList] = useState<EquipmentOeeItem[]>([]);
  const [lossesData, setLossesData] = useState<OeeLossesData | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  // Modular Kepware OPC UA Tag Mapping State
  const [isTagModalOpen, setIsTagModalOpen] = useState<boolean>(false);
  const [oeeTags, setOeeTags] = useState<Record<string, any>>({});

  const fetchOeeTags = useCallback(async () => {
    try {
      const [resOee, resModule] = await Promise.all([
        getOeeTagMappings().catch(() => null),
        getModuleTagMappings('oee').catch(() => null),
      ]);

      const merged: Record<string, any> = {};
      if (resOee && resOee.mappings) {
        Object.entries(resOee.mappings).forEach(([k, v]) => {
          const lk = k.toLowerCase();
          merged[lk] = typeof v === 'string' ? { node_id: v } : v;
        });
      }
      if (resModule && resModule.tags) {
        Object.entries(resModule.tags).forEach(([k, v]) => {
          const lk = k.toLowerCase();
          merged[lk] = {
            ...merged[lk],
            ...v,
            node_id: (v as any).node_id || merged[lk]?.node_id || '',
            value: (v as any).value !== undefined ? (v as any).value : merged[lk]?.value,
          };
        });
      }
      setOeeTags(merged);
    } catch {
      // ignore
    }
  }, []);

  const loadData = useCallback(async (isManualRefresh: boolean = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const [sumRes, eqRes, lossRes] = await Promise.all([
        getOeeSummary(shiftHours),
        getEquipmentOee(shiftHours),
        getOeeLosses(shiftHours)
      ]);

      if (sumRes) {
        setSummary((sumRes as any).data || sumRes);
      }
      if (eqRes) {
        setEquipmentList(Array.isArray(eqRes) ? eqRes : ((eqRes as any).data || []));
      }
      if (lossRes) {
        setLossesData((lossRes as any).data || lossRes);
      }
      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Failed to load OEE data:', err);
      setError(err?.message || 'Error communicating with SQL Server OEE engine.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shiftHours]);

  useEffect(() => {
    loadData();
    fetchOeeTags();
    // Auto-refresh for real-time telemetry polling
    const timer = setInterval(() => {
      loadData(true);
      fetchOeeTags();
    }, 4000);
    return () => clearInterval(timer);
  }, [loadData, fetchOeeTags]);

  // Export current OEE dataset to CSV
  const handleExportCsv = () => {
    if (!summary || !equipmentList.length) return;
    try {
      const rows = [
        ['ISA-95 Real-Time OEE Report', `Generated: ${new Date().toISOString()}`],
        ['Shift Window', summary.shift_name || 'SHIFT 2 (AFTERNOON)', summary.shift_window || '14:00 - 22:00'],
        ['Shift Leader', summary.shift_leader || 'Supervisor on Duty'],
        ['Overall OEE (%)', (summary.oee ?? summary.line_oee ?? 0).toFixed(2)],
        ['Availability (%)', summary.availability.toFixed(2)],
        ['Performance (%)', summary.performance.toFixed(2)],
        ['Quality (%)', summary.quality.toFixed(2)],
        ['Operating Minutes', (summary.operating_time_minutes ?? 0).toFixed(1)],
        ['Downtime Minutes', (summary.downtime_minutes ?? 0).toFixed(1)],
        ['Shift Output (L)', (summary.shift_output_liters ?? summary.shift_output_volume ?? 0).toFixed(1)],
        [],
        ['Equipment Code', 'Name', 'Status', 'OEE (%)', 'Availability (%)', 'Performance (%)', 'Quality (%)', 'Nominal Setpoint', 'Actual Value', 'Unit', 'Loss Category'],
        ...equipmentList.map(eq => [
          eq.equipment_code || eq.equipment_id,
          `"${eq.equipment_name}"`,
          eq.current_status || eq.status,
          eq.oee.toFixed(2),
          eq.availability.toFixed(2),
          eq.performance.toFixed(2),
          eq.quality.toFixed(2),
          eq.nominal_setpoint,
          eq.actual_value,
          eq.unit,
          `"${eq.loss_label}"`
        ])
      ];

      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `MES_OEE_Report_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (e) {
      console.error('Export failed', e);
    }
  };

  const getTagMeta = useCallback((tagKey: string) => {
    const lk = tagKey.toLowerCase();
    const tag = oeeTags[lk] || oeeTags[tagKey.toUpperCase()] || oeeTags[tagKey];
    const nodeId = typeof tag === 'string' ? tag : (tag?.node_id || '');
    const value = tag?.value;
    return {
      nodeId: nodeId && nodeId !== '[CHƯA ÁNH XẠ]' ? nodeId : '',
      value,
      isMapped: Boolean(nodeId && nodeId !== '[CHƯA ÁNH XẠ]' && nodeId.trim() !== '')
    };
  }, [oeeTags]);

  const assetTagConfig: Record<string, { pv: string; state: string; nominal: number; unit: string }> = {
    PUMP_INLET_MILK: { pv: 'pump_milk_flow_pv', state: 'pump_milk_state', nominal: 100.0, unit: 'L/min' },
    PUMP_INLET_SUGAR: { pv: 'pump_sugar_flow_pv', state: 'pump_sugar_state', nominal: 50.0, unit: 'L/min' },
    PUMP_INLET_ADDITIVE: { pv: 'pump_additive_flow_pv', state: 'pump_additive_state', nominal: 20.0, unit: 'L/min' },
    AGITATOR_MIX: { pv: 'agitator_speed_pv', state: 'agitator_state', nominal: 120.0, unit: 'RPM' },
    HEATER_UHT: { pv: 'heater_uht_temp_pv', state: 'heater_uht_state', nominal: 138.0, unit: '°C' },
    CHILLER_COOL: { pv: 'chiller_cool_temp_pv', state: 'chiller_cool_state', nominal: 4.0, unit: '°C' },
    PUMP_OUTLET: { pv: 'pump_outlet_flow_pv', state: 'pump_outlet_state', nominal: 100.0, unit: 'L/min' },
    PUMP_INLET: { pv: 'pump_milk_flow_pv', state: 'pump_milk_state', nominal: 100.0, unit: 'L/min' },
  };

  const getEquipmentIcon = (code: string) => {
    switch (code) {
      case 'PUMP_INLET_MILK':
      case 'PUMP_INLET_SUGAR':
      case 'PUMP_INLET_ADDITIVE':
      case 'PUMP_INLET':
      case 'PUMP_OUTLET':
        return <RotateCw className="w-4 h-4 text-sky-600" />;
      case 'AGITATOR_MIX':
        return <Sliders className="w-4 h-4 text-indigo-600" />;
      case 'HEATER_UHT':
        return <Flame className="w-4 h-4 text-amber-600" />;
      case 'CHILLER_COOL':
        return <Snowflake className="w-4 h-4 text-cyan-600" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'RUNNING' || s === 'RUN') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          RUNNING
        </span>
      );
    }
    if (s === 'FAULT' || s === 'ALARM' || s === 'DOWN' || s === 'ERROR') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
          FAULT
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-300">
        <span className="w-2 h-2 rounded-full bg-slate-400"></span>
        STOPPED
      </span>
    );
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* =========================================================================
          1. HEADER & SHIFT CONTROL TOOLBAR (ISA-101 WORKBENCH)
         ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider">
            <span>ISA-95 Level 3 MOM</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span>Asset Performance Management</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-800 font-bold">Real-Time OEE Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1 uppercase" style={{ fontStyle: 'normal' }}>
            Overall Equipment Effectiveness (OEE)
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Real-time Availability, Performance, and Quality tracking connected directly to SQL Server Historian & PLC Telemetry.
          </p>
        </div>

        {/* Action Controls Toolbar - 8-State Compliant */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Shift Filter Dropdown / Tabs */}
          <div className="inline-flex items-center bg-slate-100 p-0.5 rounded border border-slate-300">
            <button
              type="button"
              onClick={() => setShiftHours(8)}
              className={`h-9 px-3 text-xs font-mono font-medium rounded transition-all focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] ${
                shiftHours === 8
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Current Shift (8h)
            </button>
            <button
              type="button"
              onClick={() => setShiftHours(24)}
              className={`h-9 px-3 text-xs font-mono font-medium rounded transition-all focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] ${
                shiftHours === 24
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              Past 24h
            </button>
          </div>

          {/* Manual Refresh Button - 8 States */}
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            data-state={refreshing ? 'loading' : 'default'}
            className="h-9 px-3.5 inline-flex items-center gap-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title="Refresh OEE metrics from SQL Server"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-600' : 'text-slate-500'}`} />
            <span>{refreshing ? 'Polling...' : 'Refresh'}</span>
          </button>

          {/* Export CSV Button - 8 States */}
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !summary}
            data-state={exportSuccess ? 'success' : 'default'}
            className={`h-9 px-3.5 inline-flex items-center gap-2 text-xs font-medium rounded shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed ${
              exportSuccess
                ? 'bg-emerald-600 text-white border border-emerald-600'
                : 'bg-slate-800 text-white border border-slate-800 hover:bg-slate-700'
            }`}
          >
            {exportSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                <span>Exported</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-slate-200" />
                <span>Export Report</span>
              </>
            )}
          </button>

          {/* Machine & Counter Tag Mapping Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsTagModalOpen(true)}
            className="h-9 px-3.5 inline-flex items-center gap-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] transition-all"
            title="Cấu hình ánh xạ Kepware OPC UA 17 Tags (3 bộ đếm + 7 thiết bị công nghệ)"
          >
            <Settings className="w-3.5 h-3.5 text-slate-600" />
            <span>⚙ CẤU HÌNH TAG OEE &amp; 7 THIẾT BỊ</span>
          </button>
        </div>
      </div>

      {/* Live OEE Telemetry & Counter Acquisition Strip (Kepware OPC UA) */}
      {(() => {
        const totalCount = getTagMeta('total_count_pv');
        const rejectCount = getTagMeta('reject_count_pv');
        const lineState = getTagMeta('line_state_code');

        return (
          <div className="p-4 bg-white border border-slate-200 rounded shadow-xs font-mono text-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-sky-600" />
                <span className="font-bold uppercase tracking-wider text-slate-900">
                  Live Counter &amp; PLC Telemetry Link:
                </span>
              </div>

              {/* TOTAL_COUNT_PV */}
              <div
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded flex items-center gap-2"
                title={`Node ID: ${totalCount.isMapped ? totalCount.nodeId : '[CHƯA ÁNH XẠ]'}`}
              >
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Tổng sản phẩm (Total Count):</span>
                {totalCount.isMapped ? (
                  <>
                    <span className="font-bold text-slate-900 text-sm">
                      {totalCount.value !== undefined && totalCount.value !== null
                        ? Number(totalCount.value).toLocaleString()
                        : '0'}
                    </span>
                    <span className="text-[10px] text-slate-400">units</span>
                  </>
                ) : (
                  <span className="font-bold text-slate-400 text-xs">[CHƯA ÁNH XẠ] (--)</span>
                )}
              </div>

              {/* REJECT_COUNT_PV */}
              <div
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded flex items-center gap-2"
                title={`Node ID: ${rejectCount.isMapped ? rejectCount.nodeId : '[CHƯA ÁNH XẠ]'}`}
              >
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Phế phẩm (Reject Count):</span>
                {rejectCount.isMapped ? (
                  <>
                    <span className={`font-bold text-sm ${(rejectCount.value ?? 0) > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {rejectCount.value !== undefined && rejectCount.value !== null
                        ? Number(rejectCount.value).toLocaleString()
                        : '0'}
                    </span>
                    <span className="text-[10px] text-slate-400">units</span>
                  </>
                ) : (
                  <span className="font-bold text-slate-400 text-xs">[CHƯA ÁNH XẠ] (--)</span>
                )}
              </div>

              {/* LINE_STATE_CODE */}
              <div
                className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded flex items-center gap-2"
                title={`Node ID: ${lineState.isMapped ? lineState.nodeId : '[CHƯA ÁNH XẠ]'}`}
              >
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Mã trạng thái máy (PackML):</span>
                {lineState.isMapped ? (
                  <span
                    className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                      lineState.value === 2 || lineState.value === 'RUNNING'
                        ? 'bg-emerald-100 text-emerald-800'
                        : lineState.value === 4 || lineState.value === 'FAULT'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-slate-200 text-slate-800'
                    }`}
                  >
                    {lineState.value !== undefined && lineState.value !== null
                      ? `CODE ${lineState.value} (${lineState.value === 2 ? 'RUNNING' : lineState.value === 1 ? 'IDLE' : lineState.value === 3 ? 'COMPLETE' : 'STOP'})`
                      : 'STANDBY (0)'}
                  </span>
                ) : (
                  <span className="font-bold text-slate-400 text-xs px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                    [CHƯA ÁNH XẠ] (--)
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsTagModalOpen(true)}
              className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1.5 rounded hallmark-focus active:translate-y-px"
              title="Cấu hình địa chỉ Kepware Node ID"
            >
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              <span>Cấu hình Tag OEE</span>
            </button>
          </div>
        );
      })()}

      {/* =========================================================================
          2. ACTIVE SHIFT METADATA & TELEMETRY SYNC STRIP
         ========================================================================= */}
      {summary && (
        <div className="bg-white border border-slate-200 rounded p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-slate-900 uppercase tracking-wide">
                {summary.shift_name} ({summary.shift_window})
              </div>
              <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                Shift Supervisor: <span className="text-slate-700 font-medium">{summary.shift_leader}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 font-mono text-[11px]">
            <div>
              <div className="text-slate-400 uppercase">Shift Progress</div>
              <div className="text-slate-800 font-medium">
                {(summary.elapsed_shift_minutes ?? 0).toFixed(0)} / {(summary.planned_shift_minutes ?? 480).toFixed(0)} min (
                {(((summary.elapsed_shift_minutes ?? 0) / (summary.planned_shift_minutes || 480)) * 100).toFixed(0)}%)
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <div className="text-slate-400 uppercase">Shift Output</div>
              <div className="text-slate-800 font-medium">
                {(summary.shift_output_liters ?? summary.shift_output_volume ?? 0) > 0 ? `${(summary.shift_output_liters ?? summary.shift_output_volume ?? 0).toLocaleString()} L` : '0.0 L (Standby)'}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <div className="text-slate-400 uppercase">Historian Timestamp</div>
              <div className="text-slate-600">
                {new Date(summary.calculated_at || Date.now()).toLocaleTimeString()}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-200"></div>
            <div>
              <div className="text-slate-400 uppercase">UI Polled At</div>
              <div className="text-slate-600">
                {lastRefreshed.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Standby Status Engineering Notice */}
      {summary && summary.is_standby && (
        <div className="bg-slate-100 border border-slate-300 rounded p-3.5 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-600 mt-0.5 shrink-0" />
          <div className="text-xs text-slate-700 space-y-0.5">
            <span className="font-semibold text-slate-900 uppercase tracking-wide">Plant Operating State: Cold Standby (0.0% Telemetry)</span>
            <p>
              Physical production lines and S7-1500 PLC batch sequences are currently idle. No active production batch is running.
              OEE availability, performance, and quality counters show baseline engineering values. Upon operator dispatch of a batch work order, live historian calculations will engage automatically.
            </p>
          </div>
        </div>
      )}

      {/* Error state indicator */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded p-4 text-xs text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Error retrieving live OEE metrics: {error}</span>
        </div>
      )}

      {/* =========================================================================
          3. EXECUTIVE METRIC ROW (OEE, AVAILABILITY, PERFORMANCE, QUALITY)
         ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: OVERALL OEE */}
        <div className="bg-white border border-slate-200 rounded p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Overall OEE
              </span>
              <Gauge className="w-4 h-4 text-slate-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900">
                {summary ? `${(summary.oee ?? summary.line_oee ?? 0).toFixed(1)}%` : '--%'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                / 85.0% Target
              </span>
            </div>

            {/* Benchmark Classification Badge */}
            <div className="mt-3">
              {summary?.benchmark === 'WORLD_CLASS' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  WORLD CLASS (≥85%)
                </span>
              ) : summary?.benchmark === 'EXCELLENT' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-cyan-50 text-cyan-700 border border-cyan-300">
                  EXCELLENT (75 - 84%)
                </span>
              ) : summary?.benchmark === 'GOOD' ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-300">
                  GOOD (65 - 74%)
                </span>
              ) : summary?.is_standby ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-600 border border-slate-300">
                  COLD STANDBY (0.0%)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-50 text-amber-700 border border-amber-300">
                  ATTENTION NEEDED (&lt;65%)
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Formula: A × P × Q</span>
            <span className="text-slate-700 font-semibold">
              {summary ? `${summary.availability.toFixed(0)}% × ${summary.performance.toFixed(0)}% × ${summary.quality.toFixed(0)}%` : '--'}
            </span>
          </div>
        </div>

        {/* Card 2: AVAILABILITY (A) */}
        <div className="bg-white border border-slate-200 rounded p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Availability (A)
              </span>
              <Activity className="w-4 h-4 text-emerald-600" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900">
                {summary ? `${summary.availability.toFixed(1)}%` : '--%'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                / 90.0% Target
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, summary?.availability || 0))}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Operating Time</span>
            <span className="text-slate-800 font-medium">
              {summary ? `${(summary.operating_time_minutes ?? 0).toFixed(1)}m / ${(summary.downtime_minutes ?? 0).toFixed(1)}m Down` : '--'}
            </span>
          </div>
        </div>

        {/* Card 3: PERFORMANCE (P) */}
        <div className="bg-white border border-slate-200 rounded p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Performance (P)
              </span>
              <TrendingUp className="w-4 h-4 text-sky-600" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900">
                {summary ? `${summary.performance.toFixed(1)}%` : '--%'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                / 95.0% Target
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-sky-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, summary?.performance || 0))}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>Speed Efficiency</span>
            <span className="text-slate-800 font-medium">
              {summary && summary.performance > 0 ? `${summary.performance.toFixed(1)}% Design Nominal` : '0.0% (Cold Standby)'}
            </span>
          </div>
        </div>

        {/* Card 4: QUALITY RATE (Q) */}
        <div className="bg-white border border-slate-200 rounded p-5 relative overflow-hidden shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                Quality Rate (Q)
              </span>
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900">
                {summary ? `${summary.quality.toFixed(1)}%` : '--%'}
              </span>
              <span className="text-xs font-mono text-slate-500">
                / 99.9% Target
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, summary?.quality || 0))}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] font-mono text-slate-500 flex items-center justify-between">
            <span>First-Pass Batches</span>
            <span className="text-slate-800 font-medium">
              {summary ? `${summary.passed_batches} Passed / ${summary.total_inspected_batches} Tested` : '--'}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          4. EQUIPMENT OEE BREAKDOWN CARDS (ISA-88 PROCESS CELL ASSETS)
         ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900" style={{ fontStyle: 'normal' }}>
              Equipment OEE Breakdown (Critical Process Cell Assets)
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {equipmentList.length} Connected ISA-88 Units
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3.5">
          {equipmentList.map(eq => {
            const assetCode = eq.equipment_code || eq.equipment_id;
            const assetCfg = assetTagConfig[assetCode];
            const pvMeta = assetCfg ? getTagMeta(assetCfg.pv) : { isMapped: false, nodeId: '', value: undefined };
            const stateMeta = assetCfg ? getTagMeta(assetCfg.state) : { isMapped: false, nodeId: '', value: undefined };

            return (
              <div
                key={eq.equipment_id}
                className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-3 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                {/* Header: Name and Status */}
                <div>
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                        {getEquipmentIcon(assetCode)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-slate-900 truncate" title={assetCode}>
                          {assetCode}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={eq.equipment_name}>
                          {eq.equipment_name}
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(eq.current_status || eq.status)}
                  </div>

                  {/* Tag Mapping status pill */}
                  <div className="mt-2 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Node ID:</span>
                    {pvMeta.isMapped ? (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-medium truncate max-w-[120px]" title={`PV: ${pvMeta.nodeId}${stateMeta.isMapped ? ` | Run: ${stateMeta.nodeId}` : ''}`}>
                        {pvMeta.nodeId.replace('ns=2;s=', '')}
                      </span>
                    ) : (
                      <span className="text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 font-medium">
                        [CHƯA ÁNH XẠ]
                      </span>
                    )}
                  </div>

                  {/* Metric Display */}
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Unit OEE</span>
                      <div className="text-lg font-mono font-bold text-slate-900">
                        {eq.oee.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-slate-400 uppercase">Telemetry</span>
                      <div className="font-mono text-xs text-slate-800 font-semibold mt-0.5 truncate">
                        {pvMeta.isMapped
                          ? `${(pvMeta.value !== undefined ? Number(pvMeta.value) : eq.actual_value ?? 0).toFixed(1)} / ${eq.nominal_setpoint ?? assetCfg?.nominal ?? 100} ${eq.unit || assetCfg?.unit || ''}`
                          : `-- / ${assetCfg?.nominal ?? eq.nominal_setpoint ?? 100} ${assetCfg?.unit || eq.unit || ''}`}
                      </div>
                    </div>
                  </div>

                  {/* Submetrics breakdown: A, P, Q */}
                  <div className="mt-2.5 bg-slate-50 rounded p-1.5 text-[10px] font-mono grid grid-cols-3 gap-1 text-center border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[9px]">Avail (A)</span>
                      <span className="font-semibold text-slate-700">{eq.availability.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">Perf (P)</span>
                      <span className="font-semibold text-slate-700">{eq.performance.toFixed(0)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">Qual (Q)</span>
                      <span className="font-semibold text-slate-700">{eq.quality.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Six Big Losses classification footer */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">TPM Loss:</span>
                    <span className="font-medium text-slate-600 truncate max-w-[130px]" title={eq.loss_label || eq.loss_reason}>
                      {eq.loss_label || eq.loss_reason || 'Cold Standby'}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Runtime: {(eq.operating_minutes ?? (eq.runtime_hours ? eq.runtime_hours * 60 : 0)).toFixed(0)}m</span>
                    <span>Health: {(eq.health_percent ?? 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          5. HOURLY SHIFT TRENDLINE & SIX BIG LOSSES PARETO ANALYSIS
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Hourly Trend Chart (ISA-101 Clean Line/Bar Representation) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900" style={{ fontStyle: 'normal' }}>
                Shift Hourly OEE Profile (Target 85% vs Actual)
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-slate-300 rounded-sm"></span>
                <span className="text-slate-600">Actual OEE</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-emerald-600"></span>
                <span className="text-emerald-700 font-semibold">Target (85.0%)</span>
              </div>
            </div>
          </div>

          {/* Interactive Chart Container */}
          <div className="pt-4">
            <div className="h-48 flex items-end justify-between gap-2 border-b border-l border-slate-200 px-2 pb-2">
              {lossesData?.hourly_trend && lossesData.hourly_trend.length > 0 ? (
                lossesData.hourly_trend.map((point, idx) => {
                  const barHeight = Math.min(100, Math.max(4, point.actual_oee));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[10px] font-mono px-2 py-1 rounded shadow-md pointer-events-none whitespace-nowrap z-10">
                        {point.hour}: {point.actual_oee.toFixed(1)}% (Target: {point.target_oee}%)
                      </div>

                      {/* Bar Representation */}
                      <div className="w-full max-w-[32px] bg-slate-100 rounded-t h-36 flex items-end">
                        <div
                          className={`w-full rounded-t transition-all duration-300 ${
                            point.actual_oee >= 85
                              ? 'bg-emerald-600'
                              : point.actual_oee > 0
                              ? 'bg-sky-500'
                              : 'bg-slate-300'
                          }`}
                          style={{ height: `${barHeight}%` }}
                        ></div>
                      </div>

                      {/* X-axis Hour Label */}
                      <span className="text-[10px] font-mono text-slate-500">
                        {point.hour}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-slate-400">
                  No hourly datalog records in selected shift window.
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-slate-500">
              <span>Shift Start (0.0h)</span>
              <span>Nominal Capacity: 1,000 L / Batch</span>
              <span>Shift Handover (+8.0h)</span>
            </div>
          </div>
        </div>

        {/* Right: Pareto Decomposition & Six Big Losses */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-slate-700" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900" style={{ fontStyle: 'normal' }}>
                Loss Decomposition (TPM Six Big Losses)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Pareto Impact</span>
          </div>

          {/* Three Macro Losses */}
          <div className="space-y-3 pt-1">
            {lossesData?.losses?.map((loss, idx) => (
              <div key={idx} className="border border-slate-200 rounded p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{loss.category}</span>
                  <span className="font-mono font-bold text-slate-700">{loss.loss_percent.toFixed(1)}%</span>
                </div>
                <div className="text-[11px] text-slate-500">{loss.description}</div>
                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-1 rounded-full ${
                      loss.category === 'Unplanned Downtime'
                        ? 'bg-rose-500'
                        : loss.category === 'Speed Loss'
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, loss.loss_percent))}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* Six Big Losses Table */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block mb-2 font-semibold">
              Root-Cause Classification Table
            </span>
            <div className="space-y-1.5">
              {lossesData?.six_big_losses?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[11px] font-mono py-1 px-1.5 rounded hover:bg-slate-50">
                  <div className="flex items-center gap-2 truncate max-w-[220px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    <span className="text-slate-700 truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-[10px]">{item.type}</span>
                    <span className="font-medium text-slate-900 w-10 text-right">{item.value_pct.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated OEE Tag Mapping Modal for 7 Core Assets & Line Counters */}
      <OeeTagMappingModal
        isOpen={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        onSaved={() => {
          fetchOeeTags();
          loadData(true);
        }}
      />
    </div>
  );
};
