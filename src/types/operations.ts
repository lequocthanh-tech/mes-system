/* Hallmark · component: OperationsTypes · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

export type BatchCommandType = 
  | 'DOWNLOAD' 
  | 'START' 
  | 'HOLD' 
  | 'RESUME' 
  | 'STOP' 
  | 'RESET' 
  | 'ABORT';

export type Isa88BatchState = 
  | 'NEW'
  | 'READY'
  | 'STARTING'
  | 'RUNNING'
  | 'HELD'
  | 'HOLDING'
  | 'RESTARTING'
  | 'STOPPING'
  | 'STOPPED'
  | 'ABORTING'
  | 'ABORTED'
  | 'COMPLETING'
  | 'COMPLETED'
  | 'IDLE';

export type HandshakeStatus = 'IDLE' | 'DOWNLOADING' | 'VERIFIED' | 'FAILED';

export type CipHygieneStatus = 'CLEAN' | 'DIRTY_EXPIRED' | 'IN_PROGRESS';

export interface QueueOrder {
  id: string;
  orderName: string;
  recipeName: string;
  recipeVersion?: string;
  volume: number;
  targetScadaNode: string;
  status: Isa88BatchState;
  scadaSyncStatus: string;
  elapsedTime: string;
  completionTime?: string;
  assignedCell?: string;
  customerName?: string;
  setpoints?: {
    milkSp: number;
    sugarSp: number;
    additiveSp: number;
    tempHotSp: number;
    tempColdSp: number;
  };
}

export interface ScadaSetpointVerification {
  id: string;
  tagName: string;
  phaseId?: string;
  scriptedSetpoint: number;
  scadaActualReadback: number;
  unit: string;
  tolerance: number;
  status: 'Matched' | 'In Progress' | 'Deviating' | 'Discrepancy';
  timestamp: string;
}

export type TopologyEntityStatus = 'IDLE' | 'RUNNING' | 'HELD' | 'FAULT' | 'COMPLETED';

export interface TopologyPhase {
  id: string;
  code: string;
  name: string;
  status: TopologyEntityStatus;
  activeStep?: string;
  equipmentModule?: string;
  targetNodeId?: string;
  spValue?: number;
  pvValue?: number;
  unit?: string;
  tolerance?: string;
}

export interface TopologyOperation {
  id: string;
  code: string;
  name: string;
  status: TopologyEntityStatus;
  phases: TopologyPhase[];
}

export interface TopologyCellCard {
  id: string;
  code: string;
  name: string;
  unitLabel: string;
  targetCell: string;
  status: TopologyEntityStatus;
  operations: TopologyOperation[];
}

export interface TimelineNode {
  id: string;
  code: string;
  name: string;
  type: 'UP' | 'OP' | 'PH';
  startMinute: number;
  durationMinutes: number;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'HELD';
  parentContext?: string;
  targetCell?: string;
}

export interface TelemetryDataPoint {
  time: string;
  sp: number;
  pv: number;
}

export interface ProcessTrendCard {
  id: string;
  title: string;
  cell: string;
  spTag: string;
  pvTag: string;
  unit: string;
  min: number;
  max: number;
  currentSp: number;
  currentPv: number;
  dataPoints: TelemetryDataPoint[];
}
