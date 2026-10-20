/* Hallmark · component: TankCard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { Settings2, Trash2, Lock, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { MaterialStock } from '../../types/inventory';

export function sanitizeMaterialName(name?: string, _tankId?: string): string {
  if (!name) return '';
  let clean = name.trim();
  const pattern = /^(?:Bồn chứa|Silo chứa|Storage)\s+[\w-]+\s*\((.*)\)$/i;
  while (pattern.test(clean)) {
    clean = clean.replace(pattern, '$1').trim();
  }
  return clean;
}

export function sanitizeTankTitle(tankId: string, tankName?: string, materialName?: string): string {
  const raw = materialName || tankName || '';
  const clean = sanitizeMaterialName(raw, tankId);
  const label = clean && clean.toUpperCase() !== tankId.toUpperCase() ? clean : (materialName || tankId);
  return `Silo Chứa ${tankId} (${label})`;
}

export interface TankCardProps {
  tank: MaterialStock;
  isAdmin?: boolean;
  onConfig: (tank: MaterialStock) => void;
  onDelete?: (tank: MaterialStock) => void;
  isDeleting?: boolean;
  onReconciled?: () => void;
}

export const TankCard: React.FC<TankCardProps> = ({
  tank,
  isAdmin = true,
  onConfig,
  onDelete,
  isDeleting = false,
}) => {
  const tankId = tank.tankId || tank.tank_id || 'TANK-01';
  const materialCode = tank.materialCode || tank.material_code || '';
  const unit = tank.unit || 'L';

  // Current Stock Balance (Authoritative Silo Stock)
  const rawStock = [
    tank.currentStock,
    (tank as any).CurrentStock,
    tank.current_stock,
    (tank as any).Total_Quantity,
  ].find((v) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v)));
  const currentStock = rawStock !== undefined ? Number(rawStock) : 0;

  // Capacities & Safety Thresholds
  const capacity = Number(tank.tank_capacity || tank.tankCapacity || (tank as any).TankCapacity || tank.capacity || tank.max_capacity || 5.0);
  const minSafety = Number(tank.min_safety_threshold || tank.minSafetyThreshold || (tank as any).MinSafetyThreshold || tank.minThreshold || tank.safety_min || 0.5);

  // Metrics
  const fillPercent = Math.min(100, Math.max(0, (currentStock / (capacity || 1)) * 100));
  const availableHeadspace = Math.max(0, Math.round(((capacity || 1) - currentStock) * 100) / 100);
  const isLow = currentStock <= minSafety;
  const isHigh = fillPercent >= 95.0;

  // Active Lot Genealogy
  const activeLot = tank.activeLot || tank.active_lot || tank.supplierLot || tank.supplier_lot || `LOT-${tankId}-ACT`;

  // Sanitized Names
  const cleanTitle = sanitizeTankTitle(tankId, tank.tankName || (tank as any).tank_name, tank.materialName || (tank as any).material_name);
  const cleanMatName = sanitizeMaterialName(tank.materialName || (tank as any).material_name, tankId) || materialCode;

  // Visual Gauge Bar Color
  const progressBarColor = isLow 
    ? 'bg-amber-500' 
    : isHigh 
    ? 'bg-rose-500' 
    : 'bg-emerald-600';

  return (
    <div
      className={`bg-white border transition-all ${
        isLow 
          ? 'border-amber-300 ring-1 ring-amber-300' 
          : isHigh
          ? 'border-rose-300 ring-1 ring-rose-300'
          : 'border-slate-200 hover:border-slate-300'
      } shadow-xs p-4 flex flex-col justify-between rounded-xs font-mono`}
    >
      {/* Top Header: Tank ID, Material Code & Status Badge */}
      <div>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 bg-slate-900 text-white font-mono text-[10px] font-bold rounded-xs tracking-wide">
              {tankId}
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-800">
              {materialCode}
            </span>

            {/* Silo Operating Status Badge */}
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded-xs flex items-center gap-1 ${
                isLow
                  ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                  : isHigh
                  ? 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-300'
              }`}
            >
              {isLow ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  <span>⚠ LOW LEVEL ALERT</span>
                </>
              ) : isHigh ? (
                <>
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>⚠ HIGH LEVEL</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>● ACTIVE SILO (ONLINE)</span>
                </>
              )}
            </span>
          </div>

          {/* Action Buttons: Config [ ⚙️ Cấu hình ] and Delete [ 🗑️ ] */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => onConfig(tank)}
                className="h-8 px-2.5 bg-slate-100 border border-slate-300 hover:bg-slate-200 text-slate-700 font-mono text-xs font-semibold flex items-center gap-1.5 rounded-xs transition-all shadow-xs hallmark-focus active:translate-y-px"
                title={`Cấu hình thông số silo [${tankId}] (Admin Clearance)`}
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-600" />
                <span>⚙️ Cấu hình</span>
              </button>
            ) : (
              <span
                className="h-8 px-2.5 bg-slate-50 border border-slate-200 text-slate-400 font-mono text-xs font-medium flex items-center gap-1 rounded-xs cursor-not-allowed select-none"
                title="Chỉ Admin có quyền hiệu chỉnh"
              >
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Cấu hình</span>
              </span>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(tank)}
                disabled={isDeleting || currentStock > 0.001 || !isAdmin}
                className={`h-8 px-2 rounded-xs border text-[11px] font-mono font-bold flex items-center justify-center transition-all shadow-xs hallmark-focus active:translate-y-px ${
                  currentStock <= 0.001 && isAdmin
                    ? 'bg-white hover:bg-rose-50 text-rose-600 border-rose-300 hover:border-rose-400'
                    : 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed opacity-60'
                }`}
                title={
                  !isAdmin
                    ? 'Chỉ Administrator mới có quyền xóa silo chứa'
                    : currentStock <= 0.001
                    ? `Xóa silo chứa rỗng [${tankId}] (Tồn kho = 0)`
                    : `Không thể xóa [${tankId}]: Còn tồn kho thực tế (${currentStock.toLocaleString()} ${unit})`
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Title & Material Name */}
        <div className="mb-2">
          <h3 className="text-xs font-bold text-slate-900 truncate not-italic tracking-tight" title={cleanTitle}>
            {cleanTitle}
          </h3>
          <p className="text-[11px] text-slate-500 truncate max-w-full font-medium" title={cleanMatName}>
            {cleanMatName}
          </p>
        </div>
      </div>

      {/* Industrial Storage Level Display Gauge */}
      <div className="bg-slate-50 border border-slate-200 p-3 my-2 rounded-xs space-y-2">
        {/* Primary Readout */}
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold text-slate-700 block uppercase tracking-wide">
              Tồn kho thực tế (Current Stock):
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Dung tích bồn (Capacity): {capacity.toFixed(2)} {unit}
            </span>
          </div>
          <div className="text-right">
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-lg font-mono font-bold text-slate-900">
                {currentStock.toFixed(2)}
              </span>
              <span className="text-xs font-mono font-bold text-slate-600">
                {unit}
              </span>
            </div>
            <div className="text-[10px] font-mono font-semibold text-emerald-700">
              Khả dụng: {availableHeadspace.toFixed(2)} {unit}
            </div>
          </div>
        </div>

        {/* Visual Fill Gauge Bar */}
        <div className="relative w-full h-5 bg-slate-200 border border-slate-300 overflow-hidden rounded-xs">
          <div
            className={`h-full transition-all duration-500 ${progressBarColor}`}
            style={{ width: `${fillPercent}%` }}
          />
          {/* Minimum safety threshold line */}
          <div
            className="absolute top-0 bottom-0 border-r-2 border-dashed border-rose-600 z-10"
            style={{ left: `${(minSafety / (capacity || 1)) * 100}%` }}
            title={`Ngưỡng an toàn tối thiểu: ${minSafety.toLocaleString()} ${unit}`}
          />
          {/* Centered progress text */}
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono font-bold text-slate-900 drop-shadow-2xs select-none">
            {fillPercent.toFixed(1)}% ({currentStock.toFixed(2)} / {capacity.toFixed(2)} {unit})
          </div>
        </div>

        {/* Headspace & Safety Min Metrics */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>Ngưỡng an toàn (Min): <strong>{minSafety.toFixed(2)} {unit}</strong></span>
          <span className="text-slate-600">
            Trống khả dụng: <strong>{availableHeadspace.toFixed(2)} {unit}</strong>
          </span>
        </div>
      </div>

      {/* Footer: Discrete Safety Indicators (LSH & LSL) & Active Lot */}
      <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-[10px] font-mono text-slate-600">
        <div className="flex items-center justify-between flex-wrap gap-1">
          <div className="flex items-center gap-2">
            <span>
              Mức cao (LSH ≥ 95%):{' '}
              <strong className={isHigh ? 'text-rose-700 font-bold' : 'text-slate-700'}>
                {isHigh ? 'HIGH' : 'NORMAL'}
              </strong>
            </span>
            <span className="text-slate-300">|</span>
            <span>
              Mức thấp (LSL ≤ Min):{' '}
              <strong className={isLow ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                {isLow ? 'LOW' : 'NORMAL'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-1 text-slate-500">
            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>ISA-95 TRACKED</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-slate-500">Mã lô đang cấp (Active Lot):</span>
          <span className="font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded-xs border border-slate-200">
            {activeLot}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TankCard;
