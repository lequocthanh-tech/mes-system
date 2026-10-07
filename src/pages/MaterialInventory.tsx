/* Hallmark · component: MaterialInventory · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { InboundReceipt } from './inventory/InboundReceipt';
import { RealTimeStock } from './inventory/RealTimeStock';
import { useInventory } from '../context/InventoryContext';
import { useConfig } from '../context/ConfigContext';
import { 
  PackagePlus, 
  Database, 
  Layers, 
  Boxes
} from 'lucide-react';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

export type InventorySubTab = 'inbound' | 'stock_overview';

export const MaterialInventory: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('inbound');
  const { receipts, stocks, refreshStockBalance } = useInventory();
  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';

  React.useEffect(() => {
    refreshStockBalance();
  }, [sqlOnline]);


  const lowStockCount = stocks.filter((s) => s.currentStock < s.minThreshold).length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-mono">
      {/* Module 6 Header Banner */}
      <div className="bg-white border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider font-semibold">
              ISA-95 LEVEL 3 · INVENTORY OPERATIONS MANAGEMENT
            </span>
          </div>
          <h1 className="text-lg font-bold text-slate-900 leading-snug flex items-center gap-2 not-italic">
            <Boxes className="w-5 h-5 text-slate-800" />
            MATERIAL INVENTORY & CONSUMPTION SUITE
          </h1>
          <p className="text-xs text-slate-600 mt-0.5 font-sans font-normal">
            Quản lý tiếp nhận nguyên vật liệu, kiểm soát dung tích bồn chứa an toàn và tự động khấu trừ sau mẻ sản xuất.
          </p>
        </div>

        {/* Live Badges Summary */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 flex items-center gap-2.5 rounded-xs">
            <Layers className="w-4 h-4 text-slate-600" />
            <div className="text-left font-mono">
              <div className="text-[10px] text-slate-500 uppercase leading-none font-bold">Bồn giám sát</div>
              <div className="text-xs font-bold text-slate-900 leading-tight">3 Silos / Tanks</div>
            </div>
          </div>

          <div className="px-3.5 py-1.5 bg-slate-50 border border-slate-200 flex items-center gap-2.5 rounded-xs">
            <PackagePlus className="w-4 h-4 text-slate-600" />
            <div className="text-left font-mono">
              <div className="text-[10px] text-slate-500 uppercase leading-none font-bold">Phiếu nhập kho</div>
              <div className="text-xs font-bold text-slate-900 leading-tight">{receipts.length} Receipts</div>
            </div>
          </div>

          <div
            className={`px-3.5 py-1.5 border flex items-center gap-2.5 rounded-xs ${
              lowStockCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-emerald-50 border-emerald-300 text-emerald-900'
            }`}
          >
            <div className="text-left font-mono">
              <div className="text-[10px] opacity-75 uppercase leading-none font-bold">Cảnh báo tồn kho</div>
              <div className="text-xs font-bold leading-tight">
                {lowStockCount > 0 ? `${lowStockCount} Low Alert(s)` : 'Tất cả đạt chuẩn'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Bar */}
      <div className="flex border-b border-slate-200 bg-white px-2 pt-2 gap-2 shadow-xs select-none">
        <button
          type="button"
          onClick={() => setActiveSubTab('inbound')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all font-mono hallmark-focus active:translate-y-px ${
            activeSubTab === 'inbound'
              ? 'border-slate-900 text-slate-900 bg-slate-50'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <PackagePlus className="w-4 h-4 text-slate-700" />
          <span>CÀI ĐẶT NHẬP NGUYÊN LIỆU (INBOUND MATERIAL RECEIPT)</span>
          <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-mono rounded-xs font-bold">
            {receipts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('stock_overview')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all font-mono hallmark-focus active:translate-y-px ${
            activeSubTab === 'stock_overview'
              ? 'border-slate-900 text-slate-900 bg-slate-50'
              : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4 text-slate-700" />
          <span>GIÁM SÁT TỔNG KHO & BỒN CHỨA (REAL-TIME STOCK & SILOS)</span>
          {lowStockCount > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-mono rounded-xs font-bold">
              !
            </span>
          )}
        </button>
      </div>

      {/* Sub-View Content */}
      <section aria-label="Inventory View Content">
        {activeSubTab === 'inbound' && <InboundReceipt />}
        {activeSubTab === 'stock_overview' && <RealTimeStock />}
      </section>
    </div>
  );
};

export default MaterialInventory;
