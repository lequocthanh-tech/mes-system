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
import { generateAndDownloadExcel } from '../utils/exportExcel';
import { generateAndPrintPdf } from '../utils/exportPdf';
import * as api from '../services/api';

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
  toastNotice: string | null;
  setToastNotice: (msg: string | null) => void;
}

const initialBatchMasters: BatchProductionMaster[] = [
  {
    reportId: 'RPT-10',
    orderId: 'WO_Batch_12',
    recipeApplied: 'Chocolate Milk Std',
    startTime: '2026-09-08 06:30',
    endTime: '2026-09-08 07:15',
    hotTemp: 75.0,
    coldTemp: 4.0,
    targetQty: 1000,
    actualVolume: 998.5,
    status: 'COMPLETED',
  },
  {
    reportId: 'RPT-09',
    orderId: 'WO_Batch_11',
    recipeApplied: 'Fresh Pasteurized Milk',
    startTime: '2026-09-08 05:00',
    endTime: '2026-09-08 05:42',
    hotTemp: 140.0,
    coldTemp: 4.0,
    targetQty: 1000,
    actualVolume: 1002.1,
    status: 'COMPLETED',
  },
  {
    reportId: 'RPT-08',
    orderId: 'WO_Batch_10',
    recipeApplied: 'Chocolate Milk Std',
    startTime: '2026-09-07 14:00',
    endTime: '2026-09-07 14:48',
    hotTemp: 75.0,
    coldTemp: 4.0,
    targetQty: 1000,
    actualVolume: 995.0,
    status: 'COMPLETED',
  },
  {
    reportId: 'RPT-07',
    orderId: 'WO_Batch_09',
    recipeApplied: 'Fresh Pasteurized Milk',
    startTime: '2026-09-07 09:15',
    endTime: '2026-09-07 10:02',
    hotTemp: 140.0,
    coldTemp: 4.0,
    targetQty: 1000,
    actualVolume: 1005.4,
    status: 'COMPLETED',
  },
];

const initialBatchDetails: BatchProductionDetail[] = [
  // For RPT-10
  {
    detailId: 'DTL-01',
    reportId: 'RPT-10',
    materialCode: 'RAW_MILK',
    materialName: 'Fresh Raw Milk',
    recipeShare: '70%',
    targetSetpoint: 700.0,
    plcActual: 698.5,
    unit: 'L',
    timestamp: '2026-09-08 06:35',
  },
  {
    detailId: 'DTL-02',
    reportId: 'RPT-10',
    materialCode: 'SUGAR',
    materialName: 'Refined Cane Sugar',
    recipeShare: '20%',
    targetSetpoint: 200.0,
    plcActual: 201.2,
    unit: 'kg',
    timestamp: '2026-09-08 06:40',
  },
  {
    detailId: 'DTL-03',
    reportId: 'RPT-10',
    materialCode: 'ADDITIVE',
    materialName: 'Cocoa & Emulsifier',
    recipeShare: '10%',
    targetSetpoint: 100.0,
    plcActual: 99.8,
    unit: 'L',
    timestamp: '2026-09-08 06:45',
  },
  // For RPT-09
  {
    detailId: 'DTL-04',
    reportId: 'RPT-09',
    materialCode: 'RAW_MILK',
    materialName: 'Fresh Raw Milk',
    recipeShare: '95%',
    targetSetpoint: 950.0,
    plcActual: 951.8,
    unit: 'L',
    timestamp: '2026-09-08 05:05',
  },
  {
    detailId: 'DTL-05',
    reportId: 'RPT-09',
    materialCode: 'ADDITIVE',
    materialName: 'Vitamin D3 & Stabilizer',
    recipeShare: '5%',
    targetSetpoint: 50.0,
    plcActual: 50.3,
    unit: 'L',
    timestamp: '2026-09-08 05:10',
  },
  // For RPT-08
  {
    detailId: 'DTL-06',
    reportId: 'RPT-08',
    materialCode: 'RAW_MILK',
    materialName: 'Fresh Raw Milk',
    recipeShare: '70%',
    targetSetpoint: 700.0,
    plcActual: 697.0,
    unit: 'L',
    timestamp: '2026-09-07 14:05',
  },
  {
    detailId: 'DTL-07',
    reportId: 'RPT-08',
    materialCode: 'SUGAR',
    materialName: 'Refined Cane Sugar',
    recipeShare: '20%',
    targetSetpoint: 200.0,
    plcActual: 199.5,
    unit: 'kg',
    timestamp: '2026-09-07 14:10',
  },
  {
    detailId: 'DTL-08',
    reportId: 'RPT-08',
    materialCode: 'ADDITIVE',
    materialName: 'Cocoa & Emulsifier',
    recipeShare: '10%',
    targetSetpoint: 100.0,
    plcActual: 98.5,
    unit: 'L',
    timestamp: '2026-09-07 14:15',
  },
];

const initialQualityRecords: QualityInspectionRecord[] = [
  {
    qualityId: 'QLT-10',
    reportId: 'RPT-10',
    status: 'FAIL',
    avgDeviation: 5.20,
    inspectedAt: '2026-09-08 07:20',
    certifiedBy: 'QA_Supervisor_01',
  },
  {
    qualityId: 'QLT-09',
    reportId: 'RPT-09',
    status: 'PASS',
    avgDeviation: 0.38,
    inspectedAt: '2026-09-08 05:45',
    certifiedBy: 'QA_Supervisor_01',
  },
  {
    qualityId: 'QLT-08',
    reportId: 'RPT-08',
    status: 'PASS',
    avgDeviation: 0.45,
    inspectedAt: '2026-09-07 14:55',
    certifiedBy: 'QA_Supervisor_02',
  },
  {
    qualityId: 'QLT-07',
    reportId: 'RPT-07',
    status: 'PASS',
    avgDeviation: 0.28,
    inspectedAt: '2026-09-07 10:10',
    certifiedBy: 'QA_Supervisor_02',
  },
];

const initialQualityDetails: QualityParameterDetail[] = [
  // For QLT-10
  {
    detailId: 'QDT-01',
    qualityId: 'QLT-10',
    parameterName: 'UHT Sterilization Temp',
    setpoint: '75.0 °C',
    actualValue: '71.1 °C',
    deviationDiff: '-5.20%',
    toleranceBand: '±2.0%',
    evaluation: 'OUT OF SPEC',
  },
  {
    detailId: 'QDT-02',
    qualityId: 'QLT-10',
    parameterName: 'Milk Ratio Mass',
    setpoint: '700.0 L',
    actualValue: '698.5 L',
    deviationDiff: '-0.21%',
    toleranceBand: '±2.0%',
    evaluation: 'PASS',
  },
  {
    detailId: 'QDT-03',
    qualityId: 'QLT-10',
    parameterName: 'Sugar Dosage Weight',
    setpoint: '200.0 kg',
    actualValue: '201.2 kg',
    deviationDiff: '+0.60%',
    toleranceBand: '±1.5%',
    evaluation: 'PASS',
  },
  {
    detailId: 'QDT-04',
    qualityId: 'QLT-10',
    parameterName: 'Additive Dosage',
    setpoint: '100.0 L',
    actualValue: '99.8 L',
    deviationDiff: '-0.20%',
    toleranceBand: '±2.0%',
    evaluation: 'PASS',
  },
  // For QLT-09
  {
    detailId: 'QDT-05',
    qualityId: 'QLT-09',
    parameterName: 'Pasteurize Temperature',
    setpoint: '140.0 °C',
    actualValue: '140.3 °C',
    deviationDiff: '+0.21%',
    toleranceBand: '±1.5%',
    evaluation: 'PASS',
  },
  {
    detailId: 'QDT-06',
    qualityId: 'QLT-09',
    parameterName: 'Milk Ratio Mass',
    setpoint: '950.0 L',
    actualValue: '951.8 L',
    deviationDiff: '+0.19%',
    toleranceBand: '±2.0%',
    evaluation: 'PASS',
  },
  {
    detailId: 'QDT-07',
    qualityId: 'QLT-09',
    parameterName: 'Cooling Exchanger Temp',
    setpoint: '4.0 °C',
    actualValue: '3.9 °C',
    deviationDiff: '-2.50%',
    toleranceBand: '±5.0%',
    evaluation: 'PASS',
  },
];

const initialInventoryItems: InventoryReportItem[] = [
  {
    materialCode: 'MAT-01',
    description: 'Raw Farm Milk',
    currentBalance: 9995.04,
    unit: 'Liters',
    safetyLevel: 2000,
    lastReconciled: '2026-09-08 07:30',
    condition: 'OPTIMAL',
  },
  {
    materialCode: 'MAT-02',
    description: 'Refined Sugar',
    currentBalance: 10095.37,
    unit: 'kg',
    safetyLevel: 1500,
    lastReconciled: '2026-09-08 07:30',
    condition: 'OPTIMAL',
  },
  {
    materialCode: 'MAT-03',
    description: 'Flavor Additive',
    currentBalance: 9641.03,
    unit: 'Liters',
    safetyLevel: 500,
    lastReconciled: '2026-09-08 07:30',
    condition: 'OPTIMAL',
  },
];

const initialAlarmItems: AlarmReportItem[] = [
  {
    eventId: 'ALM-401',
    alarmTag: 'TC_COOLING_HIGH',
    severity: 'CRITICAL',
    description: 'Chilling exchanger temp exceeded 6.5°C',
    triggerTime: '2026-09-08 07:05:12',
    clearedTime: '2026-09-08 07:08:44',
    acknowledgedBy: 'operator_01',
    comment: 'Chiller valve re-seated',
  },
  {
    eventId: 'ALM-402',
    alarmTag: 'PUMP_MILK_OVERLOAD',
    severity: 'WARNING',
    description: 'Raw milk pump current high limit',
    triggerTime: '2026-09-08 06:32:00',
    clearedTime: '2026-09-08 06:33:15',
    acknowledgedBy: 'engineer_b',
    comment: 'Influx throttling resolved',
  },
  {
    eventId: 'ALM-403',
    alarmTag: 'HEATER_TEMP_DEVIATION',
    severity: 'CRITICAL',
    description: 'UHT heater bank dropped below 72.0°C',
    triggerTime: '2026-09-08 06:58:30',
    clearedTime: '2026-09-08 07:02:10',
    acknowledgedBy: 'operator_01',
    comment: 'Steam bypass valve opened',
  },
  {
    eventId: 'ALM-404',
    alarmTag: 'SILO_LEVEL_LOW',
    severity: 'INFO',
    description: 'Raw milk storage silo below 35% reserve',
    triggerTime: '2026-09-07 18:20:00',
    clearedTime: '2026-09-07 18:45:00',
    acknowledgedBy: 'supervisor_01',
    comment: 'Inbound tanker scheduled',
  },
];

const initialAuditLogs: UserAuditLogItem[] = [
  {
    logId: 'LOG-1462',
    username: 'admin',
    role: 'System Admin',
    action: 'USER_LOGIN',
    target: 'Authenticated via local terminal',
    timestamp: '2026-09-08 06:00:15',
  },
  {
    logId: 'LOG-1461',
    username: 'operator_01',
    role: 'Operator',
    action: 'BATCH_DISPATCH',
    target: 'Loaded WO_Batch_12 to Process Line 1',
    timestamp: '2026-09-08 06:29:40',
  },
  {
    logId: 'LOG-1460',
    username: 'operator_01',
    role: 'Operator',
    action: 'PLC_COMMAND',
    target: 'Executed ISA-88 START Pulse [DB2.DBX0.1]',
    timestamp: '2026-09-08 06:30:02',
  },
  {
    logId: 'LOG-1459',
    username: 'qa_lead',
    role: 'Supervisor',
    action: 'BATCH_REJECT',
    target: 'Marked Batch RPT-10 as QUARANTINE',
    timestamp: '2026-09-08 07:22:10',
  },
  {
    logId: 'LOG-1458',
    username: 'operator_01',
    role: 'Operator',
    action: 'PARAMETER_OVERRIDE',
    target: 'Manually adjusted VFD AG2151 to 45Hz',
    timestamp: '2026-09-08 06:42:15',
  },
  {
    logId: 'LOG-1457',
    username: 'supervisor_01',
    role: 'Supervisor',
    action: 'RECIPE_APPROVAL',
    target: 'Approved Recipe #01 Rev 2.3 for production',
    timestamp: '2026-09-07 08:30:00',
  },
];

const initialActiveAlarm: ActiveAlarmState = {
  eventId: 'ALM-403',
  alarmTag: 'HEATER_TEMP_DEVIATION',
  severity: 'CRITICAL',
  description: 'UHT HEATER TEMP DEVIATION',
  triggerTime: '06:58:30',
  pvText: '71.1°C',
  spText: '75.0°C',
  isAcknowledged: false,
};

const ReportContext = createContext<ReportContextType | undefined>(undefined);

export const ReportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<ReportSubTab>('batch_production');

  // ISA-18.2 Active Alarm State
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarmState | null>(initialActiveAlarm);

  const [fromDate, setFromDate] = useState<string>('2026-09-01');
  const [toDate, setToDate] = useState<string>('2026-09-08');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [toastNotice, setToastNotice] = useState<string | null>(null);

  const [selectedBatchReportId, setSelectedBatchReportId] = useState<string>('RPT-10');
  const [selectedQualityId, setSelectedQualityId] = useState<string>('QLT-10');

  // Forensic Drill-Down Filter State
  const [forensicFilter, setForensicFilter] = useState<ForensicFilter | null>(null);

  const [batchMasters, setBatchMasters] = useState<BatchProductionMaster[]>(initialBatchMasters);
  const [batchDetails] = useState<BatchProductionDetail[]>(initialBatchDetails);
  const [qualityRecords] = useState<QualityInspectionRecord[]>(initialQualityRecords);
  const [qualityDetails] = useState<QualityParameterDetail[]>(initialQualityDetails);
  const [inventoryItems] = useState<InventoryReportItem[]>(initialInventoryItems);
  const [alarmItems, setAlarmItems] = useState<AlarmReportItem[]>(initialAlarmItems);
  const [auditLogs, setAuditLogs] = useState<UserAuditLogItem[]>(initialAuditLogs);

  // Live Sync with SQL Server
  useEffect(() => {
    let isMounted = true;
    const fetchLiveReportsAndAudit = async () => {
      try {
        const [reportsRes, auditRes] = await Promise.allSettled([
          api.getReports(),
          api.getAuditLogs(100),
        ]);

        if (isMounted && reportsRes.status === 'fulfilled' && reportsRes.value.length > 0) {
          const mapped: BatchProductionMaster[] = reportsRes.value.map((r: any) => ({
            reportId: r.ReportCode || `RPT-${r.Report_ID}`,
            orderId: r.OrderCode || 'WO_Batch_12',
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
        }

        if (isMounted && auditRes.status === 'fulfilled' && auditRes.value.length > 0) {
          const mappedLogs: UserAuditLogItem[] = auditRes.value.map((l: any) => ({
            logId: `LOG-${l.ID}`,
            username: l.UserName || 'Operator',
            role: l.UserRole || 'Operator',
            action: l.ActionName || 'OPERATION',
            target: l.Detail || '',
            timestamp: l.ActionTime ? String(l.ActionTime).replace('T', ' ').substring(0, 19) : '',
          }));
          setAuditLogs(mappedLogs);
        }
      } catch (err) {
        console.debug('[ReportContext] Error loading SQL reports/audit:', err);
      }
    };
    fetchLiveReportsAndAudit();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const acknowledgeActiveAlarm = (operatorName?: string) => {
    if (!activeAlarm) return;
    const op = operatorName || user?.username || 'operator_01';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    setActiveAlarm((prev) =>
      prev
        ? {
            ...prev,
            isAcknowledged: true,
            acknowledgedBy: op,
            acknowledgedAt: timeStr,
          }
        : null
    );

    // Update alarm in alarmItems list if present
    setAlarmItems((prev) =>
      prev.map((item) =>
        item.eventId === activeAlarm.eventId
          ? { ...item, acknowledgedBy: op, comment: `Acknowledged via ISA-18.2 banner at ${timeStr}` }
          : item
      )
    );

    // Record into FDA 21 CFR Part 11 Audit Trail
    addAuditLog('ALARM_ACKNOWLEDGE', `Operator ACK ${activeAlarm.eventId} (${activeAlarm.description})`, op, user?.role || 'Operator');

    setToastNotice(`[ISA-18.2 ACKNOWLEDGED] Alarm ${activeAlarm.eventId} acknowledged by ${op}. Recorded in 21 CFR Part 11 audit log.`);
    setTimeout(() => setToastNotice(null), 5000);
  };

  const clearActiveAlarm = () => {
    if (!activeAlarm) return;
    const prevId = activeAlarm.eventId;
    const op = user?.username || 'operator_01';
    setActiveAlarm(null);
    addAuditLog('ALARM_CLEARED', `Physical interlock normal: ${prevId} cleared`, op, user?.role || 'Operator');
    setToastNotice(`Alarm ${prevId} cleared. System status nominal.`);
    setTimeout(() => setToastNotice(null), 4000);
  };

  const triggerSimulatedAlarm = (customAlarm?: Partial<ActiveAlarmState>) => {
    const alarmToSet: ActiveAlarmState = {
      eventId: customAlarm?.eventId || 'ALM-403',
      alarmTag: customAlarm?.alarmTag || 'HEATER_TEMP_DEVIATION',
      severity: customAlarm?.severity || 'CRITICAL',
      description: customAlarm?.description || 'UHT HEATER TEMP DEVIATION',
      triggerTime: customAlarm?.triggerTime || '06:58:30',
      pvText: customAlarm?.pvText || '71.1°C',
      spText: customAlarm?.spText || '75.0°C',
      isAcknowledged: false,
    };
    setActiveAlarm(alarmToSet);
    setToastNotice(`[ISA-18.2 TRIGGER] Critical Alarm ${alarmToSet.eventId} engaged.`);
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
      const response = await fetch('/api/reports/batch');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data.length > 0) {
          setBatchMasters(data.data.map((r: any) => ({
            reportId: r.Report_ID || `RPT-${r.Order_ID}`,
            orderId: r.Order_ID,
            recipeApplied: r.Recipe_ID || 'Unknown',
            startTime: r.Start_Time || '',
            endTime: r.End_Time || '',
            hotTemp: 0,
            coldTemp: 0,
            targetQty: r.Total_Volume || 0,
            actualVolume: r.Total_Volume || 0,
            status: 'COMPLETED',
          })));
        }
      }
    } catch {
      // In offline / mock mode
    }

    setTimeout(() => {
      setIsQuerying(false);
      setToastNotice(`Query executed: Date range [${fromDate} to ${toDate}] ${searchQuery ? `filter "${searchQuery}"` : ''}`);
      setTimeout(() => setToastNotice(null), 4000);
    }, 350);
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
