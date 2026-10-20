/* Hallmark · component: OeeTagMappingModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import * as api from '../../services/api';
import {
  Settings,
  X,
  Check,
  AlertTriangle,
  CheckCircle2,
  Save,
  Radio,
  Flame,
  Snowflake,
  RotateCw,
  Sliders,
  Layers,
  Search,
  Gauge,
  Activity,
  HelpCircle,
  RefreshCw,
  Trash2
} from 'lucide-react';

export interface OeeTagMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export type OeeModalTab = 'counters' | 'equipment';

export interface OeeTagDefinition {
  key: string;
  label: string;
  description: string;
  direction: 'READ' | 'WRITE';
  unit: string;
  expectedType: string;
  nominal?: number;
  icon: React.ElementType;
}

export interface EquipmentAssetRow {
  code: string;
  name: string;
  type: string;
  nominal: number;
  unit: string;
  icon: React.ElementType;
  pvTagKey: string;
  pvTagLabel: string;
  stateTagKey: string;
  stateTagLabel: string;
}

export const OEE_COUNTER_TAGS: OeeTagDefinition[] = [
  {
    key: 'total_count_pv',
    label: 'Total Output Count PV',
    description: 'Tổng sản lượng đầu ra hoàn thành của dây chuyền (Đơn vị: PCS / Thùng / Chai)',
    direction: 'READ',
    unit: 'PCS',
    expectedType: 'Integer',
    icon: Gauge,
  },
  {
    key: 'reject_count_pv',
    label: 'Defect / Reject Count PV',
    description: 'Số lượng sản phẩm phế phẩm / lỗi bị loại khỏi dây chuyền đóng gói',
    direction: 'READ',
    unit: 'PCS',
    expectedType: 'Integer',
    icon: AlertTriangle,
  },
  {
    key: 'line_state_code',
    label: 'Line State Code (PackML)',
    description: 'Mã số trạng thái vận hành tổng thể (0=STOP, 1=IDLE, 2=RUNNING, 3=COMPLETE, 4=FAULT)',
    direction: 'READ',
    unit: 'Enum',
    expectedType: 'Int16',
    icon: Activity,
  },
];

export const SEVEN_EQUIPMENT_ASSETS: EquipmentAssetRow[] = [
  {
    code: 'PUMP_INLET_MILK',
    name: 'Bơm nạp sữa tươi (Bơm 1 - PH11101)',
    type: 'Dosing Pump',
    nominal: 100.0,
    unit: 'L/min',
    icon: RotateCw,
    pvTagKey: 'pump_milk_flow_pv',
    pvTagLabel: 'Lưu lượng nạp sữa PV',
    stateTagKey: 'pump_milk_state',
    stateTagLabel: 'Trạng thái chạy/dừng Bơm 1',
  },
  {
    code: 'PUMP_INLET_SUGAR',
    name: 'Bơm nạp đường (Bơm 2 - PH11202)',
    type: 'Dosing Pump',
    nominal: 50.0,
    unit: 'L/min',
    icon: RotateCw,
    pvTagKey: 'pump_sugar_flow_pv',
    pvTagLabel: 'Lưu lượng nạp đường PV',
    stateTagKey: 'pump_sugar_state',
    stateTagLabel: 'Trạng thái chạy/dừng Bơm 2',
  },
  {
    code: 'PUMP_INLET_ADDITIVE',
    name: 'Bơm nạp phụ gia (Bơm 3 - PH11303)',
    type: 'Micro Dosing Pump',
    nominal: 20.0,
    unit: 'L/min',
    icon: RotateCw,
    pvTagKey: 'pump_additive_flow_pv',
    pvTagLabel: 'Lưu lượng nạp vi chất PV',
    stateTagKey: 'pump_additive_state',
    stateTagLabel: 'Trạng thái chạy/dừng Bơm 3',
  },
  {
    code: 'AGITATOR_MIX',
    name: 'Cánh khuấy đồng hóa bồn trộn (PH12101)',
    type: 'Impeller Agitator',
    nominal: 120.0,
    unit: 'RPM',
    icon: Sliders,
    pvTagKey: 'agitator_speed_pv',
    pvTagLabel: 'Tốc độ cánh khuấy PV',
    stateTagKey: 'agitator_state',
    stateTagLabel: 'Trạng thái động cơ khuấy',
  },
  {
    code: 'HEATER_UHT',
    name: 'Điện trở tiệt trùng UHT (PH22101)',
    type: 'Thermal Exchanger',
    nominal: 138.0,
    unit: '°C',
    icon: Flame,
    pvTagKey: 'heater_uht_temp_pv',
    pvTagLabel: 'Nhiệt độ buồng UHT PV',
    stateTagKey: 'heater_uht_state',
    stateTagLabel: 'Trạng thái đốt gia nhiệt UHT',
  },
  {
    code: 'CHILLER_COOL',
    name: 'Cụm giải nhiệt làm lạnh sốc (PH22201)',
    type: 'Plate Heat Exchanger',
    nominal: 4.0,
    unit: '°C',
    icon: Snowflake,
    pvTagKey: 'chiller_cool_temp_pv',
    pvTagLabel: 'Nhiệt độ trao đổi lạnh PV',
    stateTagKey: 'chiller_cool_state',
    stateTagLabel: 'Trạng thái máy nén làm lạnh',
  },
  {
    code: 'PUMP_OUTLET',
    name: 'Bơm xả thành phẩm ra bồn đệm (PH22202)',
    type: 'Transfer Pump',
    nominal: 100.0,
    unit: 'L/min',
    icon: RotateCw,
    pvTagKey: 'pump_outlet_flow_pv',
    pvTagLabel: 'Lưu lượng bơm xả đệm PV',
    stateTagKey: 'pump_outlet_state',
    stateTagLabel: 'Trạng thái bơm xả đệm',
  },
];

export const OeeTagMappingModal: React.FC<OeeTagMappingModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const [activeTab, setActiveTab] = useState<OeeModalTab>('counters');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Empty baseline: All tag mapping fields start as empty strings ""
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSavingAll, setIsSavingAll] = useState<boolean>(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning'>('success');

  // Test status per NodeId
  const [nodeTestResults, setNodeTestResults] = useState<Record<string, {
    testing: boolean;
    valid?: boolean;
    value?: any;
    message?: string;
  }>>({});

  const showToast = (msg: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load saved OEE tag mappings
  const loadSavedMappings = async () => {
    setIsLoading(true);
    setToastMessage(null);
    try {
      const res = await api.getOeeTagMappings();
      const raw = res && res.mappings ? res.mappings : {};
      const loaded: Record<string, string> = {};

      // Initialize counter tags
      OEE_COUNTER_TAGS.forEach((tag) => {
        const val = raw[tag.key];
        loaded[tag.key] = typeof val === 'string' ? val : (val?.node_id ? String(val.node_id) : '');
      });

      // Initialize 7 equipment tags
      SEVEN_EQUIPMENT_ASSETS.forEach((asset) => {
        const pvVal = raw[asset.pvTagKey];
        loaded[asset.pvTagKey] = typeof pvVal === 'string' ? pvVal : (pvVal?.node_id ? String(pvVal.node_id) : '');

        const stVal = raw[asset.stateTagKey];
        loaded[asset.stateTagKey] = typeof stVal === 'string' ? stVal : (stVal?.node_id ? String(stVal.node_id) : '');
      });

      setTagInputs(loaded);
    } catch (err: any) {
      console.warn('Could not load OEE tag mappings, keeping empty baseline:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedMappings();
      setNodeTestResults({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (key: string, value: string) => {
    setTagInputs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Test single OPC UA NodeId connectivity
  const handleTestNode = async (key: string, nodeId: string) => {
    const cleanNode = nodeId.trim();
    if (!cleanNode) {
      setNodeTestResults((prev) => ({
        ...prev,
        [key]: { testing: false, valid: false, message: 'Node ID rỗng!' },
      }));
      return;
    }

    setNodeTestResults((prev) => ({
      ...prev,
      [key]: { testing: true },
    }));

    try {
      const res = await api.testOpcNodeConnectivity(cleanNode);
      setNodeTestResults((prev) => ({
        ...prev,
        [key]: {
          testing: false,
          valid: res.valid,
          value: res.value,
          message: res.message || (res.valid ? `Giá trị: ${res.value}` : 'Không có phản hồi từ Kepware'),
        },
      }));
    } catch (err: any) {
      setNodeTestResults((prev) => ({
        ...prev,
        [key]: {
          testing: false,
          valid: false,
          message: err?.message || 'Lỗi kiểm tra Node ID',
        },
      }));
    }
  };

  // Save single tag (Incremental Persistence)
  const handleSaveSingleTag = async (key: string) => {
    const val = tagInputs[key] || '';
    setSavingKey(key);
    try {
      const payload = { [key]: val.trim() };
      const res = await api.updateOeeTagMappings(payload);
      if (res && res.success) {
        showToast('Đã lưu tag OEE thành công!', 'success');
        if (onSaved) onSaved();
      } else {
        showToast(res.error || 'Lỗi khi lưu tag OEE!', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi gọi API lưu tag!', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  // Save asset row (PV + State tags together)
  const handleSaveAssetRow = async (pvKey: string, stateKey: string) => {
    const payload = {
      [pvKey]: (tagInputs[pvKey] || '').trim(),
      [stateKey]: (tagInputs[stateKey] || '').trim(),
    };
    setSavingKey(pvKey);
    try {
      const res = await api.updateOeeTagMappings(payload);
      if (res && res.success) {
        showToast('Đã lưu cấu hình thiết bị thành công!', 'success');
        if (onSaved) onSaved();
      } else {
        showToast(res.error || 'Lỗi khi lưu cấu hình thiết bị!', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi gọi API lưu thiết bị!', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  // Save all tags together
  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAll(true);
    try {
      const payload: Record<string, string> = {};
      Object.entries(tagInputs).forEach(([k, v]) => {
        payload[k] = (v || '').trim();
      });

      const res = await api.updateOeeTagMappings(payload);
      if (res && res.success) {
        showToast('Đã lưu toàn bộ 17 tag OEE vào hệ thống!', 'success');
        if (onSaved) onSaved();
      } else {
        showToast(res.error || 'Lỗi khi lưu cấu hình tag OEE!', 'error');
      }
    } catch (err: any) {
      showToast(err?.message || 'Lỗi khi gọi API lưu toàn bộ!', 'error');
    } finally {
      setIsSavingAll(false);
    }
  };

  // Mapped count telemetry
  const totalTagsCount = OEE_COUNTER_TAGS.length + SEVEN_EQUIPMENT_ASSETS.length * 2;
  const mappedCount = Object.values(tagInputs).filter((v) => v && v.trim() !== '' && v.trim() !== '[CHƯA ÁNH XẠ]').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-300 rounded shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-800 font-sans">
        {/* =========================================================================
            HEADER & TOP STATUS
           ========================================================================= */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase" style={{ fontStyle: 'normal' }}>
                  CẤU HÌNH TAG OEE &amp; 7 THIẾT BỊ CÔNG NGHỆ CHẤP HÀNH
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-semibold uppercase bg-sky-100 text-sky-800 rounded border border-sky-200">
                  Kepware OPC UA port 49320
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Ánh xạ Node ID phục vụ tính toán Availability (A), Performance (P), Quality (Q) và Six Big Losses.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Độ phủ ánh xạ:</span>
              <span className="text-xs font-mono font-bold text-slate-900">
                {mappedCount} / {totalTagsCount} Tags ({Math.round((mappedCount / totalTagsCount) * 100)}%)
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 inline-flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded transition-all focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px]"
              title="Đóng modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* TOAST ALERT */}
        {toastMessage && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between border-b transition-all ${
              toastType === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : toastType === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {toastType === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
              {toastType === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600" />}
              {toastType === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              <span>{toastMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* =========================================================================
            NAVIGATION TABS & SEARCH TOOLBAR
           ========================================================================= */}
        <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Tabs */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('counters')}
              className={`h-9 px-4 text-xs font-medium rounded transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] ${
                activeTab === 'counters'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-sky-600" />
              <span>1. BỘ ĐẾM &amp; TRẠNG THÁI DÂY CHUYỀN (3 TAGS)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipment')}
              className={`h-9 px-4 text-xs font-medium rounded transition-all flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] ${
                activeTab === 'equipment'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span>2. THIẾT BỊ CÔNG NGHỆ CHẤP HÀNH (7 THIẾT BỊ / 14 TAGS)</span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm Tag hoặc Thiết bị..."
              className="h-9 w-full pl-8 pr-3 text-xs bg-slate-50 border border-slate-200 rounded font-mono focus:bg-white focus:outline-2 focus:outline-sky-600 focus:outline-offset-2"
            />
          </div>
        </div>

        {/* =========================================================================
            TAB CONTENT: SCROLLABLE BODY
           ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-6">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
              <span className="text-xs font-mono">Đang nạp cấu hình Tag từ SQL Server...</span>
            </div>
          ) : activeTab === 'counters' ? (
            /* =====================================================================
               TAB 1: LINE COUNTERS & STATE (3 TAGS)
               ===================================================================== */
            <div className="space-y-4">
              <div className="bg-sky-50/60 border border-sky-200 rounded p-3 text-xs text-sky-900 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Bộ đếm sản lượng &amp; Trạng thái PackML:</strong> Phục vụ tính toán Performance (tỷ lệ đạt sản lượng thiết kế),
                  Quality (tỷ lệ phế phẩm = Defect / Total) và Availability (thời gian chạy dựa trên trạng thái RUNNING).
                  Nếu chưa cấu hình, trường sẽ hoàn toàn trống <code className="bg-sky-100 px-1 py-0.5 rounded font-mono">""</code> và hiển thị <span className="font-semibold">[CHƯA ÁNH XẠ]</span>.
                </p>
              </div>

              <div className="space-y-3">
                {OEE_COUNTER_TAGS.filter((t) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return t.key.toLowerCase().includes(q) || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
                }).map((tag) => {
                  const Icon = tag.icon;
                  const currentVal = tagInputs[tag.key] || '';
                  const testState = nodeTestResults[tag.key];
                  const isSavingThis = savingKey === tag.key;

                  return (
                    <div
                      key={tag.key}
                      className="bg-white border border-slate-200 rounded p-4 shadow-2xs hover:border-slate-300 transition-all space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">{tag.key}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                                {tag.unit} ({tag.expectedType})
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium block">{tag.label}</span>
                          </div>
                        </div>

                        {/* Status preview */}
                        <div>
                          {currentVal && currentVal.trim() !== '' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              ĐÃ CẤU HÌNH
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              [CHƯA ÁNH XẠ]
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-600">{tag.description}</p>

                      {/* Input row + Test + Save Single */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) => handleInputChange(tag.key, e.target.value)}
                            placeholder="ns=2;s=Line1.Counter.TotalCountPV (để trống nếu chưa ánh xạ)"
                            className="h-9 w-full px-3 text-xs font-mono bg-white border border-slate-300 rounded shadow-2xs focus:border-sky-600 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 transition-all"
                          />
                        </div>

                        {/* Test Button */}
                        <button
                          type="button"
                          onClick={() => handleTestNode(tag.key, currentVal)}
                          disabled={!currentVal || testState?.testing}
                          className="h-9 px-3 text-xs font-mono font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:translate-y-[1px]"
                          title="Kiểm tra kết nối tới Kepware OPC UA"
                        >
                          {testState?.testing ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
                              <span>Đang test...</span>
                            </>
                          ) : (
                            <>
                              <Radio className="w-3 h-3 text-slate-500" />
                              <span>Test Node</span>
                            </>
                          )}
                        </button>

                        {/* Save Single Button */}
                        <button
                          type="button"
                          onClick={() => handleSaveSingleTag(tag.key)}
                          disabled={isSavingThis}
                          className="h-9 px-3.5 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-800 rounded shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50 transition-all active:translate-y-[1px]"
                          title="Lưu chỉ riêng tag này (Incremental Save)"
                        >
                          {isSavingThis ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Save className="w-3 h-3" />
                          )}
                          <span>Lưu Tag</span>
                        </button>

                        {/* Unmap Button */}
                        <button
                          type="button"
                          disabled={!currentVal || isSavingThis || isSavingAll}
                          onClick={async () => {
                            handleInputChange(tag.key, '');
                            setSavingKey(tag.key);
                            try {
                              const res = await api.updateOeeTagMappings({ [tag.key]: '' });
                              if (res && res.success) {
                                showToast(`Đã gỡ ánh xạ tag [${tag.label}] thành công!`, 'success');
                                setNodeTestResults((prev) => ({
                                  ...prev,
                                  [tag.key]: { testing: false, valid: false, message: 'Đã gỡ (Chưa ánh xạ)' }
                                }));
                                if (onSaved) onSaved();
                              } else {
                                showToast(res.error || 'Lỗi khi gỡ tag!', 'error');
                              }
                            } catch (err: any) {
                              showToast(err.message || 'Lỗi khi gọi API gỡ tag!', 'error');
                            } finally {
                              setSavingKey(null);
                            }
                          }}
                          className="h-9 px-2 text-xs font-medium text-rose-600 bg-white hover:bg-rose-50 border border-rose-300 rounded shadow-2xs inline-flex items-center gap-1 disabled:opacity-40 transition-all active:translate-y-[1px]"
                          title="Gỡ ánh xạ tag này (Đặt về [CHƯA ÁNH XẠ])"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Gỡ</span>
                        </button>
                      </div>

                      {/* Probe Result Feedback */}
                      {testState && !testState.testing && (
                        <div
                          className={`p-2 rounded text-[11px] font-mono flex items-center justify-between border ${
                            testState.valid
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {testState.valid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            )}
                            <span>{testState.message}</span>
                          </div>
                          {testState.valid && testState.value !== undefined && (
                            <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                              Live: {String(testState.value)} {tag.unit}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* =====================================================================
               TAB 2: 7 CORE PRODUCTION ASSETS (14 TAGS: PV & STATE)
               ===================================================================== */
            <div className="space-y-4">
              <div className="bg-indigo-50/60 border border-indigo-200 rounded p-3 text-xs text-indigo-900 flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <p>
                  <strong>7 Thiết bị công nghệ cốt lõi:</strong> Mỗi thiết bị bao gồm 2 biến OPC UA chính:
                  (1) <em>Lưu lượng/Tốc độ/Nhiệt độ PV</em> so với định mức danh định (Nominal Design) để tính Performance;
                  (2) <em>Trạng thái Run/Stop</em> để cập nhật thời gian vận hành &amp; dừng máy (Availability).
                </p>
              </div>

              <div className="space-y-4">
                {SEVEN_EQUIPMENT_ASSETS.filter((asset) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    asset.code.toLowerCase().includes(q) ||
                    asset.name.toLowerCase().includes(q) ||
                    asset.pvTagKey.toLowerCase().includes(q) ||
                    asset.stateTagKey.toLowerCase().includes(q)
                  );
                }).map((asset, idx) => {
                  const Icon = asset.icon;
                  const pvVal = tagInputs[asset.pvTagKey] || '';
                  const stateVal = tagInputs[asset.stateTagKey] || '';

                  const pvTest = nodeTestResults[asset.pvTagKey];
                  const stateTest = nodeTestResults[asset.stateTagKey];
                  const isSavingThisAsset = savingKey === asset.pvTagKey;

                  const isFullyMapped = pvVal.trim() !== '' && stateVal.trim() !== '';

                  return (
                    <div
                      key={asset.code}
                      className="bg-white border border-slate-200 rounded p-4 shadow-2xs hover:border-slate-300 transition-all space-y-4"
                    >
                      {/* Asset Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-800 shrink-0">
                            <Icon className="w-4 h-4 text-sky-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900">
                                #{idx + 1}. {asset.code}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                Định mức: {asset.nominal} {asset.unit}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500 font-medium block">
                              {asset.name} ({asset.type})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isFullyMapped ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              2/2 TAGS ĐÃ ÁNH XẠ
                            </span>
                          ) : pvVal.trim() !== '' || stateVal.trim() !== '' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              1/2 TAGS (BÁN PHẦN)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                              [CHƯA ÁNH XẠ]
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => handleSaveAssetRow(asset.pvTagKey, asset.stateTagKey)}
                            disabled={isSavingThisAsset}
                            className="h-8 px-3 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-800 rounded shadow-2xs inline-flex items-center gap-1.5 disabled:opacity-50 transition-all active:translate-y-[1px]"
                            title="Lưu cặp tag của thiết bị này"
                          >
                            {isSavingThisAsset ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3" />
                            )}
                            <span>Lưu thiết bị</span>
                          </button>
                        </div>
                      </div>

                      {/* Two Columns: PV Tag & State Tag */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Process Value (PV) Tag */}
                        <div className="space-y-2 bg-slate-50/60 p-3 rounded border border-slate-200/80">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-semibold text-slate-900">
                              1. {asset.pvTagKey}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {asset.unit} (Float)
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{asset.pvTagLabel}</p>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={pvVal}
                              onChange={(e) => handleInputChange(asset.pvTagKey, e.target.value)}
                              placeholder={`ns=2;s=... (Giá trị thực ${asset.unit})`}
                              className="h-9 flex-1 px-3 text-xs font-mono bg-white border border-slate-300 rounded shadow-2xs focus:border-sky-600 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => handleTestNode(asset.pvTagKey, pvVal)}
                              disabled={!pvVal || pvTest?.testing}
                              className="h-9 px-2.5 text-xs font-mono font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded shadow-2xs inline-flex items-center gap-1 disabled:opacity-40 transition-all active:translate-y-[1px]"
                              title="Test Node ID"
                            >
                              {pvTest?.testing ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
                              ) : (
                                <Radio className="w-3 h-3 text-slate-500" />
                              )}
                              <span>Test</span>
                            </button>
                            <button
                              type="button"
                              disabled={!pvVal}
                              onClick={() => {
                                handleInputChange(asset.pvTagKey, '');
                                setNodeTestResults((prev) => ({
                                  ...prev,
                                  [asset.pvTagKey]: { testing: false, valid: false, message: 'Đã gỡ (Chưa ánh xạ)' }
                                }));
                              }}
                              className="h-9 px-2 text-xs font-medium text-rose-600 bg-white hover:bg-rose-50 border border-rose-300 rounded shadow-2xs inline-flex items-center gap-1 disabled:opacity-40 transition-all active:translate-y-[1px]"
                              title="Gỡ ánh xạ PV (Đặt về [CHƯA ÁNH XẠ])"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Gỡ</span>
                            </button>
                          </div>

                          {pvTest && !pvTest.testing && (
                            <div
                              className={`p-1.5 rounded text-[10px] font-mono flex items-center justify-between border ${
                                pvTest.valid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              <span>{pvTest.message}</span>
                              {pvTest.valid && pvTest.value !== undefined && (
                                <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-emerald-300">
                                  {String(pvTest.value)} {asset.unit}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. Run/Stop State Tag */}
                        <div className="space-y-2 bg-slate-50/60 p-3 rounded border border-slate-200/80">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-semibold text-slate-900">
                              2. {asset.stateTagKey}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              Bool / Enum
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500">{asset.stateTagLabel}</p>

                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={stateVal}
                              onChange={(e) => handleInputChange(asset.stateTagKey, e.target.value)}
                              placeholder="ns=2;s=... (1=RUN, 0=STOP)"
                              className="h-9 flex-1 px-3 text-xs font-mono bg-white border border-slate-300 rounded shadow-2xs focus:border-sky-600 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 transition-all"
                            />
                            <button
                              type="button"
                              onClick={() => handleTestNode(asset.stateTagKey, stateVal)}
                              disabled={!stateVal || stateTest?.testing}
                              className="h-9 px-2.5 text-xs font-mono font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded shadow-2xs inline-flex items-center gap-1 disabled:opacity-40 transition-all active:translate-y-[1px]"
                              title="Test Node ID"
                            >
                              {stateTest?.testing ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
                              ) : (
                                <Radio className="w-3 h-3 text-slate-500" />
                              )}
                              <span>Test</span>
                            </button>
                            <button
                              type="button"
                              disabled={!stateVal}
                              onClick={() => {
                                handleInputChange(asset.stateTagKey, '');
                                setNodeTestResults((prev) => ({
                                  ...prev,
                                  [asset.stateTagKey]: { testing: false, valid: false, message: 'Đã gỡ (Chưa ánh xạ)' }
                                }));
                              }}
                              className="h-9 px-2 text-xs font-medium text-rose-600 bg-white hover:bg-rose-50 border border-rose-300 rounded shadow-2xs inline-flex items-center gap-1 disabled:opacity-40 transition-all active:translate-y-[1px]"
                              title="Gỡ ánh xạ State (Đặt về [CHƯA ÁNH XẠ])"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Gỡ</span>
                            </button>
                          </div>

                          {stateTest && !stateTest.testing && (
                            <div
                              className={`p-1.5 rounded text-[10px] font-mono flex items-center justify-between border ${
                                stateTest.valid
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                  : 'bg-rose-50 text-rose-800 border-rose-200'
                              }`}
                            >
                              <span>{stateTest.message}</span>
                              {stateTest.valid && stateTest.value !== undefined && (
                                <span className="font-bold text-slate-900 bg-white px-1.5 py-0.5 rounded border border-emerald-300">
                                  {String(stateTest.value)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* =========================================================================
            FOOTER CONTROLS
           ========================================================================= */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
            <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
            <span>OPC UA EndPoint: opc.tcp://localhost:49320 (Kepware V6 Enterprise)</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded shadow-2xs transition-all focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px]"
            >
              ĐÓNG
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSavingAll}
              className="h-9 px-5 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-600 border border-sky-700 rounded shadow-xs inline-flex items-center gap-2 transition-all focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-[1px] disabled:opacity-50"
            >
              {isSavingAll ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>ĐANG LƯU TOÀN BỘ CẤU HÌNH...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-white" />
                  <span>LƯU TOÀN BỘ CẤU HÌNH OEE</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
