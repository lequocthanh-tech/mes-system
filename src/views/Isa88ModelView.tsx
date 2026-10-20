/* Hallmark · component: Isa88ModelView · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { Isa88Model } from '../pages/Isa88Model';
import { Isa88Toolbar } from '../components/isa88/Isa88Toolbar';
import { PhysicalTree } from '../components/isa88/PhysicalTree';
import { ProceduralTree } from '../components/isa88/ProceduralTree';
import { NodeInspector } from '../components/isa88/NodeInspector';
import { AddNodeModal } from '../components/isa88/AddNodeModal';
import { Layers, Database, Network } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useIsa88 } from '../context/Isa88Context';

export const Isa88ModelView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'orchestrator' | 'trees'>('orchestrator');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const { sqlConfig, gatewayStatus: statusData } = useConfig();
  const { gatewayConnected } = useIsa88();
  const isOnline = Boolean(statusData?.is_connected || statusData?.connected || statusData?.status === "ONLINE" || gatewayConnected);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('orchestrator')}
          className={`h-9 px-4 font-mono text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 hallmark-focus ${
            activeTab === 'orchestrator'
              ? 'border-slate-900 text-slate-900 bg-slate-50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-700" />
          <span>MODULAR UNIT & TAG ORCHESTRATOR</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('trees')}
          className={`h-9 px-4 font-mono text-xs font-semibold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 hallmark-focus ${
            activeTab === 'trees'
              ? 'border-slate-900 text-slate-900 bg-slate-50'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          <Network className="w-4 h-4 text-sky-700" />
          <span>CÂY PHÂN CẤP VẬT LÝ & THỦ TỤC (ISA-88 TREES)</span>
        </button>
      </div>

      {activeTab === 'orchestrator' ? (
        /* Primary View: Dynamic Unit & Tag Orchestrator */
        <Isa88Model />
      ) : (
        /* Secondary View: Physical & Procedural Trees Hierarchy */
        <div className="space-y-5">
          {/* Header Section */}
          <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
                <span>MES Level 3</span>
                <span>/</span>
                <span>Batch Control</span>
                <span>/</span>
                <span className="text-slate-900 font-semibold">ISA-88 Hierarchy</span>
              </div>

              <div className="flex items-center gap-2.5">
                <Network className="w-5 h-5 text-slate-800" />
                <h2 className="text-xl font-bold text-slate-900 tracking-tight font-mono" style={{ fontStyle: 'normal' }}>
                  CÂY PHÂN CẤP VẬT LÝ VÀ THỦ TỤC QUY TRÌNH
                </h2>
              </div>

              <p className="text-xs text-slate-600 mt-1 max-w-3xl">
                Cây phân cấp Physical (Area &gt; Process Cell &gt; Unit &gt; EM &gt; CM) và Procedural (Procedure &gt; Unit Procedure &gt; Operation &gt; Phase).
              </p>
            </div>

            {/* Integration Status Badges */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="bg-slate-100 border border-slate-300 px-2.5 py-1 text-slate-700 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-600' : 'bg-rose-500'}`} />
                <span>KEPWARE GATEWAY: {isOnline ? 'ONLINE' : 'OFFLINE'}</span>
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
            />
          </section>

          {/* Split 2-Column Tree View */}
          <section aria-label="ISA-88 Physical and Procedural Trees">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="h-full">
                <PhysicalTree />
              </div>

              <div className="h-full">
                <ProceduralTree />
              </div>
            </div>
          </section>

          {/* Node Inspector */}
          <section id="isa88-inspector-panel" aria-label="Node Information Inspector">
            <NodeInspector />
          </section>

          {/* Add Node Modal */}
          <AddNodeModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
          />
        </div>
      )}
    </main>
  );
};
