export interface BatchProductionMaster {
  reportId: string;
  orderId: string;
  recipeApplied: string;
  startTime: string;
  endTime: string;
  hotTemp: number;
  coldTemp: number;
  targetQty: number;
  actualVolume: number;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'QUARANTINE' | 'ABORTED';
}

export interface BatchProductionDetail {
  detailId: string;
  reportId: string;
  materialCode: string;
  materialName: string;
  recipeShare: string;
  targetSetpoint: number;
  plcActual: number;
  unit: string;
  timestamp: string;
}

export interface QualityInspectionRecord {
  qualityId: string;
  reportId: string;
  status: 'PASS' | 'FAIL';
  avgDeviation: number;
  inspectedAt: string;
  certifiedBy: string;
}

export interface QualityParameterDetail {
  detailId: string;
  qualityId: string;
  parameterName: string;
  setpoint: string;
  actualValue: string;
  deviationDiff: string;
  toleranceBand: string;
  evaluation: 'PASS' | 'OUT OF SPEC';
}

export interface InventoryReportItem {
  materialCode: string;
  description: string;
  currentBalance: number;
  unit: string;
  safetyLevel: number;
  lastReconciled: string;
  condition: 'OPTIMAL' | 'LOW_STOCK' | 'CRITICAL';
}

export interface AlarmReportItem {
  eventId: string;
  alarmTag: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  triggerTime: string;
  clearedTime: string;
  acknowledgedBy: string;
  comment: string;
}

export interface UserAuditLogItem {
  logId: string;
  username: string;
  role: string;
  action: string;
  target: string;
  timestamp: string;
}

export type ReportSubTab = 
  | 'batch_production' 
  | 'quality_inspection' 
  | 'material_consumption' 
  | 'alarm_incident' 
  | 'user_audit';

export interface ForensicFilter {
  active: boolean;
  sourceEventId: string;
  sourceType: 'QUALITY_DEVIATION' | 'ALARM_INCIDENT';
  referenceTimestamp: string;
  timeWindowDescription: string;
  highlightLogIds: string[];
  reason: string;
}

export interface ActiveAlarmState {
  eventId: string;
  alarmTag: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  triggerTime: string;
  pvText: string;
  spText: string;
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

