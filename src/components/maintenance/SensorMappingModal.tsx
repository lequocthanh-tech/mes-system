/* Hallmark · component: SensorMappingModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import { SensorMappingItem } from '../../types/equipment';
import { 
  Settings2, 
  X, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Lock, 
  RefreshCw,
  Trash2
} from 'lucide-react';

export interface SensorMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  equipmentCode: string;
  equipmentName?: string;
  onSaved?: () => void;
}

export const SensorMappingModal: React.FC<SensorMappingModalProps> = ({
  isOpen,
  onClose,
  equipmentCode,
  equipmentName,
  onSaved,
}) => {
  const { user } = useAuth();
  const isAdmin = (user?.role?.toUpperCase() === 'ADMIN') || (user?.username?.toLowerCase() === 'admin');

  const [mappings, setMappings] = useState<SensorMappingItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Per-row probe testing state
  const [testStates, setTestStates] = useState<Record<string, {
    testing: boolean;
    valid?: boolean;
    value?: any;
    datatype?: string;
    message?: string;
  }>>({});

  const fetchMappings = async () => {
    if (!equipmentCode) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await api.getEquipmentSensorMappings(equipmentCode);
      if (res && res.data) {
        setMappings(res.data);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || `Không thể tải cấu hình cảm biến cho thiết bị [${equipmentCode}].`
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && equipmentCode) {
      fetchMappings();
      setTestStates({});
    }
  }, [isOpen, equipmentCode]);

  if (!isOpen) return null;

  const handleNodeIdChange = (tagKey: string, newNodeId: string) => {
    setMappings((prev) =>
      prev.map((item) =>
        item.tag_key === tagKey ? { ...item, opc_node_id: newNodeId } : item
      )
    );
  };

  const handleTestNode = async (tagKey: string, nodeId: string) => {
    if (!nodeId.trim()) {
      setTestStates((prev) => ({
        ...prev,
        [tagKey]: { testing: false, valid: false, message: 'Chưa cấu hình Node ID' }
      }));
      setMappings((prev) =>
        prev.map((item) =>
          item.tag_key === tagKey ? { ...item, live_pv: '--', quality: 'Unmapped' } : item
        )
      );
      return;
    }

    setTestStates((prev) => ({
      ...prev,
      [tagKey]: { testing: true }
    }));

    try {
      const res = await api.testOpcNodeConnectivity(nodeId.trim());
      const isUnmapped = res.quality === 'Unmapped' || !res.valid && res.value === null && !nodeId.trim();
      setTestStates((prev) => ({
        ...prev,
        [tagKey]: {
          testing: false,
          valid: res.valid,
          value: res.value,
          datatype: res.datatype,
          message: res.message || (res.valid ? `Giá trị: ${res.value}` : 'Không phản hồi')
        }
      }));

      // Instantly update the row's live PV and quality
      setMappings((prev) =>
        prev.map((item) => {
          if (item.tag_key === tagKey) {
            return {
              ...item,
              live_pv: res.valid && res.value !== undefined ? res.value : (isUnmapped ? '--' : item.live_pv),
              quality: isUnmapped ? 'Unmapped' : (res.valid ? 'Good' : 'Bad'),
            };
          }
          return item;
        })
      );
    } catch (err: any) {
      setTestStates((prev) => ({
        ...prev,
        [tagKey]: {
          testing: false,
          valid: false,
          message: err.message || 'Lỗi kiểm tra node'
        }
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      setFeedback({
        type: 'error',
        message: 'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa cấu hình cảm biến! (FDA 21 CFR Part 11)'
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      await api.updateEquipmentSensorMappings(
        equipmentCode,
        mappings,
        user?.username || 'admin',
        user?.role || 'ADMIN'
      );
      setFeedback({
        type: 'success',
        message: 'Cập nhật ánh xạ thành công và đã lưu CSDL!'
      });
      if (onSaved) onSaved();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Lỗi khi lưu cấu hình cảm biến lên hệ thống.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-mono">
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-4xl rounded-xs overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Settings2 className="w-4 h-4 text-slate-800" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wide text-xs not-italic">
              CẤU HÌNH & ÁNH XẠ TAG KEPWARE OPC UA - CẤU HÌNH SENSOR THIẾT BỊ & BẢO TRÌ ({equipmentCode})
            </h3>
            {equipmentName && (
              <span className="text-[11px] text-slate-500 font-normal">
                · {equipmentName}
              </span>
            )}
            <span className="px-2 py-0.5 bg-emerald-100 border border-emerald-300 text-emerald-800 font-mono text-[10px] font-bold rounded-xs tracking-wide">
              ADMIN ACCESS
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-900 font-bold p-1 rounded-xs transition-colors"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Feedback Alert Banner */}
        {feedback && (
          <div className={`px-4 py-2.5 text-xs flex items-center gap-2 border-b font-mono ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : feedback.type === 'warning'
              ? 'bg-amber-50 text-amber-900 border-amber-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
          }`}>
            {feedback.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
            {feedback.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />}
            {feedback.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />}
            <span className="font-semibold">{feedback.message}</span>
          </div>
        )}

        {/* Body Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xs text-xs text-slate-600 flex items-center justify-between gap-3">
            <div>
              <p className="font-bold text-slate-800">
                Giao diện liên kết cảm biến thiết bị Kepware Central (ISA-88 / ISA-95 Level 1-2):
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Chỉnh sửa Node ID OPC UA cho các thông số rung (ISO 10816), dòng điện, nhiệt độ và tiếp điểm chạy. Nhấn [TEST NODE] để xác thực trực tiếp với server.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchMappings}
              disabled={isLoading}
              className="h-8 px-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs flex items-center gap-1.5 rounded-xs transition-all shrink-0 shadow-xs"
              title="Đồng bộ lại"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          {/* Tag Mapping Table */}
          <div className="border border-slate-200 rounded-xs overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                  <th className="px-3.5 py-2.5 border-r border-slate-200 w-44">Tag Key</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Mô Tả Chức Năng (Role)</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200 w-72">OPC UA Node ID</th>
                  <th className="px-3 py-2.5 border-r border-slate-200 text-center w-16">Đơn Vị</th>
                  <th className="px-3 py-2.5 border-r border-slate-200 text-right w-24">Live PV</th>
                  <th className="px-3 py-2.5 border-r border-slate-200 text-center w-24">Chất Lượng</th>
                  <th className="px-3.5 py-2.5 text-center w-36">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {mappings.map((item) => {
                  const testState = testStates[item.tag_key];
                  const isUnmapped = !item.opc_node_id || item.quality === 'Unmapped' || testState?.message === 'Chưa cấu hình Node ID';
                  const displayQuality = isUnmapped ? 'Chưa cấu hình' : (testState?.valid !== undefined ? (testState.valid ? 'Good' : 'Bad / Not Found') : (item.quality === 'Good' ? 'Good' : 'Bad / Not Found'));
                  const isGood = !isUnmapped && (displayQuality === 'Good');

                  return (
                    <tr key={item.tag_key} className="hover:bg-slate-50 transition-colors">
                      {/* Tag Key */}
                      <td className="px-3.5 py-2 border-r border-slate-200 font-mono font-bold text-slate-900">
                        {item.tag_key}
                      </td>

                      {/* Role Description */}
                      <td className="px-3.5 py-2 border-r border-slate-200 font-sans text-slate-700 font-medium">
                        {item.role_description || item.role || item.tag_key}
                      </td>

                      {/* Editable Node ID Input */}
                      <td className="px-2 py-1.5 border-r border-slate-200">
                        <input
                          type="text"
                          disabled={!isAdmin || isSaving}
                          value={item.opc_node_id}
                          onChange={(e) => handleNodeIdChange(item.tag_key, e.target.value)}
                          placeholder="Nhập Node ID (ví dụ: ns=2;s=Line1...)"
                          className="w-full bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono text-slate-900 rounded-xs hallmark-focus disabled:bg-slate-100 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700">
                        {item.unit || '--'}
                      </td>

                      {/* Live PV */}
                      <td className="px-3 py-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                        {isUnmapped ? '--' : (testState?.value !== undefined 
                          ? String(testState.value) 
                          : (item.live_pv !== undefined && item.live_pv !== null ? String(item.live_pv) : '--'))}
                      </td>

                      {/* Quality */}
                      <td className="px-3 py-2 border-r border-slate-200 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold border rounded-xs ${
                          isUnmapped
                            ? 'bg-slate-100 text-slate-600 border-slate-300'
                            : isGood 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                            : 'bg-rose-50 text-rose-800 border-rose-300'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isUnmapped ? 'bg-slate-400' : (isGood ? 'bg-emerald-600' : 'bg-rose-600')}`} />
                          <span>{displayQuality}</span>
                        </span>
                      </td>

                      {/* Actions: Test Node & Unmap Button */}
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center gap-1.5 justify-center">
                          <button
                            type="button"
                            onClick={() => handleTestNode(item.tag_key, item.opc_node_id)}
                            disabled={testState?.testing}
                            className="h-9 px-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-300 text-slate-800 font-semibold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs transition-all hallmark-focus shadow-xs"
                            title={`Kiểm tra kết nối tới node [${item.opc_node_id}]`}
                          >
                            <Activity className={`w-3.5 h-3.5 ${testState?.testing ? 'animate-spin text-sky-600' : 'text-slate-600'}`} />
                            <span>{testState?.testing ? 'Test...' : 'TEST'}</span>
                          </button>
                          <button
                            type="button"
                            disabled={!isAdmin || isSaving || !item.opc_node_id}
                            onClick={() => {
                              handleNodeIdChange(item.tag_key, '');
                              setTestStates((prev) => ({
                                ...prev,
                                [item.tag_key]: { testing: false, valid: false, message: 'Đã gỡ (Chưa cấu hình Node ID)' }
                              }));
                              setMappings((prev) =>
                                prev.map((i) => (i.tag_key === item.tag_key ? { ...i, live_pv: '--', quality: 'Unmapped' } : i))
                              );
                            }}
                            className="h-9 px-2 bg-white hover:bg-rose-50 text-rose-600 disabled:text-slate-300 border border-rose-300 disabled:border-slate-200 font-semibold text-[11px] uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs transition-all hallmark-focus shadow-xs disabled:opacity-40"
                            title="Gỡ ánh xạ tag này (Đặt về [CHƯA ÁNH XẠ])"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Gỡ</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-2">
            {!isAdmin ? (
              <span className="flex items-center gap-1 text-amber-700 font-bold">
                <Lock className="w-3.5 h-3.5" />
                Chỉ Admin mới có quyền lưu cấu hình
              </span>
            ) : (
              <span>Cấu hình tự động lưu vào SQL Server và hot-reload Kepware</span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xs hallmark-focus shadow-xs"
            >
              HỦY
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !isAdmin}
              className="h-9 px-4 bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus shadow-xs"
            >
              <Save className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
              <span>{isSaving ? 'ĐANG LƯU...' : 'LƯU & ÁP DỤNG CẤU HÌNH'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SensorMappingModal;
