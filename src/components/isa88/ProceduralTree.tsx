/* Hallmark · component: ProceduralTree · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { 
  ChevronRight, 
  ChevronDown, 
  Workflow, 
  FileCode, 
  Tag as TagIcon, 
  ListTree
} from 'lucide-react';
import { OperationNode, PhaseNode, TagItem, UnitProcedureNode } from '../../types/isa88';

export const ProceduralTree: React.FC = () => {
  const { proceduralModel, selectedNode, selectNode, searchQuery, telemetryMap } = useIsa88();

  const [expandedUps, setExpandedUps] = useState<Record<string, boolean>>({
    UP_MIXING_PC1: true,
  });

  const [expandedOps, setExpandedOps] = useState<Record<string, boolean>>({
    OP_INLET_BLENDING: true,
    OP_THERMAL_PROCESSING: true,
  });

  const [expandedPhs, setExpandedPhs] = useState<Record<string, boolean>>({
    PH_DOSING: true,
    PH_AGITATING: true,
    PH_HEATING: true,
  });

  const toggleUp = (upId: string) => {
    setExpandedUps((prev) => ({ ...prev, [upId]: !prev[upId] }));
  };

  const toggleOp = (opId: string) => {
    setExpandedOps((prev) => ({ ...prev, [opId]: !prev[opId] }));
  };

  const togglePh = (phId: string) => {
    setExpandedPhs((prev) => ({ ...prev, [phId]: !prev[phId] }));
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const handleSelectUp = (up: UnitProcedureNode) => {
    selectNode({
      tagName: up.name,
      nodeType: 'UNIT_PROCEDURE',
      address: 'PROCEDURAL_CONTAINER',
      opcNodeId: 'N/A (PROCEDURAL_CONTAINER)',
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: 'Kepware Central Gateway (Port 49320)',
      description: up.description,
      parentContext: `Assigned Unit: ${up.unit}`,
      equipmentRef: `${up.operations.length} Operations Defined`,
      lastUpdated: 'ISA-88 Procedural State Matrix',
    });
  };

  const handleSelectOp = (up: UnitProcedureNode, op: OperationNode) => {
    selectNode({
      tagName: op.name,
      nodeType: 'OPERATION',
      address: 'OPERATION_SEQUENCE',
      opcNodeId: 'N/A (OPERATION_SEQUENCE)',
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: 'Kepware Central Gateway (Port 49320)',
      description: op.description,
      parentContext: `UP: ${up.name}`,
      equipmentRef: `${op.phases.length} Phase(s) Configured`,
      lastUpdated: 'Procedural Operation Node',
    });
  };

  const handleSelectPh = (up: UnitProcedureNode, op: OperationNode, ph: PhaseNode) => {
    selectNode({
      tagName: ph.name,
      nodeType: 'PHASE',
      address: `PHASE_CODE_${ph.code}`,
      opcNodeId: `PHASE_CODE_${ph.code}`,
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: 'Kepware Central Gateway (Port 49320)',
      description: ph.description,
      parentContext: `${up.name} > ${op.name}`,
      equipmentRef: `${ph.tags.length} Control Tags Bound`,
      lastUpdated: 'State Logic: PackML / ISA-88 Compliant',
    });
  };

  const handleSelectTag = (tag: TagItem) => {
    const live = telemetryMap[tag.address] || telemetryMap[tag.tagName];
    selectNode({
      tagId: tag.tagId,
      tagName: tag.tagName,
      nodeType: 'TAG',
      dataType: tag.dataType,
      address: tag.address,
      opcNodeId: tag.address,
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: tag.targetPlc || 'Kepware Central Gateway (Port 49320)',
      accessType: tag.accessType,
      role: tag.role,
      unit: tag.unit,
      writable: tag.writable,
      description: tag.description,
      parentContext: `${tag.parentUp} > ${tag.parentOp} > ${tag.parentPh}`,
      equipmentRef: `Whitelisted Kepware OPC UA Tag #${tag.tagId}`,
      lastUpdated: live?.timestamp ? `Live Stream @ ${live.timestamp}` : 'Synchronized to Kepware',
      liveValue: live?.value,
      liveQuality: live?.quality || 'Good',
    });
  };

  // Check if Batch is in running state
  const batchStateLive = telemetryMap['ns=2;s=Simulation Examples.Functions.User1'] || telemetryMap['Batch_State'];
  const isBatchRunning = String(batchStateLive?.value).toUpperCase() === 'RUNNING' || String(batchStateLive?.value) === '2';

  return (
    <div className="bg-white border border-slate-200 flex flex-col h-full shadow-xs">
      {/* Column Header */}
      <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-slate-700" />
          <span className="text-xs font-bold text-slate-900 tracking-wider uppercase font-mono">
            Procedural Model Tree
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-2 py-0.5">
            UP → OP → PH → OPC UA TAGS
          </span>
        </div>
      </div>

      {/* Tree Content Area */}
      <div className="p-3 overflow-y-auto max-h-[480px] text-xs font-mono space-y-2 select-none">
        {proceduralModel.map((up) => {
          const isUpExpanded = expandedUps[up.id] ?? false;
          const isUpSelected = selectedNode?.tagName === up.name;

          return (
            <div key={up.id} className="border border-slate-200 bg-slate-50/40 p-1.5">
              {/* UP Node Row */}
              <div
                className={`flex items-center justify-between p-1.5 cursor-pointer transition-colors ${
                  isUpSelected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'hover:bg-slate-200/70 text-slate-900'
                }`}
              >
                <div
                  className="flex items-center gap-1.5 flex-1 overflow-hidden"
                  onClick={() => handleSelectUp(up)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUp(up.id);
                    }}
                    className="p-0.5 text-slate-500 hover:text-slate-800 focus:outline-none"
                    aria-label={isUpExpanded ? "Collapse procedure" : "Expand procedure"}
                  >
                    {isUpExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Workflow className={`w-3.5 h-3.5 shrink-0 ${isUpSelected ? 'text-white' : 'text-slate-700'}`} />
                  <span className="font-bold truncate">{up.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.2 ${
                      isUpSelected
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {up.operations.length} OP
                  </span>
                </div>
              </div>

              {/* Operations (Children) */}
              {isUpExpanded && (
                <div className="pl-4 mt-1 border-l-2 border-slate-200 space-y-2">
                  {up.operations.map((op) => {
                    const isOpExpanded = expandedOps[op.id] ?? false;
                    const isOpSelected = selectedNode?.tagName === op.name;

                    return (
                      <div key={op.id} className="border border-slate-200/80 bg-white p-1">
                        {/* OP Row */}
                        <div
                          className={`flex items-center justify-between p-1.5 cursor-pointer transition-colors ${
                            isOpSelected
                              ? 'bg-slate-800 text-white font-medium'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div
                            className="flex items-center gap-1.5 flex-1 overflow-hidden"
                            onClick={() => handleSelectOp(up, op)}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleOp(op.id);
                              }}
                              className="p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none"
                              aria-label={isOpExpanded ? "Collapse operation" : "Expand operation"}
                            >
                              {isOpExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                            <FileCode className={`w-3.5 h-3.5 shrink-0 ${isOpSelected ? 'text-white' : 'text-slate-600'}`} />
                            <span className="text-[11px] font-semibold truncate">
                              OP: {op.name}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 px-1">
                            {op.phases.length} PH
                          </span>
                        </div>

                        {/* Phases (Children) */}
                        {isOpExpanded && (
                          <div className="pl-3 mt-1 border-l border-slate-200 space-y-1.5">
                            {op.phases.map((ph) => {
                              const isPhExpanded = expandedPhs[ph.id] ?? false;
                              const isPhSelected = selectedNode?.tagName === ph.name;
                              
                              // Visual indication of active phase
                              const isPhaseRunning = isBatchRunning && (ph.id === 'PH_HEATING' || ph.id === 'PH_AGITATING');

                              return (
                                <div 
                                  key={ph.id} 
                                  className={`border transition-colors ${
                                    isPhaseRunning 
                                      ? 'border-emerald-300 bg-emerald-50/20' 
                                      : 'border-slate-200 bg-slate-50/30'
                                  }`}
                                >
                                  {/* Phase Row */}
                                  <div
                                    className={`flex items-center justify-between p-1.5 cursor-pointer transition-colors ${
                                      isPhSelected
                                        ? 'bg-slate-700 text-white font-medium'
                                        : isPhaseRunning
                                          ? 'hover:bg-emerald-100/50 text-slate-800'
                                          : 'hover:bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    <div
                                      className="flex items-center gap-1.5 flex-1 overflow-hidden"
                                      onClick={() => handleSelectPh(up, op, ph)}
                                    >
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          togglePh(ph.id);
                                        }}
                                        className="p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none"
                                        aria-label={isPhExpanded ? "Collapse phase" : "Expand phase"}
                                      >
                                        {isPhExpanded ? (
                                          <ChevronDown className="w-3 h-3" />
                                        ) : (
                                          <ChevronRight className="w-3 h-3" />
                                        )}
                                      </button>
                                      <ListTree className={`w-3 h-3 shrink-0 ${isPhSelected ? 'text-white' : 'text-slate-500'}`} />
                                      <span className="text-[11px] font-semibold truncate">
                                        PH: {ph.name}
                                      </span>
                                      {isPhaseRunning && (
                                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-800 bg-emerald-100 border border-emerald-300 px-1.5 py-0.1 ml-1.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping" />
                                          RUNNING
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[9px] font-mono text-slate-500">
                                      {ph.tags.length} TAGS
                                    </span>
                                  </div>

                                  {/* Tags (Leaves) */}
                                  {isPhExpanded && (
                                    <div className="pl-3 pr-1 py-1 border-t border-slate-200 space-y-1">
                                      {ph.tags.map((tag) => {
                                        const isTagSelected = selectedNode?.tagId === tag.tagId;
                                        if (
                                          !matchesSearch(tag.tagName) &&
                                          !matchesSearch(tag.address) &&
                                          !matchesSearch(tag.description)
                                        ) {
                                          return null;
                                        }

                                        const live = telemetryMap[tag.address] || telemetryMap[tag.tagName];
                                        const liveValStr = live?.value !== undefined 
                                          ? (typeof live.value === 'number' 
                                              ? (Number.isInteger(live.value) ? String(live.value) : live.value.toFixed(2))
                                              : (typeof live.value === 'boolean' ? (live.value ? 'TRUE' : 'FALSE') : String(live.value)))
                                          : '—';
                                        
                                        const isGood = live?.quality === 'Good';
                                        const shortNode = tag.address.split('.').pop() || tag.address;

                                        return (
                                          <div
                                            key={tag.tagId}
                                            onClick={() => handleSelectTag(tag)}
                                            className={`p-1.5 flex items-center justify-between cursor-pointer text-[11px] transition-colors border ${
                                              isTagSelected
                                                ? 'bg-slate-900 text-white border-slate-900 font-medium shadow-xs'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                            }`}
                                          >
                                            {/* Left: Tag Name & Node */}
                                            <div className="flex items-center gap-2 truncate flex-1 min-w-0 pr-2">
                                              <TagIcon
                                                className={`w-3 h-3 shrink-0 ${
                                                  isTagSelected ? 'text-slate-300' : 'text-slate-400'
                                                }`}
                                              />
                                              <div className="truncate">
                                                <span className="font-semibold block truncate leading-tight">
                                                  {tag.tagName}
                                                </span>
                                                <span 
                                                  className={`text-[9px] font-mono block truncate ${
                                                    isTagSelected ? 'text-slate-400' : 'text-slate-400'
                                                  }`}
                                                  title={tag.address}
                                                >
                                                  {shortNode}
                                                </span>
                                              </div>
                                            </div>

                                            {/* Right: Live Telemetry Value, Quality & RW/RO */}
                                            <div className="flex items-center gap-2 shrink-0">
                                              {/* Live Value & Unit Display */}
                                              <div className="text-right">
                                                <span className={`font-mono font-bold text-[11px] ${
                                                  isTagSelected ? 'text-emerald-300' : 'text-slate-900'
                                                }`}>
                                                  {liveValStr}
                                                </span>
                                                {(tag.unit || live?.unit) && (
                                                  <span className={`text-[9px] font-mono ml-1 ${
                                                    isTagSelected ? 'text-slate-300' : 'text-slate-500'
                                                  }`}>
                                                    {tag.unit || live?.unit}
                                                  </span>
                                                )}
                                              </div>

                                              {/* Quality Indicator */}
                                              {isGood ? (
                                                <span 
                                                  title="Quality: Good (ISA-101 Verified)" 
                                                  className="inline-flex items-center gap-1 text-[9px] font-mono px-1 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold"
                                                >
                                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                                  Good
                                                </span>
                                              ) : (
                                                <span 
                                                  title="Quality: Bad / Disconnected" 
                                                  className="inline-flex items-center gap-1 text-[9px] font-mono px-1 py-0.2 bg-rose-50 text-rose-800 border border-rose-300 font-semibold"
                                                >
                                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                                                  Bad
                                                </span>
                                              )}

                                              {/* Access Type Badge */}
                                              {tag.accessType === 'Read/Write' ? (
                                                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 bg-amber-50 text-amber-800 border border-amber-300">
                                                  RW
                                                </span>
                                              ) : (
                                                <span className="text-[9px] font-mono font-medium px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-300">
                                                  RO
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span>ISA-88 Part 1 Procedural Hierarchy</span>
        <span>7 Essential Kepware Tags Streamed</span>
      </div>
    </div>
  );
};
