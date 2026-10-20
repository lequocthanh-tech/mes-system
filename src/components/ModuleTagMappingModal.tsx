/* Hallmark · component: ModuleTagMappingModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';
import { 
  Settings2, 
  X, 
  Activity, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Save, 
  Lock, 
  ShieldCheck, 
  RefreshCw,
  Radio,
  Sliders,
  Trash2
} from 'lucide-react';

export interface ModuleTagMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleKey: 'operations' | 'quality' | 'maintenance' | 'oee' | 'inventory';
  moduleTitle: string;
  onSaved?: () => void;
}

export const ModuleTagMappingModal: React.FC<ModuleTagMappingModalProps> = ({
  isOpen,
  onClose,
  moduleKey,
  moduleTitle,
  onSaved,
}) => {
  const { user } = useAuth();
  const isAdmin = (user?.role?.toUpperCase() === 'ADMIN') || (user?.username?.toLowerCase() === 'admin');

  const [tags, setTags] = useState<Record<string, api.ModuleTagItem>>({});
  const [editedTags, setEditedTags] = useState<Record<string, { node_id: string; unit: string; role: string; dataType?: string }>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Per-node test status
  const [testResults, setTestResults] = useState<Record<string, {
    testing: boolean;
    valid?: boolean;
    value?: any;
    datatype?: string;
    message?: string;
  }>>({});

  const fetchMappings = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await api.getModuleTagMappings(moduleKey);
      if (res && res.tags) {
        setTags(res.tags);
        const edits: Record<string, { node_id: string; unit: string; role: string; dataType?: string }> = {};
        Object.entries(res.tags).forEach(([k, v]) => {
          edits[k] = {
            node_id: v.node_id,
            unit: v.unit,
            role: v.role,
            dataType: v.dataType,
          };
        });
        setEditedTags(edits);
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || `Không thể tải cấu hình tag cho module ${moduleKey}.`
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMappings();
      setTestResults({});
    }
  }, [isOpen, moduleKey]);

  if (!isOpen) return null;

  const handleFieldChange = (tagKey: string, field: 'node_id' | 'unit' | 'role', val: string) => {
    setEditedTags((prev) => ({
      ...prev,
      [tagKey]: {
        ...prev[tagKey],
        [field]: val,
      },
    }));
  };

  const handleTestNode = async (tagKey: string, nodeId: string) => {
    if (!nodeId.trim()) {
      setTestResults((prev) => ({
        ...prev,
        [tagKey]: { testing: false, valid: false, message: 'Node ID rỗng' }
      }));
      return;
    }

    setTestResults((prev) => ({
      ...prev,
      [tagKey]: { testing: true }
    }));

    try {
      const res = await api.testOpcNodeConnectivity(nodeId.trim());
      setTestResults((prev) => ({
        ...prev,
        [tagKey]: {
          testing: false,
          valid: res.valid,
          value: res.value,
          datatype: res.datatype,
          message: res.message || (res.valid ? `Giá trị: ${res.value}` : 'Không phản hồi')
        }
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
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
        message: 'Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa cấu hình Tag! (FDA 21 CFR Part 11)'
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await api.updateModuleTagMappings(
        moduleKey,
        editedTags,
        user?.username || 'admin',
        user?.role || 'Admin'
      );

      setFeedback({
        type: 'success',
        message: res.message || `Đã cập nhật cấu hình tag cho module [${moduleTitle}] thành công và kích hoạt hot-reload!`
      });

      // Refetch live readouts
      await fetchMappings();
      if (onSaved) onSaved();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Lỗi cập nhật cấu hình tag.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-5xl rounded-xs overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 font-mono text-xs">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings2 className="w-4 h-4 text-slate-800" />
            <div>
              <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                Cấu hình & Ánh xạ Tag Kepware OPC UA — {moduleTitle}
              </h3>
              <p className="text-[10px] text-slate-500 font-normal">
                ISA-88 / ISA-95 Equipment Interface · Direct Node Mapping, Hot-Reloading & FDA 21 CFR Part 11 Audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Clearance Indicator Badge */}
            <span
              className={`px-2.5 py-1 text-[10px] font-bold border rounded-xs flex items-center gap-1.5 shadow-xs ${
                isAdmin
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>QUYỀN HẠN: ADMIN (TOÀN QUYỀN)</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>QUYỀN HẠN: OPERATOR (CHỈ ĐỌC)</span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-900 font-bold px-1.5 py-0.5 text-sm"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`px-4 py-2.5 border-b flex items-center justify-between text-xs shrink-0 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
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

        {/* Body Table Container */}
        <div className="overflow-y-auto p-4 flex-1">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold sticky top-0 z-10">
                <th className="py-2.5 px-3 border-r border-slate-200 w-44">Tag Key / Nghiệp vụ</th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-48">Mô tả vai trò</th>
                <th className="py-2.5 px-3 border-r border-slate-200">OPC UA Node ID</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-20">Đơn vị</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-right w-28">Live PV</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-24">Chất lượng</th>
                <th className="py-2.5 px-3 text-center w-28">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                      <span>Đang tải thông số ánh xạ tag từ Gateway...</span>
                    </div>
                  </td>
                </tr>
              ) : Object.keys(tags).length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    Không có tag nào được định nghĩa cho module [{moduleKey}].
                  </td>
                </tr>
              ) : (
                Object.entries(tags).map(([tagKey, tagMeta]) => {
                  const editData = editedTags[tagKey] || { node_id: tagMeta.node_id, unit: tagMeta.unit, role: tagMeta.role };
                  const testRes = testResults[tagKey];
                  const quality = tagMeta.quality || 'Good';

                  return (
                    <tr key={tagKey} className="hover:bg-slate-50/70 transition-colors">
                      {/* Tag Key */}
                      <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900 align-top">
                        <div className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 bg-slate-900 text-white rounded-xs text-[10px]">
                            {tagKey}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {tagMeta.dataType || 'Float'}
                        </div>
                      </td>

                      {/* Role Description */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700 align-top">
                        {isAdmin ? (
                          <input
                            type="text"
                            value={editData.role}
                            onChange={(e) => handleFieldChange(tagKey, 'role', e.target.value)}
                            className="w-full bg-white border border-slate-300 h-8 px-2 text-[11px] font-mono rounded-xs hallmark-focus"
                          />
                        ) : (
                          <div className="font-medium text-slate-800">{tagMeta.role}</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[180px]" title={tagMeta.description}>
                          {tagMeta.description}
                        </div>
                      </td>

                      {/* OPC Node ID */}
                      <td className="py-2.5 px-3 border-r border-slate-200 align-top">
                        {isAdmin ? (
                          <input
                            type="text"
                            value={editData.node_id}
                            onChange={(e) => handleFieldChange(tagKey, 'node_id', e.target.value)}
                            placeholder="ns=2;s=..."
                            className="w-full bg-white border border-slate-300 h-8 px-2 text-[11px] font-mono rounded-xs hallmark-focus"
                          />
                        ) : (
                          <code className="text-slate-800 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded-xs block truncate" title={tagMeta.node_id}>
                            {tagMeta.node_id}
                          </code>
                        )}

                        {/* Inline Test Result Feedback */}
                        {testRes && !testRes.testing && (
                          <div className={`mt-1 text-[10px] font-mono flex items-center gap-1 ${
                            testRes.valid ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {testRes.valid ? <Check className="w-3 h-3 shrink-0" /> : <AlertTriangle className="w-3 h-3 shrink-0" />}
                            <span className="truncate">{testRes.message}</span>
                          </div>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center align-top">
                        {isAdmin ? (
                          <input
                            type="text"
                            value={editData.unit}
                            onChange={(e) => handleFieldChange(tagKey, 'unit', e.target.value)}
                            className="w-16 mx-auto bg-white border border-slate-300 h-8 px-1 text-center text-[11px] font-mono rounded-xs hallmark-focus"
                          />
                        ) : (
                          <span className="font-bold text-slate-700">{tagMeta.unit}</span>
                        )}
                      </td>

                      {/* Live PV Readout */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right align-top font-bold text-slate-900">
                        <div className="flex items-center justify-end gap-1">
                          <Radio className="w-2.5 h-2.5 text-emerald-600 animate-pulse" />
                          <span>
                            {tagMeta.value !== undefined 
                              ? typeof tagMeta.value === 'number' 
                                ? tagMeta.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })
                                : String(tagMeta.value)
                              : '--'}
                          </span>
                          <span className="text-slate-500 font-normal text-[10px] ml-0.5">{tagMeta.unit}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 font-normal">
                          {tagMeta.latency_ms ? `${tagMeta.latency_ms}ms` : '<15ms'}
                        </div>
                      </td>

                      {/* Quality */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-center align-top">
                        <span className={`inline-flex px-1.5 py-0.5 text-[9px] font-bold rounded-xs border ${
                          quality === 'Good'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {quality}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-center align-top">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleTestNode(tagKey, editData.node_id)}
                            disabled={testRes?.testing || !editData.node_id?.trim()}
                            className="h-8 px-2 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 rounded-xs transition-all shadow-xs"
                            title="Kiểm tra kết nối trực tiếp tới OPC UA node"
                          >
                            <Activity className={`w-3 h-3 ${testRes?.testing ? 'animate-spin text-sky-600' : ''}`} />
                            <span>{testRes?.testing ? 'Test...' : 'Test'}</span>
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                handleFieldChange(tagKey, 'node_id', '');
                                setTestResults((prev) => ({
                                  ...prev,
                                  [tagKey]: { testing: false, valid: false, message: 'Đã gỡ (Chưa ánh xạ)' }
                                }));
                              }}
                              disabled={!editData.node_id}
                              className="h-8 px-2 bg-white hover:bg-rose-50 disabled:bg-slate-50 text-rose-600 disabled:text-slate-300 border border-rose-300 disabled:border-slate-200 font-semibold text-[10px] uppercase tracking-wider flex items-center gap-1 rounded-xs transition-all shadow-xs"
                              title="Gỡ ánh xạ tag này (Đặt về [CHƯA ÁNH XẠ])"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Gỡ</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-slate-500">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {isAdmin 
                ? 'Thay đổi thông số Node ID sẽ được ghi nhận kiểm toán FDA 21 CFR Part 11 và hot-reload tức thời.'
                : 'Tài khoản hiện tại ở chế độ Chỉ đọc. Vui lòng đăng nhập với quyền Admin để thay đổi cấu hình.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMappings}
              disabled={isLoading}
              className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-600' : ''}`} />
              <span>Làm mới</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xs hallmark-focus shadow-xs"
            >
              Đóng
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="h-9 px-4 bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus shadow-xs active:translate-y-px"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Đang lưu...' : 'Lưu & Áp dụng cấu hình'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
