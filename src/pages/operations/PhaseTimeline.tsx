/* Hallmark · component: PhaseTimeline · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useOperations } from '../../context/OperationsContext';
import { Clock, Play, CheckCircle2, Pause, AlertTriangle, Radio } from 'lucide-react';

export const PhaseTimeline: React.FC = () => {
  const { 
    timelineNodes, 
    targetProcessLine, 
    setTargetProcessLine, 
    currentBatchState, 
    runningOrders 
  } = useOperations();

  // Local active cell view toggle
  const [selectedCellView, setSelectedCellView] = useState<string>(
    targetProcessLine.includes('Cell 2') ? 'Process Cell 2 (SIMIT Digital Twin)' : 'Process Cell 1 (Physical S7-1500)'
  );

  // Derive runtime scrubber position from active running order
  const activeRunningOrder = runningOrders[0];
  let currentElapsedMinutes = 18.75; // Default T+18:45
  if (activeRunningOrder) {
    const parts = activeRunningOrder.elapsedTime.split(':').map(Number);
    if (parts.length === 3) {
      currentElapsedMinutes = parts[0] * 60 + parts[1] + parts[2] / 60;
    }
  }

  const totalMinutes = 30;
  const timeTicks = [0, 5, 10, 15, 20, 25, 30];

  // Filter nodes for selected cell
  const filteredNodes = timelineNodes.filter((node) => {
    if (!node.targetCell) return true;
    return node.targetCell === selectedCellView;
  });

  const isHeld = currentBatchState === 'HELD';

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Sub-view Header */}
      <div className="bg-white border border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-bold">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
              Phase Timeline Monitoring (Sliding Gantt Horizon)
            </h2>
            <p className="text-xs text-slate-500">
              Dynamic ISA-88 recipe execution timeline with active elapsed-time scrubber & delay detection
            </p>
          </div>
        </div>

        {/* Runtime Scrubber Indicator */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 px-3 py-1 font-bold text-slate-900">
            <span className={`w-2.5 h-2.5 rounded-full ${isHeld ? 'bg-amber-500' : 'bg-rose-600'} inline-block animate-pulse`} />
            <span>CURRENT TIME: T+{currentElapsedMinutes.toFixed(1)} MIN</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2 bg-blue-600 inline-block" /> Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2 bg-emerald-600 inline-block" /> Running
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2 bg-amber-500 inline-block" /> Hold / Delay
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2 bg-slate-200 inline-block" /> Idle / Pending
            </span>
          </div>
        </div>
      </div>

      {/* Process Line Switcher Toolbar */}
      <div className="bg-white border border-slate-200 p-2 px-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-700 uppercase">Select Process Cell:</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setSelectedCellView('Process Cell 1 (Physical S7-1500)');
                setTargetProcessLine('Process Cell 1 (Physical S7-1500)');
              }}
              className={`h-8 px-3 text-xs uppercase font-mono border transition-none flex items-center gap-1.5 ${
                selectedCellView.includes('Cell 1')
                  ? 'bg-slate-900 text-white border-slate-900 font-bold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <Radio className="w-3 h-3 text-emerald-400" />
              <span>Process Cell 1 (Physical S7-1500)</span>
            </button>

            <button
              onClick={() => {
                setSelectedCellView('Process Cell 2 (SIMIT Digital Twin)');
                setTargetProcessLine('Process Cell 2 (SIMIT Digital Twin)');
              }}
              className={`h-8 px-3 text-xs uppercase font-mono border transition-none flex items-center gap-1.5 ${
                selectedCellView.includes('Cell 2')
                  ? 'bg-slate-900 text-white border-slate-900 font-bold'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              <Radio className="w-3 h-3 text-sky-400" />
              <span>Process Cell 2 (SIMIT Digital Twin)</span>
            </button>
          </div>
        </div>

        {/* Delay Status Notice */}
        {isHeld && (
          <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2.5 py-1 text-amber-800 font-bold text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>INTERLOCK: BATCH CURRENTLY HELD · PHASES ON HOLD</span>
          </div>
        )}
      </div>

      {/* Main Gantt Chart Container */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        {/* Timeline Header Row (Labels & Time Marks) */}
        <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50">
          {/* Left Column Header (Entities) */}
          <div className="col-span-4 sm:col-span-3 p-3 font-bold text-slate-800 uppercase text-[11px] border-r border-slate-200">
            Procedural Node ({filteredNodes.length})
          </div>

          {/* Right Gantt Axis Header */}
          <div className="col-span-8 sm:col-span-9 relative py-3 px-2">
            <div className="flex justify-between text-[11px] text-slate-600 font-bold px-1">
              {timeTicks.map((tick) => (
                <div key={tick} className="flex flex-col items-center">
                  <span>T+{tick}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline Rows Area */}
        <div className="divide-y divide-slate-200 max-h-[580px] overflow-y-auto relative">
          {filteredNodes.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No active procedural timeline nodes configured for this cell.
            </div>
          ) : (
            filteredNodes.map((node) => {
              const leftPercent = Math.max(0, Math.min(100, (node.startMinute / totalMinutes) * 100));
              const widthPercent = Math.max(2, Math.min(100 - leftPercent, (node.durationMinutes / totalMinutes) * 100));

              const isUp = node.type === 'UP';
              const isOp = node.type === 'OP';
              const isNodeRunning = node.status === 'RUNNING';
              const isNodeCompleted = node.status === 'COMPLETED';
              const isNodeHeld = isHeld || node.status === 'HELD';

              return (
                <div
                  key={node.id}
                  className={`grid grid-cols-12 items-center hover:bg-slate-50 transition-none ${
                    isUp ? 'bg-slate-50/70 font-bold' : isOp ? 'bg-white font-semibold' : 'bg-white'
                  }`}
                >
                  {/* Left Column: Procedural Node Code & Name */}
                  <div className="col-span-4 sm:col-span-3 p-2.5 border-r border-slate-200 flex items-center justify-between gap-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 truncate">
                      {/* Node Type Badge */}
                      <span
                        className={`text-[9px] px-1 py-0.2 font-mono font-bold shrink-0 ${
                          isUp
                            ? 'bg-slate-900 text-white'
                            : isOp
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {node.type}
                      </span>

                      <span className="text-slate-900 truncate" title={`${node.code} - ${node.name}`}>
                        {node.code} <span className="text-slate-500 text-[10px] font-normal">{node.name}</span>
                      </span>
                    </div>

                    {/* Micro Status Dot */}
                    <div className="shrink-0">
                      {isNodeRunning && !isNodeHeld && <Play className="w-3 h-3 text-emerald-600 animate-pulse" />}
                      {isNodeCompleted && <CheckCircle2 className="w-3 h-3 text-blue-600" />}
                      {isNodeHeld && <Pause className="w-3 h-3 text-amber-600" />}
                    </div>
                  </div>

                  {/* Right Area: Gantt Bar Track */}
                  <div className="col-span-8 sm:col-span-9 p-2 relative h-9 flex items-center">
                    {/* Background Grid Guidelines every 5 min */}
                    <div className="absolute inset-0 flex justify-between pointer-events-none px-3">
                      {timeTicks.map((tick) => (
                        <div key={tick} className="h-full border-r border-slate-100" />
                      ))}
                    </div>

                    {/* Scrubber Line (Live Marker at current runtime) */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-red-600 z-20 pointer-events-none"
                      style={{ left: `${Math.min(100, (currentElapsedMinutes / totalMinutes) * 100)}%` }}
                    />

                    {/* Horizontal Progress Bar */}
                    <div
                      className={`h-5 border text-[10px] font-mono font-semibold flex items-center justify-between px-2 z-10 transition-none ${
                        isNodeHeld
                          ? 'bg-amber-500/90 border-amber-600 text-white ring-1 ring-amber-400'
                          : isNodeRunning
                          ? 'bg-emerald-600 border-emerald-700 text-white animate-pulse'
                          : isNodeCompleted
                          ? 'bg-blue-600 border-blue-700 text-white'
                          : 'bg-slate-200 border-slate-300 text-slate-500'
                      }`}
                      style={{
                        marginLeft: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                      }}
                    >
                      <span className="truncate">{node.code}</span>
                      <span className="text-[9px] opacity-90">{node.durationMinutes}m</span>
                    </div>

                    {/* Delay Warning Badge if Held */}
                    {isNodeHeld && isNodeRunning && (
                      <span className="absolute right-4 text-[9px] bg-amber-100 border border-amber-300 text-amber-800 px-1.5 py-0.2 font-bold z-20">
                        ● HOLD / DELAY
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Timeline Info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>ANSI/ISA-88 PART 1 EXECUTION HORIZON · REAL-TIME SCRUBBER SYNCHRONIZATION</span>
          </div>
          <div>
            <span>CURRENT PROCESS CELL: {selectedCellView}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhaseTimeline;
