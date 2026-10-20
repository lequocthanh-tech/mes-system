/* Hallmark · component: QualityTagMappingModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  Radio, 
  Save, 
  RotateCw,
  Sliders,
  ShieldCheck,
  Flame,
  Scale,
  Beaker,
  Trash2
} from 'lucide-react';
import * as api from '../../services/api';
import { QualityTagConfigItem } from '../../types/quality';

export interface QualityTagMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface TagTestStatus {
  testing: boolean;
  quality?: 'Good' | 'Bad' | 'Unmapped';
  value?: any;
  message?: string;
}

export const QualityTagMappingModal: React.FC<QualityTagMappingModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  // Persistent local dictionary of Quality tags
  const [tagConfigs, setTagConfigs] = useState<Record<string, QualityTagConfigItem>>({
    inline_ph_pv: {
      tag_name: 'inline_ph_pv',
      node_id: '',
      description: 'Inline Milk Acidity (pH)',
      unit: 'pH',
      spec_min: 6.5,
      spec_max: 6.8,
    },
    inline_brix_pv: {
      tag_name: 'inline_brix_pv',
      node_id: '',
      description: 'Refractometer Dissolved Brix',
      unit: '°Bx',
      spec_min: 11.5,
      spec_max: 12.5,
    },
    pasteur_hold_temp: {
      tag_name: 'pasteur_hold_temp',
      node_id: '',
      description: 'Pasteurizer Holding Tube Critical Temp (CCP-1)',
      unit: '°C',
      spec_min: 137.0,
      spec_max: 140.0,
    },
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TagTestStatus>>({});

  // Fetch current persistent mappings on open
  const fetchCurrentMappings = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.getQualityTagMappings();
      if (res && res.tags) {
        setTagConfigs((prev) => {
          const updated = { ...prev };
          Object.entries(res.tags).forEach(([k, v]: [string, any]) => {
            updated[k] = {
              tag_name: k,
              node_id: v.node_id || '',
              description: v.description || updated[k]?.description || k,
              unit: v.unit || updated[k]?.unit || '--',
              spec_min: v.spec_min ?? updated[k]?.spec_min,
              spec_max: v.spec_max ?? updated[k]?.spec_max,
              value: v.value,
              quality: v.quality,
            };
          });
          return updated;
        });
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Không thể tải cấu hình tag Quality từ máy chủ.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCurrentMappings();
      setSaveSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNodeIdChange = (tagKey: string, value: string) => {
    setTagConfigs((prev) => ({
      ...prev,
      [tagKey]: {
        ...prev[tagKey],
        node_id: value,
      },
    }));
    // Reset test result if user changes the string
    setTestResults((prev) => ({
      ...prev,
      [tagKey]: { testing: false },
    }));
  };

  const handleTestNode = async (tagKey: string) => {
    const targetTag = tagConfigs[tagKey];
    const rawNode = (targetTag?.node_id || '').trim();

    if (!rawNode) {
      setTestResults((prev) => ({
        ...prev,
        [tagKey]: {
          testing: false,
          quality: 'Unmapped',
          message: 'Chưa cấu hình Node ID',
        },
      }));
      return;
    }

    setTestResults((prev) => ({
      ...prev,
      [tagKey]: { testing: true },
    }));

    try {
      const probe = await api.testQualityNode(rawNode);
      setTestResults((prev) => ({
        ...prev,
        [tagKey]: {
          testing: false,
          quality: probe.quality === 'Good' ? 'Good' : (probe.quality === 'Unmapped' ? 'Unmapped' : 'Bad'),
          value: probe.value,
          message: probe.message || (probe.quality === 'Good' ? 'Good' : 'Bad / Not Found'),
        },
      }));
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [tagKey]: {
          testing: false,
          quality: 'Bad',
          message: 'Lỗi giao tiếp mạng hoặc Kepware OPC UA',
        },
      }));
    }
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      const res = await api.updateQualityTagMappings({ tags: tagConfigs });
      if (res && res.status === 'success') {
        setSaveSuccess(true);
        if (onSaved) onSaved();
        setTimeout(() => {
          setSaveSuccess(false);
        }, 3000);
      } else {
        throw new Error(res?.message || 'Lỗi khi lưu cấu hình tag vào SQL Server');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi lưu cấu hình tag');
    } finally {
      setIsSaving(false);
    }
  };

  const getTagIcon = (key: string) => {
    if (key.includes('ph')) return <Beaker className="w-4 h-4 text-emerald-600" />;
    if (key.includes('brix')) return <Scale className="w-4 h-4 text-indigo-600" />;
    return <Flame className="w-4 h-4 text-rose-600" />;
  };

  const renderStatusBadge = (tagKey: string) => {
    const test = testResults[tagKey];
    const config = tagConfigs[tagKey];
    const isNodeEmpty = !(config?.node_id || '').trim();

    if (test?.testing) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-300 rounded-xs">
          <RotateCw className="w-3 h-3 animate-spin text-slate-600" />
          <span>Đang kiểm tra...</span>
        </span>
      );
    }

    if (test?.quality === 'Good') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Good</span>
          {test.value !== undefined && test.value !== null && (
            <span className="text-slate-600 font-normal">({test.value} {config.unit})</span>
          )}
        </span>
      );
    }

    if (test?.quality === 'Bad') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-bold bg-rose-50 text-rose-800 border border-rose-300 rounded-xs">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          <span>Bad / Not Found</span>
        </span>
      );
    }

    if (test?.quality === 'Unmapped' || isNodeEmpty) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-100 text-slate-500 border border-slate-300 rounded-xs">
          <Radio className="w-3 h-3 text-slate-400" />
          <span>Chưa cấu hình</span>
        </span>
      );
    }

    // Default resting state for non-tested node with configured string
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono font-semibold bg-slate-50 text-slate-600 border border-slate-300 rounded-xs">
        <Radio className="w-3 h-3 text-slate-400" />
        <span>Sẵn sàng kiểm tra</span>
      </span>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-mono"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quality-tag-modal-title"
    >
      <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-3xl overflow-hidden rounded-xs flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-slate-800" />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="quality-tag-modal-title" className="text-sm font-bold text-slate-900 uppercase tracking-wide">
                  CẤU HÌNH &amp; ÁNH XẠ TAG KEPWARE OPC UA
                </h2>
                {isLoading && <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-500" />}
              </div>
              <p className="text-[11px] text-slate-500 font-normal">
                Hệ thống cảm biến phân tích chất lượng trực tuyến (Inline Analytical Sensors &amp; CCP-1)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xs transition-colors hallmark-focus"
            aria-label="Đóng cửa sổ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-300 text-rose-800 flex items-center gap-2 rounded-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 flex items-center gap-2 rounded-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Cấu hình ánh xạ tag đã được lưu và cập nhật thành công vào hệ thống!</span>
            </div>
          )}

          <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 leading-relaxed text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 uppercase text-[10px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>NGUYÊN TẮC ÁNH XẠ TAG SINGLETON KEPWARE (PORT 49320)</span>
            </div>
            <p>
              Hệ thống sử dụng kết nối đơn Kepware OPC UA trung tâm. Các tag chưa được cấu hình Node ID sẽ hiển thị trạng thái <strong>[CHƯA ÁNH XẠ]</strong> với màu xám trung tính, tuyệt đối không phát sinh giá trị mô phỏng giả lập.
            </p>
          </div>

          {/* Tag Configuration Rows */}
          <div className="space-y-4 pt-1">
            {Object.entries(tagConfigs).map(([tagKey, tag]) => {
              const test = testResults[tagKey];
              return (
                <div 
                  key={tagKey}
                  className="p-4 bg-white border border-slate-200 hover:border-slate-300 rounded-xs space-y-3 transition-colors"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      {getTagIcon(tagKey)}
                      <div>
                        <span className="font-bold text-slate-900 text-xs">{tag.description}</span>
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-slate-100 text-slate-600 border border-slate-200 rounded-xs">
                          {tagKey}
                        </span>
                      </div>
                    </div>
                    {/* Live Test Status Badge */}
                    <div>
                      {renderStatusBadge(tagKey)}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                    {/* Input Field */}
                    <div className="md:col-span-7">
                      <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                        Kepware OPC UA Node ID Address
                      </label>
                      <input
                        type="text"
                        value={tag.node_id || ''}
                        onChange={(e) => handleNodeIdChange(tagKey, e.target.value)}
                        placeholder="Nhập Node ID (ví dụ: ns=2;s=Modbus_TCP.Quality.Sensor1)"
                        className="w-full h-9 px-3 bg-white border border-slate-300 text-xs font-mono text-slate-900 rounded-xs placeholder:text-slate-400 hallmark-focus focus:border-slate-500"
                      />
                    </div>

                    {/* Spec & Unit Indicator */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                        Dải Tiêu Chuẩn
                      </label>
                      <div className="h-9 px-2 bg-slate-50 border border-slate-200 flex items-center text-[11px] text-slate-700 font-bold rounded-xs truncate">
                        {tag.spec_min !== undefined && tag.spec_max !== undefined ? (
                          <span>{tag.spec_min} - {tag.spec_max} {tag.unit}</span>
                        ) : (
                          <span>-- {tag.unit}</span>
                        )}
                      </div>
                    </div>

                    {/* Probe / Test Button & Unmap Button */}
                    <div className="md:col-span-3 flex items-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTestNode(tagKey)}
                        disabled={test?.testing}
                        className="flex-1 h-9 px-2.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs hallmark-focus active:translate-y-px transition-all disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {test?.testing ? (
                          <RotateCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
                        ) : (
                          <Radio className="w-3.5 h-3.5 text-slate-600" />
                        )}
                        <span>TEST</span>
                      </button>
                      <button
                        type="button"
                        disabled={!tag.node_id}
                        onClick={() => {
                          handleNodeIdChange(tagKey, '');
                          setTestResults((prev) => ({
                            ...prev,
                            [tagKey]: { testing: false, quality: 'Unmapped', message: 'Chưa cấu hình Node ID' }
                          }));
                        }}
                        className="h-9 px-2 bg-white border border-rose-300 hover:bg-rose-50 text-rose-600 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1 rounded-xs hallmark-focus active:translate-y-px transition-all disabled:opacity-40"
                        title="Gỡ ánh xạ tag này (Đặt về [CHƯA ÁNH XẠ])"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>GỠ</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500">
            Dữ liệu ánh xạ được lưu vĩnh viễn trong <code>dbo.Tag_Config</code> và <code>tag_mappings.json</code>.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xs hallmark-focus active:translate-y-px transition-all"
            >
              HỦY BỎ
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px transition-all shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin text-white" />
                  <span>ĐANG LƯU...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>LƯU &amp; ÁP DỤNG CẤU HÌNH</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
