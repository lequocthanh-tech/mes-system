/* Hallmark · component: RealTimeStock · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import { TankCard } from '../../components/inventory/TankCard';
import { TankCalibrationModal } from '../../components/inventory/TankCalibrationModal';

interface NodeStatus {
  testing: boolean;
  valid?: boolean;
  value?: any;
  datatype?: string;
  message?: string;
}

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

import { 
  Database, 
  RefreshCw, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Zap, 
  ArrowDownRight, 
  Cpu,
  Info,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  Plus,
  Lock,
  Activity,
  UploadCloud,
  Settings2
} from 'lucide-react';

export const RealTimeStock: React.FC = () => {
  const { 
    stocks, 
    consumptionLogs, 
    simulateBatchDeduction, 
    refreshStockBalance,
    fetchLiveStocks,
    isRefreshing
  } = useInventory();

  const { user } = useAuth();
  const isAdmin = (user?.role?.toUpperCase() === 'ADMIN') || (user?.username?.toLowerCase() === 'admin');

  const [isSimulating, setIsSimulating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [localRefreshing, setLocalRefreshing] = useState(false);

  // Node testing states for create modal
  const [testNodeStatus, setTestNodeStatus] = useState<NodeStatus | null>(null);
  const [testHighNodeStatus, setTestHighNodeStatus] = useState<NodeStatus | null>(null);
  const [testLowNodeStatus, setTestLowNodeStatus] = useState<NodeStatus | null>(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTank, setEditingTank] = useState<any | null>(null);

  // Create Tank Form State
  const [newTankId, setNewTankId] = useState('TANK-04');
  const [newMatCode, setNewMatCode] = useState('SKIMMED_MILK');
  const [newMatName, setNewMatName] = useState('Sữa gầy thanh trùng (Skimmed Milk)');
  const [newUnit, setNewUnit] = useState('L');
  const [newCapacity, setNewCapacity] = useState<number>(1000.0);
  const [newMinSafety, setNewMinSafety] = useState<number>(50.0);
  const [newOpcNodeId, setNewOpcNodeId] = useState('');
  const [newOpcHighNodeId, setNewOpcHighNodeId] = useState('');
  const [newOpcLowNodeId, setNewOpcLowNodeId] = useState('');
  const [newSensorType, setNewSensorType] = useState('LOADCELL_MASS');
  const [newTareWeight, setNewTareWeight] = useState<number>(0.0);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Dev Harness State
  const [testOrderId, setTestOrderId] = useState<string>('WO-2026-001');
  const [testRecipe, setTestRecipe] = useState<string>('Fresh Pasteurized UHT Milk (2.0L)');

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';
  const isGatewayOnline = Boolean(config?.gatewayStatus?.is_connected || config?.gatewayStatus?.connected || config?.gatewayStatus?.status === 'ONLINE');
  const prevSqlOnlineRef = React.useRef<boolean>(false);

  // Sync live stock directly from SQL Server on view mount
  React.useEffect(() => {
    if (fetchLiveStocks) {
      fetchLiveStocks(3, 300);
    } else {
      refreshStockBalance();
    }
  }, []);

  // Listener to sqlOnline status: when SQL Server transitions to ONLINE, automatically trigger re-fetch of /api/inventory
  React.useEffect(() => {
    if (sqlOnline && !prevSqlOnlineRef.current) {
      console.info('[RealTimeStock/TankOverview] SQL Server transitioned to ONLINE -> automatically re-fetching live tank inventory from /api/inventory');
      if (fetchLiveStocks) {
        fetchLiveStocks(3, 300);
      } else {
        refreshStockBalance();
      }
    }
    prevSqlOnlineRef.current = !!sqlOnline;
  }, [sqlOnline]);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const [isUplinkingOdoo, setIsUplinkingOdoo] = useState(false);
  const [lastUplinkTime, setLastUplinkTime] = useState<string | null>(null);

  const handleUplinkOdoo = async () => {
    setIsUplinkingOdoo(true);
    try {
      const res = await api.uplinkTankStocks();
      if (res.success) {
        const ts = res.timestamp || new Date().toLocaleTimeString('vi-VN');
        setLastUplinkTime(ts);
        showToast(`✔ Đã cập nhật số dư 3 bồn lên Odoo ERP thành công! (${ts})`, 'success');
      } else {
        showToast(`Lỗi đồng bộ Odoo: ${res.error || res.message || 'Thao tác không thành công'}`, 'error');
      }
    } catch (err: any) {
      showToast(`Lỗi kết nối Odoo ERP (Timeout 25s): ${err.message || 'Không thể đồng bộ'}`, 'error');
    } finally {
      setIsUplinkingOdoo(false);
    }
  };

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      simulateBatchDeduction(`BATCH_${testOrderId.replace('WO-', '')}`, testRecipe, testOrderId);
      setIsSimulating(false);
      showToast(`Batch ${testOrderId} completed! Post-batch deduction reconciled: -1.40L Raw Milk, -0.40kg Sugar, -0.20L Additives.`, 'success');
    }, 400);
  };

  const handleRefresh = async () => {
    setLocalRefreshing(true);
    try {
      if (fetchLiveStocks) {
        await fetchLiveStocks(2, 300);
      } else {
        refreshStockBalance();
      }
      showToast('Real-time stock balance synchronized with SQL Server & SCADA Historian.', 'success');
    } catch {
      showToast('Could not synchronize stock balance. Retrying...', 'error');
    } finally {
      setLocalRefreshing(false);
    }
  };

  // Node Connectivity Tester Probe
  const testNodeProbe = async (
    nodeId: string,
    setter: React.Dispatch<React.SetStateAction<NodeStatus | null>>
  ) => {
    if (!nodeId.trim()) {
      setter({
        testing: false,
        valid: false,
        message: 'Vui lòng nhập OPC Node ID trước khi kiểm tra.'
      });
      return;
    }

    setter({ testing: true });
    try {
      const res = await api.testOpcNodeConnectivity(nodeId.trim());
      setter({
        testing: false,
        valid: res.valid,
        value: res.value,
        datatype: res.datatype,
        message: res.message || (res.valid ? `● Good (Value: ${res.value})` : '● Bad (Disconnected)')
      });
    } catch (err: any) {
      setter({
        testing: false,
        valid: false,
        message: err.message || 'Lỗi kết nối tới Gateway.'
      });
    }
  };

  const handleTestNode = (nodeId: string) => testNodeProbe(nodeId, setTestNodeStatus);
  const handleTestHighNode = (nodeId: string) => testNodeProbe(nodeId, setTestHighNodeStatus);
  const handleTestLowNode = (nodeId: string) => testNodeProbe(nodeId, setTestLowNodeStatus);

  // Handle Create Tank Submission
  // Handle Create Tank Submission
  const handleCreateTank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Chỉ quản trị viên (Admin) mới có quyền hiệu chuẩn thông số bồn chứa!', 'error');
      return;
    }

    if (!newTankId.trim() || !newMatCode.trim()) {
      showToast('Mã bồn chứa và Mã nguyên liệu là bắt buộc.', 'error');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await api.createStorageTank({
        tank_id: newTankId.trim().toUpperCase(),
        material_code: newMatCode.trim().toUpperCase(),
        material_name: newMatName.trim(),
        unit: newUnit.trim(),
        tank_capacity: Number(newCapacity) || 5.0,
        min_safety_threshold: Number(newMinSafety) || 0.5,
        capacity: Number(newCapacity) || 5.0,
        min_safety: Number(newMinSafety) || 0.5,
        opc_node_id: newOpcNodeId.trim(),
        opc_high_node_id: newOpcHighNodeId.trim(),
        opc_low_node_id: newOpcLowNodeId.trim(),
        sensor_type: newSensorType,
        tare_weight: Number(newTareWeight) || 0,
        user: user?.username || 'admin',
        role: user?.role || 'ADMIN',
      });

      showToast(`Đã khởi tạo bồn chứa [${newTankId.toUpperCase()}] thành công!`, 'success');
      setShowCreateModal(false);
      setTestNodeStatus(null);
      setTestHighNodeStatus(null);
      setTestLowNodeStatus(null);
      if (fetchLiveStocks) await fetchLiveStocks(3, 300);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khởi tạo bồn chứa.', 'error');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal for Tank
  const openEditModal = (tank: any) => {
    setEditingTank(tank);
  };

  // Handle Delete Tank
  const handleDeleteTank = async (tank: any) => {
    if (!isAdmin) {
      showToast('Yêu cầu quyền Administrator (RBAC Clearance) để xóa bồn chứa.', 'error');
      return;
    }

    const rawStock = [
      tank.currentStock,
      tank.CurrentStock,
      tank.current_stock,
      tank.Total_Quantity,
      tank.total_quantity,
    ].find((v) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v)));
    const currentStock = rawStock !== undefined ? Number(rawStock) : 0;
    const rawPv = [tank.live_pv, tank.livePv, (tank as any).LivePv].find((v) => v !== undefined && v !== null && !isNaN(Number(v)));
    const sensorVolume = rawPv !== undefined ? Number(rawPv) : 0;

    if (sensorVolume > 0.001 || currentStock > 0.001) {
      showToast(
        `Không thể xóa bồn chứa [${tank.tankId}]: Bồn hiện còn tồn kho (Cảm biến: ${sensorVolume.toLocaleString()} ${tank.unit}, Sổ sách: ${currentStock.toLocaleString()} ${tank.unit}). Vui lòng xả rỗng bồn trước khi xóa (Safety Lock).`,
        'warning'
      );
      return;
    }

    const confirmed = window.confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa bồn chứa [${tank.tankId}] (${tank.materialCode}) khỏi hệ thống MES? Hành động này sẽ được ghi vào nhật ký kiểm toán FDA 21 CFR Part 11.`);
    if (!confirmed) return;

    try {
      await api.deleteStorageTank(tank.tankId, user?.username || 'admin', user?.role || 'Admin');
      showToast(`Đã xóa bồn chứa [${tank.tankId}] thành công.`, 'success');
      if (fetchLiveStocks) await fetchLiveStocks(3, 300);
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa bồn chứa.', 'error');
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`border px-4 py-3 text-xs flex items-center justify-between shadow-xs font-mono animate-in fade-in ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : toastMessage.type === 'warning'
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />}
            {toastMessage.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />}
            {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />}
            <span className="font-semibold">{toastMessage.text}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)} 
            className="text-slate-500 hover:text-slate-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP HEADER: TITLE, CONTROLS & ADD TANK BUTTON */}
      <div className="bg-white border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Database className="w-5 h-5 text-slate-800" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide not-italic">
              Giám sát tổng kho & Bồn chứa (Real-Time Silo & Tank Storage Telemetry)
            </h2>
            <p className="text-[11px] text-slate-500 font-normal">
              ISA-95 Level 3 Inventory Operations · Real-Time Silo Volume Tracking, FIFO Lot Genealogy &amp; Automated Batch Deduction
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Inventory Engine Status Indicator */}
          <div className="flex items-center gap-2 px-3 h-9 border rounded-xs text-[11px] font-mono shadow-xs bg-slate-50 border-slate-300 text-slate-800">
            <span className={`w-2 h-2 rounded-full shrink-0 inline-block ${isGatewayOnline ? 'bg-emerald-600 animate-pulse' : 'bg-emerald-600'}`} />
            <span className="font-bold tracking-tight">
              ISA-95 LEVEL 3 · INVENTORY RECONCILIATION ENGINE (PORT 8000)
            </span>
          </div>

          {/* Add New Tank Button (RBAC: Admin) */}
          <button
            type="button"
            onClick={() => {
              if (!isAdmin) {
                showToast('Chức năng thêm bồn chứa yêu cầu quyền Administrator.', 'warning');
                return;
              }
              setTestNodeStatus(null);
              setShowCreateModal(true);
            }}
            className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs hallmark-focus active:translate-y-px ${
              isAdmin 
                ? 'bg-slate-900 hover:bg-slate-800 text-white' 
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-300'
            }`}
            title={isAdmin ? 'Khởi tạo bồn chứa vật lý mới' : 'Chỉ Administrator mới có quyền tạo bồn'}
          >
            {isAdmin ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5 text-slate-500" />}
            <span>Thêm bồn chứa mới</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            disabled={isRefreshing || localRefreshing}
            onClick={handleRefresh}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 hover:border-slate-400 text-slate-800 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${(isRefreshing || localRefreshing) ? 'animate-spin text-sky-600' : ''}`} />
            <span>{(isRefreshing || localRefreshing) ? 'Đang đồng bộ...' : 'Đồng bộ kho'}</span>
          </button>

          {/* Uplink Tank Stocks to Odoo ERP Button */}
          <button
            type="button"
            onClick={handleUplinkOdoo}
            disabled={isUplinkingOdoo}
            data-state={isUplinkingOdoo ? 'loading' : 'default'}
            className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs hallmark-focus active:translate-y-px ${
              isUplinkingOdoo
                ? 'bg-slate-100 text-slate-400 border border-slate-300 cursor-wait'
                : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300'
            }`}
            title={lastUplinkTime ? `Lần đồng bộ Odoo cuối: ${lastUplinkTime}` : 'Đồng bộ số dư 3 bồn chứa lên Odoo ERP (stock.quant)'}
          >
            <UploadCloud className={`w-3.5 h-3.5 ${isUplinkingOdoo ? 'animate-bounce text-sky-600' : 'text-slate-700'}`} />
            <span>{isUplinkingOdoo ? 'ĐANG ĐỒNG BỘ...' : '↑ ĐỒNG BỘ TỒN BỒN LÊN ODOO'}</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: DYNAMIC PHYSICAL TANK LEVEL CARDS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            Bảng điều khiển bồn chứa nguyên liệu ({stocks.length} Monitored Storage Tanks)
          </span>
          <span className="text-[10px] text-slate-500">
            CẬP NHẬT THEO SỰ KIỆN RBE · CẢM BIẾN TẢI TRỌNG LOADCELL/RADAR
          </span>
        </div>

        {/* Dynamic Silo Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stocks.map((stock: any) => (
            <TankCard
              key={stock.tankId || stock.tank_id}
              tank={stock}
              isAdmin={isAdmin}
              onConfig={openEditModal}
              onDelete={handleDeleteTank}
              onReconciled={() => {
                showToast(`Đã đồng bộ số dư bồn [${stock.tankId || stock.tank_id}] theo cảm biến thực tế thành công!`, 'success');
                if (fetchLiveStocks) fetchLiveStocks(3, 300);
              }}
            />
          ))}
        </div>
      </div>

      {/* SECTION 2: CURRENT STOCK BALANCE GRID (Bảng cân đối tồn kho) */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="bg-slate-100/70 border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide not-italic">
              Bảng cân đối tồn kho hiện tại (Current Stock Balance & Sensor Mapping)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            TOTAL ASSETS: {stocks.length} MONITORED TANKS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-24">Tank ID</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Material Name</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-40">Active Lot</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-32">Current Stock</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-24">Capacity</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-center w-20">Unit</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-20">Fill %</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-right w-24">Headspace</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 text-center w-32">Safety Status</th>
                <th className="px-3.5 py-2.5 text-center w-28">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {stocks.map((stock: any) => {
                const tankId = stock.tankId || stock.tank_id || 'TANK-01';
                const rawStock = [
                  stock.currentStock,
                  stock.CurrentStock,
                  stock.current_stock,
                  stock.Total_Quantity,
                  stock.total_quantity,
                ].find((v) => v !== undefined && v !== null && v !== '' && !isNaN(Number(v)));
                const currentStock = rawStock !== undefined ? Number(rawStock) : 0;
                const capacity = Number(stock.tank_capacity || stock.tankCapacity || stock.TankCapacity || stock.capacity || 5.0);
                const minThreshold = Number(stock.min_safety_threshold || stock.minSafetyThreshold || stock.MinSafetyThreshold || stock.minThreshold || 0.5);
                const fillPct = Math.round((currentStock / (capacity || 1)) * 1000) / 10;
                const headspace = Math.max(0, Math.round(((capacity || 1) - currentStock) * 100) / 100);
                const isLow = currentStock <= minThreshold;
                const isHigh = fillPct >= 95.0;
                const activeLot = stock.activeLot || stock.active_lot || stock.supplierLot || stock.supplier_lot || `LOT-${tankId}-ACT`;
                const matName = stock.materialName || stock.material_name || stock.materialCode || '';

                return (
                  <tr key={tankId} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-900">
                      <span className="px-2 py-0.5 bg-slate-900 text-white rounded-xs">
                        {tankId}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-semibold text-slate-900">
                      {matName}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-[10px] text-slate-700 font-bold">
                      <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded-xs">
                        {activeLot}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-900 text-right">
                      {currentStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-600 text-right">
                      {capacity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-700 text-center">
                      {stock.unit || 'L'}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-800 text-right">
                      {fillPct}%
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-emerald-700 text-right">
                      {headspace.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3.5 py-2.5 border-r border-slate-200 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold border rounded-xs ${
                          isLow
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : isHigh
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}
                      >
                        {isLow ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-amber-700" />
                            LOW STOCK
                          </>
                        ) : isHigh ? (
                          <>
                            <AlertTriangle className="w-3 h-3 text-rose-700" />
                            HIGH LEVEL
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            IN STOCK
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => openEditModal(stock)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-semibold text-[10px] uppercase rounded-xs transition-colors inline-flex items-center gap-1 hallmark-focus active:translate-y-px"
                        title="Cấu hình thông số bồn chứa"
                      >
                        <Settings2 className="w-3 h-3 text-slate-600" />
                        <span>Cấu hình</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 3: AUTOMATED POST-BATCH CONSUMPTION LOG & RECONCILIATION */}
      <div className="bg-white border border-slate-200 shadow-xs flex flex-col">
        <div className="bg-slate-100/70 border-b border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide not-italic">
                Khấu trừ mẻ sản xuất tự động (Automated Post-Batch Consumption & Reconciliation)
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              ISA-95 Level 3 MOM · Tự động khấu trừ tồn kho bồn khi nhận sự kiện hoàn thành mẻ từ Module Operations
            </p>
          </div>

          {/* Active Listener Status Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-900 text-[10px] font-bold rounded-xs shadow-xs">
              <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />
              <span>EVENT LISTENER ACTIVE (Listening for state === 'COMPLETED')</span>
            </span>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-36">Batch ID</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-32">Work Order</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Recipe Title</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200">Consumed Materials Breakdown (FIFO Lot Traceability)</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-36">Timestamp</th>
                <th className="px-3.5 py-2.5 border-r border-slate-200 w-44">Reconciled By</th>
                <th className="px-3.5 py-2.5 text-center w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-[11px]">
              {consumptionLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3.5 py-2.5 border-r border-slate-200 font-bold text-slate-900">
                    {log.batchId}
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-800 font-bold">
                    {log.orderId}
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-800">
                    {log.recipeName}
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-slate-200">
                    <div className="flex flex-wrap gap-1.5">
                      {log.consumedItems.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-300 rounded-xs font-mono text-[10px] text-slate-800"
                        >
                          <ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" />
                          <span className="font-bold">{item.materialCode}:</span>
                          <span className="font-bold text-rose-700">-{item.consumedQty} {item.unit}</span>
                          <span className="text-slate-500 font-normal">
                            (Lot: <strong className="text-slate-700">{item.lotCode || '--'}</strong>)
                          </span>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-600 text-[10px]">
                    {log.timestamp}
                  </td>
                  <td className="px-3.5 py-2.5 border-r border-slate-200 text-slate-700 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span>{log.reconciledBy}</span>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xs font-bold text-[10px]">
                      <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                      RECONCILED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Industrial Note Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex items-center gap-2 text-[10px] text-slate-600">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            <strong>Quy tắc đối soát ISA-95:</strong> Khi một mẻ sản xuất đạt trạng thái <code className="bg-slate-200 px-1 font-mono font-bold">COMPLETED</code> tại Module Operations, lượng nguyên liệu thực tế theo công thức sẽ tự động được khấu trừ khỏi bồn chứa, gán mã lô FIFO và lưu vết đối soát.
          </span>
        </div>
      </div>

      {/* DISCRETE DEVELOPER TEST HARNESS (Accordion Menu) */}
      <details className="group bg-white border border-slate-200 p-3 rounded-xs text-xs font-mono shadow-xs">
        <summary className="cursor-pointer font-bold text-slate-700 hover:text-slate-900 flex items-center justify-between list-none select-none">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
            <span>Developer Test Harness: Simulate Batch Completion (Testing Without Hardware)</span>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" />
        </summary>

        <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
          <p className="text-[11px] text-slate-600">
            Menu này dành cho kỹ sư thử nghiệm hệ thống. Trong vận hành thực tế, sự kiện hoàn thành mẻ được nhận tự động qua Kepware Gateway hoặc Module Operations.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Mã lệnh:</span>
              <select
                value={testOrderId}
                onChange={(e) => setTestOrderId(e.target.value)}
                className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="WO-2026-001">WO-2026-001</option>
                <option value="WO-2026-002">WO-2026-002</option>
                <option value="WO-2026-003">WO-2026-003</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500">Công thức:</span>
              <select
                value={testRecipe}
                onChange={(e) => setTestRecipe(e.target.value)}
                className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
              >
                <option value="Fresh Pasteurized UHT Milk (2.0L)">Fresh Pasteurized UHT Milk (2.0L)</option>
                <option value="Chocolate Flavored Dairy (2.0L)">Chocolate Flavored Dairy (2.0L)</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleSimulate}
              disabled={isSimulating}
              className="h-9 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
            >
              <Zap className={`w-3.5 h-3.5 ${isSimulating ? 'animate-spin' : ''}`} />
              <span>{isSimulating ? 'Đang khấu trừ...' : 'Simulate Batch Completion'}</span>
            </button>
          </div>
        </div>
      </details>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE NEW STORAGE TANK (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-300 shadow-xl w-full max-w-lg rounded-xs overflow-hidden animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                  Khởi tạo bồn chứa vật lý mới (Physical Tank Commissioning)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-500 hover:text-slate-900 font-bold px-1.5 py-0.5 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleCreateTank} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Mã bồn chứa (Tank ID) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTankId}
                    onChange={(e) => setNewTankId(e.target.value.toUpperCase())}
                    placeholder="TANK-04"
                    className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono uppercase font-bold rounded-xs hallmark-focus"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Mã nguyên liệu (Material Code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newMatCode}
                    onChange={(e) => setNewMatCode(e.target.value.toUpperCase())}
                    placeholder="SKIMMED_MILK"
                    className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono uppercase font-bold rounded-xs hallmark-focus"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">
                  Tên nguyên liệu / Mô tả bồn chứa
                </label>
                <input
                  type="text"
                  value={newMatName}
                  onChange={(e) => setNewMatName(e.target.value)}
                  placeholder="Sữa gầy thanh trùng (Skimmed Milk Silo 04)"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono rounded-xs hallmark-focus"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Đơn vị (Unit)
                  </label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-white border border-slate-300 h-9 px-2 text-xs font-mono rounded-xs hallmark-focus"
                  >
                    <option value="L">L (Lít)</option>
                    <option value="kg">kg (Kilogram)</option>
                    <option value="m3">m3 (Khối)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Dung tích tối đa
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Ngưỡng an toàn tối thiểu
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.05"
                    value={newMinSafety}
                    onChange={(e) => setNewMinSafety(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Loại cảm biến đo lường
                  </label>
                  <select
                    value={newSensorType}
                    onChange={(e) => setNewSensorType(e.target.value)}
                    className="w-full bg-white border border-slate-300 h-9 px-2 text-xs font-mono rounded-xs hallmark-focus"
                  >
                    <option value="LOADCELL_MASS">LOADCELL_MASS (Cảm biến tải trọng)</option>
                    <option value="RADAR_LEVEL">RADAR_LEVEL (Cảm biến mức sóng Radar)</option>
                    <option value="HYDROSTATIC_PRESSURE">HYDROSTATIC_PRESSURE (Áp suất thủy tĩnh)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Khối lượng bì / Bồn rỗng (Tare Weight)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTareWeight}
                    onChange={(e) => setNewTareWeight(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-right rounded-xs hallmark-focus"
                  />
                </div>
              </div>

              {/* OPC Node Continuous PV / Loadcell with Test Button */}
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Cảm biến Mức liên tục / Loadcell PV
                  </label>
                  {testNodeStatus && !testNodeStatus.testing && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-xs border font-semibold flex items-center gap-1 ${
                      testNodeStatus.valid 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}>
                      {testNodeStatus.valid ? `Good (PV: ${testNodeStatus.value})` : 'Bad (Disconnected)'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOpcNodeId}
                    onChange={(e) => {
                      setNewOpcNodeId(e.target.value);
                      setTestNodeStatus(null);
                    }}
                    placeholder="ns=2;s=Simulation Examples.Functions.Random1"
                    className="flex-1 bg-white border border-slate-300 h-9 px-3 text-xs font-mono rounded-xs hallmark-focus"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestNode(newOpcNodeId)}
                    disabled={testNodeStatus?.testing}
                    className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs uppercase tracking-wider flex items-center gap-1 rounded-xs transition-all shrink-0"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testNodeStatus?.testing ? 'animate-spin text-sky-600' : ''}`} />
                    <span>{testNodeStatus?.testing ? 'Test...' : 'Test'}</span>
                  </button>
                </div>
              </div>

              {/* OPC Node LSH High Overfill Switch */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Cảm biến Mức cao (LSH Overfill)
                  </label>
                  {testHighNodeStatus && !testHighNodeStatus.testing && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-xs border font-semibold flex items-center gap-1 ${
                      testHighNodeStatus.valid 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}>
                      {testHighNodeStatus.valid ? `Good (${String(testHighNodeStatus.value)})` : 'Bad (Disconnected)'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOpcHighNodeId}
                    onChange={(e) => {
                      setNewOpcHighNodeId(e.target.value);
                      setTestHighNodeStatus(null);
                    }}
                    placeholder="ns=2;s=Simulation Examples.Functions.User1"
                    className="flex-1 bg-white border border-slate-300 h-9 px-3 text-xs font-mono rounded-xs hallmark-focus"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestHighNode(newOpcHighNodeId)}
                    disabled={testHighNodeStatus?.testing}
                    className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs uppercase tracking-wider flex items-center gap-1 rounded-xs transition-all shrink-0"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testHighNodeStatus?.testing ? 'animate-spin text-sky-600' : ''}`} />
                    <span>{testHighNodeStatus?.testing ? 'Test...' : 'Test'}</span>
                  </button>
                </div>
              </div>

              {/* OPC Node LSL Low Dry Run Switch */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">
                    Cảm biến Mức thấp (LSL Dry Run)
                  </label>
                  {testLowNodeStatus && !testLowNodeStatus.testing && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-xs border font-semibold flex items-center gap-1 ${
                      testLowNodeStatus.valid 
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                        : 'bg-rose-50 text-rose-800 border-rose-300'
                    }`}>
                      {testLowNodeStatus.valid ? `Good (${String(testLowNodeStatus.value)})` : 'Bad (Disconnected)'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newOpcLowNodeId}
                    onChange={(e) => {
                      setNewOpcLowNodeId(e.target.value);
                      setTestLowNodeStatus(null);
                    }}
                    placeholder="ns=2;s=Simulation Examples.Functions.User2"
                    className="flex-1 bg-white border border-slate-300 h-9 px-3 text-xs font-mono rounded-xs hallmark-focus"
                  />
                  <button
                    type="button"
                    onClick={() => handleTestLowNode(newOpcLowNodeId)}
                    disabled={testLowNodeStatus?.testing}
                    className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-semibold text-xs uppercase tracking-wider flex items-center gap-1 rounded-xs transition-all shrink-0"
                  >
                    <Activity className={`w-3.5 h-3.5 ${testLowNodeStatus?.testing ? 'animate-spin text-sky-600' : ''}`} />
                    <span>{testLowNodeStatus?.testing ? 'Test...' : 'Test'}</span>
                  </button>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xs hallmark-focus shadow-xs"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  className="h-9 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isSubmittingCreate ? 'Đang khởi tạo...' : 'Khởi tạo bồn chứa'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: HIỆU CHUẨN BỒN CHỨA (ADMIN DYNAMIC CALIBRATION HUB) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* MODAL 2: HIỆU CHUẨN BỒN CHỨA (ADMIN DYNAMIC CALIBRATION HUB) */}
      {/* ========================================================================= */}
      <TankCalibrationModal
        isOpen={Boolean(editingTank)}
        tank={editingTank}
        onClose={() => setEditingTank(null)}
        onSaved={() => {
          showToast('Cập nhật ánh xạ thành công và đã lưu CSDL!', 'success');
          if (fetchLiveStocks) fetchLiveStocks(3, 300);
        }}
      />
    </div>
  );
};
