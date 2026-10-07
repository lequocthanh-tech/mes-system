/* Hallmark · component: EditSingleTagModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { InspectorNodeData, TagAccessType } from '../../types/isa88';
import { 
  X, 
  Tag as TagIcon, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Activity, 
  CheckCircle2,
  Server
} from 'lucide-react';

interface EditSingleTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tagData: InspectorNodeData;
}

export const EditSingleTagModal: React.FC<EditSingleTagModalProps> = ({
  isOpen,
  onClose,
  tagData,
}) => {
  const { saveSingleTagMapping, testNodeConnectivity } = useIsa88();

  const [nodeId, setNodeId] = useState<string>('');
  const [unit, setUnit] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [accessType, setAccessType] = useState<TagAccessType>('Read');

  // Test state
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    valid: boolean;
    value?: any;
    datatype?: string;
    message?: string;
  } | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen && tagData) {
      setNodeId(tagData.address || tagData.opcNodeId || '');
      setUnit(tagData.unit || '');
      setDescription(tagData.description || '');
      setAccessType(tagData.accessType || (tagData.writable ? 'Read/Write' : 'Read'));
      setTestResult(null);
      setSaveStatus(null);
    }
  }, [isOpen, tagData]);

  if (!isOpen) return null;

  const handleTest = async () => {
    if (!nodeId.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    const res = await testNodeConnectivity(nodeId.trim());
    setIsTesting(false);
    setTestResult({
      valid: res.valid,
      value: res.value,
      datatype: res.datatype,
      message: res.message,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId.trim()) return;

    setIsSaving(true);
    setSaveStatus(null);

    const writable = accessType === 'Read/Write';
    const res = await saveSingleTagMapping(tagData.tagName, {
      node_id: nodeId.trim(),
      unit: unit.trim(),
      writable,
      description: description.trim(),
      role: tagData.role || 'General Process Tag',
    });

    setIsSaving(false);
    if (res.success) {
      setSaveStatus({ type: 'success', message: res.message });
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setSaveStatus({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 shadow-2xl max-w-lg w-full font-mono text-xs">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-800 text-white flex items-center justify-center">
              <TagIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                EDIT NODE PARAMETERS: {tagData.tagName}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                ISA-88 Context: <strong className="text-slate-800">{tagData.parentContext}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 focus:outline-none"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Save Status Banner */}
        {saveStatus && (
          <div className={`px-5 py-2.5 border-b text-xs flex items-center gap-2 ${
            saveStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}>
            {saveStatus.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span>{saveStatus.message}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Tag Identifier (Read-Only) */}
          <div className="p-2.5 bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Tag Identifier</div>
            <div className="text-xs font-bold text-slate-900 mt-0.5">
              {tagData.tagName} {tagData.role && `(${tagData.role})`}
            </div>
          </div>

          {/* Kepware Node ID & Inline Test Button */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
              Kepware OPC UA Node ID
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nodeId}
                onChange={(e) => {
                  setNodeId(e.target.value);
                  setTestResult(null);
                }}
                className="flex-1 h-9 px-3 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
                placeholder="e.g. ns=2;s=Simulation Examples.Functions..."
                required
              />
              <button
                type="button"
                disabled={isTesting || !nodeId.trim()}
                onClick={handleTest}
                className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px transition-colors shadow-xs disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Activity className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Test</span>
              </button>
            </div>

            {/* Test Result Feedback */}
            {testResult && (
              <div className={`mt-2 p-2 border text-[11px] flex items-center gap-2 ${
                testResult.valid
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                {testResult.valid ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      Node Verified in Kepware! Value: <strong>{String(testResult.value)}</strong> ({testResult.datatype})
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                    <span>{testResult.message || 'Node verification failed.'}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Unit & Access Type Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Engineering Unit
              </label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. °C, L, RPM"
                className="w-full h-9 px-3 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Access Privilege
              </label>
              <select
                value={accessType}
                onChange={(e) => setAccessType(e.target.value as TagAccessType)}
                className="w-full h-9 px-2 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
              >
                <option value="Read">Read Only (RO)</option>
                <option value="Read/Write">Read / Write (RW)</option>
              </select>
            </div>
          </div>

          {/* Functional Description */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
              Functional Description & Engineering Note
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full p-2.5 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
              placeholder="Tag purpose & engineering description..."
            />
          </div>

          {/* Gateway Info */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 text-[10px] text-slate-600 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>Target Server: Kepware Central Gateway (opc.tcp://127.0.0.1:49320)</span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs uppercase font-semibold font-mono hallmark-focus active:translate-y-px"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !nodeId.trim()}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs uppercase font-semibold font-mono flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Apply Parameters</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
