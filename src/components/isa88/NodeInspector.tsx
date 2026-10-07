/* Hallmark · component: NodeInspector · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { TargetPlcOption, TagDataType, TagAccessType } from '../../types/isa88';
import { 
  Info, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Edit3, 
  Copy, 
  Check, 
  Send, 
  Activity, 
  RefreshCw,
  Server
} from 'lucide-react';
import { EditSingleTagModal } from './EditSingleTagModal';

export const NodeInspector: React.FC = () => {
  const { selectedNode, updateTagMapping, telemetryMap, writeNodeValue, gatewayConnected } = useIsa88();

  // Focused Single Tag Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  // Local state for interactive editing if it's a Tag
  const [editAddress, setEditAddress] = useState<string>('');
  const [editTargetPlc, setEditTargetPlc] = useState<TargetPlcOption>('Kepware Central Gateway (Port 49320)');
  const [editDataType, setEditDataType] = useState<TagDataType>('Real');
  const [editAccessType, setEditAccessType] = useState<TagAccessType>('Read');
  const [editDescription, setEditDescription] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Write dispatch states
  const [customWriteVal, setCustomWriteVal] = useState<string>('');
  const [isWriting, setIsWriting] = useState<boolean>(false);
  const [writeFeedback, setWriteFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Copy state
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (selectedNode) {
      setEditAddress(selectedNode.address || '');
      setEditTargetPlc(selectedNode.targetPlc || 'Kepware Central Gateway (Port 49320)');
      setEditDataType((selectedNode.dataType as TagDataType) || 'Real');
      setEditAccessType(selectedNode.accessType || 'Read');
      setEditDescription(selectedNode.description || '');
      setIsEditing(false);
      setSaveToast(null);
      setWriteFeedback(null);

      // Pre-fill write input with current value if writable
      const live = telemetryMap[selectedNode.address] || telemetryMap[selectedNode.tagName];
      if (live?.value !== undefined) {
        setCustomWriteVal(String(live.value));
      } else {
        setCustomWriteVal('');
      }
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <div className="bg-white border border-slate-200 p-6 text-center text-slate-500 font-mono text-xs">
        <Info className="w-5 h-5 mx-auto mb-2 text-slate-400" />
        Select any node or tag from the Physical or Procedural tree to inspect its ISA-88 telemetry and OPC UA attributes.
      </div>
    );
  }

  const isTag = selectedNode.nodeType === 'TAG' && typeof selectedNode.tagId === 'number';
  const live = telemetryMap[selectedNode.address] || (selectedNode.opcNodeId ? telemetryMap[selectedNode.opcNodeId] : null) || telemetryMap[selectedNode.tagName];
  
  const liveValue = live?.value !== undefined ? live.value : (selectedNode.liveValue !== undefined ? selectedNode.liveValue : null);
  const liveQuality = live?.quality || selectedNode.liveQuality || (gatewayConnected ? 'Good' : 'Bad');
  const liveTimestamp = live?.timestamp || selectedNode.lastUpdated || '--:--:--';
  const unit = selectedNode.unit || live?.unit || '';
  const isWritable = Boolean(selectedNode.writable || selectedNode.accessType === 'Read/Write');

  const handleCopyNodeId = () => {
    if (!selectedNode.address) return;
    navigator.clipboard.writeText(selectedNode.address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTag && typeof selectedNode.tagId === 'number') {
      updateTagMapping(selectedNode.tagId, {
        address: editAddress,
        targetPlc: editTargetPlc,
        dataType: editDataType,
        accessType: editAccessType,
        description: editDescription,
      });
      setIsEditing(false);
      setSaveToast('Node parameters and Kepware OPC UA mapping updated successfully.');
      setTimeout(() => setSaveToast(null), 4000);
    }
  };

  const handleDispatchWrite = async (val: any, dType?: string) => {
    if (!selectedNode.address) return;
    setIsWriting(true);
    setWriteFeedback(null);

    const targetType = dType || (selectedNode.dataType === 'Real' ? 'Float' : (selectedNode.dataType || 'Float'));
    const res = await writeNodeValue(selectedNode.address, val, targetType);

    setIsWriting(false);
    if (res.success) {
      setWriteFeedback({ type: 'success', message: res.message });
      setTimeout(() => setWriteFeedback(null), 4000);
    } else {
      setWriteFeedback({ type: 'error', message: res.message });
    }
  };

  const formattedLiveValue = liveValue !== null && liveValue !== undefined
    ? (typeof liveValue === 'number' 
        ? (Number.isInteger(liveValue) ? String(liveValue) : liveValue.toFixed(2))
        : (typeof liveValue === 'boolean' ? (liveValue ? 'TRUE' : 'FALSE') : String(liveValue)))
    : '—';

  return (
    <div className="bg-white border border-slate-200 shadow-xs">
      {/* Inspector Top Bar */}
      <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-slate-800 text-white flex items-center justify-center text-xs font-bold font-mono">
            i
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 font-mono tracking-tight">
                Node Information: {selectedNode.tagName}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-200 text-slate-800 uppercase font-semibold">
                {selectedNode.nodeType}
              </span>
              {selectedNode.role && (
                <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 font-semibold">
                  {selectedNode.role}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              ISA-88 Hierarchy: <strong className="text-slate-800">{selectedNode.parentContext}</strong>
            </p>
          </div>
        </div>

        {/* Action Button (for Tags) */}
        {isTag && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(true)}
              className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors font-mono hallmark-focus active:translate-y-px shadow-xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              <span>Edit Parameters</span>
            </button>
          </div>
        )}
      </div>

      {/* Save Toast */}
      {saveToast && (
        <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Write Toast */}
      {writeFeedback && (
        <div className={`px-5 py-2.5 border-b text-xs font-mono flex items-center gap-2 ${
          writeFeedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {writeFeedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
          )}
          <span>{writeFeedback.message}</span>
        </div>
      )}

      {/* Hero Real-Time Telemetry Bar (ISA-101 Display) */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          {/* Hero Value Display */}
          <div className="md:col-span-1 p-4 bg-white border border-slate-300">
            <div className="text-[10px] font-mono uppercase text-slate-500 flex items-center justify-between">
              <span>Real-Time Process Value</span>
              <span className="flex items-center gap-1 text-[9px] text-slate-400">
                <Activity className="w-3 h-3 text-slate-400" />
                WebSocket &lt;15ms
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-mono font-bold tracking-tight text-slate-900">
                {formattedLiveValue}
              </span>
              {unit && (
                <span className="text-sm font-mono font-semibold text-slate-600">
                  {unit}
                </span>
              )}
            </div>

            <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono">
              <span className="text-slate-500">Signal Quality:</span>
              {liveQuality === 'Good' ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-300 text-emerald-800 font-semibold text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  ● Good (ISA-101)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-50 border border-rose-300 text-rose-800 font-semibold text-[10px]">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  ● Bad / Offline
                </span>
              )}
            </div>
          </div>

          {/* OPC UA Node & Transport Details */}
          <div className="md:col-span-2 p-4 bg-white border border-slate-300 font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-[10px] text-slate-500 uppercase">Kepware OPC UA Node ID</span>
              <button
                type="button"
                onClick={handleCopyNodeId}
                className="h-6 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-semibold flex items-center gap-1 transition-colors hallmark-focus"
                title="Copy Node ID to clipboard"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">COPIED</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3 text-slate-500" />
                    <span>COPY NODEID</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="text-xs font-bold text-slate-900 break-all select-all py-0.5">
              {selectedNode.address}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Access Mode</span>
                <span className={`font-semibold ${isWritable ? 'text-amber-700' : 'text-slate-700'}`}>
                  {isWritable ? 'Read / Write (RW)' : 'Read Only (RO)'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Gateway Endpoint</span>
                <span className="font-semibold text-slate-700 truncate block" title="opc.tcp://127.0.0.1:49320">
                  opc.tcp://127.0.0.1:49320
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Last Updated</span>
                <span className="font-semibold text-slate-700 truncate block">
                  {liveTimestamp}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Write Dispatch Panel (Strictly for Writable Nodes) */}
      {isWritable && (
        <div className="p-5 border-b border-slate-200 bg-amber-50/20 font-mono">
          <div className="flex items-center gap-2 mb-3">
            <Send className="w-4 h-4 text-amber-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Interactive OPC UA Write Dispatch: {selectedNode.tagName}
            </h4>
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 border border-amber-300 text-amber-900 font-semibold">
              Live Kepware Socket Channel
            </span>
          </div>

          {/* Quick-Action Presets based on Tag Role */}
          {selectedNode.tagName === 'Recipe_Temp_SP' ? (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-600">
                Preset Setpoints (°C):
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[75.0, 85.0, 95.0, 100.0, 120.0].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={isWriting}
                    onClick={() => handleDispatchWrite(preset, 'Float')}
                    className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 text-xs font-semibold hallmark-focus active:translate-y-px transition-colors shadow-xs disabled:opacity-50"
                  >
                    {preset.toFixed(1)} °C
                  </button>
                ))}
              </div>

              {/* Custom Numeric Setpoint Dispatch */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <div className="relative w-48">
                  <input
                    type="number"
                    step="0.5"
                    value={customWriteVal}
                    onChange={(e) => setCustomWriteVal(e.target.value)}
                    placeholder="Custom setpoint..."
                    className="w-full h-9 px-3 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
                  />
                  <span className="absolute right-2.5 top-2 text-xs font-mono text-slate-400">
                    °C
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isWriting || !customWriteVal}
                  onClick={() => handleDispatchWrite(parseFloat(customWriteVal), 'Float')}
                  className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs disabled:opacity-50"
                >
                  {isWriting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>WRITING...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch Setpoint</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : selectedNode.tagName === 'Batch_State' ? (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-600">
                PackML State Transition Command:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: '1: IDLE', val: 'IDLE' },
                  { label: '2: RUNNING', val: 'RUNNING' },
                  { label: '3: COMPLETE', val: 'COMPLETE' },
                  { label: '4: STOPPED', val: 'STOPPED' },
                ].map((item) => (
                  <button
                    key={item.val}
                    type="button"
                    disabled={isWriting}
                    onClick={() => handleDispatchWrite(item.val, 'String')}
                    className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 text-xs font-semibold hallmark-focus active:translate-y-px transition-colors shadow-xs disabled:opacity-50"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ) : selectedNode.dataType === 'Boolean' || selectedNode.unit === 'Bool' ? (
            <div className="space-y-3">
              <div className="text-[11px] text-slate-600">
                Digital Command Pulse:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isWriting}
                  onClick={() => handleDispatchWrite(true, 'Boolean')}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs disabled:opacity-50"
                >
                  {isWriting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>PULSE TRUE (1)</span>
                </button>
                <button
                  type="button"
                  disabled={isWriting}
                  onClick={() => handleDispatchWrite(false, 'Boolean')}
                  className="h-9 px-4 bg-slate-700 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs disabled:opacity-50"
                >
                  <span>RESET FALSE (0)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={customWriteVal}
                onChange={(e) => setCustomWriteVal(e.target.value)}
                placeholder="Enter value to write..."
                className="w-48 h-9 px-3 text-xs font-mono border border-slate-300 bg-white hallmark-focus"
              />
              <button
                type="button"
                disabled={isWriting || !customWriteVal}
                onClick={() => handleDispatchWrite(customWriteVal, selectedNode.dataType || 'Float')}
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs disabled:opacity-50"
              >
                {isWriting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Write to Node</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Parameters / Metadata Grid */}
      <form onSubmit={handleSaveEdit} className="p-5 font-mono text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Tag ID */}
          <div className="p-3 bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Tag / Node Index</div>
            <div className="text-sm font-bold text-slate-900 mt-1">
              {selectedNode.tagId !== undefined ? `#${selectedNode.tagId}` : 'CONTAINER'}
            </div>
          </div>

          {/* Node Name */}
          <div className="p-3 bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Canonical Identifier</div>
            <div className="text-sm font-bold text-slate-900 mt-1 truncate" title={selectedNode.tagName}>
              {selectedNode.tagName}
            </div>
          </div>

          {/* Data Type */}
          <div className="p-3 bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Data Type</div>
            {isEditing ? (
              <select
                value={editDataType}
                onChange={(e) => setEditDataType(e.target.value as TagDataType)}
                className="w-full h-8 text-xs font-mono bg-white border border-slate-300 mt-1 px-2 hallmark-focus"
              >
                <option value="Real">Real (Float 32)</option>
                <option value="Boolean">Boolean (Bit)</option>
                <option value="Int">Int (16-bit)</option>
                <option value="DInt">DInt (32-bit)</option>
                <option value="Word">Word (16-bit Bitstring)</option>
                <option value="String">String</option>
              </select>
            ) : (
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {selectedNode.dataType || 'STRUCT / NODE'}
              </div>
            )}
          </div>

          {/* Access Mode */}
          <div className="p-3 bg-slate-50 border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase">Access Privilege</div>
            {isEditing ? (
              <select
                value={editAccessType}
                onChange={(e) => setEditAccessType(e.target.value as TagAccessType)}
                className="w-full h-8 text-xs font-mono bg-white border border-slate-300 mt-1 px-2 hallmark-focus"
              >
                <option value="Read">Read Only (RO)</option>
                <option value="Read/Write">Read / Write (RW)</option>
              </select>
            ) : (
              <div className="mt-1">
                {selectedNode.accessType === 'Read/Write' ? (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[11px]">
                    READ / WRITE
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-300 font-medium text-[11px]">
                    READ ONLY
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Kepware Node Address */}
          <div className="p-3 bg-slate-50 border border-slate-200 sm:col-span-2">
            <div className="text-[10px] text-slate-500 uppercase">Kepware OPC UA Node ID</div>
            {isEditing ? (
              <input
                type="text"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full h-8 text-xs font-mono bg-white border border-slate-300 mt-1 px-2 hallmark-focus"
                placeholder="e.g. ns=2;s=Simulation Examples.Functions.Ramp2"
                required
              />
            ) : (
              <div className="text-xs font-bold text-slate-900 mt-1 break-all select-all">
                {selectedNode.address}
              </div>
            )}
          </div>

          {/* Target Gateway */}
          <div className="p-3 bg-slate-50 border border-slate-200 sm:col-span-2">
            <div className="text-[10px] text-slate-500 uppercase">Target Controller / Server</div>
            {isEditing ? (
              <select
                value={editTargetPlc}
                onChange={(e) => setEditTargetPlc(e.target.value as TargetPlcOption)}
                className="w-full h-8 text-xs font-mono bg-white border border-slate-300 mt-1 px-2 hallmark-focus"
              >
                <option value="Kepware Central Gateway (Port 49320)">
                  Kepware Central Gateway (Port 49320)
                </option>
              </select>
            ) : (
              <div className="text-xs font-semibold text-slate-800 mt-1 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-slate-500" />
                <span>Kepware Central Gateway (Port 49320)</span>
              </div>
            )}
          </div>
        </div>

        {/* Description Row */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200">
          <label className="block text-[10px] text-slate-500 uppercase mb-1">
            Functional Description & Engineering Note
          </label>
          {isEditing ? (
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={2}
              className="w-full text-xs font-mono bg-white border border-slate-300 p-2 hallmark-focus"
            />
          ) : (
            <p className="text-slate-800 text-xs leading-relaxed">
              {selectedNode.description || 'No engineering note provided for this element.'}
            </p>
          )}
        </div>

        {/* Edit Mode Save Button */}
        {isEditing && (
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="h-9 px-3.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold uppercase tracking-wider font-mono hover:bg-slate-100 hallmark-focus active:translate-y-px"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider font-mono flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Mapping Changes</span>
            </button>
          </div>
        )}
      </form>

      {/* Inspector Micro Footer */}
      <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50/60 text-[10px] text-slate-500 font-mono flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>ISA-88 PHYSICAL / PROCEDURAL UNIFIED TELEMETRY HUB</span>
          <span>•</span>
          <span>OPC UA BINARY OVER TCP (ASYNCUA)</span>
        </div>
        <div>
          <span>ISA-101 HIGH SITUATIONAL AWARENESS STANDARD</span>
        </div>
      </div>

      {/* Focused Single Tag Editor Modal */}
      {selectedNode && (
        <EditSingleTagModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          tagData={selectedNode}
        />
      )}
    </div>
  );
};
