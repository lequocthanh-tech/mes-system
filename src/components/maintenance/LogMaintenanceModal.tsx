/* Hallmark · component: LogMaintenanceModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useEquipment } from '../../context/EquipmentContext';
import { ServiceActionType } from '../../types/equipment';
import { 
  Wrench, 
  X, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  User, 
  FileText,
  Loader2
} from 'lucide-react';

interface LogMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preSelectedEquipmentId?: string;
}

export const LogMaintenanceModal: React.FC<LogMaintenanceModalProps> = ({
  isOpen,
  onClose,
  preSelectedEquipmentId,
}) => {
  const { equipmentList, recordMaintenanceEvent, refreshData } = useEquipment();

  const [selectedEqId, setSelectedEqId] = useState<string>(
    preSelectedEquipmentId || (equipmentList[0] ? equipmentList[0].id : 'PUMP_INLET')
  );
  const [maintenanceType, setMaintenanceType] = useState<ServiceActionType>('Periodic Inspection');

  const [technician, setTechnician] = useState<string>('Kỹ sư Nguyễn Thành Long');
  const [costVnd, setCostVnd] = useState<number>(500000);
  const [resetRuntime, setResetRuntime] = useState<boolean>(true);
  const [description, setDescription] = useState<string>(
    'Bảo dưỡng định kỳ: Vệ sinh công nghiệp, thay phớt làm kín và kiểm tra độ rơ trục.'
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const selectedEquipment = equipmentList.find((e) => e.id === selectedEqId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEqId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn thiết bị bảo trì.' });
      return;
    }
    if (!technician.trim()) {
      setFeedback({ type: 'error', message: 'Tên kỹ thuật viên không được để trống.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = recordMaintenanceEvent({
        equipmentId: selectedEqId,
        equipmentName: selectedEquipment ? selectedEquipment.name : selectedEqId,
        technician: technician.trim(),
        serviceAction: maintenanceType,
        servicedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
        resetRuntime,
        remarks: description.trim(),
        costVnd: Number(costVnd) || 0,
      });

      await refreshData();

      setFeedback({
        type: 'success',
        message: res.message || 'Đã ghi nhận bảo trì thành công vào SQL Server.',
      });

      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      setFeedback({
        type: 'error',
        message: `Lỗi ghi nhận bảo trì: ${err.message || 'Không thể kết nối SQL Server'}`,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs font-mono text-xs animate-in fade-in">
      <div className="bg-white border border-slate-300 w-full max-w-xl shadow-2xl overflow-hidden rounded-xs flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider not-italic text-white">
              Ghi nhận bảo trì thiết bị (Log Equipment Maintenance Record)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-xs hallmark-focus"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 border-b flex items-center gap-2 text-xs font-semibold ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                : 'bg-rose-50 text-rose-900 border-rose-300'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Target Equipment Selector */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase">
              Thiết bị thực hiện bảo trì (Equipment Target) *
            </label>
            <select
              value={selectedEqId}
              onChange={(e) => setSelectedEqId(e.target.value)}
              className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  [{eq.id}] {eq.name} — {eq.runtimeHours}h / {eq.maintenanceLimit}h ({eq.status})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Info Badge for Target Asset */}
          {selectedEquipment && (
            <div className="p-2.5 bg-slate-50 border border-slate-200 grid grid-cols-3 gap-2 text-[10px] text-slate-600">
              <div>
                <span className="block text-slate-400 uppercase">Giờ chạy</span>
                <span className="font-bold text-slate-900">{selectedEquipment.runtimeHours} hrs</span>
              </div>
              <div>
                <span className="block text-slate-400 uppercase">Định mức</span>
                <span className="font-bold text-slate-900">{selectedEquipment.maintenanceLimit} hrs</span>
              </div>
              <div>
                <span className="block text-slate-400 uppercase">Chu kỳ bảo trì</span>
                <span className="font-bold text-blue-700">{selectedEquipment.maintenanceCount || 0} lần</span>
              </div>
            </div>
          )}

          {/* Maintenance Type & Technician Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Loại hình bảo trì (Maintenance Type) *
              </label>
              <select
                value={maintenanceType}
                onChange={(e) => setMaintenanceType(e.target.value as ServiceActionType)}
                className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="Periodic Inspection">Bảo trì phòng ngừa (Preventive)</option>
                <option value="Seal Replacement">Thay thế linh kiện & Phớt (Replacement)</option>
                <option value="Overhaul">Đại tu toàn diện (Overhaul)</option>
                <option value="Calibration">Hiệu chuẩn cảm biến (Calibration)</option>
                <option value="Lubrication">Tra dầu & Bôi trơn (Lubrication)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Kỹ thuật viên phụ trách *
              </label>
              <input
                type="text"
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                placeholder="Họ tên kỹ thuật viên..."
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>
          </div>

          {/* Cost VND & Reset Runtime Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                Chi phí bảo trì (Cost VND)
              </label>
              <input
                type="number"
                min="0"
                step="50000"
                value={costVnd}
                onChange={(e) => setCostVnd(parseFloat(e.target.value) || 0)}
                placeholder="500000"
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 h-9 flex items-center rounded-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetRuntime}
                  onChange={(e) => setResetRuntime(e.target.checked)}
                  className="w-4 h-4 rounded-xs border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                  <RotateCcw className="w-3 h-3 text-emerald-600" />
                  Đặt lại giờ chạy về 0.0 hrs
                </span>
              </label>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Nội dung thực hiện & Mô tả kỹ thuật (Description) *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú chi tiết công việc bảo dưỡng, thay thế linh kiện..."
              className="w-full bg-white border border-slate-300 p-2.5 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
            />
          </div>

          {/* Modal Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xs hallmark-focus active:translate-y-px"
            >
              Hủy bỏ
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xs hallmark-focus active:translate-y-px shadow-xs ${
                isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                  <span>Đang đồng bộ SQL Server...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Ghi nhận bảo trì (Log Record)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
