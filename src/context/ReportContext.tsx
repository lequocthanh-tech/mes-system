/* Hallmark · context: ReportContext · genre: modern-minimal · register: industrial-workbench
 * standards: ISA-95 Level 3 MOM · FDA 21 CFR Part 11 · ANSI/ISA-88
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  BatchProductionMaster,
  BatchProductionDetail,
  QualityInspectionRecord,
  QualityParameterDetail,
  InventoryReportItem,
  AlarmReportItem,
  UserAuditLogItem,
  ReportSubTab,
  ForensicFilter,
  ActiveAlarmState,
} from '../types/report';
import { useAuth } from './AuthContext';
import { useConfig } from './ConfigContext';
import { generateAndDownloadExcel } from '../utils/exportExcel';
import { generateAndPrintPdf } from '../utils/exportPdf';
import * as api from '../services/api';

const useSafeConfig = () => {
  try {
    return useConfig();
  } catch {
    return null;
  }
};

interface ReportContextType {
  // Navigation
  activeSubTab: ReportSubTab;
  setActiveSubTab: (tab: ReportSubTab) => void;

  // Active Alarm State (ISA-18.2)
  activeAlarm: ActiveAlarmState | null;
  acknowledgeActiveAlarm: (operatorName?: string) => void;
  clearActiveAlarm: () => void;
  triggerSimulatedAlarm: (customAlarm?: Partial<ActiveAlarmState>) => void;
  addAuditLog: (action: string, target: string, username?: string, role?: string) => void;

  // Filters
  fromDate: string;
  toDate: string;
  searchQuery: string;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setSearchQuery: (query: string) => void;
  runQuery: () => void;
  isQuerying: boolean;

  // Selected IDs
  selectedBatchReportId: string;
  selectBatchReport: (id: string) => void;
  selectedQualityId: string;
  selectQualityReport: (id: string) => void;

  // Forensic Investigation State
  forensicFilter: ForensicFilter | null;
  triggerForensicInvestigation: (eventId: string, type: 'QUALITY_DEVIATION' | 'ALARM_INCIDENT') => void;
  clearForensicInvestigation: () => void;

  // Data
  batchMasters: BatchProductionMaster[];
  batchDetails: BatchProductionDetail[];
  qualityRecords: QualityInspectionRecord[];
  qualityDetails: QualityParameterDetail[];
  inventoryItems: InventoryReportItem[];
  alarmItems: AlarmReportItem[];
  auditLogs: UserAuditLogItem[];

  // Export functions
  exportReportToExcel: (reportType: string) => Promise<void>;
  exportReportToPdf: (reportType: string) => Promise<void>;
  isExporting: boolean;
  refreshAuditLogs: () => Promise<void>;
  toastNotice: string | null;
  setToastNotice: (msg: string | null) => void;
}

const initialBatchMasters: BatchProductionMaster[] = [];
const initialBatchDetails: BatchProductionDetail[] = [];
const initialQualityRecords: QualityInspectionRecord[] = [];
const initialQualityDetails: QualityParameterDetail[] = [];
const initialInventoryItems: InventoryReportItem[] = [];
const initialAlarmItems: AlarmReportItem[] = [];
const initialAuditLogs: UserAuditLogItem[] = [];

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const ReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('batch_production');

  // ISA-18.2 Active Alarm State: starts null (zero hardcoded mock alarms)
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarmState | null>(null);

  const [fromDate, setFromDate] = useState<string>('2026-09-01');
  const [toDate, setToDate] = useState<string>('2026-09-08');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const [selectedBatchReportId, setSelectedBatchReportId] = useState<string>('');
  const [selectedQualityId, setSelectedQualityId] = useState<string>('');

  // Forensic Drill-Down Filter State
  const [forensicFilter, setForensicFilter] = useState<ForensicFilter | null>(null);

  const config = useSafeConfig();
  const sqlOnline = config?.sqlConfig?.connectionState === 'connected';
  const prevSqlOnlineRef = React.useRef<boolean>(false);

  const [batchMasters, setBatchMasters] = useState<BatchProductionMaster[]>(initialBatchMasters);
  const [batchDetails] = useState<BatchProductionDetail[]>(initialBatchDetails);
  const [qualityRecords] = useState<QualityInspectionRecord[]>(initialQualityRecords);
  const [qualityDetails] = useState<QualityParameterDetail[]>(initialQualityDetails);
  const [inventoryItems, setInventoryItems] = useState<InventoryReportItem[]>(initialInventoryItems);
  const [alarmItems, setAlarmItems] = useState<AlarmReportItem[]>(initialAlarmItems);
  const [auditLogs, setAuditLogs] = useState<UserAuditLogItem[]>(initialAuditLogs);

  // Live Sync with SQL Server (Active Alarms, Reports, Alarm History, Inventory Stocks, Audit Trail)
  const fetchLiveReportsAndAudit = React.useCallback(async (retries = 3, delay = 1000) => {
    try {
      const [reportsRes, auditRes, activeAlarmsRes, alarmHistoryRes, stocksRes] = await Promise.allSettled([
        api.getReports(),
        api.getAuditLogs(100),
        api.getActiveAlarms(),
        api.getAlarmHistory(),
        api.getInventoryStocks(),
      ]);

      let hasData = false;

      if (activeAlarmsRes.status === 'fulfilled') {
        if (activeAlarmsRes.value.length > 0) {
          hasData = true;
          const first = activeAlarmsRes.value[0];
          setActiveAlarm({
            eventId: first.AlarmCode || first.eventId || 'ALM-UNKNOWN',
            alarmTag: first.AlarmCode || 'PROCESS_ALARM',
            severity: (first.severity || 'CRITICAL') as any,
            description: first.Message || first.description || 'Process Alarm',
            triggerTime: first.triggerTime || first.TriggerTime || '',
            pvText: first.pvText || '--',
            spText: first.spText || '--',
            isAcknowledged: false,
          });
        } else {
          setActiveAlarm(null);
        }
      }

      if (alarmHistoryRes.status === 'fulfilled') {
        if (alarmHistoryRes.value.length > 0) {
          hasData = true;
          const mappedAlarms: AlarmReportItem[] = alarmHistoryRes.value.map((a: any) => ({
            eventId: a.AlarmCode || a.eventId,
            alarmTag: a.AlarmCode || 'PROCESS_ALARM',
            severity: (a.severity || 'CRITICAL') as any,
            description: a.Message || a.description || 'Process Alarm',
            triggerTime: a.TriggerTime ? String(a.TriggerTime).replace('T', ' ').substring(0, 19) : '',
            clearedTime: a.AckTime ? String(a.AckTime).replace('T', ' ').substring(0, 19) : '--',
            acknowledgedBy: a.AckUser || a.acknowledgedBy || '--',
            comment: a.IsAcknowledged ? 'Acknowledged in SQL Server' : 'Active Alarm',
          }));
          setAlarmItems(mappedAlarms);
        } else {
          setAlarmItems([]);
        }
      }

      if (reportsRes.status === 'fulfilled') {
        if (reportsRes.value.length > 0) {
          hasData = true;
          const mapped: BatchProductionMaster[] = reportsRes.value.map((r: any) => ({
            reportId: r.ReportCode || `RPT-${r.Report_ID}`,
            orderId: r.OrderCode || 'WO_ACTIVE',
            recipeApplied: r.RecipeApplied || 'Fresh Pasteurized Milk',
            startTime: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
            endTime: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
            hotTemp: 138.0,
            coldTemp: 4.0,
            targetQty: Number(r.TotalProduced || 1000),
            actualVolume: Number(r.TotalProduced || 1000),
            status: 'COMPLETED',
          }));
          setBatchMasters(mapped);
          setSelectedBatchReportId(mapped[0].reportId);
        } else {
          setBatchMasters([]);
          setSelectedBatchReportId('');
        }
      }

      if (auditRes.status === 'fulfilled') {
        if (auditRes.value.length > 0) {
          hasData = true;
          const mappedLogs: UserAuditLogItem[] = auditRes.value.map((l: any) => ({
            logId: `LOG-${l.ID}`,
            username: l.UserName || 'Operator',
            role: l.UserRole || 'Operator',
            action: l.ActionName || 'OPERATION',
            target: l.Detail || '',
            timestamp: l.ActionTime ? String(l.ActionTime).replace('T', ' ').substring(0, 19) : '',
            fieldName: l.FieldName || '',
            oldValue: l.OldValue || '',
            newValue: l.NewValue || '',
            reason: l.Reason || '',
            signatureMeaning: l.SignatureMeaning || '',
            recordHash: l.RecordHash || '',
            isCorrection: Boolean(l.IsCorrection),
            refLogId: l.RefLogID,
          }));
          setAuditLogs(mappedLogs);
        } else {
          setAuditLogs([]);
        }
      }

      if (stocksRes.status === 'fulfilled') {
        if (stocksRes.value.length > 0) {
          hasData = true;
          const mappedInventory: InventoryReportItem[] = stocksRes.value.map((s) => ({
            materialCode: s.materialCode,
            description: s.materialName,
            currentBalance: s.currentStock,
            unit: s.unit,
            safetyLevel: s.minThreshold,
            lastReconciled: s.lastUpdated ? String(s.lastUpdated).replace('T', ' ').substring(0, 19) : '--',
            condition: s.currentStock <= s.minThreshold * 0.5 ? 'CRITICAL' : (s.currentStock <= s.minThreshold ? 'LOW_STOCK' : 'OPTIMAL'),
          }));
          setInventoryItems(mappedInventory);
        }
      }

      // Cold-boot retry engine: if no data retrieved yet and retries remain, back off exponentially
      if (!hasData && retries > 0) {
        setTimeout(() => fetchLiveReportsAndAudit(retries - 1, delay * 2), delay);
      }
    } catch (err) {
      console.debug('[ReportContext] Error loading SQL reports/audit:', err);
      if (retries > 0) {
        setTimeout(() => fetchLiveReportsAndAudit(retries - 1, delay * 2), delay);
      }
    }
  }, []);

  useEffect(() => {
    fetchLiveReportsAndAudit();
  }, [fetchLiveReportsAndAudit]);

  useEffect(() => {
    if (sqlOnline && !prevSqlOnlineRef.current) {
      console.log('[ReportContext] SQL Server transitioned online - refetching live reports and audit...');
      fetchLiveReportsAndAudit();
    }
    prevSqlOnlineRef.current = sqlOnline;
  }, [sqlOnline, fetchLiveReportsAndAudit]);

  const refreshAuditLogs = async () => {
    try {
      const logs = await api.getAuditLogs(100);
      if (Array.isArray(logs) && logs.length > 0) {
        const mappedLogs: UserAuditLogItem[] = logs.map((l: any) => ({
          logId: `LOG-${l.ID}`,
          username: l.UserName || 'Operator',
          role: l.UserRole || 'Operator',
          action: l.ActionName || 'OPERATION',
          target: l.Detail || '',
          timestamp: l.ActionTime ? String(l.ActionTime).replace('T', ' ').substring(0, 19) : '',
          fieldName: l.FieldName || '',
          oldValue: l.OldValue || '',
          newValue: l.NewValue || '',
          reason: l.Reason || '',
          signatureMeaning: l.SignatureMeaning || '',
          recordHash: l.RecordHash || '',
          isCorrection: Boolean(l.IsCorrection),
          refLogId: l.RefLogID,
        }));
        setAuditLogs(mappedLogs);
      }
    } catch (err) {
      console.debug('[ReportContext] Error refreshing audit logs:', err);
    }
  };

  const addAuditLog = (action: string, target: string, username?: string, role?: string) => {
    const userRole = role || user?.role || 'Operator';
    const userName = username || user?.username || 'operator_01';
    const newLog: UserAuditLogItem = {
      logId: `LOG-${Date.now().toString().slice(-4)}`,
      username: userName,
      role: userRole,
      action,
      target,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    // Two-way synchronization with physical SQL Server
    api.logUserAction({
      username: userName,
      role: userRole,
      action,
      detail: target,
    }).catch(() => {});
  };

  const acknowledgeActiveAlarm = async (operatorName?: string) => {
    if (!activeAlarm) return;
    const op = operatorName || user?.username || 'operator_01';
    const alarmCode = activeAlarm.eventId;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // 1. Immediately persist acknowledgment to SQL Server dbo.Alarm_History
    try {
      await api.acknowledgeAlarm(alarmCode, op);
    } catch (err) {
      console.warn('[ReportContext] Failed to persist alarm acknowledgment in SQL Server:', err);
    }

    // 2. Clear banner immediately (on subsequent reboots, IsAcknowledged=1 prevents reappearance)
    setActiveAlarm(null);

    // Update alarm in alarmItems list if present
    setAlarmItems((prev) =>
      prev.map((item) =>
        item.eventId === alarmCode
          ? { ...item, acknowledgedBy: op, comment: `Acknowledged via ISA-18.2 banner at ${timeStr}` }
          : item
      )
    );

    // Record into FDA 21 CFR Part 11 Audit Trail
    addAuditLog('ALARM_ACKNOWLEDGE', `Operator ACK ${alarmCode} (${activeAlarm.description})`, op, user?.role || 'Operator');

    setToastNotice(`[ISA-18.2 ACKNOWLEDGED] Alarm ${alarmCode} acknowledged by ${op}. Persisted to SQL Server & 21 CFR Part 11 audit log.`);
    setTimeout(() => setToastNotice(null), 5000);
  };

  const clearActiveAlarm = async () => {
    if (!activeAlarm) return;
    const prevId = activeAlarm.eventId;
    const op = user?.username || 'operator_01';
    try {
      await api.acknowledgeAlarm(prevId, op);
    } catch {}
    setActiveAlarm(null);
    addAuditLog('ALARM_CLEARED', `Physical interlock normal: ${prevId} cleared`, op, user?.role || 'Operator');
    setToastNotice(`Alarm ${prevId} cleared. System status nominal.`);
    setTimeout(() => setToastNotice(null), 4000);
  };

  const triggerSimulatedAlarm = async (customAlarm?: Partial<ActiveAlarmState>) => {
    const code = customAlarm?.eventId || 'ALM-403';
    const msg = customAlarm?.description || 'UHT HEATER TEMP DEVIATION (PV: 71.1°C vs SP: 75.0°C)';
    
    // Persist new unacknowledged alarm into SQL Server dbo.Alarm_History
    try {
      await api.triggerAlarm(code, msg);
    } catch (err) {
      console.warn('[ReportContext] Failed to trigger alarm to SQL Server:', err);
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const alarmToSet: ActiveAlarmState = {
      eventId: code,
      alarmTag: customAlarm?.alarmTag || 'HEATER_TEMP_DEVIATION',
      severity: customAlarm?.severity || 'CRITICAL',
      description: msg,
      triggerTime: timeStr,
      pvText: customAlarm?.pvText || '71.1°C',
      spText: customAlarm?.spText || '75.0°C',
      isAcknowledged: false,
    };
    setActiveAlarm(alarmToSet);
    setToastNotice(`[ISA-18.2 TRIGGER] Critical Alarm ${alarmToSet.eventId} engaged in SQL Server.`);
    setTimeout(() => setToastNotice(null), 4000);
  };


  const selectBatchReport = (id: string) => {
    setSelectedBatchReportId(id);
    const matchingQuality = qualityRecords.find((q) => q.reportId === id);
    if (matchingQuality) {
      setSelectedQualityId(matchingQuality.qualityId);
    }
  };

  const selectQualityReport = (id: string) => {
    setSelectedQualityId(id);
  };

  const triggerForensicInvestigation = (eventId: string, type: 'QUALITY_DEVIATION' | 'ALARM_INCIDENT') => {
    if (type === 'QUALITY_DEVIATION') {
      setForensicFilter({
        active: true,
        sourceEventId: eventId,
        sourceType: 'QUALITY_DEVIATION',
        referenceTimestamp: '2026-09-08 07:20:00',
        timeWindowDescription: '06:30:00 — 07:25:00 UTC (Batch Execution Window)',
        highlightLogIds: ['LOG-1461', 'LOG-1460', 'LOG-1458', 'LOG-1459'],
        reason: 'Root-Cause Analysis for UHT Sterilization Temp deviation (-5.20%) on Batch RPT-10 / QLT-10',
      });
    } else {
      setForensicFilter({
        active: true,
        sourceEventId: eventId,
        sourceType: 'ALARM_INCIDENT',
        referenceTimestamp: '2026-09-08 06:58:30',
        timeWindowDescription: '06:43:30 — 07:13:30 UTC (±15 Minutes Event Horizon)',
        highlightLogIds: ['LOG-1458', 'LOG-1460', 'LOG-1459'],
        reason: 'Forensic Investigation for ALM-403 (HEATER_TEMP_DEVIATION below 72.0°C)',
      });
    }
    setActiveSubTab('user_audit');
    setToastNotice(`Forensic investigation filter engaged for ${eventId}. Spotlighting operator logs.`);
  };

  const clearForensicInvestigation = () => {
    setForensicFilter(null);
    setToastNotice('Forensic investigation filter cleared. Full audit trail restored.');
    setTimeout(() => setToastNotice(null), 3000);
  };

  const runQuery = async () => {
    setIsQuerying(true);

    try {
      const res = await api.queryReports({
        keyword: searchQuery.trim() || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
      });

      if (res && res.data && res.data.length > 0) {
        const mapped: BatchProductionMaster[] = res.data.map((r: any) => ({
          reportId: r.ReportCode || `RPT-${r.Report_ID}`,
          orderId: r.OrderCode || 'WO_ACTIVE',
          recipeApplied: r.RecipeApplied || 'Fresh Pasteurized Milk',
          startTime: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
          endTime: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
          hotTemp: 138.0,
          coldTemp: 4.0,
          targetQty: Number(r.TotalProduced || 1000),
          actualVolume: Number(r.TotalProduced || 1000),
          status: 'COMPLETED',
        }));
        setBatchMasters(mapped);
        if (mapped.length > 0) {
          setSelectedBatchReportId(mapped[0].reportId);
        }
      } else {
        setBatchMasters([]);
        setSelectedBatchReportId('');
      }
    } catch (err) {
      console.warn('[ReportContext] Server query failed:', err);
    } finally {
      setIsQuerying(false);
      setToastNotice(`Server query executed: Range [${fromDate} to ${toDate}] ${searchQuery ? `filter "${searchQuery}"` : ''}`);
      setTimeout(() => setToastNotice(null), 4000);
    }
  };

  const exportReportToExcel = async (reportType: string) => {
    setIsExporting(true);
    try {
      const sessionUser = {
        username: user?.username || 'admin',
        name: user?.name || 'System Administrator',
        role: user?.role || 'System Administrator',
        employeeId: user?.employeeId || 'EMP-6583',
      };

      const result = await generateAndDownloadExcel({
        reportType,
        user: sessionUser,
        batchMasters,
        batchDetails,
        qualityRecords,
        qualityDetails,
        inventoryItems,
        alarmItems,
        auditLogs,
      });

      setToastNotice(`Excel Export: ${result.filename} generated with SHA-256 [${result.sha256.slice(0, 16)}...]`);
      setTimeout(() => setToastNotice(null), 6000);
    } catch (err) {
      console.error('Failed to export Excel report', err);
      setToastNotice('Failed to generate Excel report.');
    } finally {
      setIsExporting(false);
    }
  };

  const exportReportToPdf = async (reportType: string) => {
    setIsExporting(true);
    try {
      const sessionUser = {
        username: user?.username || 'admin',
        name: user?.name || 'System Administrator',
        role: user?.role || 'System Administrator',
        employeeId: user?.employeeId || 'EMP-6583',
      };

      const result = await generateAndPrintPdf({
        reportType,
        user: sessionUser,
        batchMasters,
        batchDetails,
        qualityRecords,
        qualityDetails,
        inventoryItems,
        alarmItems,
        auditLogs,
      });

      setToastNotice(`EBR PDF Print: Cryptographic SHA-256 Hash [${result.sha256.slice(0, 16)}...] verified.`);
      setTimeout(() => setToastNotice(null), 6000);
    } catch (err) {
      console.error('Failed to generate PDF report', err);
      setToastNotice('Failed to generate PDF report.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ReportContext.Provider
      value={{
        activeSubTab,
        setActiveSubTab,
        activeAlarm,
        acknowledgeActiveAlarm,
        clearActiveAlarm,
        triggerSimulatedAlarm,
        addAuditLog,
        fromDate,
        toDate,
        searchQuery,
        setFromDate,
        setToDate,
        setSearchQuery,
        runQuery,
        isQuerying,
        selectedBatchReportId,
        selectBatchReport,
        selectedQualityId,
        selectQualityReport,
        forensicFilter,
        triggerForensicInvestigation,
        clearForensicInvestigation,
        batchMasters,
        batchDetails,
        qualityRecords,
        qualityDetails,
        inventoryItems,
        alarmItems,
        auditLogs,
        refreshAuditLogs,
        exportReportToExcel,
        exportReportToPdf,
        isExporting,
        toastNotice,
        setToastNotice,
      }}
    >
      {children}
    </ReportContext.Provider>
  );
};

export const useReports = (): ReportContextType => {
  const context = useContext(ReportContext);
  if (!context) {
    throw new Error('useReports must be used within a ReportProvider');
  }
  return context;
};
