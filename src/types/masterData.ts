/* Hallmark · component: MasterDataTypes · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

export type CustomerPriority = 1 | 2 | 3;
export type CustomerStatus = 'Active' | 'Inactive';

export interface Customer {
  id: number;
  code: string;            // e.g. "CUS-VNM", "CUS-THM"
  name: string;            // e.g. "Vinamilk Corporation"
  email: string;           // e.g. "contact@vinamilk.vn"
  phone: string;           // e.g. "028-5415-5555"
  address?: string;        // e.g. "District 7, HCMC"
  priority: CustomerPriority; // 1 = Critical/High, 2 = Normal, 3 = Low
  status: CustomerStatus;  // 'Active' | 'Inactive'
  activeOrdersCount?: number;
}

export type RecipeStatus = 'DRAFT' | 'RELEASED' | 'LOCKED' | 'Draft' | 'Released' | 'Locked';

export interface RecipeParameter {
  id: string;              // e.g. "param-1"
  phaseId: string;         // e.g. "PH_SUPPLYMILK", "PH_HEATING"
  parameterName: string;   // e.g. "Ingredient Raw Milk", "Thermal Process"
  targetValue: number;     // e.g. 70.0, 138.0
  unit: string;            // e.g. "%", "°C", "RPM", "s"
  tolerance: string;       // e.g. "±1.0%", "±0.5°C"
  targetNodeId: string;    // e.g. "Recipe_Milk_SP", "Recipe_Temp_SP"
  durationSeconds?: number;
  // Legacy & extended compatibility fields
  recipeId?: number;
  materialName?: string;
  percentage?: number;
  tagName?: string;
  targetSetpoint?: number;
  isIngredient?: boolean;
}

export interface MasterRecipe {
  id: number;
  code: string;            // e.g. "RCP-MILK-UHT-01"
  name: string;            // e.g. "Fresh Pasteurized UHT Milk"
  version: string;         // e.g. "v1.2"
  status: RecipeStatus;    // 'DRAFT' | 'RELEASED' | 'LOCKED'
  category?: string;       // e.g. "Dairy UHT Processing"
  author?: string;
  createdDate?: string;
  lastModified?: string;
  parameters: RecipeParameter[];
  tempHot?: number;
  tempCold?: number;
}

// Backward compatibility aliases
export type RecipeMaster = MasterRecipe;
export type RecipeDetail = RecipeParameter;

export type WorkOrderStatus = 
  | 'NEW' 
  | 'READY' 
  | 'RUNNING' 
  | 'HELD' 
  | 'STOPPED' 
  | 'COMPLETED' 
  | 'ABORTED'
  | 'New'
  | 'Running'
  | 'Held'
  | 'Stopping'
  | 'Stopped'
  | 'Aborting'
  | 'Aborted'
  | 'Completed';

export interface CalculatedSetpoint {
  name: string;            // e.g. "Raw Milk", "Sugar Syrup", "Additive", "Sterilization Setpoint"
  calculatedValue: number; // e.g. 700.0, 200.0, 100.0, 138.0
  unit: string;            // e.g. "L", "kg", "°C"
  percentage?: number;
}

export interface WorkOrder {
  id: number;
  orderId: string;         // e.g. "WO-2026-001"
  orderName?: string;
  customerId: number;
  customerCode?: string;
  customerName: string;
  recipeId: number;
  recipeCode?: string;
  recipeName: string;
  recipeVersion: string;   // e.g. "v1.2"
  volume: number;          // Target batch volume in Liters
  quantity?: number;
  calculatedSetpoints?: CalculatedSetpoint[];
  status: WorkOrderStatus;
  targetUnit?: string;     // e.g. "UNIT MIXING"
  scheduledStartTime?: string;
  startTime?: string;
  endTime?: string;
}
