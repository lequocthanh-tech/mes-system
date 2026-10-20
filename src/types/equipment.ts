/* Hallmark · component: equipmentTypes · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

export type EquipmentType = 
  | 'Centrifugal Pump' 
  | 'Mixing Motor'
  | 'Heat Exchanger'
  | 'Valve'
  | 'Chiller'
  | 'Dosing Pump' 
  | 'Mixing Agitator' 
  | 'Heating Resistor' 
  | 'Chilling Unit' 
  | 'Solenoid Valve' 
  | 'RTD Sensor'
  | 'Pump'
  | 'Motor'
  | 'Heater';

export type EquipmentLocation = 
  | 'Line 1 - Mixing Unit' 
  | 'Line 2 - Sterilize Unit' 
  | 'Utility Area'
  | string;

export type OperatingStatus = 'RUNNING' | 'STOPPED' | 'FAULT' | 'MAINTENANCE';

export type ServiceActionType = 
  | 'Periodic Inspection' 
  | 'Lubrication' 
  | 'Seal Replacement' 
  | 'Overhaul' 
  | 'Calibration';

export interface Equipment {
  id: string; // EquipmentCode or ID string (e.g. 'PUMP_INLET')
  equipmentId?: number; // Integer PK in Equipment_Master
  name: string;
  type: EquipmentType;
  location: EquipmentLocation;
  plcTag: string; // OPC UA Node ID / CM Binding
  opcNodeId?: string;
  status: OperatingStatus;
  runtimeHours: number;
  maintenanceLimit: number;
  maintenanceCount?: number;
  totalStarts?: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;
  healthRatio?: number;
  usagePercent?: number;
  notes: string;
  lastStateUpdate: string;
  isInterlocked?: boolean;
  // Performance & Sensor telemetry fields (ISO 10816 / ISA-95)
  ratedCurrent?: number;
  rated_current?: number;
  maxVibrationThreshold?: number;
  max_vibration?: number;
  maxTempThreshold?: number;
  max_temp?: number;
  actualCurrent?: number;
  actual_current?: number;
  loadPercent?: number;
  load_percent?: number;
  vibrationRms?: number;
  vibration_rms?: number;
  vibrationSeverity?: 'GOOD' | 'WARNING' | 'CRITICAL' | 'UNMAPPED';
  temperature?: number;
  healthIndex?: number;
  health_index?: number;
  rulHours?: number;
  rul_hours?: number;
  is_valve?: boolean;
  is_mapped?: boolean;
  valve_state?: string;
}

export interface EquipmentPerformanceItem {
  equipment_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_type: string;
  location: string;
  current_status: string;
  status: string;
  actual_current: number;
  rated_current: number;
  load_percent: number;
  vibration_rms: number;
  vibration_severity: 'GOOD' | 'WARNING' | 'CRITICAL' | 'UNMAPPED';
  temperature: number;
  max_temp: number;
  runtime_hours: number;
  maintenance_limit: number;
  rul_hours: number;
  health_index: number;
  is_interlocked: boolean;
  is_valve?: boolean;
  is_mapped?: boolean;
  valve_state?: string;
  notes?: string;
  last_update?: string;
}

export interface SensorMappingItem {
  tag_key: string;
  prop_key?: string;
  role?: string;
  role_description?: string;
  opc_node_id: string;
  unit?: string;
  data_type?: string;
  live_pv?: any;
  quality?: 'Good' | 'Bad' | 'Unmapped';
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  equipmentIntId?: number;
  equipmentName: string;
  technician: string;
  serviceAction: ServiceActionType;
  ticketType?: string;
  sparePartsUsed?: string;
  actionTaken?: string;
  servicedAt: string;
  resetRuntime: boolean;
  remarks: string;
  costVnd?: number;
  status?: string;
}

export interface StateTransitionEvent {
  id: string;
  equipmentId: string;
  equipmentName: string;
  previousState: OperatingStatus;
  newState: OperatingStatus;
  triggerSource: string;
  durationSeconds?: number;
  timestamp: string;
}

