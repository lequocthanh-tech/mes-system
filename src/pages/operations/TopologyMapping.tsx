/* Hallmark · component: TopologyMapping · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useOperations } from '../../context/OperationsContext';
import { TopologyEntityStatus, TopologyPhase } from '../../types/operations';
import { 
  Network, 
  Server, 
  Layers, 
  Cpu, 
  X, 
  ShieldCheck,
  Radio
} from 'lucide-react';

export const TopologyMapping: React.FC = () => {
  const { topologyCards, targetProcessLine, currentBatchState } = useOperations();

  // Selected phase for ISA-101 Drill-Down Faceplate
  const [inspectedPhase, setInspectedPhase] = useState<{
    phase: TopologyPhase;
    unitName: string;
    targetCell: string;
  } | null>(null);

  const getStatusColor = (status: TopologyEntityStatus) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-emerald-500 border-emerald-600';
      case 'HELD':
        return 'bg-amber-400 border-amber-500';
      case 'FAULT':
        return 'bg-rose-500 border-rose-600';
      case 'COMPLETED':
        return 'bg-blue-500 border-blue-600';
      case 'IDLE':
      default:
        return 'bg-slate-300 border-slate-400';
    }
  };

  const getStatusLabel = (status: TopologyEntityStatus) => {
    switch (status) {
      case 'RUNNING':
        return 'RUNNING';
      case 'HELD':
        return 'HELD';
      case 'FAULT':
        return 'FAULT';
      case 'COMPLETED':
        return 'COMPLETED';
      case 'IDLE':
      default:
        return 'IDLE';
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs relative">
      {/* Header Bar */}
      <div className="bg-white border border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold">
            <Network className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
              Topology Status Mapping (ISA-88 Procedural Hierarchy)
            </h2>
            <p className="text-xs text-slate-500">
              Live Unit Procedure (UP) $\rightarrow$ Operation (OP) $\rightarrow$ Phase (PH) state telemetry across physical & twin cells
            </p>
          </div>
        </div>

        {/* Legend of Flat Square Status Blocks */}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5">
          <span className="font-semibold text-slate-500 uppercase text-[10px]">LEGEND:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-slate-300 border border-slate-400 inline-block" />
            <span>IDLE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-emerald-500 border border-emerald-600 inline-block" />
            <span>RUNNING</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-400 border border-amber-500 inline-block" />
            <span>HELD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-rose-500 border border-rose-600 inline-block" />
            <span>FAULT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-blue-500 border border-blue-600 inline-block" />
            <span>COMPLETED</span>
          </div>
        </div>
      </div>

      {/* Active Line Notice */}
      <div className="bg-slate-50 border border-slate-200 p-2.5 px-4 flex flex-wrap items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-emerald-600" />
          <span>SUPERVISED CELL: <strong className="text-slate-900">{targetProcessLine}</strong></span>
          <span className="text-slate-400">|</span>
          <span>BATCH STATE: <strong className="text-emerald-700">{currentBatchState}</strong></span>
        </div>
        <div className="text-[11px] text-slate-500">
          Click any Phase card below to launch the ISA-101 Phase Inspection Faceplate
        </div>
      </div>

      {/* 4 Vertical Process Cell Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {topologyCards.map((card) => {
          const isCardActive = targetProcessLine.includes('Cell 2') 
            ? card.targetCell.includes('Cell 2')
            : card.targetCell.includes('Cell 1');

          return (
            <div 
              key={card.id} 
              className={`bg-white border shadow-xs flex flex-col h-full transition-none ${
                isCardActive ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200 opacity-90'
              }`}
            >
              {/* Card Header */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                    <Server className="w-4 h-4 text-slate-700" />
                    {card.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 border ${getStatusColor(card.status)}`} />
                    <span className="text-[10px] font-bold text-slate-700">
                      {getStatusLabel(card.status)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 font-normal">
                  {card.unitLabel}
                </div>

                <div className="flex items-center justify-between text-[10px] mt-1">
                  <span className="text-slate-600 bg-slate-200/70 px-2 py-0.5 inline-block">
                    {card.targetCell}
                  </span>
                  {card.targetCell.includes('SIMIT') && (
                    <span className="text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.2 font-bold">
                      DIGITAL TWIN
                    </span>
                  )}
                </div>
              </div>

              {/* Nested Operations & Phases Tree */}
              <div className="p-3.5 space-y-3 flex-1 overflow-y-auto max-h-[540px]">
                {card.operations.map((op) => (
                  <div key={op.id} className="border border-slate-200 bg-slate-50/50 p-2.5 space-y-2">
                    {/* Operation Header */}
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-600" />
                        <span className="font-bold text-slate-800 text-[11px]">
                          {op.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={`w-2.5 h-2.5 border ${getStatusColor(op.status)}`} />
                        <span className="text-[9px] text-slate-600 font-semibold">
                          {getStatusLabel(op.status)}
                        </span>
                      </div>
                    </div>

                    {/* Phases List (Interactive Cards) */}
                    <div className="space-y-1.5 pl-2 border-l-2 border-slate-200">
                      {op.phases.map((ph) => {
                        const isCurrentInspected = inspectedPhase?.phase.id === ph.id;
                        return (
                          <div
                            key={ph.id}
                            onClick={() => setInspectedPhase({ phase: ph, unitName: card.name, targetCell: card.targetCell })}
                            className={`p-2 bg-white border cursor-pointer transition-none flex flex-col justify-between gap-1 ${
                              isCurrentInspected
                                ? 'border-sky-600 bg-sky-50/50 shadow-xs'
                                : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="font-bold text-slate-900 text-[11px]">
                                  {ph.name}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className={`w-2.5 h-2.5 border ${getStatusColor(ph.status)}`} />
                                <span className="text-[9px] text-slate-500 font-semibold">
                                  {getStatusLabel(ph.status)}
                                </span>
                              </div>
                            </div>

                            {/* Active Step & Equipment Module */}
                            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                              <span className="truncate max-w-[140px] text-slate-700">
                                {ph.activeStep || 'Standby'}
                              </span>
                              <span className="text-[9px] text-sky-700 underline">
                                Faceplate $\rightarrow$
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* =======================================================
          ISA-101 DRILL-DOWN PHASE INSPECTION FACEPLATE (DRAWER)
         ======================================================= */}
      {inspectedPhase && (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l border-slate-300 shadow-2xl z-50 flex flex-col font-mono text-xs">
          {/* Faceplate Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider">
                  ISA-101 PHASE FACEPLATE
                </h3>
                <div className="text-[10px] text-slate-300">
                  {inspectedPhase.phase.code} · {inspectedPhase.phase.name}
                </div>
              </div>
            </div>
            <button
              onClick={() => setInspectedPhase(null)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Faceplate Body Content */}
          <div className="p-4 space-y-4 flex-1 overflow-y-auto">
            {/* Status Strip */}
            <div className="p-3 bg-slate-50 border border-slate-200 flex items-center justify-between">
              <span className="text-slate-500 uppercase text-[10px]">CURRENT PHASE STATE:</span>
              <div className="flex items-center gap-1.5">
                <span className={`w-3 h-3 border ${getStatusColor(inspectedPhase.phase.status)}`} />
                <span className="font-bold text-slate-900">
                  {getStatusLabel(inspectedPhase.phase.status)}
                </span>
              </div>
            </div>

            {/* Context Details */}
            <div className="space-y-2 border border-slate-200 p-3 bg-white">
              <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1">
                Equipment & Node Hierarchy
              </div>
              <div className="space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Unit Procedure:</span>
                  <span className="font-bold text-slate-900">{inspectedPhase.unitName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Cell:</span>
                  <span className="font-semibold text-slate-800">{inspectedPhase.targetCell}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Equipment Module:</span>
                  <span className="font-bold text-sky-800">{inspectedPhase.phase.equipmentModule || 'EM-General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Node ID:</span>
                  <span className="font-mono bg-slate-100 px-1 text-[10px] text-slate-800">{inspectedPhase.phase.targetNodeId || 'Node_SP'}</span>
                </div>
              </div>
            </div>

            {/* Parameter & Process Deviation Matrix */}
            <div className="space-y-2 border border-slate-200 p-3 bg-white">
              <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide border-b border-slate-200 pb-1">
                Telemetry SP / PV Comparison
              </div>

              <div className="grid grid-cols-2 gap-2 text-center pt-1">
                <div className="p-2.5 bg-blue-50 border border-blue-200">
                  <span className="text-[10px] text-blue-700 block font-semibold">RECIPE SP</span>
                  <span className="font-bold text-blue-900 text-sm">
                    {inspectedPhase.phase.spValue !== undefined ? inspectedPhase.phase.spValue : 100.0} {inspectedPhase.phase.unit || ''}
                  </span>
                </div>

                <div className="p-2.5 bg-emerald-50 border border-emerald-200">
                  <span className="text-[10px] text-emerald-700 block font-semibold">ACTUAL PV</span>
                  <span className="font-bold text-emerald-900 text-sm">
                    {inspectedPhase.phase.pvValue !== undefined ? inspectedPhase.phase.pvValue : 99.8} {inspectedPhase.phase.unit || ''}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Allowed Tolerance:</span>
                  <span className="font-semibold text-slate-800">{inspectedPhase.phase.tolerance || '±1.0%'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Active Procedural Step:</span>
                  <span className="font-bold text-slate-900">{inspectedPhase.phase.activeStep || 'Normal Execution'}</span>
                </div>
              </div>
            </div>

            {/* Diagnostic Footnote */}
            <div className="p-3 bg-slate-50 border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ISA-101 Phase Interlock Diagnostics</span>
              </div>
              <p>
                Direct phase supervision allows operators to verify equipment motor & valve telemetry without switching views.
              </p>
            </div>
          </div>

          {/* Faceplate Action Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
            <button
              onClick={() => setInspectedPhase(null)}
              className="h-8 px-4 bg-slate-900 hover:bg-slate-800 text-white font-mono text-xs uppercase"
            >
              Close Faceplate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopologyMapping;
