/* Hallmark · component: Isa88Toolbar · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · success
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { useIsa88 } from '../../context/Isa88Context';
import { Search, Plus, RefreshCw, CheckCircle2, Edit3, X } from 'lucide-react';

interface Isa88ToolbarProps {
  onOpenAddModal: () => void;
  onOpenEditMapping: () => void;
}

export const Isa88Toolbar: React.FC<Isa88ToolbarProps> = ({
  onOpenAddModal,
  onOpenEditMapping,
}) => {
  const { 
    searchQuery, 
    setSearchQuery, 
    syncWithSqlServer, 
    isSyncing, 
    lastSyncTime 
  } = useIsa88();

  const [syncNotice, setSyncNotice] = React.useState<string | null>(null);

  const handleSync = async () => {
    setSyncNotice(null);
    const result = await syncWithSqlServer();
    if (result.success) {
      setSyncNotice(result.message);
      setTimeout(() => setSyncNotice(null), 6000);
    }
  };

  return (
    <div className="space-y-3">
      {/* Action and Search Row */}
      <div className="bg-white border border-slate-200 p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Tags, Physical Units, Phases, CMs..."
            className="w-full h-9 pl-9 pr-8 text-xs font-mono border border-slate-300 rounded-xs bg-white hallmark-focus"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Add Node Button */}
          <button
            type="button"
            onClick={onOpenAddModal}
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Add Node</span>
          </button>

          {/* Edit Mapping Button */}
          <button
            type="button"
            onClick={onOpenEditMapping}
            className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
          >
            <Edit3 className="w-3.5 h-3.5 text-slate-600" />
            <span>Edit Mapping</span>
          </button>

          {/* Sync with SQL Server Button */}
          <button
            type="button"
            onClick={handleSync}
            disabled={isSyncing}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs disabled:opacity-50"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>SYNCING SQL SCHEMA...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync with SQL Server</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Confirmation Banner */}
      {syncNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between font-mono animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{syncNotice}</span>
          </div>
          {lastSyncTime && (
            <span className="text-[11px] text-emerald-800 font-semibold">
              TIME: {lastSyncTime}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
