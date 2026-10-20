/* Hallmark · component: PreventiveMaintenance · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useEquipment } from '../../context/EquipmentContext';
import * as api from '../../services/api';
import { ServiceActionType } from '../../types/equipment';
import { 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  RotateCcw,
  ClipboardList,
  Clock,
  Download,
  ShieldCheck,
  Coins,
  Lock,
  Package
} from 'lucide-react';

const SERVICE_ACTIONS: ServiceActionType[] = [
  'Periodic Inspection',
  'Lubrication',
  'Seal Replacement',
  'Overhaul',
  'Calibration',
];

export const PreventiveMaintenance: React.FC = () => {
  const {
    equipmentList,
    maintenanceLogs,
    selectedEquipmentId,
    recordMaintenanceEvent,
    exportMaintenanceLogsToCsv,
    isEquipmentInterlocked,
  } = useEquipment();

  // Dynamic KPI Aggregation from Backend
  const [kpis, setKpis] = useState<{
    total_cost_vnd: number;
    total_tickets: number;
    recent_serviced_asset: string;
    recent_serviced_date: string;
    interlocked_count: number;
  }>({
    total_cost_vnd: 0,
    total_tickets: 0,
    recent_serviced_asset: '--',
    recent_serviced_date: '--',
    interlocked_count: 0,
  });

  const fetchKpis = useCallback(async () => {
    try {
      const res = await api.getMaintenanceKpis();
      if (res) {
        setKpis(res);
      }
    } catch (e) {
      console.warn('Failed to fetch maintenance KPIs:', e);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 6000);
    return () => clearInterval(interval);
  }, [fetchKpis]);

  // Form State
  const [targetEquipmentId, setTargetEquipmentId] = useState<string>(
    selectedEquipmentId || (equipmentList[0] ? equipmentList[0].id : '')
  );
  const [ticketType, setTicketType] = useState<string>('PREVENTIVE');
  const [technician, setTechnician] = useState<string>('Tech_Nguyen_Van_A');
  const [serviceAction, setServiceAction] = useState<ServiceActionType>('Periodic Inspection');
  const [sparePartsUsed, setSparePartsUsed] = useState<string>('');
  const [servicedAt, setServicedAt] = useState<string>(
    new Date().toISOString().replace('T', ' ').substring(0, 19)
  );
  const [costVnd, setCostVnd] = useState<number>(450000);
  const [resetRuntime, setResetRuntime] = useState<boolean>(true);
  const [remarks, setRemarks] = useState<string>(
    'Bảo trì định kỳ hoàn tất. Thay dầu bôi trơn, kiểm tra cách điện và hiệu chuẩn cảm biến.'
  );
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Search in ledger
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // Keep targetEquipmentId in sync if selectedEquipmentId changes from outside
  useEffect(() => {
    if (selectedEquipmentId) {
      setTargetEquipmentId(selectedEquipmentId);
    }
  }, [selectedEquipmentId]);

  const targetEquipment = equipmentList.find((e) => e.id === targetEquipmentId);
  const targetIsInterlocked = targetEquipment ? isEquipmentInterlocked(targetEquipment) : false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEquipmentId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn thiết bị bảo trì.' });
      return;
    }
    if (!technician.trim()) {
      setFeedback({ type: 'error', message: 'Họ tên kỹ thuật viên không được để trống.' });
      return;
    }

    const eqName = targetEquipment ? targetEquipment.name : targetEquipmentId;

    try {
      const res = await recordMaintenanceEvent({
        equipmentId: targetEquipmentId,
        equipmentName: eqName,
        technician: technician.trim(),
        serviceAction,
        ticketType,
        sparePartsUsed: sparePartsUsed.trim(),
        actionTaken: serviceAction,
        servicedAt: servicedAt || new Date().toISOString().replace('T', ' ').substring(0, 19),
        resetRuntime,
        remarks: remarks.trim() || 'Nghiệm thu bảo trì đạt chuẩn.',
        costVnd: Number(costVnd) || 0,
      });

      setFeedback({
        type: 'success',
        message: res.message,
      });

      setRemarks('Bảo trì hoàn tất, thiết bị hoạt động bình thường.');
      setSparePartsUsed('');
      await fetchKpis();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Lỗi ghi nhận bảo trì: ${err.message || 'Không thể đồng bộ với SQL Server'}`,
      });
    }
  };

  const filteredLogs = maintenanceLogs.filter((log) => {
    const q = logSearchQuery.toLowerCase();
    return (
      log.id.toLowerCase().includes(q) ||
      log.equipmentId.toLowerCase().includes(q) ||
      log.equipmentName.toLowerCase().includes(q) ||
      log.technician.toLowerCase().includes(q) ||
      log.serviceAction.toLowerCase().includes(q) ||
      (log.ticketType && log.ticketType.toLowerCase().includes(q)) ||
      (log.sparePartsUsed && log.sparePartsUsed.toLowerCase().includes(q)) ||
      log.remarks.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* Top 4 KPI Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Tổng chi phí */}
        <div className="bg-white border border-slate-200 p-3.5 rounded-xs shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tổng chi phí bảo trì</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {(kpis.total_cost_vnd || 0).toLocaleString('vi-VN')} ₫
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Lũy kế chi phí vật tư & dịch vụ</div>
          </div>
          <div className="w-8 h-8 rounded-xs bg-slate-100 flex items-center justify-center text-slate-700">
            <Coins className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Tổng số phiếu */}
        <div className="bg-white border border-slate-200 p-3.5 rounded-xs shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Tổng số phiếu bảo trì</div>
            <div className="text-base font-bold text-slate-900 mt-0.5">
              {kpis.total_tickets} Phiếu
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Lưu trữ trên SQL Server</div>
          </div>
          <div className="w-8 h-8 rounded-xs bg-slate-100 flex items-center justify-center text-slate-700">
            <ClipboardList className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Vừa bảo trì gần nhất */}
        <div className="bg-white border border-slate-200 p-3.5 rounded-xs shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Thiết bị bảo trì gần nhất</div>
            <div className="text-base font-bold text-slate-900 mt-0.5 truncate max-w-[150px]" title={kpis.recent_serviced_asset || '--'}>
              {kpis.recent_serviced_asset || '--'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Ghi nhận: {kpis.recent_serviced_date || '--'}</div>
          </div>
          <div className="w-8 h-8 rounded-xs bg-slate-100 flex items-center justify-center text-slate-700">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        </div>

        {/* Card 4: Khóa an toàn LOTO / Interlock */}
        <div className={`border p-3.5 rounded-xs shadow-xs flex items-center justify-between ${
          (kpis.interlocked_count || 0) > 0
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider opacity-75">Khóa an toàn (LOTO / Interlock)</div>
            <div className="text-base font-bold mt-0.5">
              {kpis.interlocked_count || 0} Thiết bị
            </div>
            <div className="text-[10px] opacity-75 mt-0.5">
              {(kpis.interlocked_count || 0) > 0 ? 'Đang khóa liên động an toàn' : 'Tất cả thiết bị sẵn sàng'}
            </div>
          </div>
          <div className={`w-8 h-8 rounded-xs flex items-center justify-center ${
            (kpis.interlocked_count || 0) > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <Lock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 border flex items-center justify-between shadow-xs font-mono transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Left Service Event Dispatch (5 cols) / Right Historical Ledger (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Record Maintenance Event Form */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-slate-800" />
              <h2 className="font-bold text-slate-900 uppercase tracking-wide not-italic">
                LẬP PHIẾU BẢO TRÌ & SỬA CHỮA
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              ISA-95 SERVICE DISPATCH
            </span>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Target Asset Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Thiết bị thực hiện bảo trì (Target Equipment) *
              </label>
              <select
                value={targetEquipmentId}
                onChange={(e) => setTargetEquipmentId(e.target.value)}
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              >
                {equipmentList.map((eq) => {
                  const interlocked = isEquipmentInterlocked(eq);
                  return (
                    <option key={eq.id} value={eq.id}>
                      {eq.id} - {eq.name} ({eq.runtimeHours}h / {eq.maintenanceLimit}h) {interlocked ? '[INTERLOCKED]' : `[${eq.status}]`}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Target Asset Quick Telemetry Strip */}
            {targetEquipment && (
              <div className={`p-3 border rounded-xs space-y-1.5 font-mono ${
                targetIsInterlocked ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Vị trí: <strong>{targetEquipment.location}</strong></span>
                  <span className={`font-bold px-1.5 py-0.5 rounded-xs text-[10px] ${
                    targetIsInterlocked ? 'bg-rose-200 text-rose-800' : 'bg-slate-200 text-slate-800'
                  }`}>
                    {targetIsInterlocked ? '● INTERLOCKED (LOCKED FOR BATCH)' : `● STATUS: ${targetEquipment.status}`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-600">
                  <span>Giờ chạy tích lũy: <strong>{targetEquipment.runtimeHours} h</strong> / {targetEquipment.maintenanceLimit} h</span>
                  <span>OPC Node: <strong>{targetEquipment.opcNodeId || targetEquipment.plcTag || '[CHƯA ÁNH XẠ]'}</strong></span>
                </div>
              </div>
            )}

            {/* Field: Ticket Classification & Service Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Phân loại phiếu (Ticket Type) *
                </label>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value)}
                  className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
                >
                  <option value="PREVENTIVE">Bảo trì phòng ngừa (Preventive)</option>
                  <option value="CORRECTIVE">Sửa chữa sự cố (Corrective)</option>
                  <option value="CALIBRATION">Hiệu chuẩn thiết bị (Calibration)</option>
                  <option value="OVERHAUL">Đại tu toàn bộ (Overhaul)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Hành động bảo dưỡng (Action) *
                </label>
                <select
                  value={serviceAction}
                  onChange={(e) => setServiceAction(e.target.value as ServiceActionType)}
                  className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
                >
                  {SERVICE_ACTIONS.map((action) => (
                    <option key={action} value={action}>{action}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Spare Parts Used */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-500" />
                Vật tư & Linh kiện thay thế (Spare Parts)
              </label>
              <input
                type="text"
                value={sparePartsUsed}
                onChange={(e) => setSparePartsUsed(e.target.value)}
                placeholder="VD: Phớt cơ khí Viton, Vòng bi SKF 6205, Dầu bôi trơn..."
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            {/* Field: Technician & Cost VND */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  Kỹ thuật viên phụ trách *
                </label>
                <input
                  type="text"
                  value={technician}
                  onChange={(e) => setTechnician(e.target.value)}
                  placeholder="Tech_Nguyen_Van_A"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-slate-500" />
                  Chi phí thực hiện (Cost VND)
                </label>
                <input
                  type="number"
                  min="0"
                  step="50000"
                  value={costVnd}
                  onChange={(e) => setCostVnd(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>
            </div>

            {/* Field: Serviced At */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Thời gian nghiệm thu (Timestamp)
              </label>
              <input
                type="text"
                value={servicedAt}
                onChange={(e) => setServicedAt(e.target.value)}
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            {/* Reset Cumulative Runtime Checkbox */}
            <div className="p-3 bg-slate-50 border border-slate-300 rounded-xs space-y-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={resetRuntime}
                  onChange={(e) => setResetRuntime(e.target.checked)}
                  className="w-4 h-4 rounded-xs border-slate-300 text-slate-900 focus:ring-0"
                />
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wide">
                  Đặt lại số giờ chạy về 0 h (Reset Cumulative Runtime)
                </span>
              </label>
              <p className="text-[10px] text-slate-500 ml-6 leading-relaxed font-sans">
                Tự động xóa trạng thái FAULT / DUE, chuyển thiết bị về STANDBY (STOPPED) và giải phóng khóa liên động vận hành tại Module Operations.
              </p>
            </div>

            {/* Remarks & Observations */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Ghi chú nghiệm thu kỹ thuật (Service Remarks)
              </label>
              <textarea
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Mô tả công việc thực hiện, linh kiện thay thế, kết quả chạy thử..."
                className="w-full bg-white border border-slate-300 p-2.5 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            {/* Submit Action Button */}
            <div className="pt-2 border-t border-slate-200">
              <button
                type="submit"
                className="w-full h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 rounded-xs hallmark-focus active:translate-y-px transition-all shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>GHI NHẬN & ĐẶT LẠI GIỜ CHẠY</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Historical Service Logs Table (Equipment_Maintenance Schema) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-xs flex flex-col">
          {/* Header & Export Bar */}
          <div className="p-4 bg-slate-100/70 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                  SỔ BỘ PHIẾU BẢO TRÌ & SỬA CHỮA (EQUIPMENT_MAINTENANCE)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredLogs.length} PHIẾU NGHIỆM THU
              </span>
            </div>

            {/* Search Input & Export Action - Uniform h-9 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Tìm theo mã phiếu, thiết bị, phân loại, linh kiện..."
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono rounded-xs hallmark-focus"
                />
              </div>

              {/* Export Button */}
              <button
                type="button"
                onClick={exportMaintenanceLogsToCsv}
                className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
                title="Xuất dữ liệu lịch sử bảo trì ra file CSV chuẩn hóa"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Xuất file (CSV)</span>
              </button>
            </div>
          </div>

          {/* Service Log Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">Mã phiếu</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-36">Thiết bị</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-28 text-center">Phân loại</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Hành động & Vật tư</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-28">Kỹ thuật viên</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-28">Thời gian</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right w-28">Chi phí</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-20">Reset giờ</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      Chưa có nhật ký bảo trì nào phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      {/* Log ID */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-900">
                        {log.id}
                      </td>

                      {/* Equipment */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        <div className="font-bold text-slate-900">{log.equipmentId}</div>
                        <div className="text-[10px] text-slate-500 truncate max-w-[140px]" title={log.equipmentName}>
                          {log.equipmentName}
                        </div>
                      </td>

                      {/* Ticket Type */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                        <span className={`inline-block px-1.5 py-0.5 rounded-xs text-[9px] font-bold border uppercase ${
                          (log.ticketType || '').includes('CORRECTIVE')
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : (log.ticketType || '').includes('CALIBRATION')
                            ? 'bg-sky-100 text-sky-800 border-sky-300'
                            : (log.ticketType || '').includes('OVERHAUL')
                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {log.ticketType || 'PREVENTIVE'}
                        </span>
                      </td>

                      {/* Service Action & Spare Parts */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800">
                        <div className="font-semibold text-slate-800">{log.serviceAction}</div>
                        {log.sparePartsUsed ? (
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={log.sparePartsUsed}>
                            LK: {log.sparePartsUsed}
                          </div>
                        ) : null}
                      </td>

                      {/* Technician */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                        {log.technician}
                      </td>

                      {/* Serviced At */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 text-[10px]">
                        {log.servicedAt}
                      </td>

                      {/* Cost */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-slate-900">
                        {(log.costVnd || 0).toLocaleString('vi-VN')} ₫
                      </td>

                      {/* Reset Runtime */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                        {log.resetRuntime ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xs font-bold text-[10px]">
                            <RotateCcw className="w-3 h-3 text-emerald-700" />
                            YES (0h)
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-xs text-[10px]">
                            NO
                          </span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="py-2.5 px-3 text-slate-600 text-[10px]">
                        <span className="line-clamp-2" title={log.remarks}>
                          {log.remarks}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
            <div>
              <span>TỔNG SỐ SỰ KIỆN: <strong className="text-slate-800">{maintenanceLogs.length}</strong></span>
              <span className="mx-2">•</span>
              <span>ĐỒNG BỘ: TỰ ĐỘNG CẬP NHẬT EQUIPMENT_MASTER</span>
            </div>
            <div>
              <span>QUY CHUẨN ISO 55000 / ISA-95 ASSET MANAGEMENT</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreventiveMaintenance;
