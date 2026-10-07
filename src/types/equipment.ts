/* Hallmark · component: equipmentTypes · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

export type EquipmentType = 
  | 'Centrifugal Pump' 
  | 'Dosing Pump' 
  | 'Mixing Agitator' 
  | 'Heating Resistor' 
  | 'Chilling Unit' 
  | 'Solenoid Valve' 
  | 'RTD Sensor';

export type EquipmentLocation = 
  | 'Line 1 - Mixing Unit' 
  | 'Line 2 - Sterilize Unit' 
  | 'Utility Area';

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
}

export interface MaintenanceLog {
  id: string;
  equipmentId: string;
  equipmentIntId?: number;
  equipmentName: string;
  technician: string;
  serviceAction: ServiceActionType;
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

