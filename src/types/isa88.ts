export type TagDataType = 'Boolean' | 'Real' | 'Int' | 'DInt' | 'Word' | 'String' | 'Float';
export type TagAccessType = 'Read' | 'Read/Write';
export type TargetPlcOption = 'Kepware Central Gateway (Port 49320)' | 'PLC 1 (192.168.0.1)' | 'PLC 2 (192.168.0.23)' | string;

export interface TagMappingDefinition {
  node_id: string;
  role: string;
  unit: string;
  writable: boolean;
  description: string;
}

export interface TagItem {
  tagId: number;
  tagName: string;
  dataType: TagDataType;
  address: string; // Kepware OPC UA Node ID (e.g. ns=2;s=Simulation Examples.Functions.Ramp2)
  targetPlc?: TargetPlcOption;
  gatewaySource?: string;
  accessType: TagAccessType;
  description: string;
  parentUp: string;
  parentOp: string;
  parentPh: string;
  role?: string;
  unit?: string;
  writable?: boolean;
  liveValue?: any;
  liveQuality?: string;
}

export interface PhaseNode {
  id: string;
  name: string;
  code: string;
  description: string;
  tags: TagItem[];
  status?: 'IDLE' | 'RUNNING' | 'COMPLETE' | 'STOPPED';
}

export interface OperationNode {
  id: string;
  name: string;
  description: string;
  phases: PhaseNode[];
}

export interface UnitProcedureNode {
  id: string;
  name: string;
  unit: string;
  description: string;
  operations: OperationNode[];
}

// Physical Model Hierarchy
export interface ControlModuleNode {
  id: string;
  name: string;
  equipment: string;
  equipmentType: string;
  ioAddress: string; // Kepware OPC UA Node ID
  targetPlc: TargetPlcOption;
  status: 'IDLE' | 'ACTIVE' | 'STANDBY';
  description: string;
  boundTagName?: string;
  role?: string;
  unit?: string;
  liveValue?: any;
  liveQuality?: string;
}

export interface EquipmentModuleNode {
  id: string;
  name: string;
  description: string;
  controlModules: ControlModuleNode[];
}

export interface UnitNode {
  id: string;
  name: string;
  area: string;
  description: string;
  targetPlc: TargetPlcOption;
  equipmentModules: EquipmentModuleNode[];
}

// Inspector unified presentation model
export interface InspectorNodeData {
  tagId?: number | string;
  tagName: string;
  nodeType: 'TAG' | 'PHASE' | 'OPERATION' | 'UNIT_PROCEDURE' | 'CONTROL_MODULE' | 'EQUIPMENT_MODULE' | 'UNIT';
  dataType?: TagDataType | string;
  address: string; // Kepware OPC UA Node ID
  opcNodeId?: string;
  gatewaySource?: string;
  targetPlc?: TargetPlcOption;
  accessType?: TagAccessType;
  description: string;
  parentContext: string;
  equipmentRef?: string;
  lastUpdated?: string;
  role?: string;
  unit?: string;
  writable?: boolean;
  liveValue?: any;
  liveQuality?: string;
}
