/* Hallmark · component: ActiveAlarmBanner · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { useReports } from '../context/ReportContext';
import { useAuth } from '../context/AuthContext';
import { BellRing, ArrowRight, ShieldCheck, Check, RotateCcw } from 'lucide-react';

interface ActiveAlarmBannerProps {
  onNavigateToAlarmReport: () => void;
}

export const ActiveAlarmBanner: React.FC<ActiveAlarmBannerProps> = ({ onNavigateToAlarmReport }) => {
  const { activeAlarm, acknowledgeActiveAlarm, clearActiveAlarm, triggerSimulatedAlarm } = useReports();
  const { user } = useAuth();

  // If no alarm is active -> Normal Nominal State
  if (!activeAlarm) {
    return (
      <aside
        aria-label="Active Alarm Status Banner"
        className="w-full h-10 bg-slate-50 border-b border-slate-200 px-4 flex items-center justify-between font-mono text-xs select-none transition-colors duration-150"
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-slate-600 font-semibold tracking-wider uppercase truncate">
            SYSTEM STATUS: ALL PROCESS CELLS NOMINAL · ZERO CRITICAL ALARMS
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>ISA-18.2 SUPERVISED</span>
          </span>
          <button
            type="button"
            onClick={() => triggerSimulatedAlarm()}
            className="h-6 px-2 text-[10px] uppercase font-mono font-medium text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 bg-white transition-none active:translate-y-px"
            title="Simulate ISA-18.2 Critical Alarm ALM-403"
          >
            [Simulate ALM-403]
          </button>
        </div>
      </aside>
    );
  }

  // Active Alarm State: Unacknowledged vs Acknowledged
  const isAck = activeAlarm.isAcknowledged;

  return (
    <aside
      aria-label="Active Alarm Status Banner"
      className={`w-full h-10 border-b px-4 flex items-center justify-between font-mono text-xs select-none transition-colors duration-150 ${
        isAck
          ? 'bg-amber-50 border-amber-300 text-amber-950'
          : 'bg-[#FFF1F2] border-[#FDA4AF] text-[#881337]'
      }`}
    >
      {/* Left Details */}
      <div className="flex items-center gap-2.5 overflow-hidden pr-2">
        {/* Pulsing indicator if unacknowledged, solid indicator if acknowledged */}
        {!isAck ? (
          <div className="relative flex items-center justify-center shrink-0 w-2.5 h-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-600 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-700" />
          </div>
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-amber-600 shrink-0" />
        )}

        {/* Text */}
        {!isAck ? (
          <span className="font-bold text-[#881337] tracking-tight truncate" style={{ fontStyle: 'normal' }}>
            [CRITICAL ALARM] {activeAlarm.eventId}: {activeAlarm.description} (PV: {activeAlarm.pvText} vs SP: {activeAlarm.spText}) · TRIGGERED: {activeAlarm.triggerTime}
          </span>
        ) : (
          <span className="font-bold text-amber-950 tracking-tight truncate" style={{ fontStyle: 'normal' }}>
            [ALARM ACKNOWLEDGED] {activeAlarm.eventId}: {activeAlarm.description} · ACK BY {activeAlarm.acknowledgedBy} AT {activeAlarm.acknowledgedAt}
          </span>
        )}
      </div>

      {/* Right Action Group */}
      <div className="flex items-center gap-2 shrink-0">
        {!isAck ? (
          <button
            type="button"
            onClick={() => acknowledgeActiveAlarm(user?.username || 'operator_01')}
            className="h-7 px-3 bg-rose-700 hover:bg-rose-800 text-white rounded-xs text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-rose-700 focus-visible:outline-offset-2 active:translate-y-px transition-none shadow-xs"
            title="Acknowledge alarm and record operator ID to 21 CFR Part 11 audit log"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>ACKNOWLEDGE ALARM</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="h-7 px-2 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-bold uppercase inline-flex items-center gap-1">
              <Check className="w-3 h-3 text-amber-700" />
              ACKNOWLEDGED
            </span>
            <button
              type="button"
              onClick={clearActiveAlarm}
              className="h-7 px-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold uppercase active:translate-y-px transition-none"
              title="Clear alarm and return system status to nominal"
            >
              Clear Alarm
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onNavigateToAlarmReport}
          className={`h-7 px-2.5 text-xs font-semibold flex items-center gap-1 transition-none hover:underline ${
            isAck ? 'text-amber-950 hover:text-black' : 'text-[#881337] hover:text-black'
          }`}
          title="Inspect alarm forensics in Enterprise Report Center"
        >
          <span>Inspect in Alarm Center</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        {isAck && (
          <button
            type="button"
            onClick={() => triggerSimulatedAlarm()}
            className="h-7 px-2 text-[10px] uppercase font-mono font-medium text-slate-500 hover:text-slate-900 border border-slate-300 bg-white"
            title="Re-trigger test alarm"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>
    </aside>
  );
};

export default ActiveAlarmBanner;
