/* Hallmark · component: ApiService · genre: modern-minimal · register: industrial-workbench
 * states: default · loading · error · success
 * contrast: WCAG AA Pass
 */

import { Customer, MasterRecipe, WorkOrder } from '../types/masterData';
import { MaterialStock } from '../types/inventory';

export type SqlStoreForwardMode = 'ONLINE' | 'BUFFERING' | 'SYNCING';

export interface DbStatusResponse {
  connected: boolean;
  sql_connected?: boolean;
  mode?: SqlStoreForwardMode;
  buffered_count?: number;
  status: 'connected' | 'disconnected';
  database: string;
  server?: string;
  driver?: string;
  timestamp: string;
  latency_ms: number;
  error?: string;
}

export interface BatchCompletionReportPayload {
  order_code: string;
  report_code?: string;
  recipe_applied: string;
  total_produced: number;
  avg_deviation_percent?: number;
  quality_status?: 'CONFORMING' | 'NON_CONFORMING' | 'DEVIATION_ACCEPTED';
  disposition_action?: string;
  sign_off_by?: string;
  quality_results?: Array<{
    parameter_name: string;
    setpoint: number;
    actual_value: number;
    deviation_percent?: number;
    tolerance_band?: string;
    evaluation?: 'PASS' | 'WARN' | 'FAIL';
  }>;
}

export interface UserActionLogPayload {
  username: string;
  role?: string;
  action: string;
  detail?: string;
}

export interface ConsumeMaterialsPayload {
  order_id: string;
  consumed_items?: Array<{
    material_code: string;
    amount: number;
  }>;
  milk_qty?: number;
  sugar_qty?: number;
  additive_qty?: number;
}

// Base URL detection: works seamlessly with Vite proxy on localhost:3000,
// direct desktop port 8000, and file:// protocol
const getApiBase = (): string => {
  if (typeof window === 'undefined') return 'http://127.0.0.1:8000';
  if (window.location.protocol === 'file:' || window.location.port !== '3000') {
    return 'http://127.0.0.1:8000';
  }
  return '';
};

const API_BASE = getApiBase();

/**
 * Standard HTTP Fetch helper with timeout and JSON parsing
 */
async function fetchJson<T>(url: string, options?: RequestInit, timeoutMs = 4000): Promise<T> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;
    const res = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    clearTimeout(id);

    if (!res.ok) {
      let message = res.statusText || `Request failed with status ${res.status}`;
      try {
        const text = await res.text();
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.detail === 'string') {
            message = parsed.detail;
          } else if (parsed && typeof parsed.message === 'string') {
            message = parsed.message;
          } else if (text) {
            message = text;
          }
        } catch {
          if (text) message = text;
        }
      } catch {}
      throw new Error(message);
    }

    return await res.json();
  } catch (error: any) {
    clearTimeout(id);
    throw error;
  }
}

// ============================================================================
// SYSTEM TELEMETRY & HEALTH CHECKS
// ============================================================================

/**
 * Heartbeat check for Microsoft SQL Server connection on localhost\WINCC
 */
export async function checkDbStatus(): Promise<DbStatusResponse> {
  try {
    return await fetchJson<DbStatusResponse>('/api/db/status', { method: 'GET' }, 3000);
  } catch (error: any) {
    return {
      connected: false,
      sql_connected: false,
      mode: 'BUFFERING',
      buffered_count: 0,
      status: 'disconnected',
      database: 'MES_Milk_Production',
      timestamp: new Date().toISOString(),
      latency_ms: 0,
      error: error.message || 'Database unreachable',
    };
  }
}

/**
 * Unified system status for Kepware and SQL Server
 */
export async function checkSystemStatus(): Promise<{ sql_online: boolean; kepware_online: boolean; status: string }> {
  try {
    return await fetchJson<{ sql_online: boolean; kepware_online: boolean; status: string }>('/api/system/status', { method: 'GET' }, 3000);
  } catch {
    return { sql_online: false, kepware_online: false, status: 'offline' };
  }
}

export interface TestDbResponse {
  connected: boolean;
  ok?: boolean;
  status: 'connected' | 'disconnected';
  database: string;
  server: string;
  version?: string;
  latency_ms?: number;
  message?: string;
  error?: string;
}

/**
 * Handshake test to verify SQL Server connection parameters
 */
export async function testDbConnection(payload: {
  server_name: string;
  database_name: string;
  auth_mode?: string;
  username?: string;
  password?: string;
  port?: number;
}): Promise<TestDbResponse> {
  return await fetchJson<TestDbResponse>('/api/db/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 4000);
}

// ============================================================================
// MASTER DATA SERVICES
// ============================================================================

/**
 * Fetch all registered customers from SQL Server dbo.Customers
 */
export async function getCustomers(): Promise<Customer[]> {
  try {
    const res = await fetchJson<{ status: string; data: Customer[] }>('/api/customers');
    return res.data || [];
  } catch (error) {
    console.warn('[API] Could not fetch customers from SQL Server:', error);
    throw error;
  }
}

/**
 * Create customer in SQL Server dbo.Customers
 */
export async function createCustomer(customer: Partial<Customer>): Promise<any> {
  return await fetchJson('/api/customers', {
    method: 'POST',
    body: JSON.stringify(customer),
  });
}

/**
 * Update customer in SQL Server dbo.Customers
 */
export async function updateCustomer(customerId: number, customer: Partial<Customer>): Promise<any> {
  return await fetchJson(`/api/customers/${customerId}`, {
    method: 'PUT',
    body: JSON.stringify(customer),
  });
}

/**
 * Delete customer by ID from SQL Server dbo.Customers
 */
export async function deleteCustomer(customerId: number): Promise<any> {
  return await fetchJson(`/api/customers/${customerId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch master recipes from SQL Server dbo.Recipes & dbo.Recipe_Detail
 */
export async function getRecipes(): Promise<MasterRecipe[]> {
  try {
    const res = await fetchJson<{ status: string; data: MasterRecipe[] }>('/api/recipes');
    return res.data || [];
  } catch (error) {
    console.warn('[API] Could not fetch recipes from SQL Server:', error);
    throw error;
  }
}

/**
 * Create new Master Recipe in SQL Server dbo.Recipes & dbo.Recipe_Detail
 */
export async function createRecipe(recipe: Partial<MasterRecipe> & { user?: string }): Promise<any> {
  return await fetchJson('/api/recipes', {
    method: 'POST',
    body: JSON.stringify(recipe),
  });
}

/**
 * Update recipe status or parameters in SQL Server dbo.Recipes
 */
export async function updateRecipe(recipeId: number, update: Partial<MasterRecipe> & { user?: string }): Promise<any> {
  return await fetchJson(`/api/recipes/${recipeId}`, {
    method: 'PUT',
    body: JSON.stringify(update),
  });
}

/**
 * Delete recipe from SQL Server dbo.Recipes & dbo.Recipe_Detail
 */
export async function deleteRecipe(recipeId: number): Promise<any> {
  return await fetchJson(`/api/recipes/${recipeId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// OPERATIONS & ORDERS
// ============================================================================

export interface OrderSearchParams {
  keyword?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
  limit?: number;
}

/**
 * Historical Multi-Criteria Search & Filtering for Work Orders
 */
export async function searchOrders(params: OrderSearchParams = {}): Promise<WorkOrder[]> {
  try {
    const query = new URLSearchParams();
    if (params.keyword && params.keyword.trim()) {
      query.set('keyword', params.keyword.trim());
    }
    if (params.from_date && params.from_date.trim()) {
      query.set('from_date', params.from_date.trim());
    }
    if (params.to_date && params.to_date.trim()) {
      query.set('to_date', params.to_date.trim());
    }
    if (params.status && params.status.trim() && params.status.toUpperCase() !== 'ALL') {
      query.set('status', params.status.trim());
    }
    if (params.limit) {
      query.set('limit', String(params.limit));
    }
    const queryString = query.toString();
    const endpoint = queryString ? `/api/orders/search?${queryString}` : '/api/orders/search';
    const res = await fetchJson<{ status: string; count?: number; data: WorkOrder[] }>(endpoint);
    return res.data || [];
  } catch (error) {
    console.warn('[API] Order search failed:', error);
    throw error;
  }
}

/**
 * Fetch production orders from SQL Server dbo.Orders
 */
export async function getOrders(): Promise<WorkOrder[]> {
  try {
    const res = await fetchJson<{ status: string; data: WorkOrder[] }>('/api/orders');
    return res.data || [];
  } catch (error) {
    console.warn('[API] Could not fetch orders from SQL Server:', error);
    throw error;
  }
}

/**
 * Create new production batch order in SQL Server dbo.Orders
 */
export async function createOrder(order: {
  order_code?: string;
  orderId?: string;
  recipe_id?: number;
  recipeId?: number;
  customer_id?: number;
  customerId?: number;
  target_volume?: number;
  volume?: number;
  status?: string;
  user?: string;
}): Promise<any> {
  return await fetchJson('/api/orders', {
    method: 'POST',
    body: JSON.stringify(order),
  });
}

/**
 * Update order status in SQL Server (Ready, Running, Completed, Held, Aborted)
 */
export async function updateOrderStatus(orderId: string | number, status: string, user?: string): Promise<any> {
  return await fetchJson(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, user: user || 'Operator' }),
  });
}

/**
 * Delete order from SQL Server dbo.Orders
 */
export async function deleteOrder(orderCode: string | number): Promise<any> {
  return await fetchJson(`/api/orders/${orderCode}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// INVENTORY & CONSUMPTION
// ============================================================================

/**
 * Fetch live silo storage levels from SQL Server dbo.Material_Stock
 */
export async function getMaterials(): Promise<MaterialStock[]> {
  try {
    const res = await fetchJson<{ status: string; data: any[] }>('/api/inventory');
    if (!res.data) return [];
    return res.data.map((item: any) => ({
      materialCode: item.material_code || item.materialCode || item.Material_Code,
      materialName: item.material_name || item.materialName || item.Material_Name,
      tankId: item.tank_id || item.tankId || item.AssignedTank || 'TANK-01',
      tankName: item.tank_name || item.tankName || item.Tank_Name || `Silo ${item.AssignedTank || ''}`,
      currentStock: Number(item.current_stock ?? item.currentStock ?? item.CurrentStock ?? 0),
      capacity: Number(item.capacity ?? item.TankCapacity ?? 10000),
      unit: item.unit || item.Unit || 'L',
      minThreshold: Number(item.min_threshold ?? item.minThreshold ?? item.MinSafetyThreshold ?? 1000),
      lastUpdated: item.last_updated ?? item.lastUpdated ?? item.Last_Update ?? new Date().toISOString(),
      status: (item.status || item.Status || 'NORMAL') as any,
    }));
  } catch (error) {
    console.warn('[API] Could not fetch materials from SQL Server:', error);
    throw error;
  }
}

export const getInventory = getMaterials;

/**
 * Deduct material amounts via SQL Server atomic transaction after batch completion
 */
export async function consumeMaterials(payload: ConsumeMaterialsPayload): Promise<any> {
  return await fetchJson('/api/inventory/consume', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export const consumeInventory = consumeMaterials;

/**
 * Restock inbound materials into dbo.Material_Input and update dbo.Material_Stock
 */
export async function restockInventory(payload: {
  material_code: string;
  material_name?: string;
  quantity: number;
  lot_number?: string;
  remark?: string;
  user?: string;
}): Promise<any> {
  return await fetchJson('/api/inventory/restock', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ============================================================================
// AUDIT TRAIL & EBR ELECTRONIC BATCH RECORDS
// ============================================================================

/**
 * Log user interaction into SQL Server dbo.UserActionLog
 */
export async function logUserAction(payload: UserActionLogPayload): Promise<any> {
  try {
    return await fetchJson('/api/audit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking log
    return null;
  }
}

/**
 * Fetch audit trail logs from SQL Server dbo.UserActionLog
 */
export async function getAuditLogs(limit = 100): Promise<any[]> {
  try {
    const res = await fetchJson<{ status: string; data: any[] }>(`/api/audit?limit=${limit}`);
    return res.data || [];
  } catch {
    return [];
  }
}

/**
 * Submit full batch completion report into dbo.ProductionReport and dbo.Quality_Result
 */
export async function submitBatchCompletionReport(payload: BatchCompletionReportPayload): Promise<any> {
  return await fetchJson('/api/reports/batch-completion', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Get historical production reports from dbo.ProductionReport
 */
export async function getBatchReports(): Promise<any[]> {
  try {
    const res = await fetchJson<{ status: string; data: any[] }>('/api/reports');
    return res.data || [];
  } catch {
    return [];
  }
}

export const getReports = getBatchReports;

/**
 * Get detailed report with Quality_Result rows
 */
export async function getBatchReportDetail(orderCode: string): Promise<any> {
  try {
    const res = await fetchJson<{ status: string; data: any }>(`/api/reports/${orderCode}`);
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Query time-series telemetry from dbo.PLC_Datalog for a batch
 */
export async function getHistorianDatalog(orderCode: string): Promise<any[]> {
  try {
    const res = await fetchJson<{ status: string; data: any[] }>(`/api/telemetry/${orderCode}`);
    return res.data || [];
  } catch {
    return [];
  }
}

export const getTelemetry = getHistorianDatalog;

export interface CreateMaintenancePayload {
  equipment_id: number | string;
  maintenance_type: string;
  description: string;
  technician: string;
  cost_vnd?: number;
  reset_runtime?: boolean;
}

export interface UpdateEquipmentStatusPayload {
  status: string;
  duration_seconds?: number;
  trigger_source?: string;
}

/**
 * Fetch all equipment from SQL Server dbo.Equipment_Master
 */
export async function getEquipment(): Promise<any[]> {
  try {
    const res = await fetchJson<{ status: string; data: any[] }>('/api/equipment');
    return res.data || [];
  } catch {
    return [];
  }
}

/**
 * Fetch maintenance history from SQL Server dbo.Equipment_Maintenance
 */
export async function getEquipmentMaintenance(equipmentId?: number): Promise<any[]> {
  try {
    const q = equipmentId ? `?equipment_id=${equipmentId}` : '';
    const res = await fetchJson<{ status: string; data: any[] }>(`/api/equipment/maintenance${q}`);
    return res.data || [];
  } catch {
    return [];
  }
}

/**
 * Record a completed maintenance event in SQL Server
 */
export async function createMaintenanceRecord(payload: CreateMaintenancePayload): Promise<any> {
  return await fetchJson('/api/equipment/maintenance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Update equipment operating status and log transition into dbo.Equipment_Status_History
 */
export async function updateEquipmentStatus(
  identifier: string | number,
  payload: UpdateEquipmentStatusPayload
): Promise<any> {
  return await fetchJson(`/api/equipment/${identifier}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Fetch state transition history from dbo.Equipment_Status_History
 */
export async function getEquipmentStatusHistory(equipmentId?: number, limit = 100): Promise<any[]> {
  try {
    const q = equipmentId ? `?equipment_id=${equipmentId}&limit=${limit}` : `?limit=${limit}`;
    const res = await fetchJson<{ status: string; data: any[] }>(`/api/equipment/status-history${q}`);
    return res.data || [];
  } catch {
    return [];
  }
}

/**
 * Fetch setpoint monitoring comparison logs from dbo.PLC_Setpoint_Monitoring
 */
export async function getSetpointMonitoring(): Promise<any[]> {
  try {
    const res = await fetchJson<{ status: string; data: any[] }>('/api/setpoints/monitoring');
    return res.data || [];
  } catch {
    return [];
  }
}

