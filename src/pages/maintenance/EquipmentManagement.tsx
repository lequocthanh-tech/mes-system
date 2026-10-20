/* Hallmark · component: EquipmentManagement · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useEquipment } from '../../context/EquipmentContext';
import { useGatewayStatus } from '../../context/ConfigContext';
import * as api from '../../services/api';
import { 
  EquipmentType, 
  EquipmentLocation, 
  EquipmentPerformanceItem 
} from '../../types/equipment';
import { SensorMappingModal } from '../../components/maintenance/SensorMappingModal';
import { 
  Cpu, 
  Search, 
  Plus, 
  Save, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Settings2, 
  RefreshCw,
  Sliders,
  ShieldCheck,
  AlertOctagon,
  Wrench
} from 'lucide-react';

export interface EquipmentManagementProps {
  onDispatchToPreventive?: (eqCode: string) => void;
}

const EQUIPMENT_TYPES: EquipmentType[] = [
  'Centrifugal Pump',
  'Mixing Motor',
  'Heat Exchanger',
  'Valve',
  'Chiller',
  'Dosing Pump',
  'Mixing Agitator',
  'Heating Resistor',
  'Chilling Unit',
  'Solenoid Valve',
  'RTD Sensor',
];

const LOCATIONS: EquipmentLocation[] = [
  'Line 1 - Mixing Unit',
  'Line 2 - Sterilize Unit',
  'Utility Area',
];

export const EquipmentManagement: React.FC<EquipmentManagementProps> = ({ onDispatchToPreventive }) => {
  const { user } = useAuth();
  const isAdmin = (user?.role?.toUpperCase() === 'ADMIN') || (user?.username?.toLowerCase() === 'admin');

  const {
    equipmentList,
    selectedEquipmentId,
    selectEquipment,
    refreshData,
    isLoading: isContextLoading
  } = useEquipment();
  const { isGatewayOnline } = useGatewayStatus();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Live Performance Telemetry State (ISO 10816 / Kepware)
  const [performanceMap, setPerformanceMap] = useState<Record<string, EquipmentPerformanceItem>>({});
  const [isPerfLoading, setIsPerfLoading] = useState<boolean>(false);

  // Sensor Mapping Modal State
  const [mappingModalOpen, setMappingModalOpen] = useState<boolean>(false);
  const [mappingTargetCode, setMappingTargetCode] = useState<string>('');
  const [mappingTargetName, setMappingTargetName] = useState<string>('');

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [deleteTargetCode, setDeleteTargetCode] = useState<string>('');
  const [deleteTargetName, setDeleteTargetName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Form State (New entry mode vs Edit existing mode)
  const [isNewEntryMode, setIsNewEntryMode] = useState<boolean>(false);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<EquipmentType>('Centrifugal Pump');
  const [formLocation, setFormLocation] = useState<EquipmentLocation>('Line 1 - Mixing Unit');
  const [formMaintenanceLimit, setFormMaintenanceLimit] = useState<number>(500);
  const [formRatedCurrent, setFormRatedCurrent] = useState<number>(10.0);
  const [formMaxVib, setFormMaxVib] = useState<number>(4.5);
  const [formMaxTemp, setFormMaxTemp] = useState<number>(75.0);
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // User-facing Toast Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Fetch Live Equipment Performance & Telemetry (every 3000ms)
  const fetchPerformance = useCallback(async () => {
    try {
      setIsPerfLoading(true);
      const res = await api.getEquipmentPerformance();
      if (res && res.data) {
        const pMap: Record<string, EquipmentPerformanceItem> = {};
        res.data.forEach((item: EquipmentPerformanceItem) => {
          pMap[item.equipment_code.toUpperCase()] = item;
        });
        setPerformanceMap(pMap);
      }
    } catch (err) {
      console.warn('[EquipmentManagement] Live performance fetch notice:', err);
    } finally {
      setIsPerfLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPerformance();
    const interval = setInterval(fetchPerformance, 3000);
    return () => clearInterval(interval);
  }, [fetchPerformance]);

  // Synchronize Form with Selected Equipment from Context or Performance Map
  useEffect(() => {
    if (isNewEntryMode) return;

    const currentEq = equipmentList.find((e) => e.id === selectedEquipmentId) || equipmentList[0];
    if (currentEq) {
      setFormCode(currentEq.id);
      setFormName(currentEq.name);
      setFormType(currentEq.type);
      setFormLocation(currentEq.location);
      setFormMaintenanceLimit(currentEq.maintenanceLimit || 500);
      setFormRatedCurrent(currentEq.ratedCurrent || (currentEq as any).rated_current || 10.0);
      setFormMaxVib(currentEq.maxVibrationThreshold || (currentEq as any).max_vibration || 4.5);
      setFormMaxTemp(currentEq.maxTempThreshold || (currentEq as any).max_temp || 75.0);
      setFormNotes(currentEq.notes || '');
    }
  }, [selectedEquipmentId, equipmentList, isNewEntryMode]);

  // Handle Switching to [+ THÊM THIẾT BỊ] Mode
  const handleAddNewMode = () => {
    setIsNewEntryMode(true);
    selectEquipment(null);
    setFormCode('M-' + (equipmentList.length + 101));
    setFormName('');
    setFormType('Centrifugal Pump');
    setFormLocation('Line 1 - Mixing Unit');
    setFormMaintenanceLimit(500);
    setFormRatedCurrent(10.0);
    setFormMaxVib(4.5);
    setFormMaxTemp(75.0);
    setFormNotes('');
    showToast('Chuyển sang chế độ đăng ký thiết bị mới. Vui lòng nhập thông số và nhấn Lưu.', 'warning');
  };

  // Handle Row Selection in Table
  const handleSelectEquipment = (eqCode: string) => {
    setIsNewEntryMode(false);
    selectEquipment(eqCode);
  };

  // Handle Form Submit: Add New OR Update Existing
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Yêu cầu quyền Administrator (RBAC) để thêm hoặc cập nhật thiết bị!', 'error');
      return;
    }

    if (!formCode.trim() || !formName.trim()) {
      showToast('Mã thiết bị và Tên thiết bị không được để trống!', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isNewEntryMode) {
        // Create new equipment
        const res = await api.createEquipment({
          equipment_code: formCode.trim().toUpperCase(),
          equipment_name: formName.trim(),
          equipment_type: formType,
          location: formLocation,
          maintenance_limit: Number(formMaintenanceLimit) || 500,
          rated_current: Number(formRatedCurrent) || 10.0,
          max_vibration: Number(formMaxVib) || 4.5,
          max_temp: Number(formMaxTemp) || 75.0,
          notes: formNotes.trim(),
          user: user?.username || 'admin',
          role: user?.role || 'ADMIN',
        });
        showToast(res.message || `Đã đăng ký thiết bị [${formCode.toUpperCase()}] thành công!`, 'success');
        setIsNewEntryMode(false);
        selectEquipment(formCode.trim().toUpperCase());
      } else {
        // Update existing equipment
        const res = await api.updateEquipmentDetails(formCode.trim().toUpperCase(), {
          equipment_name: formName.trim(),
          equipment_type: formType,
          location: formLocation,
          maintenance_limit: Number(formMaintenanceLimit) || 500,
          rated_current: Number(formRatedCurrent) || 10.0,
          max_vibration: Number(formMaxVib) || 4.5,
          max_temp: Number(formMaxTemp) || 75.0,
          notes: formNotes.trim(),
          user: user?.username || 'admin',
          role: user?.role || 'ADMIN',
        });
        showToast(res.message || `Đã cập nhật thông tin thiết bị [${formCode.toUpperCase()}] thành công!`, 'success');
      }

      await refreshData();
      await fetchPerformance();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu thông tin thiết bị.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Modal with Safety Interlock Check
  const handleOpenDeleteModal = () => {
    if (!isAdmin) {
      showToast('Yêu cầu quyền Administrator để xóa thiết bị!', 'error');
      return;
    }

    const currentCode = formCode.trim().toUpperCase();
    const perf = performanceMap[currentCode];
    const isRunning = (perf?.current_status === 'RUNNING') || (perf?.status === 'RUNNING');

    if (isRunning) {
      showToast(`Không thể xóa thiết bị [${currentCode}]: Thiết bị đang hoạt động (RUNNING). Vui lòng dừng thiết bị trước!`, 'error');
      return;
    }

    setDeleteTargetCode(currentCode);
    setDeleteTargetName(formName || currentCode);
    setDeleteModalOpen(true);
  };

  // Confirm Delete Action
  const handleConfirmDelete = async () => {
    if (!deleteTargetCode) return;
    setIsDeleting(true);
    try {
      const res = await api.deleteEquipment(
        deleteTargetCode,
        user?.username || 'admin',
        user?.role || 'ADMIN'
      );
      showToast(res.message || `Đã xóa thiết bị [${deleteTargetCode}] thành công.`, 'success');
      setDeleteModalOpen(false);
      setIsNewEntryMode(false);
      selectEquipment(null);
      await refreshData();
      await fetchPerformance();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa thiết bị.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open Sensor Mapping Modal for Given Equipment
  const handleOpenSensorMapping = (eqCode?: string, eqName?: string) => {
    const targetCode = eqCode || formCode.trim().toUpperCase();
    const targetName = eqName || formName || targetCode;
    if (!targetCode) {
      showToast('Vui lòng chọn thiết bị để cấu hình cảm biến!', 'warning');
      return;
    }
    setMappingTargetCode(targetCode);
    setMappingTargetName(targetName);
    setMappingModalOpen(true);
  };

  // Toggle Equipment Maintenance (LOTO Safety Lockout) Status
  const handleToggleLotoStatus = async (eqCode: string, currentStatus: string) => {
    if (!isAdmin) {
      showToast('Yêu cầu quyền Administrator để thao tác chuyển trạng thái LOTO!', 'error');
      return;
    }
    const targetStatus = currentStatus === 'MAINTENANCE' ? 'STOPPED' : 'MAINTENANCE';
    try {
      await api.toggleEquipmentMaintenanceStatus(
        eqCode,
        targetStatus,
        targetStatus === 'MAINTENANCE' ? 'Lockout / Tagout (LOTO) kích hoạt cho bảo trì' : 'Mở khóa an toàn (Release LOTO)',
        user?.username || 'admin'
      );
      showToast(`Đã chuyển thiết bị [${eqCode}] sang ${targetStatus === 'MAINTENANCE' ? 'BẢO TRÌ (LOTO)' : 'STANDBY (STOPPED)'}`, 'success');
      await refreshData();
      await fetchPerformance();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái LOTO.', 'error');
    }
  };

  // Filtered Equipment List
  const filteredEquipment = useMemo(() => {
    return equipmentList.filter((eq) => {
      const matchesSearch =
        eq.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        eq.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLocation =
        locationFilter === 'ALL' || eq.location === locationFilter;
      const perf = performanceMap[eq.id.toUpperCase()];
      const effectiveStatus = perf?.current_status || eq.status;
      const matchesStatus =
        statusFilter === 'ALL' || effectiveStatus === statusFilter;
      return matchesSearch && matchesLocation && matchesStatus;
    });
  }, [equipmentList, searchQuery, locationFilter, statusFilter, performanceMap]);

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`border px-4 py-3 text-xs flex items-center justify-between shadow-xs font-mono animate-in fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : toastMessage.type === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />}
            <span className="font-semibold">{toastMessage.text}</span>
          </div>
          <button 
            type="button"
            onClick={() => setToastMessage(null)} 
            className="text-slate-500 hover:text-slate-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER: TITLE & TELEMETRY CONTROLS */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Cpu className="w-5 h-5 text-slate-800" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide not-italic">
              Quản lý tài sản & Vận hành thiết bị (Asset Lifecycle & Performance Hub)
            </h2>
            <p className="text-[11px] text-slate-500 font-normal">
              ISA-95 Level 3 MOM · ISO 10816 Vibration Severity, Real-Time Health Index & Live Sensor Mapping
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 px-3 h-9 bg-slate-50 border border-slate-300 rounded-xs text-[11px] font-mono text-slate-800 shadow-xs">
            {isGatewayOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse shrink-0 inline-block" />
                <span className="font-bold tracking-tight text-emerald-800">ISO 10816 TELEMETRY STREAM · ACTIVE</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0 inline-block" />
                <span className="font-bold tracking-tight text-rose-800">GATEWAY DISCONNECTED · OFFLINE</span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              refreshData();
              fetchPerformance();
              showToast('Đã đồng bộ dữ liệu thiết bị và telemetry thời gian thực.', 'success');
            }}
            disabled={isContextLoading || isPerfLoading}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${(isContextLoading || isPerfLoading) ? 'animate-spin text-sky-600' : ''}`} />
            <span>LÀM MỚI DỮ LIỆU</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKBENCH LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: EQUIPMENT CONFIGURATION SIDEBAR FORM (4 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 bg-white border border-slate-200 shadow-xs p-4 rounded-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700" />
              <h3 className="font-bold text-slate-900 uppercase tracking-wide text-xs not-italic">
                HIỆU CHỈNH THIẾT BỊ / EQUIPMENT CONFIG
              </h3>
            </div>
            <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-xs border ${
              isNewEntryMode 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                : 'bg-slate-100 text-slate-700 border-slate-300'
            }`}>
              {isNewEntryMode ? 'CHẾ ĐỘ TẠO MỚI' : `ĐANG CHỌN: ${formCode}`}
            </span>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-3">
            {/* Mã thiết bị */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Mã thiết bị (Equipment Code) *
              </label>
              <input
                type="text"
                required
                disabled={!isNewEntryMode}
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="M-101 / PUMP_INLET"
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono font-bold uppercase rounded-xs hallmark-focus disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
              />
            </div>

            {/* Tên thiết bị */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Tên thiết bị (Equipment Name) *
              </label>
              <input
                type="text"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Mô tơ cánh khuấy bồn trộn M201"
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono rounded-xs hallmark-focus"
              />
            </div>

            {/* Loại thiết bị & Vị trí */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Loại thiết bị
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as EquipmentType)}
                  className="w-full bg-white border border-slate-300 h-9 px-2 text-xs font-mono rounded-xs hallmark-focus"
                >
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Vị trí / Phân xưởng
                </label>
                <select
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value as EquipmentLocation)}
                  className="w-full bg-white border border-slate-300 h-9 px-2 text-xs font-mono rounded-xs hallmark-focus"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Giới hạn bảo trì (h) & Dòng điện định mức (A) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Giới hạn bảo trì (h)
                </label>
                <input
                  type="number"
                  min="10"
                  step="10"
                  value={formMaintenanceLimit}
                  onChange={(e) => setFormMaintenanceLimit(parseFloat(e.target.value) || 0)}
                  placeholder="500.0"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Dòng định mức (A)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={formRatedCurrent}
                  onChange={(e) => setFormRatedCurrent(parseFloat(e.target.value) || 0)}
                  placeholder="10.0"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus font-bold"
                />
              </div>
            </div>

            {/* Ngưỡng rung tối đa (mm/s) & Ngưỡng nhiệt độ tối đa (°C) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Ngưỡng Rung Max (mm/s)
                </label>
                <input
                  type="number"
                  min="0.5"
                  step="0.1"
                  value={formMaxVib}
                  onChange={(e) => setFormMaxVib(parseFloat(e.target.value) || 0)}
                  placeholder="4.5"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Nhiệt độ Max (°C)
                </label>
                <input
                  type="number"
                  min="20"
                  step="1"
                  value={formMaxTemp}
                  onChange={(e) => setFormMaxTemp(parseFloat(e.target.value) || 0)}
                  placeholder="75.0"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus"
                />
              </div>
            </div>

            {/* Ghi chú kỹ thuật */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase">
                Ghi chú kỹ thuật
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Động cơ truyền động chính, kiểm tra định kỳ 500 giờ chạy..."
                className="w-full bg-white border border-slate-300 p-2 text-xs font-mono rounded-xs hallmark-focus"
              />
            </div>

            {/* ACTION BUTTONS SUITE (Strict Uniform h-9 Buttons) */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {/* [+ THÊM THIẾT BỊ] (Emerald Solid) */}
                <button
                  type="button"
                  onClick={handleAddNewMode}
                  className="h-9 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs hallmark-focus shadow-xs active:translate-y-px transition-all"
                  title="Chuyển sang chế độ nhập mới thiết bị"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ THÊM MỚI</span>
                </button>

                {/* [💾 CẬP NHẬT / LƯU] (Slate Solid) */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9 px-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs hallmark-focus shadow-xs active:translate-y-px transition-all"
                  title={isNewEntryMode ? "Lưu đăng ký thiết bị mới vào SQL Server" : "Lưu cập nhật thông số thiết bị"}
                >
                  <Save className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                  <span>{isNewEntryMode ? 'LƯU TẠO MỚI' : '💾 CẬP NHẬT'}</span>
                </button>
              </div>

              {/* [CẤU HÌNH SENSOR THIẾT BỊ] (Sky Solid) */}
              <button
                type="button"
                onClick={() => handleOpenSensorMapping()}
                className="w-full h-9 px-3 bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-xs hallmark-focus shadow-xs active:translate-y-px transition-all"
                title="Mở bảng cấu hình Node ID OPC UA cho các cảm biến của thiết bị này"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>CẤU HÌNH SENSOR THIẾT BỊ</span>
              </button>

              {/* LOTO TOGGLE & CREATE TICKET ACTIONS (Available for existing equipment) */}
              {!isNewEntryMode && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const code = formCode.trim().toUpperCase();
                      const curStat = performanceMap[code]?.current_status || 'STOPPED';
                      handleToggleLotoStatus(code, curStat);
                    }}
                    className={`h-9 px-2 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs hallmark-focus shadow-xs active:translate-y-px transition-all ${
                      (performanceMap[formCode.trim().toUpperCase()]?.current_status === 'MAINTENANCE')
                        ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                    }`}
                    title="Chuyển đổi trạng thái LOTO (Khóa an toàn để bảo trì)"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>
                      {performanceMap[formCode.trim().toUpperCase()]?.current_status === 'MAINTENANCE' ? 'MỞ LOTO' : 'KHÓA LOTO'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const code = formCode.trim().toUpperCase();
                      if (onDispatchToPreventive) {
                        onDispatchToPreventive(code);
                      } else {
                        showToast(`Chuyển sang lập phiếu bảo trì cho [${code}]`, 'info' as any);
                      }
                    }}
                    className="h-9 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs hallmark-focus shadow-xs active:translate-y-px transition-all"
                    title="Chuyển sang Tab 2 để lập phiếu công tác bảo trì / sửa chữa"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    <span>TẠO PHIẾU SC</span>
                  </button>
                </div>
              )}

              {/* [🗑️ XÓA THIẾT BỊ] (Rose Outline) */}
              {!isNewEntryMode && (
                <button
                  type="button"
                  onClick={handleOpenDeleteModal}
                  disabled={performanceMap[formCode.trim().toUpperCase()]?.current_status === 'RUNNING'}
                  className="w-full h-9 px-3 bg-white hover:bg-rose-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed border border-rose-300 text-rose-600 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-xs hallmark-focus shadow-xs active:translate-y-px transition-all"
                  title="Xóa thiết bị khỏi hệ thống (Yêu cầu thiết bị ở trạng thái STOP)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>🗑️ XÓA THIẾT BỊ</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: EQUIPMENT LEDGER TABLE WITH LIVE PERFORMANCE (8 Cols) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-8 bg-white border border-slate-200 shadow-xs rounded-xs flex flex-col space-y-0 overflow-hidden">
          {/* Table Toolbar & Filters */}
          <div className="p-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã hoặc tên thiết bị..."
                className="w-full max-w-xs bg-white border border-slate-300 h-8 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="bg-white border border-slate-300 h-8 px-2 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="ALL">Tất cả phân xưởng</option>
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>{loc}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-300 h-8 px-2 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="RUNNING">RUNNING (Đang chạy)</option>
                <option value="STOPPED">STOPPED (Dừng)</option>
                <option value="FAULT">FAULT (Lỗi)</option>
                <option value="MAINTENANCE">MAINTENANCE (Bảo trì)</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                  <th className="px-3 py-2.5 border-r border-slate-200 w-28">Mã Thiết Bị</th>
                  <th className="px-3 py-2.5 border-r border-slate-200">Tên & Cụm</th>
                  <th className="px-3 py-2.5 border-r border-slate-200 w-28">Loại</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-200 text-center w-24">Trạng Thái</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-200 text-right w-28">Tải Vận Hành</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-200 text-center w-32">Sức Khỏe (HI %)</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-200 text-right w-36">Giờ Chạy / Định Mức</th>
                  <th className="px-2.5 py-2.5 border-r border-slate-200 text-center w-36">Độ Rung & Temp</th>
                  <th className="px-2 py-2.5 border-r border-slate-200 text-center w-20">Khóa LĐ</th>
                  <th className="px-2 py-2.5 text-center w-40">Tác Vụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-slate-400">
                      Không tìm thấy thiết bị nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                ) : (
                  filteredEquipment.map((eq) => {
                    const perf = performanceMap[eq.id.toUpperCase()];
                    const currentStatus = perf?.current_status || eq.status;
                    const isSelected = eq.id === selectedEquipmentId;

                    // Metrics
                    const isValve = perf?.is_valve !== undefined ? perf.is_valve : (eq.id.startsWith('VALVE_') || eq.type.toLowerCase().includes('valve'));
                    const isMapped = perf?.is_mapped !== undefined ? perf.is_mapped : false;
                    const valveState = perf?.valve_state || '--';
                    const loadPct = perf?.load_percent !== undefined ? perf.load_percent : 0.0;
                    const actCurr = perf?.actual_current !== undefined ? perf.actual_current : 0.0;
                    const healthIdx = perf?.health_index !== undefined ? perf.health_index : (eq.healthRatio || 100);
                    const vibRms = perf?.vibration_rms !== undefined ? perf.vibration_rms : 0.0;
                    const vibSeverity = perf?.vibration_severity || (isMapped ? 'GOOD' : 'UNMAPPED');
                    const tempAct = perf?.temperature !== undefined ? perf.temperature : 0.0;
                    const isInterlocked = perf?.is_interlocked !== undefined ? perf.is_interlocked : Boolean(eq.isInterlocked);
                    const rulHrs = perf?.rul_hours !== undefined ? perf.rul_hours : Math.max(0, eq.maintenanceLimit - eq.runtimeHours);

                    // Health Color
                    const healthColor =
                      healthIdx > 85 ? 'bg-emerald-600' : healthIdx >= 60 ? 'bg-amber-500' : 'bg-rose-600';

                    // Load Color
                    const loadBadgeColor =
                      loadPct > 105 ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      loadPct > 90 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-slate-100 text-slate-800 border-slate-200';

                    return (
                      <tr
                        key={eq.id}
                        onClick={() => handleSelectEquipment(eq.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-sky-50/70 border-l-2 border-l-sky-600' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* 1. Mã Thiết Bị */}
                        <td className="px-3 py-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                          {eq.id}
                        </td>

                        {/* 2. Tên & Cụm */}
                        <td className="px-3 py-2 border-r border-slate-200">
                          <div className="font-bold text-slate-900 truncate max-w-[160px]" title={eq.name}>
                            {eq.name}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[160px]">
                            {eq.location}
                          </div>
                        </td>

                        {/* 3. Loại */}
                        <td className="px-3 py-2 border-r border-slate-200 font-sans text-slate-600 truncate max-w-[110px]">
                          {eq.type}
                        </td>

                        {/* 4. Trạng Thái */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center">
                          <span className={`inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold border rounded-xs ${
                            currentStatus === 'RUNNING' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                            currentStatus === 'FAULT' ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse' :
                            currentStatus === 'MAINTENANCE' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {currentStatus === 'MAINTENANCE' ? '● BẢO TRÌ (LOTO)' :
                             currentStatus === 'RUNNING' ? '● RUNNING' :
                             currentStatus === 'FAULT' ? '● FAULT' : '● STOPPED'}
                          </span>
                        </td>

                        {/* 5. Tải Vận Hành (% Load / Valve State) */}
                        <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono">
                          {isValve ? (
                            isMapped && valveState !== '--' ? (
                              <span className={`inline-block px-1.5 py-0.5 text-[9px] font-bold border rounded-xs ${
                                valveState === 'OPEN' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'
                              }`}>
                                {valveState === 'OPEN' ? 'MỞ (OPEN)' : 'ĐÓNG (CLOSED)'}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">-- State</span>
                            )
                          ) : !isMapped ? (
                            <span className="inline-block px-1.5 py-0.5 text-[9px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 rounded-xs">
                              [CHƯA ÁNH XẠ]
                            </span>
                          ) : (
                            <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold border rounded-xs ${loadBadgeColor}`}>
                              {loadPct.toFixed(1)}% · {actCurr.toFixed(1)}A
                            </span>
                          )}
                        </td>

                        {/* 6. Sức Khỏe (Health Index %) */}
                        <td className="px-2.5 py-2 border-r border-slate-200">
                          <div className="flex items-center gap-1.5 justify-center font-mono">
                            <div className="w-16 h-2.5 bg-slate-200 rounded-xs overflow-hidden border border-slate-300">
                              <div
                                className={`h-full ${healthColor} transition-all duration-300`}
                                style={{ width: `${healthIdx}%` }}
                              />
                            </div>
                            <span className="font-bold text-[10px] text-slate-800 w-9 text-right">
                              {healthIdx.toFixed(0)}%
                            </span>
                          </div>
                        </td>

                        {/* 7. Giờ Chạy Lũy Kế / Định Mức */}
                        <td className="px-2.5 py-2 border-r border-slate-200 text-right font-mono text-[10px]">
                          <span className="font-bold text-slate-900">{eq.runtimeHours.toFixed(1)}h</span>
                          <span className="text-slate-400"> / {eq.maintenanceLimit.toFixed(0)}h</span>
                          <div className="text-[9px] text-slate-500">RUL: {rulHrs.toFixed(0)}h</div>
                        </td>

                        {/* 8. Độ Rung & Nhiệt Độ PV */}
                        <td className="px-2.5 py-2 border-r border-slate-200 text-center font-mono text-[10px]">
                          {isValve ? (
                            <span className="text-slate-400">-- mm/s | -- °C</span>
                          ) : !isMapped ? (
                            <div className="text-slate-400">
                              <div>-- mm/s | -- °C</div>
                              <span className="text-[8px] text-slate-400">[CHƯA CẤU HÌNH]</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center justify-center gap-1">
                                <span className="font-bold text-slate-800">{vibRms.toFixed(1)} mm/s</span>
                                <span className={`px-1 text-[8px] font-bold rounded-2xs border ${
                                  vibSeverity === 'CRITICAL' ? 'bg-rose-500 text-white border-rose-600' :
                                  vibSeverity === 'WARNING' ? 'bg-amber-500 text-white border-amber-600' :
                                  'bg-emerald-100 text-emerald-800 border-emerald-300'
                                }`}>
                                  {vibSeverity}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-500">
                                {tempAct.toFixed(1)}°C
                              </div>
                            </>
                          )}
                        </td>

                        {/* 9. Khóa Liên Động */}
                        <td className="px-2 py-2 border-r border-slate-200 text-center">
                          {isInterlocked ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-rose-50 border border-rose-300 text-rose-700 text-[9px] font-bold rounded-xs" title="Thiết bị bị khóa liên động an toàn">
                              <Lock className="w-2.5 h-2.5 text-rose-600" />
                              LOCK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-700 text-[9px] font-bold rounded-xs" title="Thiết bị sẵn sàng vận hành">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                              OK
                            </span>
                          )}
                        </td>

                        {/* 10. Hành Động */}
                        <td className="px-1.5 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenSensorMapping(eq.id, eq.name)}
                              className="h-7 px-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-[10px] font-mono font-bold flex items-center justify-center gap-0.5 rounded-xs transition-all hallmark-focus shadow-xs"
                              title={`Cấu hình ánh xạ cảm biến OPC UA cho [${eq.id}]`}
                            >
                              <Settings2 className="w-3 h-3 text-slate-600" />
                              <span className="hidden sm:inline">Sensor</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleLotoStatus(eq.id, currentStatus)}
                              className={`h-7 px-1.5 text-[10px] font-mono font-bold flex items-center justify-center gap-0.5 rounded-xs transition-all hallmark-focus shadow-xs border ${
                                currentStatus === 'MAINTENANCE'
                                  ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                                  : 'bg-white hover:bg-amber-50 text-slate-700 border-slate-300'
                              }`}
                              title={currentStatus === 'MAINTENANCE' ? `Mở khóa LOTO cho [${eq.id}]` : `Khóa LOTO an toàn bảo trì cho [${eq.id}]`}
                            >
                              <Lock className="w-3 h-3 text-amber-600" />
                              <span>{currentStatus === 'MAINTENANCE' ? 'Mở' : 'LOTO'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onDispatchToPreventive?.(eq.id)}
                              className="h-7 px-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-mono font-bold flex items-center justify-center gap-0.5 rounded-xs transition-all hallmark-focus shadow-xs"
                              title={`Lập phiếu bảo trì cho [${eq.id}]`}
                            >
                              <Wrench className="w-3 h-3 text-indigo-600" />
                              <span>Phiếu</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SENSOR MAPPING MODAL INTEGRATION */}
      <SensorMappingModal
        isOpen={mappingModalOpen}
        onClose={() => setMappingModalOpen(false)}
        equipmentCode={mappingTargetCode}
        equipmentName={mappingTargetName}
        onSaved={() => {
          showToast(`Đã cập nhật ánh xạ cảm biến cho thiết bị [${mappingTargetCode}] thành công!`, 'success');
          fetchPerformance();
        }}
      />

      {/* HIGH-CONTRAST DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-rose-300 shadow-2xl w-full max-w-md rounded-xs overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800">
                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0" />
                <h3 className="font-bold text-xs uppercase tracking-wide">
                  XÁC NHẬN XÓA THIẾT BỊ / SAFETY INTERLOCK
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-800 font-bold px-1 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 font-mono text-xs">
              <p className="text-slate-800 font-semibold">
                Bạn có chắc chắn muốn xóa vĩnh viễn thiết bị <span className="bg-rose-100 px-1.5 py-0.5 text-rose-900 font-bold rounded-2xs">[{deleteTargetCode}]</span> - {deleteTargetName}?
              </p>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-xs text-[11px] text-slate-600 space-y-1">
                <p>• Dữ liệu thiết bị trong <code className="font-bold text-slate-800">dbo.Equipment_Master</code> sẽ bị xóa.</p>
                <p>• Các liên kết cảm biến trong <code className="font-bold text-slate-800">dbo.Tag_Config</code> sẽ được giải phóng.</p>
                <p>• Thao tác này được lưu vết vào nhật ký kiểm toán <code className="font-bold text-slate-800">dbo.UserActionLog</code> (FDA 21 CFR Part 11).</p>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={isDeleting}
                className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xs hallmark-focus shadow-xs"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'ĐANG XÓA...' : 'XÁC NHẬN XÓA'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Aliased export to maintain backwards compatibility
export const EquipmentInventory = EquipmentManagement;
export default EquipmentManagement;
