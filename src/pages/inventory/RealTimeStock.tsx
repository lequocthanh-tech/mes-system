/* Hallmark · component: RealTimeStock · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { 
  Database, 
  RefreshCw, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  ArrowDownRight, 
  Cpu,
  Info,
  Radio,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';

export const RealTimeStock: React.FC = () => {
  const { 
    stocks, 
    consumptionLogs, 
    simulateBatchDeduction, 
    refreshStockBalance 
  } = useInventory();

  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Dev Harness State
  const [testOrderId, setTestOrderId] = useState<string>('WO-2026-001');
  const [testRecipe, setTestRecipe] = useState<string>('Fresh Pasteurized UHT Milk (1,000L)');

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      simulateBatchDeduction(`BATCH_${testOrderId.replace('WO-', '')}`, testRecipe, testOrderId);
      setIsSimulating(false);
      setToastMessage(`Batch ${testOrderId} completed! Post-batch deduction reconciled: -700.0L Raw Milk, -200.0kg Sugar, -100.0L Additives.`);
      setTimeout(() => setToastMessage(null), 5000);
    }, 400);
  };

  const handleRefresh = () => {
    refreshStockBalance();
    setToastMessage('Real-time stock balance synchronized with Kepware Gateway & SCADA Historian.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 text-xs flex items-center justify-between shadow-xs font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)} 
            className="text-slate-500 hover:text-slate-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER: TITLE & GATEWAY PROTOCOL TELEMETRY */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-slate-800" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide not-italic">
              Giám sát tổng kho & Bồn chứa (Real-Time Silo & Tank Storage Telemetry)
            </h2>
            <p className="text-[11px] text-slate-500 font-normal">
              ISA-95 Level 3 Inventory Tracking · Continuous Level Sensors & Automated Reconciliation
            </p>
          </div>
        </div>

        {/* Protocol Label & Action */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Modernized Gateway Protocol Label */}
          <div className="flex items-center gap-2 px-3 h-9 bg-slate-50 border border-slate-300 rounded-xs text-[11px] font-mono text-slate-800 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0 inline-block" />
            <span className="font-bold tracking-tight">GATEWAY: KEPWARE CENTRAL (PORT 49320) · RBE WEBSOCKET ACTIVE</span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            <span>Đồng bộ kho (Refresh)</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: VISUAL SILO / TANK LEVEL GAUGES */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Bảng điều khiển bồn chứa nguyên liệu (Physical Storage Tanks)
          </span>
          <span className="text-[10px] text-slate-500">
            CẬP NHẬT THEO SỰ KIỆN RBE (REPORT BY EXCEPTION)
          </span>
        </div>

        {/* 3 Visual Silo Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stocks.map((stock) => {
            const percentage = Math.min(100, Math.round((stock.currentStock / stock.capacity) * 1000) / 10);
            const remaining = Math.max(0, Math.round((stock.capacity - stock.currentStock) * 100) / 100);
            const isLow = stock.currentStock < stock.minThreshold;

            return (
              <div
                key={stock.tankId}
                className={`bg-white border transition-all ${
                  isLow ? 'border-amber-300 ring-1 ring-amber-300' : 'border-slate-200 hover:border-slate-300'
                } shadow-xs p-4 flex flex-col justify-between`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold rounded-xs">
                        {stock.tankId}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-slate-800">
                        {stock.materialCode}
                      </span>
                    </div>

                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded-xs ${
                        isLow
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isLow ? 'LOW STOCK ALERT' : 'IN STOCK / NORMAL'}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900 truncate not-italic" title={stock.tankName}>
                    {stock.tankName}
                  </h3>
                  <p className="text-[11px] text-slate-500 mb-3">{stock.materialName}</p>
                </div>

                {/* Industrial Level Display Gauge */}
                <div className="bg-slate-50 border border-slate-200 p-3 my-2 rounded-xs">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-slate-600">Mức chứa hiện tại:</span>
                    <div className="text-right">
                      <span className="text-base font-mono font-bold text-slate-900">
                        {stock.currentStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-600 ml-1">
                        {stock.unit}
                      </span>
                    </div>
                  </div>

                  {/* Visual Fill Gauge Bar */}
                  <div className="relative w-full h-5 bg-slate-200 border border-slate-300 overflow-hidden mb-1.5 rounded-xs">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isLow
                          ? 'bg-amber-500'
                          : stock.materialCode === 'RAW_MILK'
                          ? 'bg-sky-600'
                          : stock.materialCode === 'SUGAR'
                          ? 'bg-amber-600'
                          : 'bg-emerald-600'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                    {/* Minimum threshold line */}
                    <div
                      className="absolute top-0 bottom-0 border-r-2 border-dashed border-rose-600 z-10"
                      style={{ left: `${(stock.minThreshold / stock.capacity) * 100}%` }}
                      title={`Safety Min: ${stock.minThreshold} ${stock.unit}`}
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-slate-900">
                      {percentage}% ({stock.currentStock.toLocaleString()} / {stock.capacity.toLocaleString()} {stock.unit})
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                    <span>Mức an toàn: {stock.minThreshold.toLocaleString()} {stock.unit}</span>
                    <span className="text-emerald-700 font-bold">Khả dụng (Headspace): {remaining.toLocaleString()} {stock.unit}</span>
                  </div>
                </div>

                {/* Footer Telemetry */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Dung tích: {stock.capacity.toLocaleString()} {stock.unit}</span>
                  <span>Đồng bộ: {stock.lastUpdated.slice(11)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: CURRENT STOCK BALANCE GRID (Bảng cân đối tồn kho) */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="bg-slate-100/70 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide not-italic">
              Bảng cân đối tồn kho hiện tại (Current Stock Balance & Safety Thresholds)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            TOTAL ASSETS: 3 MONITORED TANKS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-32">Material Code</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Material Description</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Assigned Tank</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-28">Current Stock</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-center w-20">Unit</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-28">Capacity</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-28">Safety Min</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-24">Fill %</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-32">Headspace</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-36">Last Synchronized</th>
                <th className="px-3.5 py-2.5 text-center w-36">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {stocks.map((stock) => {
                const fillPct = Math.round((stock.currentStock / stock.capacity) * 1000) / 10;
                const headspace = Math.max(0, Math.round((stock.capacity - stock.currentStock) * 100) / 100);
                const isLow = stock.currentStock < stock.minThreshold;

                return (
                  <tr key={stock.materialCode} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-900">
                      {stock.materialCode}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-medium text-slate-900">
                      {stock.materialName}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-600">
                      {stock.tankName} ({stock.tankId})
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-900 text-right">
                      {stock.currentStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-700 text-center">
                      {stock.unit}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-600 text-right">
                      {stock.capacity.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-600 text-right">
                      {stock.minThreshold.toLocaleString()}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-800 text-right">
                      {fillPct}%
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-emerald-700 text-right">
                      {headspace.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-500 text-[10px]">
                      {stock.lastUpdated}
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border rounded-xs ${
                          isLow
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {isLow ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            LOW STOCK
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            IN STOCK
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: AUTOMATED POST-BATCH CONSUMPTION LOG & RECONCILIATION */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="bg-slate-100/70 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide not-italic">
                Khấu trừ mẻ sản xuất tự động (Automated Post-Batch Consumption & Reconciliation)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ISA-95 Level 3 MOM · Tự động khấu trừ tồn kho bồn khi nhận sự kiện hoàn thành mẻ từ Module Operations
            </p>
          </div>

          {/* Active Listener Status Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-[10px] font-bold rounded-xs shadow-xs">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>EVENT LISTENER ACTIVE (Listening for state === 'COMPLETED')</span>
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-36">Batch ID</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-32">Work Order</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Recipe Title</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Consumed Materials Breakdown (FIFO Lot Traceability)</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-36">Timestamp</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-44">Reconciled By</th>
                <th className="px-3.5 py-2.5 text-center w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {consumptionLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  {/* Batch ID */}
                  <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-900">
                    {log.batchId}
                  </td>

                  {/* Work Order */}
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-800 font-bold">
                    {log.orderId}
                  </td>

                  {/* Recipe Title */}
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-800">
                    {log.recipeName}
                  </td>

                  {/* Consumed Materials Breakdown with FIFO / Lot Traceability */}
                  <td className="px-3.5 py-2.5 border-r border-slate-200">
                    <div className="flex flex-wrap gap-1.5">
                      {log.consumedItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-300 rounded-xs font-mono text-[10px] text-slate-800"
                        >
                          <ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="font-bold">{item.materialCode}:</span>
                          <span className="font-bold text-rose-700">-{item.consumedQty} {item.unit}</span>
                          <span className="text-slate-500 font-normal">
                            (Lot: <strong className="text-slate-700">{item.lotCode || 'LOT-VNM-26A'}</strong>)
                          </span>
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* Timestamp */}
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-600 text-[10px]">
                    {log.timestamp}
                  </td>

                  {/* Reconciled By */}
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-700 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{log.reconciledBy}</span>
                    </div>
                  </td>

                  {/* Status */}
                  <td className="px-3.5 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xs font-bold text-[10px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                      RECONCILED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Industrial Note Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center gap-2 text-[10px] text-slate-600">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            <strong>Quy tắc đối soát ISA-95:</strong> Khi một mẻ sản xuất đạt trạng thái <code className="bg-slate-200 px-1 font-mono font-bold">COMPLETED</code> tại Module Operations, lượng nguyên liệu thực tế theo công thức sẽ tự động được khấu trừ khỏi bồn chứa, gán mã lô FIFO và lưu vết đối soát.
          </span>
        </div>
      </div>

      {/* DISCRETE DEVELOPER TEST HARNESS (Accordion Menu) */}
      <details className="group bg-white border border-slate-200 p-3 rounded-xs text-xs font-mono shadow-xs">
        <summary className="cursor-pointer font-bold text-slate-700 hover:text-slate-900 flex items-center justify-between list-none select-none">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <span>Developer Test Harness: Simulate Batch Completion (Testing Without Hardware)</span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
          <p className="text-[11px] text-slate-600">
            Menu này dành cho kỹ sư thử nghiệm hệ thống. Trong vận hành thực tế, sự kiện hoàn thành mẻ được nhận tự động qua Kepware Gateway hoặc Module Operations.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Mã lệnh:</span>
              <select
                value={testOrderId}
                onChange={(e) => setTestOrderId(e.target.value)}
                className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="WO-2026-001">WO-2026-001</option>
                <option value="WO-2026-002">WO-2026-002</option>
                <option value="WO-2026-003">WO-2026-003</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Công thức:</span>
              <select
                value={testRecipe}
                onChange={(e) => setTestRecipe(e.target.value)}
                className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="Fresh Pasteurized UHT Milk (1,000L)">Fresh Pasteurized UHT Milk (1,000L)</option>
                <option value="Chocolate Flavored Dairy (1,000L)">Chocolate Flavored Dairy (1,000L)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulating}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Đang khấu trừ...' : 'Simulate Batch Completion'}</span>
            </button>
          </div>
        </div>
      </details>
    </div>
  );
};
