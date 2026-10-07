/* Hallmark · component: inventoryTypes · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

export type MaterialCode = 'RAW_MILK' | 'SUGAR' | 'ADDITIVE';

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
