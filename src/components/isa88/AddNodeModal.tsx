/* Hallmark · component: AddNodeModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { TargetPlcOption, TagDataType, TagAccessType } from '../../types/isa88';
import { X, Plus, Box, Tag as TagIcon, Check } from 'lucide-react';

interface AddNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KEPWARE_TARGET: TargetPlcOption = 'Kepware Central Gateway (Port 49320)';

export const AddNodeModal: React.FC<AddNodeModalProps> = ({ isOpen, onClose }) => {
  const { physicalModel, addPhysicalNode, addProceduralTag } = useIsa88();

  const [mode, setMode] = useState<'physical' | 'procedural'>('physical');

  // Physical Form State
  const [selectedUnitId, setSelectedUnitId] = useState<string>(physicalModel[0]?.id || 'UNIT_MIXING');
  const [emName, setEmName] = useState<string>('');
  const [cmName, setCmName] = useState<string>('');
  const [equipment, setEquipment] = useState<string>('');
  const [targetPlc, setTargetPlc] = useState<TargetPlcOption>(KEPWARE_TARGET);

  // Procedural Tag Form State
  const [tagName, setTagName] = useState<string>('');
  const [address, setAddress] = useState<string>('ns=2;s=Simulation Examples.Functions.CustomTag');
  const [dataType, setDataType] = useState<TagDataType>('Real');
  const [accessType, setAccessType] = useState<TagAccessType>('Read/Write');
  const [description, setDescription] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmitPhysical = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emName.trim() || !cmName.trim() || !equipment.trim()) return;

    addPhysicalNode(selectedUnitId, emName.trim(), cmName.trim(), equipment.trim(), targetPlc);
    onClose();
  };

  const handleSubmitProcedural = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim() || !address.trim()) return;

    addProceduralTag('UP_MIXING_PC1', 'OP_INLET_BLENDING', 'PH_DOSING', {
      tagName: tagName.trim(),
      dataType,
      address: address.trim(),
      targetPlc,
      accessType,
      description: description.trim() || `User-defined procedural tag ${tagName}`,
      parentUp: 'UP_MIXING_PC1',
      parentOp: 'OP_INLET_BLENDING',
      parentPh: 'PH_DOSING',
      gatewaySource: 'Kepware OPC UA',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white border border-slate-300 shadow-xl max-w-lg w-full font-mono text-xs">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-slate-900 uppercase">Add ISA-88 Model Node</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 focus:outline-none"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector: Physical vs Procedural */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-100/50">
          <button
            type="button"
            onClick={() => setMode('physical')}
            className={`h-10 text-xs font-semibold uppercase flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'physical'
                ? 'bg-white border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>Physical Node (EM / CM)</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('procedural')}
            className={`h-10 text-xs font-semibold uppercase flex items-center justify-center gap-1.5 transition-colors ${
              mode === 'procedural'
                ? 'bg-white border-b-2 border-slate-900 text-slate-900'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <TagIcon className="w-3.5 h-3.5" />
            <span>Procedural Tag (PH Tag)</span>
          </button>
        </div>

        {/* Form Body */}
        {mode === 'physical' ? (
          <form onSubmit={handleSubmitPhysical} className="p-5 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Parent Unit
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
              >
                {physicalModel.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} (Kepware Port 49320)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Equipment Module (EM) Name
              </label>
              <input
                type="text"
                value={emName}
                onChange={(e) => setEmName(e.target.value)}
                placeholder="e.g. INLET DOSING MODULE"
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Control Module (CM) Name
              </label>
              <input
                type="text"
                value={cmName}
                onChange={(e) => setCmName(e.target.value)}
                placeholder="e.g. PUMP_DOSING_CMD"
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Physical Equipment Reference
              </label>
              <input
                type="text"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. P-101 (Positive Displacement Dosing Pump)"
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Target Gateway / Server
              </label>
              <select
                value={targetPlc}
                onChange={(e) => setTargetPlc(e.target.value as TargetPlcOption)}
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
              >
                <option value="Kepware Central Gateway (Port 49320)">
                  Kepware Central Gateway (Port 49320)
                </option>
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs uppercase font-semibold hallmark-focus active:translate-y-px"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs uppercase font-semibold flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Physical Node</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSubmitProcedural} className="p-5 space-y-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Tag Name
              </label>
              <input
                type="text"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                placeholder="e.g. Temp_Sterilizer_PV"
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Data Type
                </label>
                <select
                  value={dataType}
                  onChange={(e) => setDataType(e.target.value as TagDataType)}
                  className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                >
                  <option value="Real">Real (Float)</option>
                  <option value="Boolean">Boolean</option>
                  <option value="Int">Int (16-bit)</option>
                  <option value="DInt">DInt (32-bit)</option>
                  <option value="Word">Word</option>
                  <option value="String">String</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                  Access Type
                </label>
                <select
                  value={accessType}
                  onChange={(e) => setAccessType(e.target.value as TagAccessType)}
                  className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                >
                  <option value="Read">Read Only (RO)</option>
                  <option value="Read/Write">Read / Write (RW)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Kepware OPC UA Node ID
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. ns=2;s=Simulation Examples.Functions.Ramp2"
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Target Gateway / Server
              </label>
              <select
                value={targetPlc}
                onChange={(e) => setTargetPlc(e.target.value as TargetPlcOption)}
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
              >
                <option value="Kepware Central Gateway (Port 49320)">
                  Kepware Central Gateway (Port 49320)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tag purpose & engineering description"
                className="w-full h-9 text-xs font-mono bg-white border border-slate-300 px-2.5 hallmark-focus"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs uppercase font-semibold hallmark-focus active:translate-y-px"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs uppercase font-semibold flex items-center gap-1.5 hallmark-focus active:translate-y-px shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save Procedural Tag</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
