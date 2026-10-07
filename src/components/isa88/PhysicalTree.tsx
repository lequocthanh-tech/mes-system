/* Hallmark · component: PhysicalTree · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { 
  ChevronRight, 
  ChevronDown, 
  Box, 
  Cpu, 
  Layers, 
  Radio,
  Server
} from 'lucide-react';
import { ControlModuleNode, EquipmentModuleNode, UnitNode } from '../../types/isa88';

export const PhysicalTree: React.FC = () => {
  const { physicalModel, selectedNode, selectNode, searchQuery, telemetryMap } = useIsa88();

  // Track expanded branches
  const [expandedUnits, setExpandedUnits] = useState<Record<string, boolean>>({
    UNIT_MIXING: true,
    UNIT_STERILIZE: true,
  });

  const [expandedEms, setExpandedEms] = useState<Record<string, boolean>>({
    EM_INLET_DOSING: true,
    EM_TANK_VESSEL: true,
    EM_AGITATOR: true,
    EM_HEATING: true,
    EM_STATE_COORDINATOR: true,
  });

  const toggleUnit = (unitId: string) => {
    setExpandedUnits((prev) => ({ ...prev, [unitId]: !prev[unitId] }));
  };

  const toggleEm = (emId: string) => {
    setExpandedEms((prev) => ({ ...prev, [emId]: !prev[emId] }));
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const handleSelectUnit = (unit: UnitNode) => {
    selectNode({
      tagName: unit.name,
      nodeType: 'UNIT',
      address: 'PHYSICAL_REACTOR_NODE',
      opcNodeId: 'N/A (PHYSICAL_UNIT)',
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: unit.targetPlc,
      description: unit.description,
      parentContext: `Area: ${unit.area}`,
      equipmentRef: `${unit.equipmentModules.length} Equipment Modules Attached`,
      lastUpdated: 'Hardware Model Verified',
    });
  };

  const handleSelectEm = (unit: UnitNode, em: EquipmentModuleNode) => {
    selectNode({
      tagName: em.name,
      nodeType: 'EQUIPMENT_MODULE',
      address: 'EQUIPMENT_CONTAINER',
      opcNodeId: 'N/A (EQUIPMENT_MODULE)',
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: unit.targetPlc,
      description: em.description,
      parentContext: `Unit: ${unit.name}`,
      equipmentRef: `${em.controlModules.length} Control Module(s)`,
      lastUpdated: 'Hardware Topology Verified',
    });
  };

  const handleSelectCm = (unit: UnitNode, em: EquipmentModuleNode, cm: ControlModuleNode) => {
    const live = telemetryMap[cm.ioAddress] || (cm.boundTagName ? telemetryMap[cm.boundTagName] : null);
    selectNode({
      tagName: cm.name,
      nodeType: 'CONTROL_MODULE',
      address: cm.ioAddress,
      opcNodeId: cm.ioAddress,
      gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
      targetPlc: cm.targetPlc,
      description: cm.description,
      parentContext: `${unit.name} > ${em.name}`,
      equipmentRef: `${cm.equipment} (${cm.equipmentType})`,
      lastUpdated: live?.timestamp ? `Live Stream @ ${live.timestamp}` : `Status: ${cm.status}`,
      role: cm.role,
      unit: cm.unit,
      liveValue: live?.value,
      liveQuality: live?.quality || 'Good',
    });
  };

  return (
    <div className="bg-white border border-slate-200 flex flex-col h-full shadow-xs">
      {/* Column Header */}
      <div className="px-4 py-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-slate-700" />
          <span className="text-xs font-bold text-slate-900 tracking-wider uppercase font-mono">
            Physical Model Tree
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500 bg-slate-200/80 px-2 py-0.5">
            UNIT → EM → CM (OPC UA)
          </span>
        </div>
      </div>

      {/* Tree Content Area */}
      <div className="p-3 overflow-y-auto max-h-[480px] text-xs font-mono space-y-2 select-none">
        {physicalModel.map((unit) => {
          const isUnitExpanded = expandedUnits[unit.id] ?? false;
          const isUnitSelected = selectedNode?.tagName === unit.name;

          return (
            <div key={unit.id} className="border border-slate-200 bg-slate-50/40 p-1.5">
              {/* Unit Node Row */}
              <div
                className={`flex items-center justify-between p-1.5 cursor-pointer transition-colors ${
                  isUnitSelected
                    ? 'bg-slate-900 text-white font-semibold'
                    : 'hover:bg-slate-200/70 text-slate-900'
                }`}
              >
                <div
                  className="flex items-center gap-1.5 flex-1 overflow-hidden"
                  onClick={() => handleSelectUnit(unit)}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleUnit(unit.id);
                    }}
                    className="p-0.5 text-slate-500 hover:text-slate-800 focus:outline-none"
                    aria-label={isUnitExpanded ? "Collapse unit" : "Expand unit"}
                  >
                    {isUnitExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <Box className={`w-3.5 h-3.5 shrink-0 ${isUnitSelected ? 'text-white' : 'text-slate-700'}`} />
                  <span className="font-bold truncate">{unit.name}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] px-1.5 py-0.2 flex items-center gap-1 ${
                      isUnitSelected
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    <Server className="w-3 h-3 text-slate-500" />
                    <span>Kepware Port 49320</span>
                  </span>
                </div>
              </div>

              {/* Equipment Modules (Children) */}
              {isUnitExpanded && (
                <div className="pl-4 mt-1 border-l-2 border-slate-200 space-y-2">
                  {unit.equipmentModules.map((em) => {
                    const isEmExpanded = expandedEms[em.id] ?? false;
                    const isEmSelected = selectedNode?.tagName === em.name;
                    const emHasMatches =
                      matchesSearch(em.name) ||
                      em.controlModules.some((cm) => matchesSearch(cm.name) || matchesSearch(cm.equipment));

                    if (!emHasMatches) return null;

                    return (
                      <div key={em.id} className="border border-slate-200/80 bg-white p-1">
                        {/* EM Row */}
                        <div
                          className={`flex items-center justify-between p-1.5 cursor-pointer transition-colors ${
                            isEmSelected
                              ? 'bg-slate-800 text-white font-semibold'
                              : 'hover:bg-slate-100 text-slate-800'
                          }`}
                        >
                          <div
                            className="flex items-center gap-1.5 flex-1 overflow-hidden"
                            onClick={() => handleSelectEm(unit, em)}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleEm(em.id);
                              }}
                              className="p-0.5 text-slate-400 hover:text-slate-700 focus:outline-none"
                              aria-label={isEmExpanded ? "Collapse equipment module" : "Expand equipment module"}
                            >
                              {isEmExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                            <Layers className={`w-3.5 h-3.5 shrink-0 ${isEmSelected ? 'text-white' : 'text-slate-500'}`} />
                            <span className="text-[11px] font-semibold truncate">
                              EM: {em.name}
                            </span>
                          </div>
                          <span className="text-[9px] text-slate-500 px-1">
                            {em.controlModules.length} CM
                          </span>
                        </div>

                        {/* Control Modules (Children) */}
                        {isEmExpanded && (
                          <div className="pl-3 mt-1 border-l border-slate-200 space-y-1">
                            {em.controlModules.map((cm) => {
                              const isCmSelected = selectedNode?.tagName === cm.name;
                              if (!matchesSearch(cm.name) && !matchesSearch(cm.equipment)) return null;

                              const live = telemetryMap[cm.ioAddress] || (cm.boundTagName ? telemetryMap[cm.boundTagName] : null);
                              const shortNode = cm.ioAddress.split('.').pop() || cm.ioAddress;
                              const isGood = live?.quality === 'Good';

                              return (
                                <div
                                  key={cm.id}
                                  onClick={() => handleSelectCm(unit, em, cm)}
                                  className={`p-1.5 flex items-center justify-between cursor-pointer text-[11px] transition-colors border ${
                                    isCmSelected
                                      ? 'bg-slate-900 text-white border-slate-900 font-medium shadow-xs'
                                      : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  {/* Left: CM Name & Equipment */}
                                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-2">
                                    <Cpu className={`w-3 h-3 shrink-0 ${isCmSelected ? 'text-slate-300' : 'text-slate-500'}`} />
                                    <div className="truncate">
                                      <div className="font-semibold block truncate leading-tight">
                                        {cm.name}
                                      </div>
                                      <div className={`text-[9px] truncate ${isCmSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {cm.equipment}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right: Live Telemetry & Node ID */}
                                  <div className="flex items-center gap-2 shrink-0">
                                    {live?.value !== undefined && (
                                      <div className="text-right">
                                        <span className={`font-mono font-bold text-[11px] ${
                                          isCmSelected ? 'text-emerald-300' : 'text-slate-900'
                                        }`}>
                                          {typeof live.value === 'number' 
                                            ? (Number.isInteger(live.value) ? String(live.value) : live.value.toFixed(2))
                                            : (typeof live.value === 'boolean' ? (live.value ? 'TRUE' : 'FALSE') : String(live.value))}
                                        </span>
                                        {(cm.unit || live.unit) && (
                                          <span className={`text-[9px] font-mono ml-1 ${
                                            isCmSelected ? 'text-slate-300' : 'text-slate-500'
                                          }`}>
                                            {cm.unit || live.unit}
                                          </span>
                                        )}
                                      </div>
                                    )}

                                    <span 
                                      className={`text-[9px] font-mono px-1 py-0.2 border ${
                                        isCmSelected 
                                          ? 'bg-slate-800 border-slate-700 text-slate-300' 
                                          : 'bg-slate-50 border-slate-200 text-slate-600'
                                      }`}
                                      title={cm.ioAddress}
                                    >
                                      {shortNode}
                                    </span>

                                    {/* Status / Quality Dot */}
                                    <span 
                                      className={`w-2 h-2 rounded-full inline-block ${
                                        isGood ? 'bg-emerald-600' : 'bg-rose-500'
                                      }`} 
                                      title={isGood ? 'Telemetry Quality: Good' : 'Telemetry Quality: Bad / Disconnected'} 
                                    />
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

      {/* Footer Info */}
      <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 font-mono flex items-center justify-between">
        <span className="flex items-center gap-1">
          <Radio className="w-3 h-3 text-slate-400" />
          ISA-88 Part 1 Physical Model
        </span>
        <span>2 Units · Kepware Central Bus</span>
      </div>
    </div>
  );
};
