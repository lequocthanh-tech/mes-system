/* Hallmark · component: QualityView · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { useQuality, QualitySubTab } from '../context/QualityContext';
import { QualityOverviewTab } from '../components/quality/QualityOverviewTab';
import { QualityDetailTab } from '../components/quality/QualityDetailTab';
import { QualitySummaryTab } from '../components/quality/QualitySummaryTab';
import { QualityToleranceConfigTab } from '../components/quality/QualityToleranceConfigTab';
import { Award, ListChecks, FileText, BarChart3, Sliders } from 'lucide-react';

export const QualityView: React.FC = () => {
  const { 
    activeSubTab, 
    setActiveSubTab, 
    batchRecords 
  } = useQuality();

  const tabs: { id: QualitySubTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: ListChecks },
    { id: 'detail', label: 'Detail', icon: FileText },
    { id: 'summary', label: 'Summary', icon: BarChart3 },
    { id: 'config', label: 'Parameter Configuration', icon: Sliders },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
      {/* Top Section Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span>MES Level 3</span>
            <span>/</span>
            <span>Quality Assurance</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Quality Operations</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Award className="w-5 h-5 text-slate-800" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight font-mono">
              QUALITY MANAGEMENT
            </h1>
          </div>

          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Monitor batch quality, review deviations, summarize performance, and configure tolerance parameters (Đánh giá chất lượng mẻ).
          </p>
        </div>

        {/* Live Batch Counter Badge */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1.5 bg-slate-100 text-slate-800 font-bold border border-slate-300">
            {batchRecords.length} batch(es)
          </span>
          <div className="bg-emerald-50 border border-emerald-300 px-3 py-1.5 text-emerald-800 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span>ISA-95 QUALITY ASSURANCE</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs Bar */}
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

      {/* Sub-View Content */}
      <section aria-label="Quality Sub-View Content">
        {activeSubTab === 'overview' && <QualityOverviewTab />}
        {activeSubTab === 'detail' && <QualityDetailTab />}
        {activeSubTab === 'summary' && <QualitySummaryTab />}
        {activeSubTab === 'config' && <QualityToleranceConfigTab />}
      </section>
    </main>
  );
};
