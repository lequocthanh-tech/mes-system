/* Hallmark · component: PhaseDurationModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Clock, 
  RotateCcw, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Layers, 
  Cpu, 
  Loader2,
  Info
} from 'lucide-react';
import { useOperations } from '../../context/OperationsContext';
import { PhaseDurationsMap } from '../../types/operations';

interface PhaseDurationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PhaseDef {
  code: string;
  name: string;
  unit: string;
  defaultMin: number;
  desc: string;
}

const CELL1_PHASE_DEFS: PhaseDef[] = [
  { code: 'PH11101', name: 'Nạp sữa tươi (PH_SUPPLYMILK)', unit: 'UP_MIXING / OP_INLET', defaultMin: 6.0, desc: 'Bơm nạp nguyên liệu sữa tươi từ silo vào bồn trộn' },
  { code: 'PH11202', name: 'Nạp đường (PH_SUPPLYSUGAR)', unit: 'UP_MIXING / OP_INLET', defaultMin: 5.0, desc: 'Định lượng và nạp đường tinh luyện qua phễu nạp' },
  { code: 'PH11303', name: 'Nạp phụ gia vi lượng (PH_SUPPLYADDITIVE)', unit: 'UP_MIXING / OP_INLET', defaultMin: 4.0, desc: 'Định lượng vitamin và phụ gia hòa tan' },
  { code: 'PH12101', name: 'Khuấy trộn bồn trộn (PH_AGITATE)', unit: 'UP_MIXING / OP_MIXING', defaultMin: 12.0, desc: 'Khuấy đều hỗn hợp sữa và nguyên liệu theo tốc độ cài đặt' },
  { code: 'PH12202', name: 'Tuần hoàn đồng hóa (PH_CIRCULATE)', unit: 'UP_MIXING / OP_MIXING', defaultMin: 10.0, desc: 'Bơm tuần hoàn dịch sữa qua thiết bị đồng hóa' },
  { code: 'PH12303', name: 'Bơm chuyển dịch mẻ (PH_TRANSFER_MIX)', unit: 'UP_MIXING / OP_MIXING', defaultMin: 4.0, desc: 'Bơm chuyển hỗn hợp sang bồn đệm tiệt trùng' },
  { code: 'PH22101', name: 'Gia nhiệt tiệt trùng UHT (PH_HEAT)', unit: 'UP_STERILIZE / OP_HEATING', defaultMin: 8.0, desc: 'Gia nhiệt tức thời bằng hơi nước áp suất cao đạt 138°C' },
  { code: 'PH22102', name: 'Giữ nhiệt tiệt trùng (PH_HOLD_TEMP)', unit: 'UP_STERILIZE / OP_HEATING', defaultMin: 4.0, desc: 'Duy trì nhiệt độ tiệt trùng trong ống giữ nhiệt vô trùng' },
  { code: 'PH22201', name: 'Làm lạnh nhanh (PH_CHILL)', unit: 'UP_STERILIZE / OP_COOLING', defaultMin: 5.0, desc: 'Hạ nhiệt cấp tốc qua tấm trao đổi nhiệt xuống 4°C' },
  { code: 'PH22202', name: 'Chiết rót vô trùng (PH_TRANSFER_OUT)', unit: 'UP_STERILIZE / OP_COOLING', defaultMin: 3.0, desc: 'Chuyển sữa tiệt trùng sang cụm máy chiết rót bao bì' },
];

const CELL2_PHASE_DEFS: PhaseDef[] = [
  { code: 'PH_SUPPLYMILK_PC2', name: 'Nạp sữa tươi SIMIT (PH_SUPPLYMILK)', unit: 'UP_MIXING_PC2 / OP_INLET_PC2', defaultMin: 6.0, desc: 'Mô phỏng bơm nạp sữa số học SIMIT Digital Twin' },
  { code: 'PH_SUPPLYSUGAR_PC2', name: 'Nạp đường SIMIT (PH_SUPPLYSUGAR)', unit: 'UP_MIXING_PC2 / OP_INLET_PC2', defaultMin: 5.0, desc: 'Mô phỏng van xoay nạp liệu đường SIMIT' },
  { code: 'PH_AGITATE_PC2', name: 'Khuấy trộn SIMIT (PH_AGITATE)', unit: 'UP_MIXING_PC2 / OP_MIXING_PC2', defaultMin: 12.0, desc: 'Mô phỏng động cơ khuấy trộn điều tốc SIMIT' },
  { code: 'PH_HEAT_PC2', name: 'Gia nhiệt UHT SIMIT (PH_HEAT)', unit: 'UP_STERILIZE_PC2 / OP_HEATING_PC2', defaultMin: 8.0, desc: 'Mô hình trao đổi nhiệt hơi nóng SIMIT' },
  { code: 'PH_CHILL_PC2', name: 'Làm lạnh nhanh SIMIT (PH_CHILL)', unit: 'UP_STERILIZE_PC2 / OP_COOLING_PC2', defaultMin: 5.0, desc: 'Mô hình làm lạnh trao đổi nước lạnh SIMIT' },
];

export const PhaseDurationModal: React.FC<PhaseDurationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { phaseDurations, saveAllPhaseDurations } = useOperations();

  const [activeTab, setActiveTab] = useState<'cell1' | 'cell2'>('cell1');
  const [localDurations, setLocalDurations] = useState<PhaseDurationsMap>({
    cell1_physical: {},
    cell2_simit: {},
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Copy current context phase durations into local edit buffer whenever opened
  useEffect(() => {
    if (isOpen) {
      const initCell1: Record<string, number> = {};
      CELL1_PHASE_DEFS.forEach((def) => {
        initCell1[def.code] = phaseDurations.cell1_physical[def.code] ?? def.defaultMin;
      });

      const initCell2: Record<string, number> = {};
      CELL2_PHASE_DEFS.forEach((def) => {
        initCell2[def.code] = phaseDurations.cell2_simit[def.code] ?? def.defaultMin;
      });

      setLocalDurations({
        cell1_physical: initCell1,
        cell2_simit: initCell2,
      });
      setToastMessage(null);
    }
  }, [isOpen, phaseDurations]);

  if (!isOpen) return null;

  const handleDurationChange = (cell: 'cell1_physical' | 'cell2_simit', code: string, val: number) => {
    const clamped = Math.max(0.5, Math.min(120.0, Number(val)));
    setLocalDurations((prev) => ({
      ...prev,
      [cell]: {
        ...prev[cell],
        [code]: clamped,
      },
    }));
  };

  const handleResetDefaults = () => {
    if (activeTab === 'cell1') {
      const resetCell1: Record<string, number> = {};
      CELL1_PHASE_DEFS.forEach((d) => {
        resetCell1[d.code] = d.defaultMin;
      });
      setLocalDurations((prev) => ({ ...prev, cell1_physical: resetCell1 }));
      setToastType('success');
      setToastMessage('Đã đặt lại thời lượng mặc định cho Cell 1 (Thực tế). Bấm [LƯU TOÀN BỘ] để áp dụng.');
    } else {
      const resetCell2: Record<string, number> = {};
      CELL2_PHASE_DEFS.forEach((d) => {
        resetCell2[d.code] = d.defaultMin;
      });
      setLocalDurations((prev) => ({ ...prev, cell2_simit: resetCell2 }));
      setToastType('success');
      setToastMessage('Đã đặt lại thời lượng mặc định cho Cell 2 (SIMIT). Bấm [LƯU TOÀN BỘ] để áp dụng.');
    }
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setToastMessage(null);

    // Ensure SIMIT aliases match standard codes for backward compatibility
    const cell2Prepared = { ...localDurations.cell2_simit };
    if (cell2Prepared['PH_SUPPLYMILK_PC2']) cell2Prepared['PH11101'] = cell2Prepared['PH_SUPPLYMILK_PC2'];
    if (cell2Prepared['PH_SUPPLYSUGAR_PC2']) cell2Prepared['PH11202'] = cell2Prepared['PH_SUPPLYSUGAR_PC2'];
    if (cell2Prepared['PH_AGITATE_PC2']) cell2Prepared['PH12101'] = cell2Prepared['PH_AGITATE_PC2'];
    if (cell2Prepared['PH_HEAT_PC2']) cell2Prepared['PH22101'] = cell2Prepared['PH_HEAT_PC2'];
    if (cell2Prepared['PH_CHILL_PC2']) cell2Prepared['PH22201'] = cell2Prepared['PH_CHILL_PC2'];

    const payload: PhaseDurationsMap = {
      cell1_physical: localDurations.cell1_physical,
      cell2_simit: cell2Prepared,
    };

    const success = await saveAllPhaseDurations(payload);
    setIsSaving(false);

    if (success) {
      setToastType('success');
      setToastMessage('Đã lưu thời lượng các Phase thành công!');
      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    } else {
      setToastType('error');
      setToastMessage('Lỗi khi lưu thời lượng Phase tới máy chủ.');
    }
  };

  const currentDefs = activeTab === 'cell1' ? CELL1_PHASE_DEFS : CELL2_PHASE_DEFS;
  const currentCellKey = activeTab === 'cell1' ? 'cell1_physical' : 'cell2_simit';

  // Calculate total cell execution time and dynamic Gantt horizon
  const totalCellMinutes = currentDefs.reduce((acc, def) => {
    const val = localDurations[currentCellKey][def.code] ?? def.defaultMin;
    return acc + val;
  }, 0);
  const modalHorizonMinutes = Math.max(30, Math.ceil(totalCellMinutes / 10) * 10);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="phase-duration-modal-title"
    >
      <div className="bg-white border border-slate-300 w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] text-xs font-mono text-slate-800">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-start justify-between shrink-0">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-sky-400" />
            </div>
            <div>
              <h2 
                id="phase-duration-modal-title" 
                className="text-sm font-bold text-slate-900 uppercase tracking-tight"
                style={{ fontStyle: 'normal' }}
              >
                Cài đặt thời gian định mức từng Pha (Phase Duration Setup)
              </h2>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5" style={{ fontStyle: 'normal' }}>
                Hiệu chỉnh số phút chạy dự kiến cho từng bước quy trình ISA-88 trên Cell 1 (Thực tế) và Cell 2 (SIMIT)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
            aria-label="Đóng hộp thoại"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher & Total Summary Strip */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cell1'}
              onClick={() => setActiveTab('cell1')}
              className={`h-9 px-3.5 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 border transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px ${
                activeTab === 'cell1'
                  ? 'bg-white border-slate-400 text-slate-900 shadow-xs'
                  : 'bg-slate-200/80 border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-slate-700" />
              <span>1. Process Cell 1 - Thiết bị thực</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-slate-200 text-slate-700 font-mono">
                {CELL1_PHASE_DEFS.length} Pha
              </span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cell2'}
              onClick={() => setActiveTab('cell2')}
              className={`h-9 px-3.5 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-2 border transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px ${
                activeTab === 'cell2'
                  ? 'bg-white border-slate-400 text-slate-900 shadow-xs'
                  : 'bg-slate-200/80 border-transparent text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. Process Cell 2 - SIMIT Digital Twin</span>
              <span className="text-[10px] px-1.5 py-0.2 bg-indigo-100 text-indigo-800 font-mono">
                {CELL2_PHASE_DEFS.length} Pha
              </span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-300 text-slate-700">
              <span className="text-slate-500 font-normal">TỔNG THỜI LƯỢNG MẺ:</span>
              <span className="font-bold text-slate-900 text-xs">
                {totalCellMinutes.toFixed(1)} phút
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetDefaults}
              className="h-8 px-2.5 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
              title="Đặt lại các giá trị định mức mặc định theo tài liệu thiết kế ISA-88"
            >
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Mặc định</span>
            </button>
          </div>
        </div>

        {/* Toast Alert Banner */}
        {toastMessage && (
          <div 
            className={`px-5 py-2 text-xs flex items-center justify-between border-b ${
              toastType === 'success' 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastType === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span className="font-semibold">{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-slate-500 hover:text-slate-900 text-[10px] uppercase font-bold"
            >
              [ẨN]
            </button>
          </div>
        )}

        {/* Phase Configuration Table Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <div className="flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-slate-400" />
              <span>Bước hiệu chỉnh: 0.5 phút · Giới hạn: 0.5m – 120.0m · Trục tham chiếu Gantt: {modalHorizonMinutes} phút</span>
            </div>
            <div>
              <span>Khung thời gian mẻ ISA-88</span>
            </div>
          </div>

          <div className="border border-slate-300 bg-white shadow-xs overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-700 tracking-wider">
                  <th className="py-2.5 px-3 w-28 border-r border-slate-200">Mã Phase</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Tên bước công nghệ</th>
                  <th className="py-2.5 px-3 w-40 border-r border-slate-200 text-center">
                    Thời lượng (Phút)
                  </th>
                  <th className="py-2.5 px-3 w-64">
                    <div className="flex justify-between items-center">
                      <span>Xem trước trục Gantt</span>
                      <span className="text-[9px] text-slate-500 font-normal">T+0m &rarr; T+{modalHorizonMinutes}m</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {currentDefs.map((phase) => {
                  const currentVal = localDurations[currentCellKey][phase.code] ?? phase.defaultMin;
                  const ganttPercent = Math.min(100, (currentVal / modalHorizonMinutes) * 100);

                  return (
                    <tr 
                      key={phase.code}
                      className="hover:bg-slate-50 transition-none"
                    >
                      {/* Procedural Code */}
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900 bg-slate-50/50">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1 py-0.2 bg-slate-900 text-white font-mono shrink-0">
                            PH
                          </span>
                          <span className="font-mono text-xs">{phase.code}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-normal truncate mt-0.5">
                          {phase.unit}
                        </div>
                      </td>

                      {/* Phase Name & Description */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-semibold text-slate-900">
                          {phase.name}
                        </div>
                        <div className="text-[10px] text-slate-500 font-normal mt-0.5 line-clamp-1">
                          {phase.desc}
                        </div>
                      </td>

                      {/* Configured Duration (Minutes) */}
                      <td className="py-2 px-3 border-r border-slate-200 text-center bg-slate-50/30">
                        <div className="inline-flex items-center border border-slate-300 bg-white focus-within:outline-2 focus-within:outline-sky-600 focus-within:outline-offset-2">
                          <button
                            type="button"
                            onClick={() => handleDurationChange(currentCellKey, phase.code, Math.max(0.5, currentVal - 0.5))}
                            className="w-7 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 font-bold border-r border-slate-200"
                            title="Giảm 0.5 phút"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="120.0"
                            value={currentVal}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v)) {
                                handleDurationChange(currentCellKey, phase.code, v);
                              }
                            }}
                            className="w-16 h-8 text-center font-bold text-slate-900 font-mono text-xs focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={() => handleDurationChange(currentCellKey, phase.code, Math.min(120.0, currentVal + 0.5))}
                            className="w-7 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 font-bold border-l border-slate-200"
                            title="Tăng 0.5 phút"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Gantt Preview Bar (30m Horizon) */}
                      <td className="py-2.5 px-3">
                        <div className="space-y-1">
                          <div className="h-4 bg-slate-100 border border-slate-200 relative overflow-hidden flex items-center">
                            {/* Grid marker ticks at 10m, 20m */}
                            <div className="absolute top-0 bottom-0 left-1/3 border-r border-slate-200 pointer-events-none" />
                            <div className="absolute top-0 bottom-0 left-2/3 border-r border-slate-200 pointer-events-none" />

                            {/* Gantt Fill Bar */}
                            <div
                              className={`h-full transition-none ${
                                activeTab === 'cell1'
                                  ? 'bg-sky-600 border-r border-sky-700'
                                  : 'bg-indigo-600 border-r border-indigo-700'
                              }`}
                              style={{ width: `${ganttPercent}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono">
                            <span className="font-bold text-slate-700">
                              {currentVal.toFixed(1)} phút
                            </span>
                            <span>
                              {ganttPercent >= 100 ? '100% (Khung 30m)' : `${ganttPercent.toFixed(0)}% trục 30m`}
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            <span>Dữ liệu được lưu vĩnh viễn vào backend/phase_durations.json và bảng dbo.Phase_Config.</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 text-xs font-mono font-semibold uppercase tracking-wider border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px disabled:opacity-50"
            >
              [Đóng]
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="h-9 px-4 text-xs font-mono font-bold uppercase tracking-wider inline-flex items-center gap-2 border border-sky-700 bg-sky-700 text-white hover:bg-sky-800 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px disabled:opacity-50 shadow-xs"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>[Lưu toàn bộ thời lượng]</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PhaseDurationModal;
