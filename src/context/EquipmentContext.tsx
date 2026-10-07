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
  getEquipmentStatusHistory 
} from '../services/api';

interface EquipmentContextType {
  equipmentList: Equipment[];
  maintenanceLogs: MaintenanceLog[];
  transitionEvents: StateTransitionEvent[];
  selectedEquipmentId: string | null;
  selectEquipment: (id: string | null) => void;
  registerEquipment: (eq: Omit<Equipment, 'lastStateUpdate'>) => void;
  updateEquipment: (id: string, updated: Partial<Equipment>) => void;
  deleteEquipment: (id: string) => void;
  recordMaintenanceEvent: (log: Omit<MaintenanceLog, 'id'>) => { success: boolean; message: string };
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

  // Synchronize data from live SQL Server endpoints
  const refreshData = useCallback(async () => {
    try {
      const [eqs, mLogs, trans] = await Promise.all([
        getEquipment(),
        getEquipmentMaintenance(),
        getEquipmentStatusHistory(),
      ]);

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

        return {
          id: r.EquipmentCode,
          equipmentId: r.EquipmentID,
          name: r.EquipmentName,
          type: (r.EquipmentType as EquipmentType) || 'Centrifugal Pump',
          location: (r.Location as EquipmentLocation) || 'Line 1 - Mixing Unit',
          plcTag: `ns=2;s=Line1.${r.EquipmentCode}`,
          opcNodeId: `ns=2;s=Line1.${r.EquipmentCode}`,
          status: mappedStatus,
          runtimeHours: Number((r.Runtime_Hours || 0).toFixed(1)),
          maintenanceLimit: r.Maintenance_Limit_Hours || 500,
          maintenanceCount: r.Maintenance_Count || 0,
          totalStarts: r.TotalStarts || 0,
          lastMaintenanceDate: r.Last_Maintenance_Date,
          nextMaintenanceDue: r.Next_Maintenance_Due,
          healthRatio: r.Health_Ratio ?? 100,
          usagePercent: r.Usage_Percent ?? 0,
          isInterlocked: r.Is_Interlocked ?? false,
          notes: `${r.Location || 'Plant Floor'} - Lượt khởi động: ${r.TotalStarts || 0}, Chu kỳ bảo trì: ${r.Maintenance_Count || 0}`,
          lastStateUpdate: r.Last_Maintenance_Date || new Date().toISOString(),
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
        servicedAt: m.Completed_Date ? m.Completed_Date.replace('T', ' ').substring(0, 19) : '',
        resetRuntime: true,
        remarks: m.Description,
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

  // Initial fetch and continuous 6-second heartbeat sync
  useEffect(() => {
    setIsLoading(true);
    refreshData().finally(() => setIsLoading(false));

    const poll = setInterval(() => {
      refreshData();
    }, 6000);

    return () => clearInterval(poll);
  }, [refreshData]);

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
  const recordMaintenanceEvent = (logData: Omit<MaintenanceLog, 'id'>) => {
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
    createMaintenanceRecord({
      equipment_id: intId,
      maintenance_type: logData.serviceAction,
      description: logData.remarks,
      technician: logData.technician,
      cost_vnd: logData.costVnd || 0,
      reset_runtime: logData.resetRuntime,
    }).then(() => {
      refreshData();
    }).catch((err) => {
      console.warn('Backend maintenance record sync warning:', err);
    });

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
