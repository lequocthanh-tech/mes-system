/* Hallmark · component: MasterDataContext · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Customer, 
  MasterRecipe, 
  RecipeParameter, 
  RecipeDetail, 
  WorkOrder,
  CalculatedSetpoint
} from '../types/masterData';
import * as api from '../services/api';
import { useConfig } from './ConfigContext';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

export interface MasterDataContextType {
  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, 'id'> & { id?: number }) => Promise<boolean>;
  editCustomer: (id: number, customer: Partial<Customer>) => Promise<boolean>;
  deleteCustomer: (id: number) => Promise<boolean>;

  // Recipe Masters (Siemens PM-CONTROL Benchmark)
  recipes: MasterRecipe[];
  selectedRecipeId: number | null;
  setSelectedRecipeId: (id: number | null) => void;
  saveRecipeMaster: (recipe: Omit<MasterRecipe, 'id'> & { id?: number }) => Promise<boolean>;
  editRecipeMaster: (id: number, recipe: Partial<MasterRecipe>) => Promise<boolean>;
  deleteRecipeMaster: (id: number) => Promise<boolean>;
  createNewVersion: (recipeId: number) => Promise<boolean>;
  approveRecipe: (recipeId: number) => Promise<boolean>;
  lockRecipe: (recipeId: number) => Promise<boolean>;
  updateRecipeParameters: (recipeId: number, parameters: RecipeParameter[]) => Promise<boolean>;

  // Recipe Details (Backward-compatibility)
  recipeDetails: RecipeDetail[];
  addRecipeDetail: (detail: any) => boolean;
  editRecipeDetail: (id: number, detail: any) => boolean;
  deleteRecipeDetail: (id: number) => boolean;

  // Work Orders (Operations Dispatch & Control Recipe)
  workOrders: WorkOrder[];
  addWorkOrder: (order: Omit<WorkOrder, 'id'> & { id?: number }) => Promise<boolean>;
  editWorkOrder: (id: number, order: Partial<WorkOrder>) => Promise<boolean>;
  deleteWorkOrder: (id: number) => Promise<boolean>;
  dispatchWorkOrder: (id: number) => Promise<boolean>;

  // State synchronization & feedback
  isLoading: boolean;
  errorNotice: string | null;
  clearErrorNotice: () => void;
  refetchData: () => Promise<void>;
}



export const calculateControlRecipeSetpoints = (volume: number, recipe: MasterRecipe): CalculatedSetpoint[] => {
  const params = recipe.parameters || [];
  const milkParam = params.find(p => 
    p.phaseId === 'PH_SUPPLYMILK' || 
    p.phaseId === 'PH_DOSING_MILK' || 
    (p.phaseId === 'PH_DOSING' && /milk|sữa/i.test(p.parameterName || '')) ||
    /milk|sữa/i.test(p.parameterName || '')
  ) || params[0];

  const sugarParam = params.find(p => 
    p.phaseId === 'PH_SUPPLYSUGAR' || 
    p.phaseId === 'PH_DOSING_SUGAR' || 
    (p.phaseId === 'PH_DOSING' && /sugar|đường/i.test(p.parameterName || '')) ||
    /sugar|đường/i.test(p.parameterName || '')
  ) || params[1];

  const additiveParam = params.find(p => 
    p.phaseId === 'PH_SUPPLYADDITIVE' || 
    p.phaseId === 'PH_DOSING_ADDITIVE' || 
    (p.phaseId === 'PH_DOSING' && /additive|phụ gia/i.test(p.parameterName || '')) ||
    /additive|phụ gia/i.test(p.parameterName || '')
  ) || params[2];

  const heatParam = params.find(p => 
    p.phaseId === 'PH_HEATING' || 
    /temp|nhiệt|steril/i.test(p.parameterName || '') || 
    p.unit === '°C'
  );

  const milkPct = milkParam ? (Number(milkParam.targetSetpoint ?? milkParam.targetValue ?? milkParam.percentage) || 70.0) : 70.0;
  const sugarPct = sugarParam ? (Number(sugarParam.targetSetpoint ?? sugarParam.targetValue ?? sugarParam.percentage) || 20.0) : 20.0;
  const additivePct = additiveParam ? (Number(additiveParam.targetSetpoint ?? additiveParam.targetValue ?? additiveParam.percentage) || 10.0) : 10.0;
  const heatTemp = heatParam ? (Number(heatParam.targetSetpoint ?? heatParam.targetValue) || 138.0) : (recipe.tempHot || 138.0);

  return [
    {
      name: 'Raw Milk Setpoint',
      calculatedValue: parseFloat(((volume * milkPct) / 100).toFixed(1)),
      unit: 'L',
      percentage: milkPct,
    },
    {
      name: 'Sugar Syrup Setpoint',
      calculatedValue: parseFloat(((volume * sugarPct) / 100).toFixed(1)),
      unit: 'kg',
      percentage: sugarPct,
    },
    {
      name: 'Additive Dosing Setpoint',
      calculatedValue: parseFloat(((volume * additivePct) / 100).toFixed(1)),
      unit: 'L',
      percentage: additivePct,
    },
    {
      name: 'Sterilization Temp Setpoint',
      calculatedValue: heatTemp,
      unit: '°C',
    },
  ];
};

const MasterDataContext = createContext<MasterDataContextType | undefined>(undefined);

export const MasterDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [recipes, setRecipes] = useState<MasterRecipe[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState<number | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const clearErrorNotice = () => setErrorNotice(null);

  // Derived legacy recipeDetails
  const recipeDetails: RecipeDetail[] = recipes.flatMap((r) => r.parameters || []);

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';

  // Live Fetch from physical SQL Server via API Service with resilient exponential backoff retry
  const fetchMasterDataWithRetry = async (retries = 3, delay = 1000) => {
    setIsLoading(true);
    try {
      const [custRes, recRes, ordRes] = await Promise.allSettled([
        api.getCustomers(),
        api.getRecipes(),
        api.getOrders(),
      ]);

      let anySuccess = false;

      if (custRes.status === 'fulfilled' && Array.isArray(custRes.value)) {
        setCustomers(custRes.value);
        anySuccess = true;
      }

      if (recRes.status === 'fulfilled' && Array.isArray(recRes.value)) {
        const rList = recRes.value;
        setRecipes(rList);
        if (rList.length > 0) {
          setSelectedRecipeId((prev) => (prev && rList.some((r) => r.id === prev) ? prev : rList[0].id));
        } else {
          setSelectedRecipeId(null);
        }
        anySuccess = true;
      }

      if (ordRes.status === 'fulfilled' && Array.isArray(ordRes.value)) {
        setWorkOrders(ordRes.value);
        anySuccess = true;
      }

      // If nothing succeeded, trigger retry
      if (!anySuccess && retries > 0) {
        throw new Error('Initial SQL Server handshake pending');
      }
      setErrorNotice(null);
    } catch (err: any) {
      if (retries > 0) {
        setTimeout(() => {
          fetchMasterDataWithRetry(retries - 1, Math.round(delay * 1.5));
        }, delay);
      } else {
        console.warn('[MasterData] Initial load retry exhausted:', err);
        setErrorNotice(err?.message || 'Database Read Warning: Unable to synchronize with SQL Server');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch on mount and whenever SQL Server transitions to connected
  useEffect(() => {
    fetchMasterDataWithRetry(3, 1000);
  }, [sqlOnline]);

  // Update customer active orders count based on workOrders
  useEffect(() => {
    setCustomers((prev) =>
      prev.map((c) => {
        const activeCount = workOrders.filter(
          (wo) => wo.customerId === c.id && (wo.status === 'NEW' || wo.status === 'READY' || wo.status === 'RUNNING' || wo.status === 'New' || wo.status === 'Running')
        ).length;
        return { ...c, activeOrdersCount: activeCount };
      })
    );
  }, [workOrders]);

  // Customer Actions
  const addCustomer = async (customer: Omit<Customer, 'id'> & { id?: number }): Promise<boolean> => {
    try {
      await api.createCustomer(customer);
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Create customer error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const editCustomer = async (id: number, updated: Partial<Customer>): Promise<boolean> => {
    try {
      await api.updateCustomer(id, updated);
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Edit customer error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const deleteCustomer = async (id: number): Promise<boolean> => {
    try {
      await api.deleteCustomer(id);
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Delete customer error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  // Recipe Master Actions (Siemens PM-CONTROL Standard)
  const saveRecipeMaster = async (recipe: Omit<MasterRecipe, 'id'> & { id?: number }): Promise<boolean> => {
    try {
      await api.createRecipe(recipe);
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Save recipe error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const editRecipeMaster = async (id: number, updated: Partial<MasterRecipe>): Promise<boolean> => {
    try {
      // Optimistic state update
      setRecipes((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
      );
      await api.updateRecipe(id, updated);
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Edit recipe error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const deleteRecipeMaster = async (id: number): Promise<boolean> => {
    try {
      await api.deleteRecipe(id);
      await fetchMasterDataWithRetry();
      if (selectedRecipeId === id) {
        setSelectedRecipeId(null);
      }
      return true;
    } catch (err: any) {
      console.error('[MasterData] Delete recipe error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const createNewVersion = async (recipeId: number): Promise<boolean> => {
    const parent = recipes.find((r) => r.id === recipeId);
    if (!parent) return false;

    // Increment version, e.g. v1.2 -> v1.3
    const match = parent.version.match(/v?(\d+)\.(\d+)/);
    let nextVer = 'v1.0';
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10) + 1;
      nextVer = `v${major}.${minor}`;
    } else {
      nextVer = `${parent.version}.1`;
    }

    try {
      await api.createRecipe({
        code: parent.code,
        name: parent.name,
        version: nextVer,
        status: 'DRAFT',
        tempHot: parent.tempHot,
        tempCold: parent.tempCold,
        parameters: parent.parameters || [],
        user: 'MES Operator / Version Engine',
      });
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Create version error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const approveRecipe = async (recipeId: number): Promise<boolean> => {
    try {
      // Optimistic state update to immediately unlock downstream operations & counter
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? { ...r, status: 'RELEASED' } : r))
      );
      await api.updateRecipe(recipeId, { status: 'RELEASED' });
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Approve recipe error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const lockRecipe = async (recipeId: number): Promise<boolean> => {
    try {
      // Optimistic state update
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? { ...r, status: 'LOCKED' } : r))
      );
      await api.updateRecipe(recipeId, { status: 'LOCKED' });
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Lock recipe error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const updateRecipeParameters = async (recipeId: number, parameters: RecipeParameter[]): Promise<boolean> => {
    try {
      // Optimistic state update
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipeId ? { ...r, parameters } : r))
      );
      const heat = parameters.find((p) => p.phaseId === 'PH_HEATING');
      const cool = parameters.find((p) => p.phaseId === 'PH_COOLING');
      await api.updateRecipe(recipeId, {
        parameters,
        tempHot: heat ? heat.targetValue : undefined,
        tempCold: cool ? cool.targetValue : undefined,
      });
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Update recipe parameters error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  // Recipe Detail Legacy Actions
  const addRecipeDetail = (detail: any): boolean => {
    if (!selectedRecipeId) return false;
    const targetRecipe = recipes.find((r) => r.id === selectedRecipeId);
    if (!targetRecipe) return false;

    const newParam: RecipeParameter = {
      id: detail.id || `param-${Date.now()}`,
      phaseId: detail.phaseId || 'PH_CUSTOM',
      parameterName: detail.materialName || detail.parameterName || 'Custom Parameter',
      targetValue: detail.percentage ?? detail.targetValue ?? 0,
      unit: detail.unit || '%',
      tolerance: detail.tolerance || '±0.5%',
      targetNodeId: detail.tagName || detail.targetNodeId || 'Custom_SP',
      recipeId: selectedRecipeId,
      materialName: detail.materialName,
      percentage: detail.percentage,
      tagName: detail.tagName,
    };

    updateRecipeParameters(selectedRecipeId, [...(targetRecipe.parameters || []), newParam]);
    return true;
  };

  const editRecipeDetail = (id: number | string, updated: any): boolean => {
    if (!selectedRecipeId) return false;
    const targetRecipe = recipes.find((r) => r.id === selectedRecipeId);
    if (!targetRecipe) return false;

    const updatedParams = (targetRecipe.parameters || []).map((p) => {
      if (p.id === id.toString() || p.id === `param-${id}`) {
        return {
          ...p,
          ...updated,
          targetValue: updated.percentage ?? updated.targetValue ?? p.targetValue,
          parameterName: updated.materialName ?? updated.parameterName ?? p.parameterName,
          targetNodeId: updated.tagName ?? updated.targetNodeId ?? p.targetNodeId,
        };
      }
      return p;
    });

    updateRecipeParameters(selectedRecipeId, updatedParams);
    return true;
  };

  const deleteRecipeDetail = (id: number | string): boolean => {
    if (!selectedRecipeId) return false;
    const targetRecipe = recipes.find((r) => r.id === selectedRecipeId);
    if (!targetRecipe) return false;

    const filtered = (targetRecipe.parameters || []).filter(
      (p) => p.id !== id.toString() && p.id !== `param-${id}`
    );
    updateRecipeParameters(selectedRecipeId, filtered);
    return true;
  };

  // Work Order Actions
  const addWorkOrder = async (order: Omit<WorkOrder, 'id'> & { id?: number }): Promise<boolean> => {
    const nextId = order.id && !workOrders.some((w) => w.id === order.id)
      ? order.id
      : (workOrders.length > 0 ? Math.max(...workOrders.map((w) => w.id)) + 1 : 1);

    const orderId = order.orderId || `WO-${new Date().getFullYear()}-${nextId.toString().padStart(3, '0')}`;

    try {
      await api.createOrder({
        order_code: orderId,
        recipe_id: order.recipeId || 1,
        customer_id: order.customerId || 1,
        target_volume: order.volume || 1000,
        status: order.status || 'READY',
        user: 'Operator'
      });
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Create order error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const editWorkOrder = async (id: number, updated: Partial<WorkOrder>): Promise<boolean> => {
    const target = workOrders.find((w) => w.id === id);
    if (!target) return false;
    try {
      if (updated.status) {
        await api.updateOrderStatus(target.orderId, updated.status, 'Operator');
        await fetchMasterDataWithRetry();
      } else {
        setWorkOrders((prev) => prev.map((w) => (w.id === id ? { ...w, ...updated, id } : w)));
      }
      return true;
    } catch (err: any) {
      console.error('[MasterData] Edit order error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const deleteWorkOrder = async (id: number): Promise<boolean> => {
    try {
      const target = workOrders.find((w) => w.id === id);
      const orderCode = target ? target.orderId : id;
      await api.deleteOrder(orderCode);
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Delete work order error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  const dispatchWorkOrder = async (id: number): Promise<boolean> => {
    const target = workOrders.find((w) => w.id === id);
    if (!target) return false;

    try {
      await api.updateOrderStatus(target.orderId, 'Running', 'Operator');
      await fetchMasterDataWithRetry();
      return true;
    } catch (err: any) {
      console.error('[MasterData] Dispatch order error:', err);
      const msg = err?.message || 'Database Write Failed';
      setErrorNotice(msg);
      throw err;
    }
  };

  return (
    <MasterDataContext.Provider
      value={{
        customers,
        addCustomer,
        editCustomer,
        deleteCustomer,

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

        recipeDetails,
        addRecipeDetail,
        editRecipeDetail,
        deleteRecipeDetail,

        workOrders,
        addWorkOrder,
        editWorkOrder,
        deleteWorkOrder,
        dispatchWorkOrder,

        isLoading,
        errorNotice,
        clearErrorNotice,
        refetchData: fetchMasterDataWithRetry,
      }}
    >
      {children}
    </MasterDataContext.Provider>
  );
};

export const useMasterData = (): MasterDataContextType => {
  const context = useContext(MasterDataContext);
  if (!context) {
    throw new Error('useMasterData must be used within a MasterDataProvider');
  }
  return context;
};
