/* Hallmark · component: inventoryTypes · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

export type MaterialCode = 'RAW_MILK' | 'SUGAR' | 'ADDITIVE' | (string & {});

export interface InboundReceipt {
  id: string;
  receiptCode: string;
  materialCode: MaterialCode;
  materialName: string;
  quantity: number;
  unit: string;
  timestamp: string;
  supplierLot: string;
  note: string;
  tankId?: string;
  expectedQty?: number;
  actualQty?: number;
  discrepancyQty?: number;
  discrepancyPercent?: number;
  status?: string;
  receivedBy?: string;
  preIntakeWeight?: number;
  postIntakeWeight?: number;
  actualDeliveredWeight?: number;
  weightDiscrepancy?: number;
  discrepancyStatus?: 'VERIFIED' | 'SHORTAGE_WARNING' | 'SURPLUS' | 'MATCHED' | 'SHORTAGE' | 'OVERAGE' | string;
}

export interface MaterialStock {
  materialCode: MaterialCode;
  materialName: string;
  tankId: string;
  tankName: string;
  currentStock: number;
  capacity: number;
  unit: string;
  minThreshold: number;
  lastUpdated: string;
  status: 'NORMAL' | 'LOW_STOCK' | 'CRITICAL';
  opcNodeId?: string;
  sensorType?: 'LOADCELL_MASS' | 'RADAR_LEVEL' | 'HYDROSTATIC_PRESSURE' | string;
  tareWeight?: number;
  createdBy?: string;
  livePv?: number;
  pvQuality?: string;
  // Standardized industrial & snake_case telemetry aliases
  tank_id?: string;
  material_code?: string;
  material_name?: string;
  tank_name?: string;
  current_stock?: number;
  max_capacity?: number;
  maxCapacity?: number;
  tank_capacity?: number;
  tankCapacity?: number;
  safety_min?: number;
  safetyMin?: number;
  min_safety?: number;
  min_safety_threshold?: number;
  minSafetyThreshold?: number;
  assigned_tank?: string;
  AssignedTank?: string;
  assignedTank?: string;
  opc_tag?: string;
  opcTag?: string;
  opc_node_id?: string;
  live_pv?: number;
  quality?: string;
  pv_quality?: string;
  sensor_type?: string;
  tare_weight?: number;
  last_synced?: string;
  lastSynced?: string;
  // Discrete safety sensor indicators (ISA-101)
  opcHighNodeId?: string;
  opcLowNodeId?: string;
  opc_high_node_id?: string;
  opc_low_node_id?: string;
  opc_high_tag?: string;
  opc_low_tag?: string;
  highLevelActive?: boolean;
  lowLevelActive?: boolean;
  high_level_active?: boolean;
  low_level_active?: boolean;
  highLevelQuality?: string;
  lowLevelQuality?: string;
  high_level_quality?: string;
  low_level_quality?: string;
  is_mapped?: boolean;
  isMapped?: boolean;
  activeLot?: string;
  active_lot?: string;
  supplierLot?: string;
  supplier_lot?: string;
  receiptCode?: string;
  receipt_code?: string;
}

export interface ConsumedItem {
  materialCode: MaterialCode;
  materialName: string;
  consumedQty: number;
  unit: string;
  lotCode?: string;
}

export interface BatchConsumptionRecord {
  id: string;
  batchId: string;
  orderId: string;
  recipeName: string;
  timestamp: string;
  consumedItems: ConsumedItem[];
  status: 'RECONCILED' | 'PENDING' | 'MANUAL_OVERRIDE';
  reconciledBy: string;
}
