/* Hallmark · component: OperationsView · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { BatchDispatcherHome } from '../components/operations/BatchDispatcherHome';
import { TopologyStatusMapping } from '../components/operations/TopologyStatusMapping';
import { PhaseTimelineMonitoring } from '../components/operations/PhaseTimelineMonitoring';
import { ProcessTelemetryAnalyze } from '../components/operations/ProcessTelemetryAnalyze';
import { Activity, Radio, Network, Clock, LineChart } from 'lucide-react';
import { useOperations } from '../context/OperationsContext';
import { useMasterData } from '../context/MasterDataContext';
import { useConfig } from '../context/ConfigContext';
import { OeeShiftDashboard } from '../components/OeeShiftDashboard';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

export type OperationsSubTab = 'home' | 'topology' | 'timeline' | 'analyze';

export const OperationsView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<OperationsSubTab>('home');
  const { currentBatchState, targetProcessLine, isScadaConnected } = useOperations();
  const { refetchData } = useMasterData();
  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';

  React.useEffect(() => {
    refetchData();
  }, [sqlOnline]);


  const tabs: { id: OperationsSubTab; label: string; icon: React.ElementType }[] = [
    { id: 'home', label: 'Batch Dispatcher (Home)', icon: Radio },
    { id: 'topology', label: 'Topology Mapping', icon: Network },
    { id: 'timeline', label: 'Phase Timeline', icon: Clock },
    { id: 'analyze', label: 'Process Telemetry (Analyze)', icon: LineChart },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Module Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span>MES Level 3</span>
            <span>/</span>
            <span>Execution Layer</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Operations & Batch Supervision</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-slate-800" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              OPERATIONS & BATCH SUPERVISION
            </h1>
          </div>

          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            ISA-95 Level 3 MOM to Level 2 SCADA Supervisory Gateway (WinCC Unified / OPC UA) batch dispatching, procedural state machine execution, and real-time process monitoring.
          </p>
        </div>

        {/* Global Supervisory Indicators */}
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="bg-slate-100 border border-slate-300 px-3 py-1 text-slate-700 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isScadaConnected ? 'bg-emerald-600' : 'bg-slate-400'}`} />
            <span>KEPWARE GATEWAY: {isScadaConnected ? 'CONNECTED (49320)' : 'STANDBY'}</span>
          </div>

          <div className="bg-slate-100 border border-slate-300 px-3 py-1 text-slate-700 flex items-center gap-1.5">
            <span className="text-slate-500">LINE:</span>
            <span className="font-semibold">{targetProcessLine.includes('Cell 2') || targetProcessLine.includes('PC2') ? 'CELL 2 (TWIN)' : 'CELL 1 (PHYSICAL)'}</span>
          </div>

          <div className="bg-slate-900 text-white px-3 py-1 font-semibold flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-normal">ISA-88 STATE:</span>
            <span className="text-emerald-400 font-bold">{currentBatchState}</span>
          </div>
        </div>
      </div>

      {/* Real-Time OEE Calculation Engine & Shift Management Dashboard */}
      <OeeShiftDashboard />

      {/* Sub-navigation Tabs at the Top */}
      <div className="border-b border-slate-200 bg-white flex flex-wrap items-center gap-1 shadow-xs select-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all font-mono hallmark-focus active:translate-y-px ${
                isActive
                  ? 'border-slate-900 text-slate-900 bg-slate-50/80'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-slate-900' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Sub-view Viewport */}
      <section aria-label="Operations Active View">
        {activeSubTab === 'home' && <BatchDispatcherHome />}
        {activeSubTab === 'topology' && <TopologyStatusMapping />}
        {activeSubTab === 'timeline' && <PhaseTimelineMonitoring />}
        {activeSubTab === 'analyze' && <ProcessTelemetryAnalyze />}
      </section>
    </main>
  );
};
