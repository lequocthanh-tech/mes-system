/* Hallmark · component: ProcessTelemetry · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useOperations } from '../../context/OperationsContext';
import { ProcessTrendCard } from '../../types/operations';
import { getHistorianDatalog, getSetpointMonitoring } from '../../services/api';
import { 
  LineChart, 
  Activity, 
  Zap, 
  Database, 
  RefreshCw, 
  Download, 
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';


interface SparklineProps {
  card: ProcessTrendCard;
}

const TrendChart: React.FC<SparklineProps> = ({ card }) => {
  const width = 280;
  const height = 90;
  const padding = 10;

  const points = card.dataPoints;
  if (points.length < 2) return null;

  const minVal = card.min;
  const maxVal = card.max;
  const range = maxVal - minVal || 1;

  const getY = (val: number) => {
    const clampedVal = Math.max(minVal, Math.min(maxVal, val));
    const norm = (clampedVal - minVal) / range;
    return height - padding - norm * (height - 2 * padding);
  };

  const getX = (index: number) => {
    return padding + (index / (points.length - 1)) * (width - 2 * padding);
  };

  const spPath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.sp).toFixed(1)}`)
    .join(' ');

  const pvPath = points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(pt.pv).toFixed(1)}`)
    .join(' ');

  const errorOffset = Math.abs(card.currentPv - card.currentSp);
  const isOffsetHigh = errorOffset > (card.max - card.min) * 0.05;

  return (
    <div className="bg-white border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between font-mono">
      {/* Card Header: Title & Cell */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <h3 className="text-xs font-bold text-slate-900 truncate font-mono not-italic" title={card.title}>
            {card.title}
          </h3>
          <div className="text-[10px] text-slate-500 font-mono">{card.cell}</div>
        </div>
        <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 border border-slate-300 text-slate-700 font-semibold font-mono">
          {card.unit}
        </span>
      </div>

      {/* SVG Process Curve */}
      <div className="my-2 bg-slate-50 border border-slate-200 p-1 relative flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
          <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
          <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

          {/* SP: Blue Dashed Line */}
          <path
            d={spPath}
            fill="none"
            stroke="#2563EB"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />

          {/* PV: Solid Emerald Line */}
          <path
            d={pvPath}
            fill="none"
            stroke="#16A34A"
            strokeWidth="2"
          />

          {/* Current PV marker circle */}
          <circle
            cx={getX(points.length - 1)}
            cy={getY(card.currentPv)}
            r="3"
            fill="#16A34A"
          />
        </svg>

        <span className="absolute top-1 left-2 text-[8px] text-slate-400 font-mono">
          MAX: {card.max} {card.unit}
        </span>
        <span className="absolute bottom-1 left-2 text-[8px] text-slate-400 font-mono">
          MIN: {card.min} {card.unit}
        </span>
      </div>

      {/* Numerical Metrics Bar */}
      <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-1 text-[11px] font-mono">
        <div>
          <span className="text-[9px] text-slate-500 block uppercase">SP (MES)</span>
          <span className="font-bold text-blue-700">
            {card.currentSp.toFixed(1)}
          </span>
        </div>

        <div>
          <span className="text-[9px] text-slate-500 block uppercase">PV (ACTUAL)</span>
          <span className="font-bold text-emerald-700">
            {card.currentPv.toFixed(1)}
          </span>
        </div>

        <div className="text-right">
          <span className="text-[9px] text-slate-500 block uppercase">OFFSET</span>
          <span className={`font-bold ${isOffsetHigh ? 'text-amber-700' : 'text-slate-700'}`}>
            {errorOffset.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

// Historical Datalog Point
interface DatalogPoint {
  LogID: number;
  OrderCode: string;
  TagName: string;
  Value: number;
  Unit: string;
  ReadTime: string;
}

interface SetpointLog {
  LogID: number;
  TagName: string;
  SetpointValue: number;
  ActualValue: number;
  DeviationPercent: number;
  ReadTime: string;
  Status: string;
}

export const ProcessTelemetry: React.FC = () => {
  const { trendCards } = useOperations();
  const [telemetryMode, setTelemetryMode] = useState<'realtime' | 'historian'>('realtime');

  // Historian query state
  const [targetOrderCode, setTargetOrderCode] = useState<string>('WO_Batch_12');
  const [historicalData, setHistoricalData] = useState<DatalogPoint[]>([]);
  const [setpointLogs, setSetpointLogs] = useState<SetpointLog[]>([]);
  const [isLoadingHistorian, setIsLoadingHistorian] = useState<boolean>(false);
  const [filterTag, setFilterTag] = useState<string>('ALL');
  const [searchTableQuery, setSearchTableQuery] = useState<string>('');

  const fetchHistorianData = useCallback(async (orderCode: string) => {
    setIsLoadingHistorian(true);
    try {
      const [telemetryRows, spRows] = await Promise.all([
        getHistorianDatalog(orderCode),
        getSetpointMonitoring(),
      ]);
      setHistoricalData(telemetryRows || []);
      setSetpointLogs(spRows || []);
    } catch (err) {
      console.warn('Failed to load historian data from SQL Server:', err);
    } finally {
      setIsLoadingHistorian(false);
    }
  }, []);

  // Fetch when switching to historian tab
  useEffect(() => {
    if (telemetryMode === 'historian') {
      fetchHistorianData(targetOrderCode);
    }
  }, [telemetryMode, targetOrderCode, fetchHistorianData]);

  // Group historical data by tag for chart rendering
  const groupedByTag: Record<string, DatalogPoint[]> = {};
  historicalData.forEach((pt) => {
    if (!groupedByTag[pt.TagName]) {
      groupedByTag[pt.TagName] = [];
    }
    groupedByTag[pt.TagName].push(pt);
  });

  const availableTags = Object.keys(groupedByTag);

  // Filtered raw logs
  const filteredDatalog = historicalData.filter((pt) => {
    const matchTag = filterTag === 'ALL' || pt.TagName === filterTag;
    const matchSearch =
      searchTableQuery === '' ||
      pt.TagName.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
      pt.ReadTime.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
      String(pt.Value).includes(searchTableQuery);
    return matchTag && matchSearch;
  });

  // Export to CSV
  const handleExportCsv = () => {
    if (historicalData.length === 0) return;
    const headers = ['LogID', 'OrderCode', 'TagName', 'Value', 'Unit', 'ReadTime'];
    const rows = historicalData.map((d) => [
      d.LogID,
      d.OrderCode,
      `"${d.TagName}"`,
      d.Value,
      `"${d.Unit || ''}"`,
      d.ReadTime,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MES_PLC_Datalog_${targetOrderCode}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Sub-view Header & Mode Switcher */}
      <div className="bg-white border border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold">
            <LineChart className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase not-italic">
              Process Telemetry & Historian Analytics (ISA-88 / ISA-101)
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Đồng bộ dữ liệu thời gian thực và trích xuất lịch sử quá trình từ SQL Server (dbo.PLC_Datalog).
            </p>
          </div>
        </div>

        {/* Mode Toggle Bar: Real-Time vs Historian */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 border border-slate-300 rounded-xs select-none">
          <button
            type="button"
            onClick={() => setTelemetryMode('realtime')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-xs transition-all hallmark-focus active:translate-y-px ${
              telemetryMode === 'realtime'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-600" />
            <span>Real-time SCADA (RBE)</span>
          </button>

          <button
            type="button"
            onClick={() => setTelemetryMode('historian')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-bold text-xs uppercase tracking-wider rounded-xs transition-all hallmark-focus active:translate-y-px ${
              telemetryMode === 'historian'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-blue-600" />
            <span>Historian Archive (SQL)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: REAL-TIME SCADA DYNAMICS                                          */}
      {/* ========================================================================= */}
      {telemetryMode === 'realtime' && (
        <div className="space-y-4">
          {/* Protocol Legend & Indicators */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 px-4 py-2 text-[11px] text-slate-700">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 border-t-2 border-dashed border-blue-600 inline-block" />
                <span className="font-bold text-blue-800">SP (Setpoint from MES)</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-emerald-600 inline-block" />
                <span className="font-bold text-emerald-800">PV (Actual from Controller)</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 pl-3">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-slate-800 font-semibold">
                WebSocket Streaming &lt;15ms · Kepware Port 49320
              </span>
            </div>
          </div>

          {/* Responsive Grid of 8 Trend Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trendCards.map((card) => (
              <TrendChart key={card.id} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: HISTORICAL DATALOG ARCHIVE (SQL dbo.PLC_Datalog)                   */}
      {/* ========================================================================= */}
      {telemetryMode === 'historian' && (
        <div className="space-y-4">
          {/* Query & Fast-Select Bar */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-700" />
                <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                  Truy vấn dữ liệu lưu trữ lịch sử (Microsoft SQL Server dbo.PLC_Datalog)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {historicalData.length} ĐIỂM DỮ LIỆU ĐÃ GHI NHẬN
              </span>
            </div>

            {/* Order Selector Controls - Uniform h-9 */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase">Mã mẻ (Order):</label>
                <input
                  type="text"
                  value={targetOrderCode}
                  onChange={(e) => setTargetOrderCode(e.target.value)}
                  placeholder="WO_Batch_12..."
                  className="bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus w-44"
                />
              </div>

              {/* Quick Select Chips */}
              <div className="flex items-center gap-1.5">
                {['WO_Batch_12', 'WO-2026-TEST', 'WO_INIT_TEST', 'LATEST'].map((code) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      setTargetOrderCode(code);
                      fetchHistorianData(code);
                    }}
                    className={`h-9 px-2.5 text-[11px] font-mono border rounded-xs transition-all hallmark-focus active:translate-y-px ${
                      targetOrderCode === code
                        ? 'bg-slate-900 text-white border-slate-900 font-bold'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {code}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <button
                type="button"
                onClick={() => fetchHistorianData(targetOrderCode)}
                disabled={isLoadingHistorian}
                className="h-9 px-4 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px transition-all shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHistorian ? 'animate-spin' : ''}`} />
                <span>Truy vấn</span>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={historicalData.length === 0}
                className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px transition-all shadow-xs ml-auto"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Xuất CSV</span>
              </button>
            </div>
          </div>

          {/* Historical Curves Grid */}
          {availableTags.length === 0 ? (
            <div className="p-10 bg-white border border-slate-200 text-center text-slate-500 font-mono">
              <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-slate-700">Chưa có bản ghi nào cho mã mẻ [{targetOrderCode}].</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Bản ghi thời gian thực sẽ tự động được lưu vào dbo.PLC_Datalog khi mẻ sản xuất ở trạng thái RUNNING.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {availableTags.map((tagName) => {
                const tagPoints = groupedByTag[tagName] || [];
                const vals = tagPoints.map((p) => p.Value);
                const minVal = vals.length > 0 ? Math.min(...vals) : 0;
                const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
                const avgVal = vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0;
                const lastPt = tagPoints[tagPoints.length - 1];
                const unit = lastPt?.Unit || 'EU';

                // Chart coordinates
                const cWidth = 280;
                const cHeight = 85;
                const cPad = 10;
                const range = maxVal - minVal || 1;

                const getChartY = (v: number) => {
                  const norm = (v - minVal) / range;
                  return cHeight - cPad - norm * (cHeight - 2 * cPad);
                };

                const getChartX = (idx: number) => {
                  return cPad + (idx / Math.max(1, tagPoints.length - 1)) * (cWidth - 2 * cPad);
                };

                const curvePath = tagPoints
                  .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getChartX(idx).toFixed(1)} ${getChartY(pt.Value).toFixed(1)}`)
                  .join(' ');

                return (
                  <div key={tagName} className="bg-white border border-slate-200 p-3.5 shadow-xs flex flex-col justify-between font-mono">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 truncate font-mono not-italic" title={tagName}>
                          {tagName}
                        </h4>
                        <div className="text-[10px] text-slate-500">{tagPoints.length} Data Points Logged</div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 font-semibold font-mono">
                        {unit}
                      </span>
                    </div>

                    {/* SVG Curve */}
                    <div className="my-2 bg-slate-50 border border-slate-200 p-1 relative flex items-center justify-center">
                      <svg viewBox={`0 0 ${cWidth} ${cHeight}`} className="w-full h-20 overflow-visible">
                        <line x1={cPad} y1={cPad} x2={cWidth - cPad} y2={cPad} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
                        <line x1={cPad} y1={cHeight / 2} x2={cWidth - cPad} y2={cHeight / 2} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />
                        <line x1={cPad} y1={cHeight - cPad} x2={cWidth - cPad} y2={cHeight - cPad} stroke="#E2E8F0" strokeWidth="1" strokeDasharray="2 2" />

                        <path
                          d={curvePath}
                          fill="none"
                          stroke="#0284C7"
                          strokeWidth="2"
                        />

                        {tagPoints.length > 0 && (
                          <circle
                            cx={getChartX(tagPoints.length - 1)}
                            cy={getChartY(lastPt.Value)}
                            r="3"
                            fill="#0284C7"
                          />
                        )}
                      </svg>
                      <span className="absolute top-1 left-2 text-[8px] text-slate-400">
                        MAX: {maxVal} {unit}
                      </span>
                      <span className="absolute bottom-1 left-2 text-[8px] text-slate-400">
                        MIN: {minVal} {unit}
                      </span>
                    </div>

                    {/* Stats strip */}
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-3 gap-1 text-[10px]">
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">LAST VALUE</span>
                        <span className="font-bold text-slate-900">{lastPt ? lastPt.Value.toFixed(1) : '--'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block uppercase">AVERAGE</span>
                        <span className="font-bold text-slate-900">{avgVal}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 block uppercase">TIME STAMP</span>
                        <span className="text-slate-600 truncate block">{lastPt?.ReadTime ? lastPt.ReadTime.slice(11, 19) : '--'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Setpoint Deviation Verification Block (dbo.PLC_Setpoint_Monitoring) */}
          {setpointLogs.length > 0 && (
            <div className="bg-white border border-slate-200 shadow-xs">
              <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-700" />
                  <h4 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                    Kiểm định độ lệch Setpoint vs Thực tế (dbo.PLC_Setpoint_Monitoring)
                  </h4>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  {setpointLogs.length} BẢN GHI SO SÁNH
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                      <th className="py-2 px-3 border-r border-slate-200">Tag / Biến kiểm soát</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right w-28">Cài đặt (SP)</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right w-28">Thực tế (PV)</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-right w-28">Độ lệch (%)</th>
                      <th className="py-2 px-3 border-r border-slate-200 text-center w-28">Đánh giá</th>
                      <th className="py-2 px-3 text-slate-500 w-44">Thời gian kiểm tra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {setpointLogs.map((sp) => (
                      <tr key={sp.LogID} className="hover:bg-slate-50">
                        <td className="py-2 px-3 border-r border-slate-200 font-bold text-slate-800">
                          {sp.TagName}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right text-blue-700 font-bold">
                          {sp.SetpointValue.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right text-emerald-700 font-bold">
                          {sp.ActualValue.toFixed(1)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-right font-bold text-slate-800">
                          {sp.DeviationPercent.toFixed(2)}%
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-center">
                          <span className={`px-2 py-0.5 rounded-xs font-bold text-[10px] border ${
                            sp.Status === 'CONFORMING'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {sp.Status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-500 text-[10px]">
                          {sp.ReadTime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Raw Datalog Table */}
          <div className="bg-white border border-slate-200 shadow-xs">
            <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-700" />
                <h4 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                  Sổ lưu trữ bản ghi số hóa (Raw PLC Datalog Stream)
                </h4>
              </div>

              {/* Filter by Tag */}
              <div className="flex items-center gap-2">
                <select
                  value={filterTag}
                  onChange={(e) => setFilterTag(e.target.value)}
                  className="bg-white border border-slate-300 h-8 px-2 text-xs font-mono rounded-xs hallmark-focus"
                >
                  <option value="ALL">Tất cả thông số ({availableTags.length})</option>
                  {availableTags.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={searchTableQuery}
                  onChange={(e) => setSearchTableQuery(e.target.value)}
                  placeholder="Lọc giá trị, thời gian..."
                  className="bg-white border border-slate-300 h-8 px-2.5 text-xs font-mono rounded-xs hallmark-focus w-44"
                />
              </div>
            </div>

            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10 shadow-xs">
                  <tr className="text-slate-700 text-[10px] uppercase font-bold">
                    <th className="py-2 px-3 border-r border-slate-200 text-center w-20">Log ID</th>
                    <th className="py-2 px-3 border-r border-slate-200 w-32">Mã mẻ (Order)</th>
                    <th className="py-2 px-3 border-r border-slate-200">Tên thông số (Tag Name)</th>
                    <th className="py-2 px-3 border-r border-slate-200 text-right w-28">Giá trị đo</th>
                    <th className="py-2 px-3 border-r border-slate-200 text-center w-16">Đơn vị</th>
                    <th className="py-2 px-3 w-48">Thời gian ghi (ReadTime)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-[11px]">
                  {filteredDatalog.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Không có bản ghi nào khớp với điều kiện lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredDatalog.slice(0, 100).map((pt) => (
                      <tr key={pt.LogID} className="hover:bg-slate-50 transition-colors">
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center font-bold text-slate-800">
                          {pt.LogID}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-slate-700">
                          {pt.OrderCode}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 font-semibold text-slate-900">
                          {pt.TagName}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-right font-bold text-emerald-700">
                          {pt.Value.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">
                          {pt.Unit || '--'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 text-[10px]">
                          {pt.ReadTime}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-mono">
              <span>HIỂN THỊ {Math.min(100, filteredDatalog.length)} / {filteredDatalog.length} BẢN GHI GẦN NHẤT</span>
              <span>LƯU TRỮ VĨNH VIỄN TẠI SQL SERVER (LOCALHOST\WINCC)</span>
            </div>
          </div>
        </div>
      )}

      {/* Modernized Footer Info */}
      <div className="p-3 bg-white border border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>ISA-101 HIGH-PERFORMANCE HMI PROCESS TELEMETRY</span>
        </div>
        <div>
          <span className="font-semibold text-slate-700">
            DATABASE: MES_MILK_PRODUCTION (WINCC) · ISA-88 COMPLIANT
          </span>
        </div>
      </div>
    </div>
  );
};

export default ProcessTelemetry;
