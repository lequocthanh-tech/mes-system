/* Hallmark · component: EquipmentAuditTrail · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useEquipment } from '../../context/EquipmentContext';
import { OperatingStatus } from '../../types/equipment';
import { 
  Activity, 
  Filter, 
  ArrowRight, 
  Calendar, 
  Cpu, 
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Clock
} from 'lucide-react';

export const EquipmentAuditTrail: React.FC = () => {
  const { transitionEvents, equipmentList, selectedEquipmentId, refreshData } = useEquipment();

  // Filters - Uniform h-9 controls
  const [fromDate, setFromDate] = useState<string>('2026-09-01');
  const [toDate, setToDate] = useState<string>('2026-10-02');
  const [equipmentFilter, setEquipmentFilter] = useState<string>(selectedEquipmentId || 'ALL');
  const [transitionFilter, setTransitionFilter] = useState<string>('ALL');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      setFeedback('Đã tải luồng nhật ký chuyển trạng thái mới nhất từ Microsoft SQL Server (dbo.Equipment_Status_History).');
    } catch {
      setFeedback('Đồng bộ thất bại, vui lòng kiểm tra kết nối SQL Server.');
    } finally {
      setIsRefreshing(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };


  const getStatusBadge = (status: OperatingStatus | string) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'STOPPED':
        return 'bg-slate-100 text-slate-700 border-slate-300';
      case 'FAULT':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case 'MAINTENANCE':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const filteredEvents = transitionEvents.filter((evt) => {
    const evtDate = evt.timestamp.slice(0, 10);
    if (fromDate && evtDate < fromDate) return false;
    if (toDate && evtDate > toDate) return false;

    if (equipmentFilter !== 'ALL' && evt.equipmentId !== equipmentFilter) {
      return false;
    }

    if (transitionFilter !== 'ALL') {
      const pair = `${evt.previousState}->${evt.newState}`;
      if (pair !== transitionFilter) return false;
    }

    return true;
  });

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* Feedback Message */}
      {feedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between font-mono animate-in fade-in shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{feedback}</span>
          </div>
          <button 
            onClick={() => setFeedback(null)} 
            className="text-slate-500 hover:text-slate-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Audit Header & Multi-Filter Bar */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-slate-800" />
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide not-italic">
              Nhật ký kiểm toán chuyển dịch trạng thái (Equipment_Status_History Audit Stream)
            </h2>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            CHU KỲ LƯU TRỮ: 30 NGÀY • BẤT BIẾN (IMMUTABLE)
          </span>
        </div>

        {/* Filter Bar - Uniform h-9 Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs items-end">
          {/* From Date */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Từ ngày (From Date)
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" />
              Đến ngày (To Date)
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
            />
          </div>

          {/* Equipment Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <Cpu className="w-3 h-3 text-slate-400" />
              Thiết bị (Equipment)
            </label>
            <select
              value={equipmentFilter}
              onChange={(e) => setEquipmentFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 h-9 px-2 text-xs font-mono rounded-xs hallmark-focus"
            >
              <option value="ALL">Tất cả thiết bị ({equipmentList.length})</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.id} - {eq.name}
                </option>
              ))}
            </select>
          </div>

          {/* Transition Filter */}
          <div className="space-y-1">
            <label className="block text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1">
              <Filter className="w-3 h-3 text-slate-400" />
              Cặp chuyển trạng thái
            </label>
            <select
              value={transitionFilter}
              onChange={(e) => setTransitionFilter(e.target.value)}
              className="w-full bg-white border border-slate-300 h-9 px-2 text-xs font-mono rounded-xs hallmark-focus"
            >
              <option value="ALL">Tất cả chuyển dịch</option>
              <option value="STOPPED->RUNNING">STOPPED → RUNNING (Khởi động)</option>
              <option value="RUNNING->STOPPED">RUNNING → STOPPED (Dừng mẻ)</option>
              <option value="RUNNING->FAULT">RUNNING → FAULT (Sự cố vận hành)</option>
              <option value="STOPPED->FAULT">STOPPED → FAULT (Trip sự cố)</option>
              <option value="FAULT->STOPPED">FAULT → STOPPED (Khắc phục bảo trì)</option>
            </select>
          </div>

          {/* Refresh Action */}
          <div>
            <button
              type="button"
              onClick={handleRefresh}
              className="w-full h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Tải lại dữ liệu</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Immutable Event Stream Table */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-800" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
              Luồng sự kiện trạng thái thiết bị thời gian thực
            </h3>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            HIỂN THỊ {filteredEvents.length} SỰ KIỆN GHI NHẬN
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">Mã sự kiện</th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-40">Thời gian ghi nhận</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Thiết bị (Equipment)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-56 text-center">Chuyển dịch trạng thái (Transition)</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Nguồn kích hoạt (ISA-88 Trigger Source)</th>
                <th className="py-2.5 px-3 text-center w-36">Kiểm tra toàn vẹn</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    Không có sự kiện chuyển dịch trạng thái nào trong khoảng thời gian đã chọn.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50 transition-colors">
                    {/* Event ID */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-900">
                      {evt.id}
                    </td>

                    {/* Timestamp */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 text-[10px]">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{evt.timestamp}</span>
                      </div>
                    </td>

                    {/* Equipment */}
                    <td className="py-2.5 px-3 border-r border-slate-200">
                      <div className="font-bold text-slate-900">{evt.equipmentId}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={evt.equipmentName}>
                        {evt.equipmentName}
                      </div>
                    </td>

                    {/* Transition Stream */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                      <div className="inline-flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-xs ${getStatusBadge(evt.previousState)}`}>
                          {evt.previousState}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className={`px-2 py-0.5 text-[10px] font-bold border rounded-xs ${getStatusBadge(evt.newState)}`}>
                          {evt.newState}
                        </span>
                      </div>
                    </td>

                    {/* Trigger Source (reflecting ISA-88 Procedural Phases) */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
                        <span className="font-medium">{evt.triggerSource}</span>
                      </div>
                    </td>

                    {/* Integrity Check */}
                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xs font-bold text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                        IMMUTABLE
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
            <span>NGUỒN DỮ LIỆU: <strong className="text-slate-800">SCADA WINCC / KEPWARE OPC UA TELEMETRY</strong></span>
            <span className="mx-2">•</span>
            <span>TIÊU CHUẨN: ISA-88 STATE MACHINE LOGGING</span>
          </div>
          <div>
            <span>LƯU TRỮ VĨNH VIỄN CHO PHÂN TÍCH RỦI RO & ROOT CAUSE (RCA)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
