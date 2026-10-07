/* Hallmark · component: Isa88ModelView · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { Isa88Toolbar } from '../components/isa88/Isa88Toolbar';
import { PhysicalTree } from '../components/isa88/PhysicalTree';
import { ProceduralTree } from '../components/isa88/ProceduralTree';
import { NodeInspector } from '../components/isa88/NodeInspector';
import { AddNodeModal } from '../components/isa88/AddNodeModal';
import { EditMappingModal } from '../components/isa88/EditMappingModal';
import { Layers, Database } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useIsa88 } from '../context/Isa88Context';

export const Isa88ModelView: React.FC = () => {
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditMappingModalOpen, setIsEditMappingModalOpen] = useState<boolean>(false);
  const { sqlConfig } = useConfig();
  const { gatewayConnected } = useIsa88();

  const handleOpenEditMapping = () => {
    setIsEditMappingModalOpen(true);
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Header Section */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span>MES Level 3</span>
            <span>/</span>
            <span>Batch Control</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">ISA-88 Architecture</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-slate-800" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              ISA-88 DATA CONFIGURATION & TELEMETRY HUB
            </h1>
          </div>

          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Physical & Procedural Model hierarchy, equipment bindings, centralized Kepware OPC UA Node IDs, and sub-15ms WebSocket telemetry streaming.
          </p>
        </div>

        {/* Integration Status Badges */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div className="bg-slate-100 border border-slate-300 px-2.5 py-1 text-slate-700 flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${gatewayConnected ? 'bg-emerald-600' : 'bg-rose-500'}`} />
            <span>KEPWARE GATEWAY: {gatewayConnected ? 'ONLINE' : 'OFFLINE'}</span>
          </div>

          <div className="bg-slate-100 border border-slate-300 px-2.5 py-1 text-slate-700 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>SQL HISTORIAN: {sqlConfig.connectionState === 'connected' ? 'ONLINE' : 'OFFLINE'}</span>
          </div>
        </div>
      </div>

      {/* Interactive Controls & Search Toolbar */}
      <section aria-label="ISA-88 Controls Toolbar">
        <Isa88Toolbar
          onOpenAddModal={() => setIsAddModalOpen(true)}
          onOpenEditMapping={handleOpenEditMapping}
        />
      </section>

      {/* Main Content Area: Split 2-Column View */}
      <section aria-label="ISA-88 Physical and Procedural Trees">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Column 1: Physical Model Tree */}
          <div className="h-full">
            <PhysicalTree />
          </div>

          {/* Column 2: Procedural Model Tree */}
          <div className="h-full">
            <ProceduralTree />
          </div>
        </div>
      </section>

      {/* Bottom Inspector Panel ("Node Information & Live Telemetry Inspector") */}
      <section id="isa88-inspector-panel" aria-label="Node Information Inspector">
        <NodeInspector />
      </section>

      {/* Add Node Modal */}
      <AddNodeModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Global Telemetry Node Mapping Modal */}
      <EditMappingModal
        isOpen={isEditMappingModalOpen}
        onClose={() => setIsEditMappingModalOpen(false)}
      />
    </main>
  );
};
