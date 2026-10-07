/* Hallmark · component: SystemConfigView · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { OpcGatewayConfigCard } from '../components/config/OpcGatewayConfigCard';
import { SqlConfigCard } from '../components/config/SqlConfigCard';
import { UserManagement } from '../pages/configuration/UserManagement';
import { 
  Sliders, 
  CheckCircle, 
  Info, 
  ShieldAlert, 
  Server, 
  Database, 
  Users, 
  Lock, 
  LogOut 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ConfigSubTab = 'opc' | 'sql' | 'users';

export const SystemConfigView: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<ConfigSubTab>('opc');

  // Enforce Access Restrictions:
  // If logged-in user is Operator, visiting Configuration displays an industrial fallback state
  if (user?.role === 'Operator') {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 font-mono text-xs select-none">
        <div className="bg-white border-2 border-rose-300 p-8 shadow-sm space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-7 h-7 text-rose-600" />
            </div>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-rose-50 text-rose-900 border border-rose-300 text-[10px] font-bold uppercase">
                <Lock className="w-3 h-3 text-rose-700" />
                <span>FDA 21 CFR §11.10(d) · SECURITY RESTRICTION</span>
              </div>
              <h1 className="text-lg font-bold text-slate-900 uppercase tracking-tight" style={{ fontStyle: 'normal' }}>
                Access Restricted — Requires Engineer / Admin Clearance
              </h1>
              <p className="text-slate-600 text-xs leading-relaxed pt-1">
                The Centralized System Configuration, Hardware Topology, and Identity Administration module is strictly restricted to Level 3 (Controls Engineer) and Level 4 (System Administrator) clearance holders.
              </p>
            </div>
          </div>

          <div className="p-4 bg-[#F8FAFC] border border-[#E2E8F0] space-y-2 text-xs">
            <div className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
              Active Session Security Diagnostics
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500">CURRENT USER:</span>{' '}
                <span className="font-bold text-slate-900">{user?.username}</span> ({user?.name})
              </div>
              <div>
                <span className="text-slate-500">CURRENT ROLE:</span>{' '}
                <span className="font-bold text-rose-700">{user?.role} (Clearance Level 1)</span>
              </div>
              <div>
                <span className="text-slate-500">REQUIRED CLEARANCE:</span>{' '}
                <span className="font-bold text-slate-900">Level 3 (Engineer) / Level 4 (Admin)</span>
              </div>
              <div>
                <span className="text-slate-500">AUDIT CODE:</span>{' '}
                <span className="font-mono text-slate-700">SEC_DENIED_OPERATOR_CONFIG</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
            <span className="text-[11px] text-slate-500">
              Please authenticate with Engineer or Administrator credentials to configure gateway and user policies.
            </span>
            <button
              type="button"
              onClick={logout}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-none active:translate-y-px"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Switch User Account</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  const tabs: { id: ConfigSubTab; label: string; icon: React.ElementType }[] = [
    { id: 'opc', label: '1. OPC UA Gateway', icon: Server },
    { id: 'sql', label: '2. SQL Server Historian', icon: Database },
    { id: 'users', label: '3. User & Role Management (FDA 21 CFR Part 11)', icon: Users },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Page Header */}
      <div className="border-b border-slate-200 pb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-wider mb-1">
            <span>MES Level 3</span>
            <span>/</span>
            <span>Infrastructure</span>
            <span>/</span>
            <span className="text-slate-900 font-semibold">System Configuration</span>
          </div>
          <div className="flex items-center gap-2.5">
            <Sliders className="w-5 h-5 text-slate-800" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight" style={{ fontStyle: 'normal' }}>
              Centralized Gateway &amp; Historian Configuration
            </h1>
          </div>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl">
            Pure Infrastructure Connectivity: Central Kepware OPC UA Industrial Server Gateway (KEPServerEX), Microsoft SQL Server Historian Database, and FDA 21 CFR Part 11 RBAC Administration.
          </p>
        </div>

        {/* User permissions indicator */}
        <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 text-xs text-slate-700 font-mono flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-slate-600" />
          <span>ACCESS GRANTED: {user?.role.toUpperCase()} CLEARANCE</span>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b border-slate-200 bg-white flex flex-wrap items-center gap-1 shadow-xs select-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all font-mono active:translate-y-px ${
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

      {/* Sub-tab Views */}
      <section aria-label="System Configuration Viewport">
        {activeSubTab === 'opc' && (
          <div className="space-y-6">
            <OpcGatewayConfigCard />
          </div>
        )}

        {activeSubTab === 'sql' && (
          <div className="space-y-6">
            <SqlConfigCard />
          </div>
        )}

        {activeSubTab === 'users' && (
          <div className="space-y-6">
            <UserManagement />
          </div>
        )}
      </section>

      {/* ISA-95 & ISA-101 Standards Reference Box */}
      <div className="p-4 bg-white border border-slate-200 text-xs text-slate-600 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 uppercase tracking-wide font-mono text-[11px]" style={{ fontStyle: 'normal' }}>
            ISA-95 &amp; ISA-101 Compliance Notes
          </div>
          <p className="text-slate-500 leading-relaxed text-[11px]">
            This interface strictly implements ISA-101 high-performance HMI design rules: high situational awareness, clean light theme (#FFFFFF/#F8FAFC canvas), muted static elements, and purposeful functional color application (green reserved exclusively for active connections, red for communication alarms).
          </p>
        </div>
      </div>
    </main>
  );
};

export default SystemConfigView;
