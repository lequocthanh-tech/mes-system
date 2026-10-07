/* Hallmark · component: SqlConfigCard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { Card } from '../common/Card';
import { 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Server, 
  FolderLock, 
  UserCheck, 
  KeyRound,
  Play,
  ShieldCheck
} from 'lucide-react';

export const SqlConfigCard: React.FC = () => {
  const { 
    sqlConfig, 
    updateSqlConfig, 
    saveSqlConfig, 
    testSqlConnection, 
    isSavingSql 
  } = useConfig();

  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<string | null>(null);

  const isConnected = sqlConfig.connectionState === 'connected';
  const authMode = sqlConfig.authMode || 'windows';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessNotice(null);
    const success = await saveSqlConfig();
    if (success) {
      setSaveSuccessNotice('Database configuration saved successfully.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    }
  };

  const handleTest = async () => {
    setSaveSuccessNotice(null);
    const success = await testSqlConnection();
    if (success) {
      setSaveSuccessNotice('Test connection successful! Database is accessible.');
      setTimeout(() => setSaveSuccessNotice(null), 4000);
    }
  };

  return (
    <Card
      title="CENTRAL DATABASE CONNECTIVITY (SQL SERVER)"
      subtitle="ISA-95 Level 3 Persistent Storage · Historian, Work Orders & Traceability"
      tag="SQL SERVER"
      headerAction={
        <div className="flex items-center gap-2 font-mono text-xs">
          {isConnected ? (
            <span className="h-7 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
              ● CONNECTED ({sqlConfig.version || 'SQL SERVER 2022'})
            </span>
          ) : (
            <span className="h-7 px-2.5 bg-rose-50 text-rose-800 border border-rose-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
              ● DISCONNECTED
            </span>
          )}
        </div>
      }
      footer={
        <div className="w-full flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-4">
            <span>ENGINE: MS SQL SERVER</span>
            <span>PORT: {sqlConfig.port || 1433}</span>
            <span>AUTH: {authMode === 'windows' ? 'WINDOWS TRUSTED' : 'SQL PRINCIPAL'}</span>
          </div>
          <div>
            {sqlConfig.lastSavedAt ? (
              <span className="text-slate-600">LAST SAVED: {sqlConfig.lastSavedAt}</span>
            ) : (
              <span>UNSAVED CONFIGURATION</span>
            )}
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Success Notice Banner / Brief Toast */}
        {saveSuccessNotice && (
          <div 
            className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center gap-2 font-mono"
            role="status"
            aria-live="polite"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="font-semibold">{saveSuccessNotice}</span>
          </div>
        )}

        {/* Error Notice Banner */}
        {sqlConfig.errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div className="flex-1 font-semibold leading-relaxed">
              {sqlConfig.errorMessage}
            </div>
          </div>
        )}

        {/* Top Row: Server Host & Database Name */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Server Host / Instance Name */}
          <div>
            <label
              htmlFor="sql-server-name"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Server Host / Instance Name</span>
            </label>
            <input
              id="sql-server-name"
              type="text"
              value={sqlConfig.serverName}
              onChange={(e) => updateSqlConfig({ serverName: e.target.value })}
              placeholder="localhost\WINCC"
              className="w-full font-mono text-sm border border-slate-300 rounded-none px-3 py-2 bg-white text-slate-900 focus:border-slate-800 focus:outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default: <code className="bg-slate-100 px-1 py-0.5 text-slate-700 font-bold">localhost\WINCC</code>
            </span>
          </div>

          {/* Database Name */}
          <div>
            <label
              htmlFor="sql-db-name"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <FolderLock className="w-3.5 h-3.5 text-slate-500" />
              <span>Database Name</span>
            </label>
            <input
              id="sql-db-name"
              type="text"
              value={sqlConfig.databaseName}
              onChange={(e) => updateSqlConfig({ databaseName: e.target.value })}
              placeholder="MES_Milk_Production"
              className="w-full font-mono text-sm border border-slate-300 rounded-none px-3 py-2 bg-white text-slate-900 focus:border-slate-800 focus:outline-none"
              required
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default: <code className="bg-slate-100 px-1 py-0.5 text-slate-700 font-bold">MES_Milk_Production</code>
            </span>
          </div>
        </div>

        {/* Authentication Mode Toggle */}
        <div className="border-t border-slate-200 pt-4">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
            Authentication Security Mode
          </label>
          <div className="inline-flex border border-slate-300 bg-slate-100 p-0.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => updateSqlConfig({ authMode: 'windows' })}
              className={`h-9 px-4 text-xs font-mono font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                authMode === 'windows'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Windows Authentication (Integrated Security) [Default]</span>
            </button>
            <button
              type="button"
              onClick={() => updateSqlConfig({ authMode: 'sql' })}
              className={`h-9 px-4 text-xs font-mono font-semibold uppercase tracking-wider transition-colors flex items-center gap-2 ${
                authMode === 'sql'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>SQL Server Authentication</span>
            </button>
          </div>
        </div>

        {/* Credentials Section */}
        {authMode === 'windows' ? (
          <div className="p-3.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold text-slate-900 block">
                Windows Integrated Security Active (Trusted_Connection=yes)
              </span>
              <span className="text-slate-500 text-[11px] block">
                Username and password inputs are automatically bypassed. The backend connects directly under the Windows operating system principal or service account.
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* SQL Username */}
            <div>
              <label
                htmlFor="sql-username"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              >
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>SQL Username</span>
              </label>
              <input
                id="sql-username"
                type="text"
                value={sqlConfig.username}
                onChange={(e) => updateSqlConfig({ username: e.target.value })}
                placeholder="e.g. sa or mes_user"
                className="w-full font-mono text-sm border border-slate-300 rounded-none px-3 py-2 bg-white text-slate-900 focus:border-slate-800 focus:outline-none"
                required={authMode === 'sql'}
              />
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                Database authentication principal
              </span>
            </div>

            {/* SQL Password */}
            <div>
              <label
                htmlFor="sql-password"
                className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                <span>SQL Password</span>
              </label>
              <div className="relative">
                <input
                  id="sql-password"
                  type={showPassword ? 'text' : 'password'}
                  value={sqlConfig.password}
                  onChange={(e) => updateSqlConfig({ password: e.target.value })}
                  placeholder="Enter SQL password"
                  className="w-full font-mono text-sm border border-slate-300 rounded-none pl-3 pr-10 py-2 bg-white text-slate-900 focus:border-slate-800 focus:outline-none"
                  required={authMode === 'sql'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-700 focus:outline-none"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                SQL Server standard password
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {/* Test Connection Button */}
          <button
            type="button"
            onClick={handleTest}
            disabled={isSavingSql}
            className="h-9 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hallmark-focus active:translate-y-px rounded-none transition-all shadow-xs disabled:opacity-50"
          >
            {isSavingSql ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Testing handshake to {sqlConfig.serverName || 'localhost\\WINCC'}...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-500" />
                <span>TEST SQL CONNECTION</span>
              </>
            )}
          </button>

          {/* Save Configuration Button */}
          <button
            type="submit"
            disabled={isSavingSql}
            className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hallmark-focus active:translate-y-px rounded-none transition-all shadow-xs disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>SAVE DATABASE SETTINGS</span>
          </button>

          {/* Verification Timestamp badge */}
          {isConnected && sqlConfig.lastVerifiedAt && (
            <span className="h-9 px-3 text-xs font-mono text-emerald-800 bg-emerald-50 border border-emerald-300 rounded-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              DATABASE VERIFIED ({sqlConfig.lastVerifiedAt})
            </span>
          )}
        </div>
      </form>
    </Card>
  );
};
export default SqlConfigCard;
