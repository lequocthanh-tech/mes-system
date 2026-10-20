/* Hallmark · component: EquipmentContext · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Equipment, MaintenanceLog, StateTransitionEvent, OperatingStatus, ServiceActionType, EquipmentType, EquipmentLocation } from '../types/equipment';
import { 
  getEquipment, 
  getEquipmentMaintenance, 
  createMaintenanceRecord, 
  updateEquipmentStatus, 
  getEquipmentStatusHistory,
  getEquipmentPerformance
} from '../services/api';
import { useConfig } from './ConfigContext';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

interface EquipmentContextType {
  equipmentList: Equipment[];
  maintenanceLogs: MaintenanceLog[];
  transitionEvents: StateTransitionEvent[];
  selectedEquipmentId: string | null;
  selectEquipment: (id: string | null) => void;
  registerEquipment: (eq: Omit<Equipment, 'lastStateUpdate'>) => void;
  updateEquipment: (id: string, updated: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;
  recordMaintenanceEvent: (log: Omit<MaintenanceLog, 'id'>) => Promise<{ success: boolean; message: string }>;
  exportMaintenanceLogsToCsv: () => void;
  isEquipmentInterlocked: (eq: Equipment) => boolean;
  refreshData: () => Promise<void>;
  isLoading: boolean;
}

const EquipmentContext = createContext<EquipmentContextType | undefined>(undefined);

export const EquipmentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [transitionEvents, setTransitionEvents] = useState<StateTransitionEvent[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Helper: Determine if an equipment asset is interlocked
  const isEquipmentInterlocked = useCallback((eq: Equipment): boolean => {
    return (
      eq.status === 'FAULT' ||
      eq.status === 'MAINTENANCE' ||
      eq.runtimeHours >= eq.maintenanceLimit ||
      eq.isInterlocked === true
    );
  }, []);

  const selectEquipment = (id: string | null) => {
    setSelectedEquipmentId(id);
  };

  // Synchronize data from live SQL Server endpoints and centralized Kepware telemetry
  const refreshData = useCallback(async () => {
    try {
      const [eqs, mLogs, trans, perfRes] = await Promise.all([
        getEquipment(),
        getEquipmentMaintenance(),
        getEquipmentStatusHistory(),
        getEquipmentPerformance().catch(() => ({ data: [] })),
      ]);

      const perfList = perfRes?.data || (Array.isArray(perfRes) ? perfRes : []);
      const perfMap: Record<string, any> = {};
      perfList.forEach((p: any) => {
        const code = String(p.equipment_code || p.EquipmentCode || '').toUpperCase();
        if (code) perfMap[code] = p;
      });

      const mappedEquipment: Equipment[] = (eqs || []).map((r: any) => {
        const rawStatus = (r.CurrentStatus || 'STOP').toUpperCase();
        const mappedStatus: OperatingStatus =
          rawStatus === 'RUNNING'
            ? 'RUNNING'
            : rawStatus === 'FAULT' || rawStatus === 'MAINTENANCE_REQUIRED'
            ? 'FAULT'
            : rawStatus === 'MAINTENANCE'
            ? 'MAINTENANCE'
            : 'STOPPED';

        const eqCodeUpper = String(r.EquipmentCode || '').toUpperCase();
        const perf = perfMap[eqCodeUpper] || {};

        return {
          id: r.EquipmentCode,
          equipmentId: r.EquipmentID,
          name: r.EquipmentName,
          type: (r.EquipmentType as EquipmentType) || 'Centrifugal Pump',
          location: (r.Location as EquipmentLocation) || 'Line 1 - Mixing Unit',
          plcTag: r.OpcNodeId || r.plcTag || '',
          opcNodeId: r.OpcNodeId || r.opcNodeId || '',
          status: mappedStatus,
          runtimeHours: Number((r.Runtime_Hours || 0).toFixed(1)),
          maintenanceLimit: r.Maintenance_Limit_Hours || 500,
          maintenanceCount: r.Maintenance_Count || 0,
          totalStarts: r.TotalStarts || 0,
          lastMaintenanceDate: r.Last_Maintenance_Date,
          nextMaintenanceDue: r.Next_Maintenance_Due,
          healthRatio: perf.health_index ?? (r.Runtime_Hours === 0 ? 100 : 100),
          usagePercent: r.Usage_Percent ?? 0,
          isInterlocked: perf.is_interlocked ?? r.Is_Interlocked ?? false,
          notes: r.Notes || `${r.Location || 'Plant Floor'} - Lượt khởi động: ${r.TotalStarts || 0}, Chu kỳ bảo trì: ${r.Maintenance_Count || 0}`,
          lastStateUpdate: r.Last_Maintenance_Date || new Date().toISOString(),
          ratedCurrent: r.RatedCurrent != null ? Number(r.RatedCurrent) : 10.0,
          rated_current: r.RatedCurrent != null ? Number(r.RatedCurrent) : 10.0,
          maxVibrationThreshold: r.MaxVibrationThreshold != null ? Number(r.MaxVibrationThreshold) : 4.5,
          maxTempThreshold: r.MaxTempThreshold != null ? Number(r.MaxTempThreshold) : 85.0,
          is_valve: perf.is_valve ?? (eqCodeUpper.startsWith('VALVE_') || String(r.EquipmentType || '').toUpperCase().includes('VALVE')),
          is_mapped: perf.is_mapped ?? false,
          valve_state: perf.valve_state ?? '',
          actualCurrent: perf.actual_current ?? 0.0,
          actual_current: perf.actual_current ?? 0.0,
          loadPercent: perf.load_percent ?? 0.0,
          load_percent: perf.load_percent ?? 0.0,
          vibrationRms: perf.vibration_rms ?? 0.0,
          vibration_rms: perf.vibration_rms ?? 0.0,
          vibrationSeverity: perf.vibration_severity ?? (perf.is_mapped ? 'GOOD' : 'UNMAPPED'),
        };
      });
      setEquipmentList(mappedEquipment);

      if (!selectedEquipmentId && mappedEquipment.length > 0) {
        setSelectedEquipmentId(mappedEquipment[0].id);
      }

      const mappedLogs: MaintenanceLog[] = (mLogs || []).map((m: any) => ({
        id: `LOG-${m.Maintenance_ID}`,
        equipmentId: m.EquipmentCode,
        equipmentIntId: m.EquipmentID,
        equipmentName: m.EquipmentName,
        technician: m.Technician,
        serviceAction: (m.Maintenance_Type as ServiceActionType) || 'Periodic Inspection',
        ticketType: m.Ticket_Type || m.Maintenance_Type || 'Preventive',
        sparePartsUsed: m.Spare_Parts_Used || '',
        actionTaken: m.Action_Taken || m.Description || '',
        servicedAt: m.Serviced_At ? m.Serviced_At.replace('T', ' ').substring(0, 19) : (m.Completed_Date ? m.Completed_Date.replace('T', ' ').substring(0, 19) : ''),
        resetRuntime: m.Reset_Runtime_Flag !== false,
        remarks: m.Remarks || m.Description || '',
        costVnd: m.Cost_VND,
        status: m.Status,
      }));
      setMaintenanceLogs(mappedLogs);

      const mappedTrans: StateTransitionEvent[] = (trans || []).map((t: any) => ({
        id: `EVT-${t.Hist_ID}`,
        equipmentId: t.EquipmentCode,
        equipmentName: t.EquipmentName || t.EquipmentCode,
        previousState: (t.Old_Status === 'STOP' ? 'STOPPED' : t.Old_Status) as OperatingStatus,
        newState: (t.New_Status === 'STOP' ? 'STOPPED' : t.New_Status) as OperatingStatus,
        triggerSource: 'SCADA / Operator Dispatch',
        durationSeconds: t.Duration_Seconds || 0,
        timestamp: t.Changed_At ? t.Changed_At.replace('T', ' ').substring(0, 19) : '',
      }));
      setTransitionEvents(mappedTrans);
    } catch (e) {
      console.warn('[EquipmentContext] Live SQL sync warning:', e);
    }
  }, [selectedEquipmentId]);

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';
  const prevSqlOnlineRef = React.useRef<boolean>(false);

  // Initial fetch and continuous 6-second heartbeat sync
  useEffect(() => {
    setIsLoading(true);
    refreshData().finally(() => setIsLoading(false));

    const poll = setInterval(() => {
      refreshData();
    }, 6000);

    return () => clearInterval(poll);
  }, [refreshData]);

  // Immediate re-fetch upon SQL Server transition from disconnected to connected
  useEffect(() => {
    if (sqlOnline && !prevSqlOnlineRef.current) {
      console.log('[EquipmentContext] SQL Server transitioned online - triggering immediate refreshData...');
      refreshData();
    }
    prevSqlOnlineRef.current = sqlOnline;
  }, [sqlOnline, refreshData]);

  const registerEquipment = (newEq: Omit<Equipment, 'lastStateUpdate'>) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const item: Equipment = {
      ...newEq,
      plcTag: newEq.plcTag.trim(),
      opcNodeId: newEq.opcNodeId || newEq.plcTag.split(' ')[0] || newEq.plcTag,
      lastStateUpdate: timestamp,
    };
    setEquipmentList((prev) => [item, ...prev]);

    // Record initial state transition in immutable ledger
    const evt: StateTransitionEvent = {
      id: `EVT-${Date.now().toString().slice(-4)}`,
      equipmentId: item.id,
      equipmentName: item.name,
      previousState: 'STOPPED',
      newState: item.status,
      triggerSource: 'Asset Commissioning / Manual Registration',
      timestamp,
    };
    setTransitionEvents((prev) => [evt, ...prev]);
  };

  const updateEquipment = (id: string, updated: Partial<Equipment>) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const targetEq = equipmentList.find((e) => e.id === id);

    if (updated.status && targetEq && updated.status !== targetEq.status) {
      const dbStatus = updated.status === 'STOPPED' ? 'STOP' : updated.status;
      updateEquipmentStatus(id, {
        status: dbStatus,
        duration_seconds: 0,
        trigger_source: 'Operator Manual Update / UI Action'
      }).then(() => {
        refreshData();
      }).catch((e) => {
        console.warn('Failed to update equipment status on backend:', e);
      });
    }

    setEquipmentList((prev) =>
      prev.map((eq) => {
        if (eq.id === id) {
          return {
            ...eq,
            ...updated,
            lastStateUpdate: timestamp,
          };
        }
        return eq;
      })
    );
  };

  const deleteEquipment = (id: string) => {
    setEquipmentList((prev) => prev.filter((eq) => eq.id !== id));
    if (selectedEquipmentId === id) {
      setSelectedEquipmentId(null);
    }
  };

  // Service Event Dispatch & Runtime Reset Logic
  const recordMaintenanceEvent = async (logData: Omit<MaintenanceLog, 'id'>): Promise<{ success: boolean; message: string }> => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const id = `LOG-${Date.now().toString().slice(-4)}`;
    const newLog: MaintenanceLog = {
      ...logData,
      id,
      servicedAt: logData.servicedAt || timestamp,
    };

    // Find integer EquipmentID
    const targetEq = equipmentList.find((e) => e.id === logData.equipmentId);
    const intId = targetEq?.equipmentId || (logData.equipmentIntId || 1);

    // Call backend API to write to dbo.Equipment_Maintenance and update dbo.Equipment_Master
    try {
      await createMaintenanceRecord({
        equipment_id: intId,
        equipment_code: logData.equipmentId,
        ticket_type: logData.ticketType || logData.serviceAction,
        maintenance_type: logData.serviceAction,
        description: logData.remarks,
        action_taken: logData.actionTaken || logData.remarks,
        spare_parts_used: logData.sparePartsUsed || '',
        remarks: logData.remarks,
        technician: logData.technician,
        cost_vnd: logData.costVnd || 0,
        reset_runtime: logData.resetRuntime,
      });
      await refreshData();
    } catch (err) {
      console.warn('Backend maintenance record sync warning:', err);
      throw err;
    }

    // Optimistic UI update
    setMaintenanceLogs((prev) => [newLog, ...prev]);

    if (newLog.resetRuntime) {
      setEquipmentList((prev) =>
        prev.map((eq) => {
          if (eq.id === newLog.equipmentId) {
            const nextStatus: OperatingStatus = 'STOPPED';
            return {
              ...eq,
              runtimeHours: 0,
              status: nextStatus,
              maintenanceCount: (eq.maintenanceCount || 0) + 1,
              healthRatio: 100,
              usagePercent: 0,
              lastStateUpdate: timestamp,
            };
          }
          return eq;
        })
      );

      // Trigger event clearing operational interlocks in Module Operations
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('mes:equipment-interlock-cleared', {
            detail: {
              equipmentId: newLog.equipmentId,
              equipmentName: newLog.equipmentName,
              resetRuntime: true,
              timestamp,
            },
          })
        );
      }
    }

    return {
      success: true,
      message: `Đã ghi nhận bảo trì [${newLog.id}] cho thiết bị ${newLog.equipmentName}.${
        newLog.resetRuntime ? ' Đã đặt lại giờ chạy về 0 giờ và xóa khóa liên động vận hành.' : ''
      }`,
    };
  };

  const exportMaintenanceLogsToCsv = () => {
    const headers = ['Log ID', 'Equipment ID', 'Equipment Name', 'Technician', 'Service Action', 'Serviced At', 'Cost (VND)', 'Remarks'];
    const rows = maintenanceLogs.map((log) => [
      log.id,
      log.equipmentId,
      `"${(log.equipmentName || '').replace(/"/g, '""')}"`,
      log.technician,
      log.serviceAction,
      log.servicedAt,
      log.costVnd || 0,
      `"${(log.remarks || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MES_Equipment_Maintenance_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <EquipmentContext.Provider
      value={{
        equipmentList,
        maintenanceLogs,
        transitionEvents,
        selectedEquipmentId,
        selectEquipment,
        registerEquipment,
        updateEquipment,
        deleteEquipment,
        recordMaintenanceEvent,
        exportMaintenanceLogsToCsv,
        isEquipmentInterlocked,
        refreshData,
        isLoading,
      }}
    >
      {children}
    </EquipmentContext.Provider>
  );
};

export const useEquipment = (): EquipmentContextType => {
  const context = useContext(EquipmentContext);
  if (!context) {
    throw new Error('useEquipment must be used within an EquipmentProvider');
  }
  return context;
};
