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
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  reason?: string;
  signatureMeaning?: string;
  recordHash?: string;
  isCorrection?: boolean;
  refLogId?: number;
}

export type ReportSubTab = 
  | 'batch_production' 
  | 'quality_inspection' 
  | 'material_consumption' 
  | 'alarm_incident' 
  | 'user_audit'
  | 'traceability';

export interface InboundLotDetail {
  input_id: number;
  material_code: string;
  material_name?: string;
  quantity: number;
  input_time: string;
  lot_number: string;
  supplier: string;
  raw_remark?: string;
}

export interface TraceabilityIngredient {
  material_code: string;
  material_name: string;
  percentage: number;
  target_value: number;
  actual_value: number;
  deviation_percent: number;
  unit: string;
  inbound_lots: InboundLotDetail[];
}

export interface BackwardTraceabilityData {
  status: string;
  order_code: string;
  batch_info: {
    order_code: string;
    report_code: string;
    recipe_applied: string;
    total_produced: number;
    quality_status: string;
    disposition: string;
    sign_off_by: string;
    created_time: string;
    status: string;
  };
  customer: {
    customer_code: string;
    customer_name: string;
    email: string;
    phone: string;
    address: string;
  };
  ingredients: TraceabilityIngredient[];
}

export interface AffectedBatchRecord {
  order_code: string;
  report_code: string;
  recipe_id: number;
  recipe_applied: string;
  production_date: string;
  volume_liters: number;
  quality_status: string;
  disposition: string;
  status: string;
  customer_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

export interface ForwardTraceabilityData {
  status: string;
  material_code: string;
  matched_inbound_lots: InboundLotDetail[];
  affected_batches: AffectedBatchRecord[];
  summary: {
    total_batches_affected: number;
    total_volume_liters: number;
    total_customers_impacted: number;
  };
}

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

