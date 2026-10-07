/* Hallmark · component: MasterDataView · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { CustomerManagementTab } from '../components/masterData/CustomerManagementTab';
import { RecipeManagementTab } from '../components/masterData/RecipeManagementTab';
import { OrderManagementTab } from '../components/masterData/OrderManagementTab';
import { Database, Users, FileSpreadsheet, ClipboardList } from 'lucide-react';

export type MasterDataSubTab = 'customers' | 'recipes' | 'orders';

export const MasterDataView: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<MasterDataSubTab>('customers');

  const tabs: { id: MasterDataSubTab; label: string; icon: React.ElementType }[] = [
    { id: 'customers', label: 'Customer Management', icon: Users },
    { id: 'recipes', label: 'Recipe Management', icon: FileSpreadsheet },
    { id: 'orders', label: 'Order Management', icon: ClipboardList },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Section Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span>MES Level 3</span>
            <span>/</span>
            <span>Production Planning</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Master Data</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Database className="w-5 h-5 text-slate-800" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              PRODUCTION MASTER DATA MANAGEMENT
            </h1>
          </div>

          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            ISA-95 Level 3 Master Data integration for Customer relationships, Formulation Recipes with PLC tag mappings, and Batch Work Orders.
          </p>
        </div>

        <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 text-xs text-slate-700 font-mono flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
          <span>SCHEMA: [dbo].[PRODUCTION_MASTER_DATA]</span>
        </div>
      </div>

      {/* Sub-tab Navigation Bar as Required */}
      <div className="border-b border-slate-200 bg-white flex items-center gap-1 shadow-xs select-none">
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

      {/* Sub-Tab View Container */}
      <section aria-label="Master Data Sub-view">
        {activeSubTab === 'customers' && <CustomerManagementTab />}
        {activeSubTab === 'recipes' && <RecipeManagementTab />}
        {activeSubTab === 'orders' && <OrderManagementTab />}
      </section>
    </main>
  );
};
