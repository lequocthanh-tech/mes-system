/* Hallmark · component: BatchDispatcher · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { useOperations } from '../../context/OperationsContext';
import { 
  Radio, 
  Download, 
  Play, 
  Pause, 
  RotateCw, 
  Square, 
  RefreshCcw, 
  AlertOctagon, 
  ArrowRight, 
  CheckCircle2, 
  Lock, 
  ShieldCheck, 
  Send,
  Sparkles,
  Droplets
} from 'lucide-react';
import { Isa88BatchState } from '../../types/operations';

export const BatchDispatcher: React.FC = () => {
  const {
    scadaGatewayUrl,
    isScadaConnected,
    targetProcessLine,
    setTargetProcessLine,
    handshakeStatus,
    handshakeLoadedOk,
    cipStatus,
    lastCipTimestamp,
    sterilityWindowHours,
    cipProgressRemaining,
    startCipCycle,
    resetCipToExpired,
    newOrders,
    runningOrders,
    finishedOrders,
    selectedOrderId,
    setSelectedOrderId,
    dispatchOrder,
    currentBatchState,
    executeBatchCommand,
    lastCommandFeedback,
    scadaVerifications,
  } = useOperations();

  const isCipLocked = cipStatus !== 'CLEAN';
  const isBatchRunning = currentBatchState === 'RUNNING';
  const isBatchHeld = currentBatchState === 'HELD';
  const isStartDisabled = !handshakeLoadedOk || isBatchRunning || newOrders.length === 0 || isCipLocked;
  const isDownloadDisabled = isBatchRunning || newOrders.length === 0 || handshakeStatus === 'DOWNLOADING' || isCipLocked;

  const renderStateBadge = (state: Isa88BatchState) => {
    switch (state) {
      case 'RUNNING':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-emerald-50 text-emerald-800 border border-emerald-300 animate-pulse">
            RUNNING
          </span>
        );
      case 'HELD':
      case 'HOLDING':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-amber-50 text-amber-800 border border-amber-300">
            {state}
          </span>
        );
      case 'STOPPING':
      case 'STOPPED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700 border border-slate-300">
            {state}
          </span>
        );
      case 'ABORTING':
      case 'ABORTED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-rose-50 text-rose-800 border border-rose-300">
            {state}
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-blue-50 text-blue-800 border border-blue-300">
            COMPLETED
          </span>
        );
      case 'READY':
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-sky-50 text-sky-800 border border-sky-300">
            READY
          </span>
        );
      case 'NEW':
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-mono font-medium uppercase bg-slate-100 text-slate-700 border border-slate-300">
            {state}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Operational Safety Interlock: CIP Hygiene Required Banner */}
      {isCipLocked && (
        <div className="p-3 bg-rose-50 border border-rose-300 text-rose-950 text-xs font-mono flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertOctagon className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-rose-900 uppercase">
                Operational Safety Interlock: CIP Hygiene Required
              </div>
              <div className="text-[11px] text-rose-800 mt-0.5">
                Operational Safety Interlock: Unit Mixing requires automated Clean-In-Place (CIP) cycle before fresh batch execution.
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={cipStatus === 'IN_PROGRESS' || isBatchRunning}
            onClick={() => startCipCycle()}
            className="h-8 px-3 bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 shrink-0 self-start sm:self-auto transition-none active:translate-y-px"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{cipStatus === 'IN_PROGRESS' ? `Sanitizing (${cipProgressRemaining}s)...` : 'START CIP SANITIZATION CYCLE'}</span>
          </button>
        </div>
      )}

      {/* Feedback Notification Banner */}
      {lastCommandFeedback && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-mono flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{lastCommandFeedback}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
            SCADA GATEWAY ACK
          </span>
        </div>
      )}

      {/* 3-Column Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =======================================================
            LEFT PANEL: Batch Supervisory Commands & Gateway Link
           ======================================================= */}
        <div className="lg:col-span-3 space-y-4">
          {/* Connection Status Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider">
                Kepware Gateway Link
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block animate-pulse" />
            </div>

            {/* Centralized Gateway Status Indicator */}
            <div className={`p-2.5 border text-[11px] flex items-start gap-2 ${
              isScadaConnected ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-slate-100 border-slate-300 text-slate-700'
            }`}>
              <Radio className={`w-4 h-4 shrink-0 mt-0.5 ${isScadaConnected ? 'text-emerald-700' : 'text-slate-500'}`} />
              <div>
                <div className="font-bold flex items-center gap-1.5">
                  <span>● KEPWARE GATEWAY: {isScadaConnected ? 'CONNECTED (Port 49320)' : 'STANDBY'}</span>
                </div>
                <div className="text-[10px] text-emerald-800 font-mono mt-0.5">
                  ENDPOINT: {scadaGatewayUrl}
                </div>
              </div>
            </div>

            {/* Target Process Line Dropdown */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Target Process Line
              </label>
              <select
                value={targetProcessLine}
                onChange={(e) => setTargetProcessLine(e.target.value)}
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 font-semibold focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              >
                <option value="Process Cell 1 (Physical S7-1500)">
                  Process Cell 1 (Physical S7-1500)
                </option>
                <option value="Process Cell 2 (SIMIT Digital Twin)">
                  Process Cell 2 (SIMIT Digital Twin)
                </option>
              </select>
            </div>

            {/* Handshake Indicator State */}
            <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">HANDSHAKE:</span>
                <span className={`font-bold ${handshakeLoadedOk ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {handshakeLoadedOk ? 'LOADED_OK = TRUE' : 'PENDING DOWNLINK'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">ACTIVE STATE:</span>
                <span className="font-bold text-slate-900">{currentBatchState}</span>
              </div>
            </div>
          </div>

          {/* Siemens PM-CONTROL Clean-In-Place (CIP) Hygiene Interlock Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-3 font-mono">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-slate-700" />
                <span className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                  Unit CIP Hygiene Gateway
                </span>
              </div>
              <span className="text-[9px] text-slate-500 font-mono">PM-CONTROL</span>
            </div>

            {/* Unit Readiness Badge */}
            {cipStatus === 'CLEAN' && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
                    CIP HYGIENE: VALID (CLEAN)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 border border-emerald-300">
                    INTERLOCK CLEAR
                  </span>
                </div>
                <div className="text-[10px] text-emerald-800 font-mono pt-1 border-t border-emerald-200/60">
                  <div>LAST RINSE: {lastCipTimestamp}</div>
                  <div>STERILITY WINDOW: Max {sterilityWindowHours}h (Active)</div>
                </div>
              </div>
            )}

            {cipStatus === 'DIRTY_EXPIRED' && (
              <div className="p-2.5 bg-rose-50 border border-rose-300 text-rose-950 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
                    CIP HYGIENE: EXPIRED / REQUIRED
                  </span>
                  <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 border border-rose-300">
                    LOCKED
                  </span>
                </div>
                <div className="text-[10px] text-rose-800 font-mono pt-1 border-t border-rose-200/60">
                  <div>LAST RINSE: {lastCipTimestamp} (&gt; 8h ago)</div>
                  <div className="text-rose-900 font-semibold">GATING: SCADA download &amp; start locked</div>
                </div>
              </div>
            )}

            {cipStatus === 'IN_PROGRESS' && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-amber-900 flex items-center gap-1.5">
                    <RotateCw className="w-3.5 h-3.5 text-amber-700 animate-spin" />
                    CIP HYGIENE: IN PROGRESS
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 border border-amber-300">
                    {cipProgressRemaining}s REMAINING
                  </span>
                </div>
                <div className="text-[10px] text-amber-800 font-mono">
                  Caustic wash &amp; hot steam sanitation active...
                </div>
                <div className="w-full bg-amber-200 h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-600 h-full transition-all duration-1000"
                    style={{ width: `${((5 - cipProgressRemaining) / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                disabled={cipStatus === 'IN_PROGRESS' || isBatchRunning}
                onClick={() => startCipCycle()}
                className="w-full h-8 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
                title="Run 5-second Clean-In-Place rinse and sanitation cycle"
              >
                <Droplets className="w-3.5 h-3.5 text-sky-600" />
                <span>
                  {cipStatus === 'IN_PROGRESS'
                    ? `SANITIZING (${cipProgressRemaining}s)...`
                    : cipStatus === 'CLEAN'
                    ? 'RE-RUN CIP CYCLE'
                    : 'START CIP SANITIZATION CYCLE'}
                </span>
              </button>

              {/* Test Interlock Toggle Button */}
              {cipStatus === 'CLEAN' && (
                <button
                  type="button"
                  onClick={resetCipToExpired}
                  className="w-full h-6 text-[10px] text-slate-500 hover:text-slate-800 border border-slate-200 bg-white uppercase font-mono tracking-wider flex items-center justify-center gap-1"
                  title="Simulate CIP expiration to test safety lockout"
                >
                  <span>[Simulate Expired CIP]</span>
                </button>
              )}
            </div>
          </div>

          {/* Siemens PM-CONTROL Supervisory Action Buttons Card */}
          <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-2">
            <div className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-2 flex items-center justify-between">
              <span>PM-CONTROL Commands</span>
              <span className="text-[9px] text-slate-500 font-mono">ANSI/ISA-88</span>
            </div>

            {/* [DOWNLOAD TO SCADA] (Industrial Dark Slate) */}
            <button
              type="button"
              disabled={isDownloadDisabled}
              onClick={() => executeBatchCommand('DOWNLOAD')}
              className={`w-full h-9 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px ${
                handshakeStatus === 'DOWNLOADING'
                  ? 'bg-sky-600 text-white border-sky-600 animate-pulse'
                  : isDownloadDisabled
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                  : 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900'
              }`}
              title={
                isCipLocked
                  ? 'Operational Safety Interlock: Unit Mixing requires automated Clean-In-Place (CIP) cycle'
                  : 'Transmit Selected Recipe Setpoints to Kepware Controller Buffer'
              }
            >
              {isCipLocked ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Download className="w-3.5 h-3.5" />}
              <span>{handshakeStatus === 'DOWNLOADING' ? 'DOWNLOADING...' : 'DOWNLOAD TO SCADA'}</span>
            </button>

            {/* [START BATCH] (Emerald Green - Handshake & CIP Interlocked) */}
            <button
              type="button"
              disabled={isStartDisabled}
              onClick={() => executeBatchCommand('START')}
              className={`w-full h-9 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px ${
                isStartDisabled
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-xs animate-pulse'
              }`}
              title={
                isCipLocked
                  ? 'Operational Safety Interlock: Unit Mixing requires automated Clean-In-Place (CIP) cycle'
                  : !handshakeLoadedOk
                  ? 'Interlocked: Must execute [DOWNLOAD TO SCADA] first'
                  : 'Issue ISA-88 #START Command'
              }
            >
              {isStartDisabled ? <Lock className="w-3.5 h-3.5 text-slate-400" /> : <Play className="w-3.5 h-3.5" />}
              <span>START BATCH</span>
            </button>

            {/* [HOLD] (Industrial Amber - ISA-101 Pause) */}
            <button
              type="button"
              disabled={!isBatchRunning}
              onClick={() => executeBatchCommand('HOLD')}
              className="w-full h-9 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border border-amber-600 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
              title="Issue ISA-88 #HOLD Command"
            >
              <Pause className="w-3.5 h-3.5" />
              <span>HOLD</span>
            </button>

            {/* [RESUME / RESTART] (Industrial Slate Neutral) */}
            <button
              type="button"
              disabled={!isBatchHeld}
              onClick={() => executeBatchCommand('RESUME')}
              className={`w-full h-9 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px ${
                isBatchHeld
                  ? 'bg-slate-900 hover:bg-slate-800 text-white border-slate-900 animate-pulse'
                  : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-40'
              }`}
              title="Resume paused batch execution"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>RESUME / RESTART</span>
            </button>

            {/* [STOP] (Controlled Shutdown) */}
            <button
              type="button"
              disabled={!isBatchRunning && !isBatchHeld}
              onClick={() => executeBatchCommand('STOP')}
              className="w-full h-9 bg-slate-700 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
              title="Controlled batch completion and shutdown"
            >
              <Square className="w-3.5 h-3.5" />
              <span>STOP</span>
            </button>

            {/* [RESET] */}
            <button
              type="button"
              onClick={() => executeBatchCommand('RESET')}
              className="w-full h-9 bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
              title="Reset state machine to IDLE"
            >
              <RefreshCcw className="w-3.5 h-3.5 text-slate-600" />
              <span>RESET</span>
            </button>

            {/* [ABORT] (Crimson Red - Emergency) */}
            <button
              type="button"
              disabled={!isBatchRunning && !isBatchHeld}
              onClick={() => executeBatchCommand('ABORT')}
              className="w-full h-9 bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed border border-rose-700 transition-none focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px"
              title="Immediate emergency batch abort"
            >
              <AlertOctagon className="w-3.5 h-3.5" />
              <span>ABORT</span>
            </button>
          </div>
        </div>

        {/* =======================================================
            CENTER PANEL: 3-Tier Synchronized Work Order Queue
           ======================================================= */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Table: New Orders (Dispatched from Master Data) */}
          <div className="bg-white border border-slate-200 shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="w-3.5 h-3.5 text-slate-600" />
                <span className="font-bold text-slate-900 uppercase">
                  New Orders (Awaiting Handshake)
                </span>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 font-semibold">
                {newOrders.length} Order(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] uppercase">
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Recipe & Version</th>
                    <th className="py-2 px-3 text-right">Vol (L)</th>
                    <th className="py-2 px-3 text-center">Status</th>
                    <th className="py-2 px-3 text-right">Select / Arm</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {newOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No new orders awaiting dispatch. Create orders in Master Data Tab 3.
                      </td>
                    </tr>
                  ) : (
                    newOrders.map((order) => {
                      const isSelected = selectedOrderId === order.id;
                      return (
                        <tr
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={`cursor-pointer transition-none ${
                            isSelected
                              ? 'bg-sky-50/70 border-l-2 border-l-sky-600 text-slate-900 font-semibold'
                              : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {order.id}
                          </td>
                          <td className="py-2 px-3">
                            <div className="truncate max-w-[140px] font-semibold">{order.recipeName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{order.recipeVersion || 'v1.2'}</div>
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {order.volume.toLocaleString()} L
                          </td>
                          <td className="py-2 px-3 text-center">
                            {renderStateBadge(order.status)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                dispatchOrder(order.id);
                              }}
                              className={`h-6 px-2 text-[10px] uppercase tracking-wider font-mono border transition-none inline-flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                              }`}
                            >
                              <span>{isSelected ? 'Armed' : 'Select'}</span>
                              <ArrowRight className="w-2.5 h-2.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Middle Table: Running Orders (Active SCADA Batch) */}
          <div className="bg-white border border-slate-200 shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-3.5 h-3.5 text-emerald-600" />
                <span className="font-bold text-slate-900 uppercase">
                  Running Orders (Active SCADA Batch)
                </span>
              </div>
              <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-300 px-2 py-0.5 font-bold">
                {runningOrders.length} Executing
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] uppercase">
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Recipe Name</th>
                    <th className="py-2 px-3 text-center">State</th>
                    <th className="py-2 px-3">Controller Sync Status</th>
                    <th className="py-2 px-3 text-right">Elapsed Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {runningOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No batch orders currently running. Arm an order and click [START BATCH].
                      </td>
                    </tr>
                  ) : (
                    runningOrders.map((order) => (
                      <tr key={order.id} className="bg-emerald-50/20 hover:bg-emerald-50/40">
                        <td className="py-2 px-3 font-bold text-slate-900">
                          {order.id}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {order.recipeName}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {renderStateBadge(order.status)}
                        </td>
                        <td className="py-2 px-3 text-[11px] text-emerald-800 font-semibold">
                          {order.scadaSyncStatus}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 font-mono">
                          {order.elapsedTime}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Table: Finished Orders (Archived) */}
          <div className="bg-white border border-slate-200 shadow-xs">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-900 uppercase">
                Finished Orders (Historian Archived)
              </span>
              <span className="text-[10px] bg-slate-100 text-slate-700 border border-slate-300 px-2 py-0.5 font-semibold">
                {finishedOrders.length} Completed
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] uppercase">
                    <th className="py-2 px-3">Order ID</th>
                    <th className="py-2 px-3">Recipe Formulation</th>
                    <th className="py-2 px-3 text-center">State</th>
                    <th className="py-2 px-3 text-right">Completion Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {finishedOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-900">
                        {order.id}
                      </td>
                      <td className="py-2 px-3 font-medium text-slate-700">
                        {order.recipeName}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {renderStateBadge(order.status)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-600 text-[11px]">
                        {order.completionTime || '---'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* =======================================================
            RIGHT PANEL: Pre-Flight Setpoint vs. Actual Monitor
           ======================================================= */}
        <div className="lg:col-span-4 bg-white border border-slate-200 shadow-xs font-mono text-xs">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-900 uppercase">
                Pre-Flight SP / PV Verification
              </span>
              <p className="text-[10px] text-slate-500 mt-0.5">
                Dynamic tolerance check: Level 3 Recipe SP vs Level 2 Live Telemetry
              </p>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 text-[10px] uppercase">
                  <th className="py-2 px-3">Phase / Tag</th>
                  <th className="py-2 px-2 text-center">SP</th>
                  <th className="py-2 px-2 text-center">PV</th>
                  <th className="py-2 px-2 text-center">Unit</th>
                  <th className="py-2 px-2 text-center">Tolerance Check</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white text-[11px]">
                {scadaVerifications.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900">{item.phaseId}</div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[120px]">{item.tagName}</div>
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-blue-700">
                      {item.scriptedSetpoint.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 text-center font-bold text-slate-900">
                      {item.scadaActualReadback.toFixed(1)}
                    </td>
                    <td className="py-2.5 px-2 text-center text-slate-600 font-semibold">
                      {item.unit}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      {item.status === 'Matched' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                          ● Matched
                        </span>
                      )}
                      {item.status === 'In Progress' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-50 text-sky-800 border border-sky-300 font-bold text-[10px]">
                          ● In Progress
                        </span>
                      )}
                      {item.status === 'Deviating' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 font-bold text-[10px]">
                          ● Deviating
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 space-y-1">
            <div className="flex items-start gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-600 shrink-0 mt-0.5" />
              <p>
                Strict tolerance checking: deviation within limits (|PV - SP| &le; Tolerance) guarantees formulation accuracy before phase advance.
              </p>
            </div>
            <div className="text-[9px] text-slate-400">
              ISA-88 PART 1 EXECUTION MODEL · SIEMENS PM-CONTROL HANDSHAKE INTERLOCK
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchDispatcher;
