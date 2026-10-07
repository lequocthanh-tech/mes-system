/* Hallmark · component: EquipmentInventory · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useEquipment } from '../../context/EquipmentContext';
import { Equipment, EquipmentType, EquipmentLocation, OperatingStatus } from '../../types/equipment';
import { LogMaintenanceModal } from '../../components/maintenance/LogMaintenanceModal';
import { 
  Cpu, 
  Search, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Layers, 
  Filter,
  Wrench
} from 'lucide-react';


const EQUIPMENT_TYPES: EquipmentType[] = [
  'Centrifugal Pump',
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

const OPERATING_STATUSES: OperatingStatus[] = [
  'RUNNING',
  'STOPPED',
  'FAULT',
  'MAINTENANCE',
];

export const EquipmentInventory: React.FC = () => {
  const {
    equipmentList,
    selectedEquipmentId,
    selectEquipment,
    registerEquipment,
    updateEquipment,
    deleteEquipment,
    isEquipmentInterlocked,
  } = useEquipment();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);

  // Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<EquipmentType>('Centrifugal Pump');
  const [formLocation, setFormLocation] = useState<EquipmentLocation>('Line 1 - Mixing Unit');
  const [formPlcTag, setFormPlcTag] = useState('');
  const [formStatus, setFormStatus] = useState<OperatingStatus>('STOPPED');
  const [formRuntime, setFormRuntime] = useState<number>(0);
  const [formMaintenanceLimit, setFormMaintenanceLimit] = useState<number>(500);
  const [formNotes, setFormNotes] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync form when selectedEquipmentId changes
  const handleSelectRow = (eq: Equipment) => {
    selectEquipment(eq.id);
    setFormId(eq.id);
    setFormName(eq.name);
    setFormType(eq.type);
    setFormLocation(eq.location);
    setFormPlcTag(eq.plcTag);
    setFormStatus(eq.status);
    setFormRuntime(eq.runtimeHours);
    setFormMaintenanceLimit(eq.maintenanceLimit);
    setFormNotes(eq.notes);
    setFeedback({
      type: 'success',
      message: `Đã chọn thiết bị [${eq.id}] - ${eq.name}`,
    });
  };

  const handleClearForm = () => {
    selectEquipment(null);
    setFormId('');
    setFormName('');
    setFormType('Centrifugal Pump');
    setFormLocation('Line 1 - Mixing Unit');
    setFormPlcTag('');
    setFormStatus('STOPPED');
    setFormRuntime(0);
    setFormMaintenanceLimit(500);
    setFormNotes('');
    setFeedback(null);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim() || !formPlcTag.trim()) {
      setFeedback({ type: 'error', message: 'Mã thiết bị, Tên thiết bị và OPC UA Node ID là bắt buộc.' });
      return;
    }
    if (equipmentList.some((e) => e.id.toLowerCase() === formId.trim().toLowerCase())) {
      setFeedback({ type: 'error', message: `Mã thiết bị "${formId}" đã tồn tại trên hệ thống.` });
      return;
    }

    registerEquipment({
      id: formId.trim().toUpperCase(),
      name: formName.trim(),
      type: formType,
      location: formLocation,
      plcTag: formPlcTag.trim(),
      opcNodeId: formPlcTag.trim(),
      status: formStatus,
      runtimeHours: Number(formRuntime) || 0,
      maintenanceLimit: Number(formMaintenanceLimit) || 500,
      notes: formNotes.trim(),
    });

    setFeedback({
      type: 'success',
      message: `Đã đăng ký thiết bị mới [${formId.toUpperCase()}] liên kết OPC UA thành công.`,
    });
    handleClearForm();
  };

  const handleUpdate = () => {
    if (!selectedEquipmentId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn một thiết bị từ danh sách để cập nhật.' });
      return;
    }
    if (!formName.trim() || !formPlcTag.trim()) {
      setFeedback({ type: 'error', message: 'Tên thiết bị và OPC UA Node ID không được để trống.' });
      return;
    }

    updateEquipment(selectedEquipmentId, {
      name: formName.trim(),
      type: formType,
      location: formLocation,
      plcTag: formPlcTag.trim(),
      opcNodeId: formPlcTag.trim(),
      status: formStatus,
      runtimeHours: Number(formRuntime) || 0,
      maintenanceLimit: Number(formMaintenanceLimit) || 500,
      notes: formNotes.trim(),
    });

    setFeedback({
      type: 'success',
      message: `Cập nhật thông tin thiết bị [${selectedEquipmentId}] thành công.`,
    });
  };

  const handleDelete = () => {
    if (!selectedEquipmentId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn thiết bị cần xóa.' });
      return;
    }

    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa thiết bị [${selectedEquipmentId}] khỏi Equipment Master?`);
    if (!confirmed) return;

    deleteEquipment(selectedEquipmentId);
    setFeedback({
      type: 'success',
      message: `Đã xóa thiết bị [${selectedEquipmentId}] khỏi cơ sở dữ liệu.`,
    });
    handleClearForm();
  };

  // Filter equipment list
  const filteredEquipment = equipmentList.filter((eq) => {
    const matchLocation = locationFilter === 'ALL' || eq.location === locationFilter;
    const matchStatus = statusFilter === 'ALL' || eq.status === statusFilter;
    const matchSearch =
      eq.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.plcTag.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.type.toLowerCase().includes(searchQuery.toLowerCase());
    return matchLocation && matchStatus && matchSearch;
  });

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* Feedback Toast */}
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

      {/* Main Grid: Left Asset Registration Form (5 cols) / Right Master Registry (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Asset Registration & Configuration Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-xs flex flex-col">
          <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-800" />
              <h2 className="font-bold text-slate-900 uppercase tracking-wide not-italic">
                {selectedEquipmentId ? `Hiệu chỉnh tài sản [${selectedEquipmentId}]` : 'Đăng ký thiết bị & Liên kết Node'}
              </h2>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              ISA-95 EQUIPMENT MASTER
            </span>
          </div>

          <form onSubmit={handleRegister} className="p-5 space-y-3.5">
            {/* Field 1: Asset ID & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Mã thiết bị (Asset ID) *
                </label>
                <input
                  type="text"
                  value={formId}
                  onChange={(e) => setFormId(e.target.value)}
                  disabled={!!selectedEquipmentId}
                  placeholder="EQ-17"
                  className="w-full bg-white disabled:bg-slate-100 border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Tên thiết bị (Asset Name) *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="PUMP MILK (Bơm cấp)"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>
            </div>

            {/* Field 2: Type & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Loại thiết bị (Type)
                </label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as EquipmentType)}
                  className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
                >
                  {EQUIPMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Vị trí phân xưởng (Location)
                </label>
                <select
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value as EquipmentLocation)}
                  className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
                >
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Field 3: Modernized OPC UA Node ID / CM Binding */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                <span>OPC UA Node ID / CM Binding *</span>
                <span className="text-[10px] text-slate-500 font-normal">KEPWARE BINDING</span>
              </label>
              <input
                type="text"
                value={formPlcTag}
                onChange={(e) => setFormPlcTag(e.target.value)}
                placeholder="ns=2;s=Line1.Mixing.Pump_Milk_State (or CM-P101)"
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            {/* Field 4: Operating Status & Runtime Hours */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Trạng thái (Status)
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as OperatingStatus)}
                  className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus font-bold"
                >
                  {OPERATING_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Giờ chạy (Runtime h)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formRuntime}
                  onChange={(e) => setFormRuntime(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Định mức (Limit h)
                </label>
                <input
                  type="number"
                  min="50"
                  step="10"
                  value={formMaintenanceLimit}
                  onChange={(e) => setFormMaintenanceLimit(parseFloat(e.target.value) || 500)}
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>
            </div>

            {/* Field 5: Notes */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Ghi chú kỹ thuật / Đặc tả module (Technical Notes)
              </label>
              <textarea
                rows={2}
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Thông số công suất động cơ, vật liệu gioăng phớt, áp suất tối đa..."
                className="w-full bg-white border border-slate-300 p-2.5 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            {/* Action Buttons Row - Uniform h-9 Height */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={!!selectedEquipmentId}
                className={`h-9 px-4 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  selectedEquipmentId
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white hallmark-focus active:translate-y-px'
                }`}
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Thêm thiết bị</span>
              </button>

              <button
                type="button"
                onClick={handleUpdate}
                disabled={!selectedEquipmentId}
                className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  !selectedEquipmentId
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 hallmark-focus active:translate-y-px'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Cập nhật</span>
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={!selectedEquipmentId}
                className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  !selectedEquipmentId
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 hover:border-rose-300 hallmark-focus active:translate-y-px'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>

              <button
                type="button"
                onClick={() => setIsLogModalOpen(true)}
                disabled={!selectedEquipmentId}
                className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  !selectedEquipmentId
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 hallmark-focus active:translate-y-px'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-emerald-700" />
                <span>Bảo trì</span>
              </button>

              <button
                type="button"
                onClick={handleClearForm}
                className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px shadow-xs ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Làm mới</span>
              </button>

            </div>
          </form>
        </div>

        {/* Right Column: Equipment Master Registry Table & Health Indicators */}
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-xs flex flex-col">
          {/* Header & Filter Bar */}
          <div className="p-4 bg-slate-100/70 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                  Sổ bộ thiết bị & Trạng thái vận hành (Equipment Master Registry)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredEquipment.length} TÀI SẢN GIÁM SÁT
              </span>
            </div>

            {/* Filter Controls - Uniform h-9 */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm mã EQ, tên, Node ID..."
                  className="w-full bg-white border border-slate-300 h-9 pl-8 pr-3 text-xs font-mono rounded-xs hallmark-focus"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={locationFilter}
                  onChange={(e) => setLocationFilter(e.target.value)}
                  className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
                >
                  <option value="ALL">Tất cả khu vực</option>
                  {LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus font-bold"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  {OPERATING_STATUSES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Master Registry Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-20">Mã EQ</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Tên thiết bị & Vị trí</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">OPC UA Node ID / Binding</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">Trạng thái</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-36">Chỉ số sức khỏe (Health)</th>
                  <th className="py-2.5 px-3 text-center w-40">Khóa liên động (Interlock)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Không tìm thấy thiết bị nào khớp với điều kiện lọc.
                    </td>
                  </tr>
                ) : (
                  filteredEquipment.map((eq) => {
                    const isSelected = selectedEquipmentId === eq.id;
                    const usagePct = Math.min(100, Math.round((eq.runtimeHours / eq.maintenanceLimit) * 100));
                    const isInterlocked = isEquipmentInterlocked(eq);

                    // Health Indicator Styling:
                    // < 75%: Emerald green bar (Healthy)
                    // 75% - 90%: Amber bar (Maintenance Upcoming)
                    // > 90% or Runtime >= Limit: Rose red bar with badge DUE / CRITICAL
                    const isOverdue = usagePct >= 90 || eq.runtimeHours >= eq.maintenanceLimit;
                    const isWarning = usagePct >= 75 && usagePct < 90;

                    return (
                      <tr
                        key={eq.id}
                        onClick={() => handleSelectRow(eq)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#E0F2FE] text-slate-900 font-semibold border-l-4 border-l-sky-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Asset ID */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-900">
                          {eq.id}
                        </td>

                        {/* Name & Location */}
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{eq.name}</div>
                          <div className="text-[10px] text-slate-500">{eq.location}</div>
                        </td>

                        {/* OPC UA Node ID */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 text-[10px]">
                          <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded-xs text-[10px] font-mono break-all">
                            {eq.plcTag}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] border ${
                              eq.status === 'RUNNING'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : eq.status === 'FAULT'
                                ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                : eq.status === 'MAINTENANCE'
                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-300'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              eq.status === 'RUNNING' ? 'bg-emerald-600 animate-pulse' :
                              eq.status === 'FAULT' ? 'bg-rose-600' :
                              eq.status === 'MAINTENANCE' ? 'bg-amber-600' : 'bg-slate-400'
                            }`} />
                            {eq.status}
                          </span>
                        </td>

                        {/* Dynamic Health & Reliability Bar */}
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[10px]">
                              <span><strong>{eq.runtimeHours}h</strong> / {eq.maintenanceLimit}h</span>
                              <span className={`font-bold ${
                                isOverdue ? 'text-rose-700' : isWarning ? 'text-amber-700' : 'text-emerald-700'
                              }`}>
                                {usagePct}%
                              </span>
                            </div>
                            <div className="w-full h-2 bg-slate-200 rounded-xs overflow-hidden border border-slate-300">
                              <div
                                className={`h-full transition-all ${
                                  isOverdue ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'
                                }`}
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-500">
                              <span className="font-semibold text-blue-700">
                                {eq.maintenanceCount !== undefined ? `${eq.maintenanceCount} Chu kỳ (Cycles)` : ''}
                              </span>
                              <span>
                                {eq.totalStarts !== undefined ? `${eq.totalStarts} Khởi động` : ''}
                              </span>
                            </div>
                            {isOverdue && (
                              <div className="text-[9px] font-bold text-rose-700 uppercase">
                                ● BẢO TRÌ YÊU CẦU (DUE)
                              </div>
                            )}
                          </div>
                        </td>


                        {/* Operational Interlock Flag */}
                        <td className="py-2.5 px-3 text-center">
                          {isInterlocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-bold text-[10px] rounded-xs animate-pulse">
                              <Lock className="w-3 h-3 text-rose-700 shrink-0" />
                              <span>INTERLOCKED (LOCKED FOR BATCH)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-[10px] rounded-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                              <span>CLEARED FOR OPS</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
            <div>
              <span>ĐANG CHỌN: <strong className="text-slate-800">{selectedEquipmentId || 'CHƯA CHỌN'}</strong></span>
              <span className="mx-2">•</span>
              <span>ĐỊNH MỨC BẢO TRÌ TIÊU CHUẨN: 400h – 800h</span>
            </div>
            <div className="flex items-center gap-1 text-rose-700 font-bold">
              <span>KHÓA LIÊN ĐỘNG: TỰ ĐỘNG CHẶN LỆNH SẢN XUẤT KHI THIẾT BỊ BỊ FAULT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Log Maintenance Modal */}
      <LogMaintenanceModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        preSelectedEquipmentId={selectedEquipmentId || undefined}
      />
    </div>
  );
};

