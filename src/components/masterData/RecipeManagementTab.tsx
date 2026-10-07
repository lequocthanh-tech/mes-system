/* Hallmark · component: RecipeManagementTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useMasterData } from '../../context/MasterDataContext';
import { useConfig } from '../../context/ConfigContext';
import { RecipeParameter, RecipeStatus } from '../../types/masterData';
import { 
  FileSpreadsheet, 
  Save, 
  GitBranch, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Plus, 
  Trash2, 
  Sliders, 
  Cpu, 
  AlertTriangle,
  Info,
  Layers
} from 'lucide-react';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

export const RecipeManagementTab: React.FC = () => {
  const { 
    recipes, 
    selectedRecipeId, 
    setSelectedRecipeId, 
    saveRecipeMaster, 
    editRecipeMaster, 
    deleteRecipeMaster,
    createNewVersion,
    approveRecipe,
    lockRecipe,
    updateRecipeParameters,
    refetchData
  } = useMasterData();

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';

  // Resilient initial fetch with exponential backoff & SQL online listener
  useEffect(() => {
    let isMounted = true;
    const fetchWithRetry = async (retries = 3, delay = 1000) => {
      try {
        await refetchData();
      } catch (err) {
        if (retries > 0 && isMounted) {
          setTimeout(() => fetchWithRetry(retries - 1, Math.round(delay * 1.5)), delay);
        }
      }
    };

    fetchWithRetry();
    return () => {
      isMounted = false;
    };
  }, [sqlOnline]);


  // Selected Recipe
  const activeRecipe = recipes.find((r) => r.id === selectedRecipeId) || recipes[0] || null;

  // Local Form state for editing current active recipe
  const [recipeForm, setRecipeForm] = useState<{
    code: string;
    name: string;
    category: string;
    version: string;
    status: RecipeStatus;
    author: string;
  }>({
    code: '',
    name: '',
    category: '',
    version: '',
    status: 'DRAFT',
    author: '',
  });

  // Local editable parameters
  const [parameters, setParameters] = useState<RecipeParameter[]>([]);

  // Quality Gate Warning state
  const [qualityGateError, setQualityGateError] = useState<string | null>(null);

  // Notifications
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Sync state when active recipe changes
  useEffect(() => {
    if (activeRecipe) {
      setRecipeForm({
        code: activeRecipe.code,
        name: activeRecipe.name,
        category: activeRecipe.category || 'Dairy Formulation',
        version: activeRecipe.version,
        status: activeRecipe.status,
        author: activeRecipe.author || 'Process Engineering MOM',
      });
      setParameters(JSON.parse(JSON.stringify(activeRecipe.parameters || [])));
      setQualityGateError(null);
    }
  }, [activeRecipe?.id, activeRecipe?.version, activeRecipe?.status]);

  // Is current recipe released or locked from editing
  const isReleased = (activeRecipe?.status || '').toUpperCase() === 'RELEASED' || (recipeForm.status || '').toUpperCase() === 'RELEASED';
  const isLocked = isReleased || (activeRecipe?.status || '').toUpperCase() === 'LOCKED' || (recipeForm.status || '').toUpperCase() === 'LOCKED';

  // Handle parameter value change in DRAFT mode
  const handleParamChange = (index: number, field: keyof RecipeParameter, value: any) => {
    if (isLocked) return;
    const updated = [...parameters];
    updated[index] = {
      ...updated[index],
      [field]: field === 'targetValue' || field === 'targetSetpoint' ? parseFloat(value) || 0 : value,
    };
    // Keep targetSetpoint and targetValue in sync
    if (field === 'targetValue') {
      updated[index].targetSetpoint = parseFloat(value) || 0;
    } else if (field === 'targetSetpoint') {
      updated[index].targetValue = parseFloat(value) || 0;
    }
    setParameters(updated);
    setQualityGateError(null);
  };

  // Save changes to current recipe
  const handleSaveChanges = async () => {
    if (!activeRecipe) return;
    if (isLocked) {
      showNotification('error', `Recipe is ${activeRecipe.status}. Create a new version to modify formulation parameters.`);
      return;
    }

    try {
      // Save recipe details and parameters
      await editRecipeMaster(activeRecipe.id, {
        code: recipeForm.code.trim().toUpperCase(),
        name: recipeForm.name.trim(),
        category: recipeForm.category.trim(),
        author: recipeForm.author.trim(),
      });

      await updateRecipeParameters(activeRecipe.id, parameters);
      showNotification('success', `Recipe [${recipeForm.code} ${activeRecipe.version}] parameters saved successfully.`);
    } catch (err: any) {
      showNotification('error', `Failed to save recipe: ${err?.message || 'Database write failed'}`);
    }
  };

  // Create New Version handler
  const handleCreateVersion = async () => {
    if (!activeRecipe) return;
    try {
      await createNewVersion(activeRecipe.id);
      showNotification('success', `Created new draft version incremented from [${activeRecipe.code}]. Parameters unlocked for configuration.`);
    } catch (err: any) {
      showNotification('error', `Failed to create version: ${err?.message || 'Database write failed'}`);
    }
  };

  // Approve / Release Handler (Quality Gate Verification & State Sync)
  const handleApproveRelease = async () => {
    if (!activeRecipe) return;

    // 1. Clear any existing quality gate error banner
    setQualityGateError(null);

    // 2. Unify Parameter Data Binding: calculate total percentage directly from active parameters bound to the UI table
    const activeIngredients = parameters.filter(
      (p) =>
        p.phaseId === 'PH_DOSING' ||
        p.phaseId?.startsWith('PH_DOSING') ||
        p.phaseId?.startsWith('PH_SUPPLY') ||
        p.isIngredient ||
        p.unit === '%'
    );
    const totalPercentage = activeIngredients.reduce(
      (sum, p) => sum + (Number(p.targetSetpoint ?? p.targetValue ?? p.percentage ?? 0) || 0),
      0
    );

    // Allow slight floating point tolerance (e.g. 99.9% to 100.1%)
    if (Math.abs(totalPercentage - 100.0) > 0.1) {
      const errorMsg = `Quality Gate Warning: Total ingredient percentage is ${totalPercentage.toFixed(1)}% (must total 100.0% before release).`;
      setQualityGateError(errorMsg);
      showNotification('error', errorMsg);
      return;
    }

    try {
      // 3. Auto-commit changes: automatically commit changes to the recipe object without requiring separate pre-click on SAVE
      await editRecipeMaster(activeRecipe.id, {
        code: recipeForm.code.trim().toUpperCase(),
        name: recipeForm.name.trim(),
        category: recipeForm.category.trim(),
        author: recipeForm.author.trim(),
      });
      await updateRecipeParameters(activeRecipe.id, parameters);

      // 4. Update status to RELEASED in database & global state
      await approveRecipe(activeRecipe.id);

      // 5. Update local state immediately so UI switches to green "RELEASED (Operational)" and locks editing
      setRecipeForm((prev) => ({ ...prev, status: 'RELEASED' }));
      setQualityGateError(null);
      showNotification(
        'success',
        `Recipe [${activeRecipe.code} ${activeRecipe.version}] has passed quality review and is now RELEASED for batch execution.`
      );
    } catch (err: any) {
      showNotification('error', `Failed to approve recipe: ${err?.message || 'Database write failed'}`);
    }
  };

  // Lock Recipe Handler
  const handleLockRecipe = async () => {
    if (!activeRecipe) return;
    try {
      await lockRecipe(activeRecipe.id);
      showNotification('info', `Recipe [${activeRecipe.code} ${activeRecipe.version}] marked as LOCKED/ARCHIVED.`);
    } catch (err: any) {
      showNotification('error', `Failed to lock recipe: ${err?.message || 'Database write failed'}`);
    }
  };

  // Create brand new recipe
  const handleCreateNewRecipe = async () => {
    const nextId = recipes.length > 0 ? Math.max(...recipes.map(r => r.id)) + 1 : 1;
    const defaultParams: RecipeParameter[] = [
      {
        id: `p-${nextId}-1`,
        phaseId: 'PH_SUPPLYMILK',
        parameterName: 'Raw Milk Supply',
        targetValue: 70.0,
        unit: '%',
        tolerance: '±1.0%',
        targetNodeId: 'Recipe_Milk_SP',
        durationSeconds: 300,
        recipeId: nextId,
      },
      {
        id: `p-${nextId}-2`,
        phaseId: 'PH_SUPPLYSUGAR',
        parameterName: 'Sugar Syrup Supply',
        targetValue: 20.0,
        unit: '%',
        tolerance: '±0.5%',
        targetNodeId: 'Recipe_Sugar_SP',
        durationSeconds: 180,
        recipeId: nextId,
      },
      {
        id: `p-${nextId}-3`,
        phaseId: 'PH_SUPPLYADDITIVE',
        parameterName: 'Additive Dosing',
        targetValue: 10.0,
        unit: '%',
        tolerance: '±0.2%',
        targetNodeId: 'Recipe_Additive_SP',
        durationSeconds: 120,
        recipeId: nextId,
      },
      {
        id: `p-${nextId}-4`,
        phaseId: 'PH_HEATING',
        parameterName: 'Thermal Sterilization',
        targetValue: 138.0,
        unit: '°C',
        tolerance: '±0.5°C',
        targetNodeId: 'Recipe_Temp_SP',
        durationSeconds: 600,
        recipeId: nextId,
      },
      {
        id: `p-${nextId}-5`,
        phaseId: 'PH_COOLING',
        parameterName: 'Chilled Preservation',
        targetValue: 4.0,
        unit: '°C',
        tolerance: '±1.0°C',
        targetNodeId: 'Recipe_Cool_SP',
        durationSeconds: 450,
        recipeId: nextId,
      },
    ];

    try {
      await saveRecipeMaster({
        code: `RCP-CUSTOM-0${nextId}`,
        name: `New Dairy Formulation #${nextId}`,
        version: 'v1.0',
        status: 'DRAFT',
        category: 'Liquid Dairy Formulation',
        author: 'Lead MES Engineer',
        parameters: defaultParams,
        tempHot: 138,
        tempCold: 4,
      });
      showNotification('success', `Initialized New Master Recipe [RCP-CUSTOM-0${nextId} v1.0] in DRAFT mode.`);
    } catch (err: any) {
      showNotification('error', `Failed to create recipe: ${err?.message || 'Database write failed'}`);
    }
  };

  // Calculate percentage total for visual verification
  const activeIngredients = parameters.filter(
    (p) =>
      p.phaseId === 'PH_DOSING' ||
      p.phaseId?.startsWith('PH_DOSING') ||
      p.phaseId?.startsWith('PH_SUPPLY') ||
      p.isIngredient ||
      p.unit === '%'
  );
  const ingredientTotal = activeIngredients.reduce(
    (sum, p) => sum + (Number(p.targetSetpoint ?? p.targetValue ?? p.percentage ?? 0) || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Sub-Header Strip */}
      <div className="bg-white border border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center font-mono font-bold text-sm">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 font-mono tracking-tight uppercase">
              Recipe Management (Siemens PM-CONTROL Benchmark)
            </h2>
            <p className="text-xs text-slate-500 font-mono">
              ISA-88 Master Recipe Formulation, Version Life Cycle & Phase Parameter Binding
            </p>
          </div>
        </div>

        {/* Global Action & Recipe Count */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <button
            onClick={handleCreateNewRecipe}
            className="h-9 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-mono font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Master Recipe</span>
          </button>
          <div className="bg-slate-100 border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
            {recipes.length} Master Recipes
          </div>
          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs text-emerald-800 font-bold">
            RELEASED RECIPES: {recipes.filter(r => (r.status || '').toUpperCase() === 'RELEASED').length}
          </div>
        </div>
      </div>

      {/* Quality Gate Warning Banner */}
      {qualityGateError && (
        <div
          role="alert"
          className="p-3 text-xs font-mono border border-rose-300 bg-rose-50 text-rose-900 flex items-center justify-between gap-2 shadow-2xs"
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">{qualityGateError}</span>
          </div>
          <button
            type="button"
            onClick={() => setQualityGateError(null)}
            className="text-[11px] underline hover:no-underline font-mono font-bold"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Notification Banner */}
      {notification && (
        <div
          role="alert"
          className={`p-3 text-xs font-mono border flex items-center justify-between gap-2 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : notification.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-sky-50 border-sky-300 text-sky-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
            {notification.type === 'info' && <Info className="w-4 h-4 text-sky-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-[11px] underline hover:no-underline font-mono"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* TOP CARD: Master Recipe Selection & Version Control (PM-CONTROL Benchmark) */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
              Master Recipe Header & Version Lifecycle
            </span>
          </div>

          {/* Recipe Status Badge */}
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-500 uppercase text-[10px]">LIFECYCLE STATUS:</span>
            {isReleased && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold uppercase tracking-wider text-xs">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                RELEASED (Operational)
              </span>
            )}
            {!isReleased && ((activeRecipe?.status || '').toUpperCase() === 'DRAFT' || (recipeForm.status || '').toUpperCase() === 'DRAFT') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 font-bold uppercase tracking-wider text-xs">
                <Unlock className="w-3.5 h-3.5 text-amber-600" />
                DRAFT (Modifiable)
              </span>
            )}
            {!isReleased && ((activeRecipe?.status || '').toUpperCase() === 'LOCKED' || (recipeForm.status || '').toUpperCase() === 'LOCKED') && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-300 font-bold uppercase tracking-wider text-xs">
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                LOCKED / ARCHIVED
              </span>
            )}
          </div>
        </div>

        {/* Master Recipe Selector & Property Fields */}
        <div className="p-5 space-y-4 text-xs font-mono">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Master Recipe Dropdown */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Select Master Recipe
              </label>
              <select
                value={selectedRecipeId || ''}
                onChange={(e) => setSelectedRecipeId(parseInt(e.target.value, 10))}
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 font-semibold focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              >
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    [{r.code}] {r.name} ({r.version}) - {r.status}
                  </option>
                ))}
              </select>
            </div>

            {/* Recipe Code */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Recipe Code
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={recipeForm.code}
                onChange={(e) => setRecipeForm({ ...recipeForm, code: e.target.value.toUpperCase() })}
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              />
            </div>

            {/* Version String */}
            <div className="md:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Active Version
              </label>
              <div className="relative">
                <GitBranch className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  disabled
                  value={recipeForm.version}
                  className="w-full h-9 pl-8 pr-3 text-xs font-mono font-bold bg-slate-100 border border-slate-300 text-slate-800"
                />
              </div>
            </div>

            {/* Category / Application */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Category / Process Class
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={recipeForm.category}
                onChange={(e) => setRecipeForm({ ...recipeForm, category: e.target.value })}
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              />
            </div>
          </div>

          {/* Row 2: Recipe Name & Author Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Formulation Display Name
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={recipeForm.name}
                onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-700 uppercase mb-1">
                Author / Lead MOM Engineer
              </label>
              <input
                type="text"
                disabled={isLocked}
                value={recipeForm.author}
                onChange={(e) => setRecipeForm({ ...recipeForm, author: e.target.value })}
                className="w-full h-9 px-3 text-xs font-mono bg-white border border-slate-300 text-slate-900 disabled:bg-slate-100 disabled:text-slate-600 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 transition-none"
              />
            </div>
          </div>

          {/* Siemens PM-CONTROL Lifecycle Action Bar */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Button: Create New Version */}
              <button
                type="button"
                onClick={handleCreateVersion}
                className="h-9 px-3.5 bg-slate-900 hover:bg-slate-800 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Create New Version</span>
              </button>

              {/* Button: Approve / Release Recipe */}
              <button
                type="button"
                disabled={isReleased}
                onClick={handleApproveRelease}
                className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Approve / Release Recipe</span>
              </button>

              {/* Button: Save Changes */}
              <button
                type="button"
                disabled={isLocked}
                onClick={handleSaveChanges}
                className="h-9 px-3.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-mono font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                <Save className="w-3.5 h-3.5 text-slate-700" />
                <span>Save Changes</span>
              </button>

              {/* Button: Lock Recipe */}
              {isReleased && (
                <button
                  type="button"
                  onClick={handleLockRecipe}
                  className="h-9 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
                >
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lock / Archive</span>
                </button>
              )}

              {/* Button: Delete Draft Recipe */}
              {!isLocked && (
                <button
                  type="button"
                  onClick={async () => {
                    if (activeRecipe) {
                      try {
                        await deleteRecipeMaster(activeRecipe.id);
                        showNotification('info', `Draft recipe [${activeRecipe.code}] deleted.`);
                      } catch (err: any) {
                        showNotification('error', `Delete Failed: ${err?.message || 'Database error'}`);
                      }
                    }
                  }}
                  className="h-9 px-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-mono text-xs uppercase tracking-wider flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>Delete Draft</span>
                </button>
              )}
            </div>

            {/* PM-CONTROL Integrity Indicator */}
            <div className="flex items-center gap-2 text-xs font-mono">
              {isLocked ? (
                <div className="flex items-center gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1">
                  <Lock className="w-3.5 h-3.5" />
                  <span>PARAMETERS LOCKED (PM-CONTROL INTEGRITY)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1">
                  <Unlock className="w-3.5 h-3.5" />
                  <span>DRAFT MODE: PARAMETERS EDITABLE</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM CARD: Phase Parameter Binding Table (ISA-88 Mapping) */}
      <div className="bg-white border border-slate-200 shadow-xs">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-slate-700" />
            <span className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider">
              Phase Parameter Binding Table (ISA-88 Physical Phases)
            </span>
          </div>

          {/* Ingredients Formulation Verification Badge */}
          <div className="flex items-center gap-3 font-mono text-xs">
            <div
              className={`px-3 py-1 border flex items-center gap-1.5 ${
                Math.abs(ingredientTotal - 100) < 0.1
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                  : 'bg-amber-50 border-amber-300 text-amber-800 font-bold'
              }`}
            >
              <span>INGREDIENT SUM:</span>
              <span>{ingredientTotal.toFixed(1)}%</span>
              {Math.abs(ingredientTotal - 100) < 0.1 ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 inline" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 inline" />
              )}
            </div>
          </div>
        </div>

        {/* Phase Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-3">ISA-88 Phase ID</th>
                <th className="py-2.5 px-3">Parameter Name / Role</th>
                <th className="py-2.5 px-3 text-center">Target Setpoint</th>
                <th className="py-2.5 px-3 text-center">Unit</th>
                <th className="py-2.5 px-3 text-center">Tolerance Band</th>
                <th className="py-2.5 px-3">Target Node (OPC UA / Tag)</th>
                <th className="py-2.5 px-3 text-center">Duration</th>
                <th className="py-2.5 px-3 text-center">State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {parameters.map((param, index) => {
                return (
                  <tr key={param.id || index} className="hover:bg-slate-50 transition-none">
                    {/* Phase ID */}
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                      <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 text-[11px]">
                        {param.phaseId}
                      </span>
                    </td>

                    {/* Parameter Name */}
                    <td className="py-2.5 px-3">
                      {isLocked ? (
                        <span className="font-semibold text-slate-800">{param.parameterName}</span>
                      ) : (
                        <input
                          type="text"
                          value={param.parameterName}
                          onChange={(e) => handleParamChange(index, 'parameterName', e.target.value)}
                          className="h-8 px-2 w-full text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2"
                        />
                      )}
                    </td>

                    {/* Target Setpoint */}
                    <td className="py-2.5 px-3 text-center">
                      {isLocked ? (
                        <span className="font-bold text-slate-900 text-sm">{param.targetValue}</span>
                      ) : (
                        <input
                          type="number"
                          step="0.1"
                          value={param.targetValue}
                          onChange={(e) => handleParamChange(index, 'targetValue', e.target.value)}
                          className="h-8 px-2 w-24 text-center font-bold text-slate-900 text-xs font-mono bg-white border border-slate-300 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2"
                        />
                      )}
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3 text-center font-semibold text-slate-600">
                      {param.unit}
                    </td>

                    {/* Tolerance Band */}
                    <td className="py-2.5 px-3 text-center">
                      {isLocked ? (
                        <span className="text-slate-700 bg-slate-100 px-2 py-0.5 border border-slate-200">
                          {param.tolerance}
                        </span>
                      ) : (
                        <input
                          type="text"
                          value={param.tolerance}
                          onChange={(e) => handleParamChange(index, 'tolerance', e.target.value)}
                          className="h-8 px-2 w-24 text-center text-xs font-mono bg-white border border-slate-300 text-slate-900 focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2"
                        />
                      )}
                    </td>

                    {/* Target Node (OPC UA / Tag) */}
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-mono">
                        <Cpu className="w-3 h-3 text-slate-500" />
                        {param.targetNodeId}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="py-2.5 px-3 text-center text-slate-700">
                      {param.durationSeconds ? `${param.durationSeconds} s` : 'Continuous'}
                    </td>

                    {/* Lock State */}
                    <td className="py-2.5 px-3 text-center">
                      {isLocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-semibold" title="Locked by PM-CONTROL">
                          <Lock className="w-3.5 h-3.5 text-slate-500" />
                          Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold" title="Editable">
                          <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                          Editable
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Phase Table Footnote */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 font-mono flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Parameters are bound to Siemens S7-1500 / Kepware OPC UA tags mapped in ISA-88 Telemetry Hub.</span>
          </div>
          <div className="text-[10px] text-slate-400">
            COMPLIANT: ISA-88.01 PART 1 MASTER RECIPE SCHEMA
          </div>
        </div>
      </div>
    </div>
  );
};
