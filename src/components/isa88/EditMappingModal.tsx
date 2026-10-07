/* Hallmark · component: EditMappingModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { TagMappingDefinition } from '../../types/isa88';
import { 
  X, 
  Layers, 
  Check, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Activity, 
  CheckCircle2,
  Server
} from 'lucide-react';

interface EditMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface RowState {
  tagName: string;
  node_id: string;
  role: string;
  unit: string;
  writable: boolean;
  description: string;
  isTesting?: boolean;
  testResult?: {
    valid: boolean;
    value?: any;
    datatype?: string;
    message?: string;
  } | null;
}

export const EditMappingModal: React.FC<EditMappingModalProps> = ({ isOpen, onClose }) => {
  const { tagMappings, fetchMappings, saveAllMappings, testNodeConnectivity } = useIsa88();

  const [rows, setRows] = useState<RowState[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSaveStatus(null);
      // Fetch fresh mappings from backend
      fetchMappings().then((mappings) => {
        const loaded = mappings && Object.keys(mappings).length > 0 ? mappings : tagMappings;
        const initialRows: RowState[] = Object.entries(loaded).map(([tagName, meta]) => ({
          tagName,
          node_id: meta.node_id,
          role: meta.role || '',
          unit: meta.unit || '',
          writable: Boolean(meta.writable),
          description: meta.description || '',
          isTesting: false,
          testResult: null,
        }));
        setRows(initialRows);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNodeIdChange = (tagName: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.tagName === tagName ? { ...r, node_id: value, testResult: null } : r))
    );
  };

  const handleUnitChange = (tagName: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.tagName === tagName ? { ...r, unit: value } : r))
    );
  };

  const handleTestRow = async (tagName: string, nodeId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.tagName === tagName ? { ...r, isTesting: true, testResult: null } : r))
    );

    const res = await testNodeConnectivity(nodeId);

    setRows((prev) =>
      prev.map((r) =>
        r.tagName === tagName
          ? {
              ...r,
              isTesting: false,
              testResult: {
                valid: res.valid,
                value: res.value,
                datatype: res.datatype,
                message: res.message,
              },
            }
          : r
      )
    );
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    const payload: Record<string, TagMappingDefinition> = {};
    rows.forEach((r) => {
      payload[r.tagName] = {
        node_id: r.node_id.trim(),
        role: r.role,
        unit: r.unit.trim(),
        writable: r.writable,
        description: r.description,
      };
    });

    const res = await saveAllMappings(payload);
    setIsSaving(false);

    if (res.success) {
      setSaveStatus({ type: 'success', message: res.message });
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setSaveStatus({ type: 'error', message: res.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col font-mono text-xs">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-[#F8FAFC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-slate-800 text-white flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
                ISA-88 TELEMETRY NODE ID MAPPING
              </h2>
              <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                Centralized Kepware OPC UA bindings for all ISA-88 process tags (<code className="text-slate-700">backend/tag_mappings.json</code>)
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
          <div className={`px-6 py-2.5 border-b text-xs flex items-center gap-2 ${
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

        {/* Modal Body: Table Form */}
        <form onSubmit={handleSaveAll} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="border border-slate-200 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] text-slate-700 uppercase">
                  <th className="py-2.5 px-3 font-semibold">Tag Name</th>
                  <th className="py-2.5 px-3 font-semibold">ISA-88 Procedural Role</th>
                  <th className="py-2.5 px-3 font-semibold min-w-[320px]">Kepware OPC UA Node ID</th>
                  <th className="py-2.5 px-2 font-semibold text-center w-20">Unit</th>
                  <th className="py-2.5 px-2 font-semibold text-center w-20">Access</th>
                  <th className="py-2.5 px-3 font-semibold text-right min-w-[140px]">Verification</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => {
                  const hasTest = Boolean(row.testResult);
                  const isValid = row.testResult?.valid;

                  return (
                    <tr key={row.tagName} className="hover:bg-slate-50/60 transition-colors">
                      {/* Tag Name */}
                      <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                        {row.tagName}
                      </td>

                      {/* Role */}
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] whitespace-nowrap">
                        {row.role}
                      </td>

                      {/* Editable Node ID */}
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={row.node_id}
                          onChange={(e) => handleNodeIdChange(row.tagName, e.target.value)}
                          className="w-full h-9 px-2.5 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
                          placeholder="e.g. ns=2;s=Simulation Examples.Functions..."
                          required
                        />
                      </td>

                      {/* Unit */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => handleUnitChange(row.tagName, e.target.value)}
                          className="w-16 h-9 px-1 text-xs font-mono text-center border border-slate-300 bg-white hallmark-focus mx-auto"
                          placeholder="--"
                        />
                      </td>

                      {/* Access Type */}
                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        {row.writable ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300">
                            RW
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-300">
                            RO
                          </span>
                        )}
                      </td>

                      {/* Actions: Test Button & Result */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {hasTest && (
                            isValid ? (
                              <span 
                                title={`Verified: Value=${row.testResult?.value} (${row.testResult?.datatype})`}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold"
                              >
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span>Valid ({row.testResult?.value})</span>
                              </span>
                            ) : (
                              <span 
                                title={row.testResult?.message || 'Node failed'}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-800 border border-rose-300 font-semibold"
                              >
                                <AlertCircle className="w-3 h-3 text-rose-600" />
                                <span>Failed</span>
                              </span>
                            )
                          )}

                          <button
                            type="button"
                            disabled={row.isTesting || !row.node_id.trim()}
                            onClick={() => handleTestRow(row.tagName, row.node_id)}
                            className="h-9 px-3 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold uppercase tracking-wider flex items-center gap-1 hallmark-focus active:translate-y-px transition-colors disabled:opacity-50"
                          >
                            {row.isTesting ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Activity className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>Test</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Saving applies node bindings to Kepware runtime and triggers an in-memory Report-by-Exception re-subscription. WebSocket streams will automatically switch to newly bound nodes without gateway restart.
            </span>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 font-mono">
            {rows.length} Configurable MES Process Tags Bound
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs uppercase font-semibold font-mono hallmark-focus active:translate-y-px"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveAll}
              className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs uppercase font-semibold font-mono flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>SAVING & RESUBSCRIBING...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save & Apply Mapping</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
