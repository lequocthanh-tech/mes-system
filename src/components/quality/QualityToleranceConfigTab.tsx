/* Hallmark · component: QualityToleranceConfigTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useQuality } from '../../context/QualityContext';
import { Sliders, Save, CheckCircle2, ShieldAlert, RotateCcw, Check } from 'lucide-react';
import { QualityToleranceRule } from '../../types/quality';

export const QualityToleranceConfigTab: React.FC = () => {
  const { toleranceRules, updateToleranceRule } = useQuality();

  const [localRules, setLocalRules] = useState<QualityToleranceRule[]>(toleranceRules);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);

  const handleToleranceChange = (id: string, value: number) => {
    setLocalRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, standardTolerance: value } : r))
    );
  };

  const handleCriticalToggle = (id: string) => {
    setLocalRules((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextCritical = !r.isCritical;
          return {
            ...r,
            isCritical: nextCritical,
            haccpCategory: nextCritical ? 'CRITICAL (CCP)' : 'STANDARD QUALITY',
          };
        }
        return r;
      })
    );
  };

  const handleSaveRow = (rule: QualityToleranceRule) => {
    updateToleranceRule(rule.id, rule.standardTolerance, rule.isCritical);
    setSavedRowId(rule.id);
    setSaveToast(`Tolerance for ${rule.parameterName} updated to ±${rule.standardTolerance}% (${rule.haccpCategory}).`);
    setTimeout(() => {
      setSavedRowId(null);
      setSaveToast(null);
    }, 3000);
  };

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    localRules.forEach((rule) => {
      updateToleranceRule(rule.id, rule.standardTolerance, rule.isCritical);
    });
    setSaveToast('All quality tolerance acceptance rules saved successfully into MES Level 3 Schema.');
    setTimeout(() => setSaveToast(null), 4000);
  };

  const handleResetDefaults = () => {
    setLocalRules(toleranceRules);
    setSaveToast('Values reset to active configuration.');
    setTimeout(() => setSaveToast(null), 3000);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-slate-800" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 tracking-tight not-italic uppercase">
              Parameter Quality Configuration & Tolerance Rules
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              Configure engineering acceptance bands (±% limits) and Critical Control Point (CCP) safety classifications
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Reset</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAll}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save All Bands</span>
          </button>
        </div>
      </div>

      {/* Save Toast Notification */}
      {saveToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{saveToast}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold uppercase">STORED</span>
        </div>
      )}

      {/* Tolerance Rules Table */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="px-5 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold text-slate-900 uppercase">
            Tolerance Acceptance Matrix (ISA-95 Quality Spec & HACCP Controls)
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            Breach of any critical parameter automatically locks batch disposition
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-36">Phase ID</th>
                <th className="py-2.5 px-3 border-r border-slate-200">Parameter Name</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Target Unit</th>
                <th className="py-2.5 px-3 border-r border-slate-200 w-48">Standard Tolerance (±%)</th>
                <th className="py-2.5 px-3 border-r border-slate-200 text-center w-40">HACCP Category</th>
                <th className="py-2.5 px-3 border-r border-slate-200">HACCP Hazard Description & Engineering Context</th>
                <th className="py-2.5 px-3 text-center w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {localRules.map((rule) => {
                const isSaved = savedRowId === rule.id;

                return (
                  <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                    {/* Phase ID */}
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-800 text-center">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded-xs text-[10px]">
                        {rule.phaseId}
                      </span>
                    </td>

                    {/* Parameter Name */}
                    <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">
                      {rule.parameterName}
                    </td>

                    {/* Target Unit */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-center text-slate-600">
                      {rule.targetUnit}
                    </td>

                    {/* Standard Tolerance (±%) Input */}
                    <td className="py-2 px-3 border-r border-slate-200">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-bold">±</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          max="20.0"
                          value={rule.standardTolerance}
                          onChange={(e) => handleToleranceChange(rule.id, parseFloat(e.target.value) || 0.1)}
                          className="w-20 bg-white border border-slate-300 h-8 px-2 text-xs font-mono font-bold focus:border-slate-800 focus:outline-none rounded-xs"
                        />
                        <span className="text-slate-500 font-bold">%</span>
                      </div>
                    </td>

                    {/* HACCP Category Toggle Button */}
                    <td className="py-2 px-3 border-r border-slate-200 text-center">
                      <button
                        type="button"
                        onClick={() => handleCriticalToggle(rule.id)}
                        className={`px-3 py-1 font-bold text-[10px] rounded-xs border transition-colors ${
                          rule.isCritical
                            ? 'bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-200'
                            : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }`}
                        title="Click to toggle Critical Control Point (CCP) flag"
                      >
                        {rule.isCritical ? 'CRITICAL (CCP)' : 'STANDARD QUALITY'}
                      </button>
                    </td>

                    {/* HACCP Hazard Description */}
                    <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600">
                      {rule.description}
                    </td>

                    {/* Row Action (Inline Save) */}
                    <td className="py-2 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSaveRow(rule)}
                        className={`h-7 px-2.5 text-[10px] font-bold uppercase rounded-xs border transition-all flex items-center justify-center gap-1 mx-auto ${
                          isSaved
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        {isSaved ? (
                          <>
                            <Check className="w-3 h-3" />
                            <span>Saved</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3 h-3 text-slate-500" />
                            <span>Save</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer info */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex flex-wrap items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <span>QUALITY PARAMETERS CONTROLLED BY FOOD SAFETY HACCP & ISO 22000 PROTOCOLS</span>
          </div>
          <span>ROLE: QUALITY ASSURANCE LEAD / AUTOMATION ENGINEER</span>
        </div>
      </div>
    </div>
  );
};
