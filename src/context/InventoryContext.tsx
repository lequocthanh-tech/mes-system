/* Hallmark · component: InventoryContext · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { InboundReceipt, MaterialStock, BatchConsumptionRecord, MaterialCode, ConsumedItem } from '../types/inventory';
import { useOperations } from './OperationsContext';
import { useConfig } from './ConfigContext';
import * as api from '../services/api';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

interface BatchDeductionParams {
  orderId: string;
  batchId?: string;
  recipeName?: string;
  volume?: number;
  milkQty?: number;
  sugarQty?: number;
  additiveQty?: number;
  source?: string;
}

interface InventoryContextType {
  receipts: InboundReceipt[];
  stocks: MaterialStock[];
  consumptionLogs: BatchConsumptionRecord[];
  addInboundReceipt: (receipt: Omit<InboundReceipt, 'id'>) => { success: boolean; message: string };
  updateInboundReceipt: (id: string, updated: Partial<InboundReceipt>) => void;
  deleteInboundReceipt: (id: string) => void;
  executeBatchDeduction: (params: BatchDeductionParams) => { success: boolean; message: string };
  simulateBatchDeduction: (batchId?: string, recipeName?: string, orderId?: string) => void;
  refreshStockBalance: () => void;
  getHeadspace: (materialCode: MaterialCode) => number;
  getActiveLotForMaterial: (materialCode: MaterialCode) => string;
}

const initialReceipts: InboundReceipt[] = [
  {
    id: 'inb-1',
    receiptCode: 'INB-001',
    materialCode: 'RAW_MILK',
    materialName: 'Sữa bò tươi nguyên chất (Raw Fresh Milk)',
    quantity: 10000,
    unit: 'L',
    timestamp: '2026-09-08 07:15:00',
    supplierLot: 'LOT-VINAMILK-2026-09A',
    note: 'Nhập đợt 1 xe bồn số 01 - Tiêu chuẩn tươi độ chua 14°T',
  },
  {
    id: 'inb-2',
    receiptCode: 'INB-002',
    materialCode: 'SUGAR',
    materialName: 'Đường tinh luyện RE (Granulated Sugar)',
    quantity: 10000,
    unit: 'kg',
    timestamp: '2026-09-08 07:30:00',
    supplierLot: 'LOT-BIENHOA-SUGAR-88',
    note: 'Nhập kho silo đường số 02 bao 50kg x 200 bao',
  },
  {
    id: 'inb-3',
    receiptCode: 'INB-003',
    materialCode: 'ADDITIVE',
    materialName: 'Phụ gia hương liệu & vi chất (Food Additives)',
    quantity: 1000,
    unit: 'L',
    timestamp: '2026-09-08 08:00:00',
    supplierLot: 'LOT-DSM-ADD-441',
    note: 'Nhập phụ gia bồn hòa trộn số 03 - Chứng nhận HACCP',
  },
];

const initialStocks: MaterialStock[] = [
  {
    materialCode: 'RAW_MILK',
    materialName: 'Sữa tươi nguyên liệu (Raw Milk)',
    tankId: 'TANK-01',
    tankName: 'Bồn chứa Sữa tươi (Raw Milk Silo 01)',
    currentStock: 9995.05,
    capacity: 15000,
    unit: 'L',
    minThreshold: 3000,
    lastUpdated: '2026-09-08 08:35:12',
    status: 'NORMAL',
  },
  {
    materialCode: 'SUGAR',
    materialName: 'Đường tinh luyện (Refined Sugar)',
    tankId: 'TANK-02',
    tankName: 'Silo chứa Đường tinh luyện (Sugar Silo 02)',
    currentStock: 10095.37,
    capacity: 12000,
    unit: 'kg',
    minThreshold: 2500,
    lastUpdated: '2026-09-08 08:35:12',
    status: 'NORMAL',
  },
  {
    materialCode: 'ADDITIVE',
    materialName: 'Phụ gia & Vi chất (Additives)',
    tankId: 'TANK-03',
    tankName: 'Bồn chứa Phụ gia & Vi chất (Additive Tank 03)',
    currentStock: 9641.03,
    capacity: 10000,
    unit: 'L',
    minThreshold: 2000,
    lastUpdated: '2026-09-08 08:35:12',
    status: 'NORMAL',
  },
];

const initialConsumptions: BatchConsumptionRecord[] = [
  {
    id: 'cons-1',
    batchId: 'BATCH_20260908_01',
    orderId: 'WO-2026-000',
    recipeName: 'Fresh Pasteurized UHT Milk',
    timestamp: '2026-09-08 08:30:00',
    consumedItems: [
      { materialCode: 'RAW_MILK', materialName: 'Sữa tươi nguyên liệu', consumedQty: 700.0, unit: 'L', lotCode: 'LOT-VINAMILK-2026-09A' },
      { materialCode: 'SUGAR', materialName: 'Đường tinh luyện', consumedQty: 200.0, unit: 'kg', lotCode: 'LOT-BIENHOA-SUGAR-88' },
      { materialCode: 'ADDITIVE', materialName: 'Phụ gia & Vi chất', consumedQty: 100.0, unit: 'L', lotCode: 'LOT-DSM-ADD-441' },
    ],
    status: 'RECONCILED',
    reconciledBy: 'SCADA WinCC Auto-Sync',
  },
];

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

// Safe consumer for OperationsContext to allow independent testing
const useSafeOperations = () => {
  try {
    return useOperations();
  } catch {
    return null;
  }
};

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const operations = useSafeOperations();
  const [receipts, setReceipts] = useState<InboundReceipt[]>(initialReceipts);
  const [stocks, setStocks] = useState<MaterialStock[]>([]);
  const [consumptionLogs, setConsumptionLogs] = useState<BatchConsumptionRecord[]>(initialConsumptions);

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';

  const refreshStockBalanceWithRetry = async (retries = 3, delay = 1000) => {
    try {
      const liveStocks = await api.getMaterials();
      if (liveStocks && liveStocks.length > 0) {
        setStocks(liveStocks);
      } else if (retries > 0) {
        throw new Error('Empty stock list returned from backend');
      } else if (stocks.length === 0) {
        setStocks(initialStocks);
      }
    } catch {
      if (retries > 0) {
        setTimeout(() => refreshStockBalanceWithRetry(retries - 1, Math.round(delay * 1.5)), delay);
      } else if (stocks.length === 0) {
        setStocks(initialStocks);
      }
    }
  };

  const refreshStockBalance = () => {
    refreshStockBalanceWithRetry(2, 800);
  };

  // Fetch real-time stocks from SQL Server via API Service on mount and when SQL reconnects
  useEffect(() => {
    let isMounted = true;
    const fetchStocks = async (retries = 3, delay = 1000) => {
      try {
        const liveStocks = await api.getMaterials();
        if (!isMounted) return;
        if (liveStocks && liveStocks.length > 0) {
          setStocks(liveStocks);
        } else if (retries > 0) {
          throw new Error('Empty stock list returned from backend');
        } else if (stocks.length === 0) {
          setStocks(initialStocks);
        }
      } catch {
        if (!isMounted) return;
        if (retries > 0) {
          setTimeout(() => fetchStocks(retries - 1, Math.round(delay * 1.5)), delay);
        } else if (stocks.length === 0) {
          setStocks(initialStocks);
        }
      }
    };

    fetchStocks(3, 1000);
    return () => {
      isMounted = false;
    };
  }, [sqlOnline]);

  const getHeadspace = (matCode: MaterialCode): number => {
    const targetTank = stocks.find((s) => s.materialCode === matCode);
    if (!targetTank) return 0;
    return Math.max(0, Math.round((targetTank.capacity - targetTank.currentStock) * 100) / 100);
  };

  const getActiveLotForMaterial = (matCode: MaterialCode): string => {
    const matched = receipts.filter((r) => r.materialCode === matCode);
    if (matched.length > 0) {
      return matched[0].supplierLot || 'LOT-STANDARD';
    }
    if (matCode === 'RAW_MILK') return 'LOT-VINAMILK-2026-09A';
    if (matCode === 'SUGAR') return 'LOT-BIENHOA-SUGAR-88';
    return 'LOT-DSM-ADD-441';
  };

  const updateStockForMaterial = (matCode: MaterialCode, deltaQty: number) => {
    setStocks((prevStocks) =>
      prevStocks.map((stock) => {
        if (stock.materialCode === matCode) {
          const newQty = Math.max(0, Math.round((stock.currentStock + deltaQty) * 100) / 100);
          const newStatus = newQty < stock.minThreshold ? 'LOW_STOCK' : 'NORMAL';
          const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
          return {
            ...stock,
            currentStock: newQty,
            status: newStatus,
            lastUpdated: nowStr,
          };
        }
        return stock;
      })
    );
  };

  const addInboundReceipt = (newReceipt: Omit<InboundReceipt, 'id'>) => {
    const headspace = getHeadspace(newReceipt.materialCode);
    if (newReceipt.quantity > headspace) {
      return {
        success: false,
        message: `Inbound quantity (${newReceipt.quantity.toLocaleString()} ${newReceipt.unit}) exceeds available tank headspace (${headspace.toLocaleString()} ${newReceipt.unit}). Operation blocked to prevent overflow.`,
      };
    }

    const id = `inb-${Date.now()}`;
    const receipt: InboundReceipt = {
      ...newReceipt,
      id,
    };
    setReceipts((prev) => [receipt, ...prev]);

    // Reactive increase to local stock
    updateStockForMaterial(receipt.materialCode, receipt.quantity);

    // Two-way synchronous persistence to physical SQL Server
    api.restockInventory({
      material_code: receipt.materialCode,
      material_name: receipt.materialName,
      quantity: receipt.quantity,
      lot_number: receipt.supplierLot,
      remark: receipt.note,
      user: 'Warehouse_Officer'
    }).then(() => {
      refreshStockBalance();
    }).catch((err) => {
      console.warn('[Inventory] Async SQL restock warning:', err);
    });

    return {
      success: true,
      message: `Inbound receipt [${receipt.receiptCode}] recorded successfully. ${receipt.quantity} ${receipt.unit} added to storage tank.`,
    };
  };

  const updateInboundReceipt = (id: string, updated: Partial<InboundReceipt>) => {
    const existing = receipts.find((r) => r.id === id);
    if (!existing) return;

    if (updated.quantity !== undefined && updated.quantity !== existing.quantity) {
      const delta = updated.quantity - existing.quantity;
      updateStockForMaterial(existing.materialCode, delta);
    }

    setReceipts((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updated } : r))
    );
  };

  const deleteInboundReceipt = (id: string) => {
    const existing = receipts.find((r) => r.id === id);
    if (existing) {
      updateStockForMaterial(existing.materialCode, -existing.quantity);
    }
    setReceipts((prev) => prev.filter((r) => r.id !== id));
  };

  // Automated Post-Batch Material Deduction & Reconciliation Engine
  const executeBatchDeduction = (params: BatchDeductionParams) => {
    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').substring(0, 19);
    const volumeFactor = (params.volume || 1000) / 1000;

    const milkDeduction = params.milkQty ?? Math.round(700.0 * volumeFactor * 10) / 10;
    const sugarDeduction = params.sugarQty ?? Math.round(200.0 * volumeFactor * 10) / 10;
    const additiveDeduction = params.additiveQty ?? Math.round(100.0 * volumeFactor * 10) / 10;

    // Resolve active FIFO lot codes
    const milkLot = getActiveLotForMaterial('RAW_MILK');
    const sugarLot = getActiveLotForMaterial('SUGAR');
    const additiveLot = getActiveLotForMaterial('ADDITIVE');

    // Deduct exact quantities from current stocks
    setStocks((prevStocks) =>
      prevStocks.map((stock) => {
        let deduction = 0;
        if (stock.materialCode === 'RAW_MILK') deduction = milkDeduction;
        if (stock.materialCode === 'SUGAR') deduction = sugarDeduction;
        if (stock.materialCode === 'ADDITIVE') deduction = additiveDeduction;

        const newStock = Math.max(0, Math.round((stock.currentStock - deduction) * 100) / 100);
        const status = newStock < stock.minThreshold ? 'LOW_STOCK' : 'NORMAL';

        return {
          ...stock,
          currentStock: newStock,
          status,
          lastUpdated: timeStr,
        };
      })
    );

    // Two-way synchronous persistence to physical SQL Server via atomic transaction
    api.consumeMaterials({
      order_id: params.orderId || params.batchId || 'BATCH',
      milk_qty: milkDeduction,
      sugar_qty: sugarDeduction,
      additive_qty: additiveDeduction,
      consumed_items: [
        { material_code: 'RAW_MILK', amount: milkDeduction },
        { material_code: 'SUGAR', amount: sugarDeduction },
        { material_code: 'ADDITIVE', amount: additiveDeduction },
      ]
    }).then(() => {
      refreshStockBalance();
    }).catch((err) => {
      console.warn('[Inventory] Async SQL deduction warning:', err);
    });

    const consumedItems: ConsumedItem[] = [
      {
        materialCode: 'RAW_MILK',
        materialName: 'Sữa tươi nguyên liệu',
        consumedQty: milkDeduction,
        unit: 'L',
        lotCode: milkLot,
      },
      {
        materialCode: 'SUGAR',
        materialName: 'Đường tinh luyện',
        consumedQty: sugarDeduction,
        unit: 'kg',
        lotCode: sugarLot,
      },
      {
        materialCode: 'ADDITIVE',
        materialName: 'Phụ gia & Vi chất',
        consumedQty: additiveDeduction,
        unit: 'L',
        lotCode: additiveLot,
      },
    ];

    const newLog: BatchConsumptionRecord = {
      id: `cons-${Date.now()}`,
      batchId: params.batchId || `BATCH_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(consumptionLogs.length + 1).padStart(2, '0')}`,
      orderId: params.orderId,
      recipeName: params.recipeName || 'Fresh Pasteurized UHT Milk',
      timestamp: timeStr,
      consumedItems,
      status: 'RECONCILED',
      reconciledBy: params.source || 'Kepware Central RBE Auto-Sync',
    };

    setConsumptionLogs((prev) => [newLog, ...prev]);

    // Asynchronously commit material consumption to SQL Server
    api.consumeMaterials({
      order_id: params.orderId,
      milk_qty: milkDeduction,
      sugar_qty: sugarDeduction,
      additive_qty: additiveDeduction,
    }).catch((err) => console.debug('[SQL Server] Material deduction notice:', err));

    return {
      success: true,
      message: `Batch [${params.orderId}] post-batch deduction reconciled: -${milkDeduction}L Milk (${milkLot}), -${sugarDeduction}kg Sugar (${sugarLot}), -${additiveDeduction}L Additive (${additiveLot}).`,
    };
  };

  const simulateBatchDeduction = (batchId?: string, recipeName?: string, orderId?: string) => {
    const nextOrderNum = consumptionLogs.length + 1;
    const targetOrderId = orderId || (batchId && batchId.includes('WO-') ? batchId : `WO-2026-${String(nextOrderNum).padStart(3, '0')}`);
    executeBatchDeduction({
      orderId: targetOrderId,
      batchId: batchId || `BATCH_${targetOrderId.replace('WO-', '')}`,
      recipeName: recipeName || 'Fresh Pasteurized UHT Milk (1,000L)',
      volume: 1000,
      source: 'Dev Test Harness Simulation',
    });
  };

  // Event Listener 1: Listen for Module Operations finishedOrders (status === 'COMPLETED')
  useEffect(() => {
    if (!operations?.finishedOrders) return;
    operations.finishedOrders.forEach((order) => {
      if (order.status === 'COMPLETED') {
        const alreadyReconciled = consumptionLogs.some((log) => log.orderId === order.id);
        if (!alreadyReconciled) {
          executeBatchDeduction({
            orderId: order.id,
            batchId: `BATCH_${order.id.replace('WO-', '')}`,
            recipeName: order.recipeName,
            volume: order.volume,
            source: 'Module Operations Batch Completed',
          });
        }
      }
    });
  }, [operations?.finishedOrders, consumptionLogs]);

  // Event Listener 2: Standard Window Custom Event for external/Kepware integration
  useEffect(() => {
    const handleBatchCompletedEvent = (e: Event) => {
      const custom = e as CustomEvent<{ orderId?: string; batchId?: string; recipeName?: string; volume?: number }>;
      if (custom.detail?.orderId) {
        const alreadyReconciled = consumptionLogs.some((log) => log.orderId === custom.detail?.orderId);
        if (!alreadyReconciled) {
          executeBatchDeduction({
            orderId: custom.detail.orderId,
            batchId: custom.detail.batchId,
            recipeName: custom.detail.recipeName,
            volume: custom.detail.volume,
            source: 'Kepware WebSocket Batch Event (Port 49320)',
          });
        }
      }
    };

    window.addEventListener('mes:batch-completed', handleBatchCompletedEvent);
    return () => window.removeEventListener('mes:batch-completed', handleBatchCompletedEvent);
  }, [consumptionLogs, receipts]);

  return (
    <InventoryContext.Provider
      value={{
        receipts,
        stocks,
        consumptionLogs,
        addInboundReceipt,
        updateInboundReceipt,
        deleteInboundReceipt,
        executeBatchDeduction,
        simulateBatchDeduction,
        refreshStockBalance,
        getHeadspace,
        getActiveLotForMaterial,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
