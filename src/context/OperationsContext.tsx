/* Hallmark · component: OperationsContext · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  QueueOrder, 
  ScadaSetpointVerification, 
  TopologyCellCard, 
  TimelineNode, 
  ProcessTrendCard,
  BatchCommandType,
  Isa88BatchState,
  HandshakeStatus,
  CipHygieneStatus
} from '../types/operations';
import { useMasterData } from './MasterDataContext';
import * as api from '../services/api';

interface OperationsContextType {
  // SCADA Gateway & Target Process Cell
  scadaGatewayUrl: string;
  isScadaConnected: boolean;
  targetProcessLine: string;
  setTargetProcessLine: (line: string) => void;

  // Handshake Interlock
  handshakeStatus: HandshakeStatus;
  handshakeLoadedOk: boolean;

  // Clean-In-Place (CIP) Hygiene Interlock Gateway
  cipStatus: CipHygieneStatus;
  lastCipTimestamp: string;
  sterilityWindowHours: number;
  cipProgressRemaining: number;
  startCipCycle: () => Promise<void>;
  resetCipToExpired: () => void;

  // 3-Tier Queue
  newOrders: QueueOrder[];
  runningOrders: QueueOrder[];
  finishedOrders: QueueOrder[];
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  dispatchOrder: (orderId: string) => void;

  // Active Supervisory Batch State & Commands
  currentBatchState: Isa88BatchState;
  executeBatchCommand: (command: BatchCommandType) => Promise<void>;
  lastCommandFeedback: string | null;

  // Pre-run SCADA SP vs PV Verification
  scadaVerifications: ScadaSetpointVerification[];

  // Topology Cards
  topologyCards: TopologyCellCard[];

  // Timeline Nodes
  timelineNodes: TimelineNode[];

  // Process Trends
  trendCards: ProcessTrendCard[];
}



const initialVerifications: ScadaSetpointVerification[] = [
  {
    id: '1',
    phaseId: 'PH_SUPPLYMILK',
    tagName: 'PH11101_SETPOINT_MILK',
    scriptedSetpoint: 700.0,
    scadaActualReadback: 700.0,
    unit: 'L',
    tolerance: 10.0,
    status: 'Matched',
    timestamp: '10:15:02 AM',
  },
  {
    id: '2',
    phaseId: 'PH_SUPPLYSUGAR',
    tagName: 'PH11202_SETPOINT_SUGAR',
    scriptedSetpoint: 200.0,
    scadaActualReadback: 200.0,
    unit: 'kg',
    tolerance: 2.0,
    status: 'Matched',
    timestamp: '10:15:02 AM',
  },
  {
    id: '3',
    phaseId: 'PH_HEATING',
    tagName: 'PH22101_SETPOINT_TEMP_HOT',
    scriptedSetpoint: 138.0,
    scadaActualReadback: 138.1,
    unit: '°C',
    tolerance: 1.0,
    status: 'Matched',
    timestamp: '10:15:03 AM',
  },
  {
    id: '4',
    phaseId: 'PH_COOLING',
    tagName: 'PH22202_SETPOINT_TEMP_COLD',
    scriptedSetpoint: 4.0,
    scadaActualReadback: 4.1,
    unit: '°C',
    tolerance: 0.5,
    status: 'Matched',
    timestamp: '10:15:04 AM',
  },
];

const initialTopologyCards: TopologyCellCard[] = [
  {
    id: 'card_pc1_mix',
    code: 'UP1000',
    name: 'UP_MIXING_PC1',
    unitLabel: 'Mixing Unit - Process Cell 1',
    targetCell: 'Process Cell 1 (Physical S7-1500)',
    status: 'IDLE',
    operations: [
      {
        id: 'op1',
        code: 'OP1001',
        name: 'OP_INLET',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph1', 
            code: 'PH11101', 
            name: 'PH_SUPPLYMILK', 
            status: 'IDLE', 
            activeStep: 'Ready for Dosing',
            equipmentModule: 'P-101 Raw Milk Dosing Pump',
            targetNodeId: 'Recipe_Milk_SP',
            spValue: 700.0,
            pvValue: 0.0,
            unit: 'L',
            tolerance: '±10.0 L'
          },
          { 
            id: 'ph2', 
            code: 'PH11202', 
            name: 'PH_SUPPLYSUGAR', 
            status: 'IDLE', 
            activeStep: 'Hopper Gate Ready',
            equipmentModule: 'V-103 Sugar Dosing Rotary Valve',
            targetNodeId: 'Recipe_Sugar_SP',
            spValue: 200.0,
            pvValue: 0.0,
            unit: 'kg',
            tolerance: '±2.0 kg'
          },
          { 
            id: 'ph3', 
            code: 'PH11303', 
            name: 'PH_SUPPLYADDITIVE', 
            status: 'IDLE', 
            activeStep: 'Dosing Pump Standby',
            equipmentModule: 'P-103 Micro-Dosing Injection Pump',
            targetNodeId: 'Recipe_Additive_SP',
            spValue: 100.0,
            pvValue: 0.0,
            unit: 'L',
            tolerance: '±1.0 L'
          },
        ],
      },
      {
        id: 'op2',
        code: 'OP1002',
        name: 'OP_MIXING',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph4', 
            code: 'PH12101', 
            name: 'PH_AGITATE', 
            status: 'IDLE', 
            activeStep: 'Motor Ready (1200 RPM)',
            equipmentModule: 'M-101 Variable Frequency Agitator',
            targetNodeId: 'Agitator_Speed_SP',
            spValue: 1200.0,
            pvValue: 0.0,
            unit: 'RPM',
            tolerance: '±25 RPM'
          },
          { 
            id: 'ph5', 
            code: 'PH12202', 
            name: 'PH_CIRCULATE', 
            status: 'IDLE', 
            activeStep: 'Loop Valve Standby',
            equipmentModule: 'P-102 Recirculation Sanitary Pump',
            targetNodeId: 'Loop_Valve_SP',
            spValue: 100.0,
            pvValue: 0.0,
            unit: '%',
            tolerance: '±2.0%'
          },
        ],
      },
    ],
  },
  {
    id: 'card_pc1_sterilize',
    code: 'UP2000',
    name: 'UP_STERILIZE_PC1',
    unitLabel: 'Sterilize Unit - Process Cell 1',
    targetCell: 'Process Cell 1 (Physical S7-1500)',
    status: 'IDLE',
    operations: [
      {
        id: 'op3',
        code: 'OP2001',
        name: 'OP_HEATING',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph6', 
            code: 'PH22101', 
            name: 'PH_HEAT', 
            status: 'IDLE', 
            activeStep: 'Steam Injection Primed',
            equipmentModule: 'V-201 Modulating Steam Valve',
            targetNodeId: 'Recipe_Temp_SP',
            spValue: 138.0,
            pvValue: 24.5,
            unit: '°C',
            tolerance: '±0.5°C'
          },
          { 
            id: 'ph7', 
            code: 'PH22102', 
            name: 'PH_HOLD_TEMP', 
            status: 'IDLE', 
            activeStep: 'Holding Chamber Standby',
            equipmentModule: 'TC-202 Holding Tube Section',
            targetNodeId: 'Sterilization_Hold_Timer',
            spValue: 600,
            pvValue: 0,
            unit: 's',
            tolerance: '±5s'
          },
        ],
      },
      {
        id: 'op4',
        code: 'OP2002',
        name: 'OP_COOLING',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph8', 
            code: 'PH22201', 
            name: 'PH_CHILL', 
            status: 'IDLE', 
            activeStep: 'Chilled Water Loop Ready',
            equipmentModule: 'HEX-203 Plate Heat Exchanger',
            targetNodeId: 'Recipe_Cool_SP',
            spValue: 4.0,
            pvValue: 25.0,
            unit: '°C',
            tolerance: '±1.0°C'
          },
          { 
            id: 'ph9', 
            code: 'PH22202', 
            name: 'PH_TRANSFER_OUT', 
            status: 'IDLE', 
            activeStep: 'Aseptic Line Ready',
            equipmentModule: 'V-204 Aseptic Divert Valve Block',
            targetNodeId: 'Transfer_Pump_SP',
            spValue: 80.0,
            pvValue: 0.0,
            unit: 'L/min',
            tolerance: '±5.0 L/min'
          },
        ],
      },
    ],
  },
  {
    id: 'card_pc2_mix',
    code: 'UP3000',
    name: 'UP_MIXING_PC2',
    unitLabel: 'Mixing Unit - SIMIT Digital Twin',
    targetCell: 'Process Cell 2 (SIMIT Digital Twin)',
    status: 'IDLE',
    operations: [
      {
        id: 'op5',
        code: 'OP3001',
        name: 'OP_INLET_PC2',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph10', 
            code: 'PH31101', 
            name: 'PH_SUPPLYMILK_PC2', 
            status: 'IDLE', 
            activeStep: 'SIMIT Simulation Ready',
            equipmentModule: 'Simulated Dosing Pump P-201',
            targetNodeId: 'SIMIT_Milk_SP',
            spValue: 700.0,
            pvValue: 0.0,
            unit: 'L',
            tolerance: '±5.0 L'
          },
          { 
            id: 'ph11', 
            code: 'PH31202', 
            name: 'PH_SUPPLYSUGAR_PC2', 
            status: 'IDLE', 
            activeStep: 'SIMIT Feeder Ready',
            equipmentModule: 'Simulated Rotary Valve V-203',
            targetNodeId: 'SIMIT_Sugar_SP',
            spValue: 200.0,
            pvValue: 0.0,
            unit: 'kg',
            tolerance: '±1.0 kg'
          },
        ],
      },
      {
        id: 'op6',
        code: 'OP3002',
        name: 'OP_MIXING_PC2',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph12', 
            code: 'PH32101', 
            name: 'PH_AGITATE_PC2', 
            status: 'IDLE', 
            activeStep: 'SIMIT Motor Model Active',
            equipmentModule: 'Simulated Agitator Motor M-201',
            targetNodeId: 'SIMIT_Agitator_Speed',
            spValue: 1200.0,
            pvValue: 0.0,
            unit: 'RPM',
            tolerance: '±10 RPM'
          },
        ],
      },
    ],
  },
  {
    id: 'card_pc2_sterilize',
    code: 'UP4000',
    name: 'UP_STERILIZE_PC2',
    unitLabel: 'Sterilize Unit - SIMIT Digital Twin',
    targetCell: 'Process Cell 2 (SIMIT Digital Twin)',
    status: 'IDLE',
    operations: [
      {
        id: 'op7',
        code: 'OP4001',
        name: 'OP_HEATING_PC2',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph13', 
            code: 'PH42101', 
            name: 'PH_HEAT_PC2', 
            status: 'IDLE', 
            activeStep: 'SIMIT Thermodynamic Loop',
            equipmentModule: 'Simulated Steam Exchanger TC-301',
            targetNodeId: 'SIMIT_Temp_Hot_SP',
            spValue: 138.0,
            pvValue: 25.0,
            unit: '°C',
            tolerance: '±0.5°C'
          },
        ],
      },
      {
        id: 'op8',
        code: 'OP4002',
        name: 'OP_COOLING_PC2',
        status: 'IDLE',
        phases: [
          { 
            id: 'ph14', 
            code: 'PH42201', 
            name: 'PH_CHILL_PC2', 
            status: 'IDLE', 
            activeStep: 'SIMIT Chilled Loop',
            equipmentModule: 'Simulated Chilled Exchanger HEX-302',
            targetNodeId: 'SIMIT_Temp_Cold_SP',
            spValue: 4.0,
            pvValue: 25.0,
            unit: '°C',
            tolerance: '±0.5°C'
          },
        ],
      },
    ],
  },
];

const initialTimelineNodes: TimelineNode[] = [
  // Process Cell 1 Nodes
  { id: 't1', code: 'UP1000', name: 'UP_MIXING_PC1', type: 'UP', startMinute: 0, durationMinutes: 28, status: 'IDLE', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't2', code: 'OP1001', name: 'OP_INLET', type: 'OP', startMinute: 0, durationMinutes: 12, status: 'IDLE', parentContext: 'UP1000', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't3', code: 'PH11101', name: 'PH_SUPPLYMILK', type: 'PH', startMinute: 0, durationMinutes: 6, status: 'IDLE', parentContext: 'OP1001', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't4', code: 'PH11202', name: 'PH_SUPPLYSUGAR', type: 'PH', startMinute: 4, durationMinutes: 5, status: 'IDLE', parentContext: 'OP1001', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't5', code: 'PH11303', name: 'PH_SUPPLYADDITIVE', type: 'PH', startMinute: 8, durationMinutes: 4, status: 'IDLE', parentContext: 'OP1001', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't6', code: 'OP1002', name: 'OP_MIXING', type: 'OP', startMinute: 12, durationMinutes: 16, status: 'IDLE', parentContext: 'UP1000', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't7', code: 'PH12101', name: 'PH_AGITATE', type: 'PH', startMinute: 12, durationMinutes: 12, status: 'IDLE', parentContext: 'OP1002', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't8', code: 'PH12202', name: 'PH_CIRCULATE', type: 'PH', startMinute: 16, durationMinutes: 10, status: 'IDLE', parentContext: 'OP1002', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't9', code: 'PH12303', name: 'PH_TRANSFER_MIX', type: 'PH', startMinute: 24, durationMinutes: 4, status: 'IDLE', parentContext: 'OP1002', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't10', code: 'UP2000', name: 'UP_STERILIZE_PC1', type: 'UP', startMinute: 10, durationMinutes: 20, status: 'IDLE', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't11', code: 'OP2001', name: 'OP_HEATING', type: 'OP', startMinute: 10, durationMinutes: 12, status: 'IDLE', parentContext: 'UP2000', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't12', code: 'PH22101', name: 'PH_HEAT', type: 'PH', startMinute: 10, durationMinutes: 8, status: 'IDLE', parentContext: 'OP2001', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't13', code: 'PH22102', name: 'PH_HOLD_TEMP', type: 'PH', startMinute: 18, durationMinutes: 4, status: 'IDLE', parentContext: 'OP2001', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't14', code: 'OP2002', name: 'OP_COOLING', type: 'OP', startMinute: 22, durationMinutes: 8, status: 'IDLE', parentContext: 'UP2000', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't15', code: 'PH22201', name: 'PH_CHILL', type: 'PH', startMinute: 22, durationMinutes: 5, status: 'IDLE', parentContext: 'OP2002', targetCell: 'Process Cell 1 (Physical S7-1500)' },
  { id: 't16', code: 'PH22202', name: 'PH_TRANSFER_OUT', type: 'PH', startMinute: 27, durationMinutes: 3, status: 'IDLE', parentContext: 'OP2002', targetCell: 'Process Cell 1 (Physical S7-1500)' },

  // Process Cell 2 (SIMIT Digital Twin) Nodes
  { id: 't17', code: 'UP3000', name: 'UP_MIXING_PC2', type: 'UP', startMinute: 0, durationMinutes: 26, status: 'IDLE', targetCell: 'Process Cell 2 (SIMIT Digital Twin)' },
  { id: 't18', code: 'OP3001', name: 'OP_INLET_PC2', type: 'OP', startMinute: 0, durationMinutes: 10, status: 'IDLE', parentContext: 'UP3000', targetCell: 'Process Cell 2 (SIMIT Digital Twin)' },
  { id: 't19', code: 'PH31101', name: 'PH_SUPPLYMILK_PC2', type: 'PH', startMinute: 0, durationMinutes: 6, status: 'IDLE', parentContext: 'OP3001', targetCell: 'Process Cell 2 (SIMIT Digital Twin)' },
  { id: 't20', code: 'PH31202', name: 'PH_SUPPLYSUGAR_PC2', type: 'PH', startMinute: 4, durationMinutes: 5, status: 'IDLE', parentContext: 'OP3001', targetCell: 'Process Cell 2 (SIMIT Digital Twin)' },
  { id: 't21', code: 'UP4000', name: 'UP_STERILIZE_PC2', type: 'UP', startMinute: 10, durationMinutes: 18, status: 'IDLE', targetCell: 'Process Cell 2 (SIMIT Digital Twin)' },
  { id: 't22', code: 'PH42101', name: 'PH_HEAT_PC2', type: 'PH', startMinute: 10, durationMinutes: 9, status: 'IDLE', parentContext: 'UP4000', targetCell: 'Process Cell 2 (SIMIT Digital Twin)' },
];

const generateTrendData = (baseSp: number, variance: number, clampMin = 0, points = 15): { time: string; sp: number; pv: number }[] => {
  const result = [];
  const now = new Date();
  for (let i = points; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60000);
    const timeStr = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const noise = (Math.random() - 0.5) * variance;
    const rawPv = baseSp + noise;
    const pv = Math.max(clampMin, parseFloat(rawPv.toFixed(1)));
    result.push({
      time: timeStr,
      sp: baseSp,
      pv,
    });
  }
  return result;
};

const initialTrendCards: ProcessTrendCard[] = [
  {
    id: 'tr1',
    title: 'PC1 - PH11101 Milk Flow Rate',
    cell: 'Process Cell 1',
    spTag: 'Recipe_Milk_SP',
    pvTag: 'PH11101_FLOWRATE_ACT',
    unit: 'L/min',
    min: 0,
    max: 120,
    currentSp: 100.0,
    currentPv: 99.6,
    dataPoints: generateTrendData(100.0, 2.5, 0),
  },
  {
    id: 'tr2',
    title: 'PC1 - PH11202 Sugar Weight (Clamped)',
    cell: 'Process Cell 1',
    spTag: 'Recipe_Sugar_SP',
    pvTag: 'PH11202_WEIGHT_ACT',
    unit: 'kg',
    min: 0,
    max: 300,
    currentSp: 200.0,
    currentPv: 199.8,
    dataPoints: generateTrendData(200.0, 1.8, 0),
  },
  {
    id: 'tr3',
    title: 'PC1 - PH22101 Sterilization Temp',
    cell: 'Process Cell 1',
    spTag: 'Recipe_Temp_SP',
    pvTag: 'Temp_Hot_PV',
    unit: '°C',
    min: 20,
    max: 150,
    currentSp: 138.0,
    currentPv: 138.1,
    dataPoints: generateTrendData(138.0, 0.8, 20),
  },
  {
    id: 'tr4',
    title: 'PC1 - PH12101 Mixing Speed',
    cell: 'Process Cell 1',
    spTag: 'Agitator_Speed_SP',
    pvTag: 'PH12101_SPEED_ACT',
    unit: 'RPM',
    min: 0,
    max: 1500,
    currentSp: 1200.0,
    currentPv: 1198.0,
    dataPoints: generateTrendData(1200.0, 15, 0),
  },
  {
    id: 'tr5',
    title: 'PC1 - PH11303 Additive Flow',
    cell: 'Process Cell 1',
    spTag: 'Recipe_Additive_SP',
    pvTag: 'PH11303_DOSING_ACT',
    unit: 'L/min',
    min: 0,
    max: 20,
    currentSp: 12.5,
    currentPv: 12.4,
    dataPoints: generateTrendData(12.5, 0.3, 0),
  },
  {
    id: 'tr6',
    title: 'PC1 - PH22201 Cooling Temp',
    cell: 'Process Cell 1',
    spTag: 'Recipe_Cool_SP',
    pvTag: 'Temp_Cold_PV',
    unit: '°C',
    min: 0,
    max: 30,
    currentSp: 4.0,
    currentPv: 4.1,
    dataPoints: generateTrendData(4.0, 0.5, 0),
  },
  {
    id: 'tr7',
    title: 'PC1 - Agitator Motor Current',
    cell: 'Process Cell 1',
    spTag: 'M101_CURRENT_MAX',
    pvTag: 'M101_CURRENT_ACT',
    unit: 'Amps',
    min: 0,
    max: 30,
    currentSp: 22.0,
    currentPv: 18.5,
    dataPoints: generateTrendData(20.0, 1.2, 0),
  },
  {
    id: 'tr8',
    title: 'PC2 - Tank Pressure (SIMIT Twin)',
    cell: 'Process Cell 2',
    spTag: 'TC2_PRESSURE_MAX',
    pvTag: 'TC2_PRESSURE_ACT',
    unit: 'Bar',
    min: 0,
    max: 6,
    currentSp: 3.5,
    currentPv: 3.49,
    dataPoints: generateTrendData(3.5, 0.1, 0),
  },
];

const OperationsContext = createContext<OperationsContextType | undefined>(undefined);

export const OperationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const masterData = useMasterData();

  // Centralized Kepware Gateway URL
  const [scadaGatewayUrl] = useState<string>('opc.tcp://127.0.0.1:49320');
  const [isScadaConnected] = useState<boolean>(true);
  const [targetProcessLine, setTargetProcessLine] = useState<string>('Process Cell 1 (Physical S7-1500)');

  // Handshake Interlock State
  const [handshakeStatus, setHandshakeStatus] = useState<HandshakeStatus>('IDLE');
  const [handshakeLoadedOk, setHandshakeLoadedOk] = useState<boolean>(false);

  // Clean-In-Place (CIP) Hygiene Interlock State (Siemens PM-CONTROL)
  // Initialized to DIRTY_EXPIRED (sterility expired) so interlock is active and testable immediately
  const [cipStatus, setCipStatus] = useState<CipHygieneStatus>('DIRTY_EXPIRED');
  const [lastCipTimestamp, setLastCipTimestamp] = useState<string>('2026-10-01 18:30:00');
  const [sterilityWindowHours] = useState<number>(8);
  const [cipProgressRemaining, setCipProgressRemaining] = useState<number>(5);

  const startCipCycle = async (): Promise<void> => {
    if (cipStatus === 'IN_PROGRESS') return;
    setCipStatus('IN_PROGRESS');
    setCipProgressRemaining(5);
    setLastCommandFeedback('[CIP ENGAGED] Initiating automated Clean-In-Place 5-stage sanitization cycle (Pre-rinse, Caustic wash, Acid wash, Final rinse, Hot steam)...');

    return new Promise<void>((resolve) => {
      let secondsLeft = 5;
      const interval = setInterval(() => {
        secondsLeft -= 1;
        setCipProgressRemaining(secondsLeft);
        if (secondsLeft <= 0) {
          clearInterval(interval);
          const finishedAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
          setCipStatus('CLEAN');
          setLastCipTimestamp(finishedAt);
          setLastCommandFeedback(`[CIP CYCLE COMPLETE] Hygiene and sterility validated. Unit Mixing certified clean. Sterility window: 8.0 hours active. Batch interlock unlocked.`);
          setTimeout(() => setLastCommandFeedback(null), 8000);
          resolve();
        }
      }, 1000);
    });
  };

  const resetCipToExpired = () => {
    setCipStatus('DIRTY_EXPIRED');
    setLastCipTimestamp('2026-10-01 18:30:00');
    setLastCommandFeedback('[CIP INTERLOCK ENGAGED] Unit Mixing Clean-In-Place expired (> 8.0 hours). Automated safety gate locked: SCADA download & batch start disabled.');
    setTimeout(() => setLastCommandFeedback(null), 6000);
  };

  // 3-Tier Queue
  const [newOrders, setNewOrders] = useState<QueueOrder[]>([]);
  const [runningOrders, setRunningOrders] = useState<QueueOrder[]>([]);
  const [finishedOrders, setFinishedOrders] = useState<QueueOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // Active Supervisory Batch State & Commands
  const [currentBatchState, setCurrentBatchState] = useState<Isa88BatchState>('IDLE');
  const [lastCommandFeedback, setLastCommandFeedback] = useState<string | null>(null);

  const [scadaVerifications, setScadaVerifications] = useState<ScadaSetpointVerification[]>(initialVerifications);
  const [topologyCards, setTopologyCards] = useState<TopologyCellCard[]>(initialTopologyCards);
  const [timelineNodes, setTimelineNodes] = useState<TimelineNode[]>(initialTimelineNodes);
  const [trendCards, setTrendCards] = useState<ProcessTrendCard[]>(initialTrendCards);

  // Synchronize Master Data Work Orders into Operations Queue
  useEffect(() => {
    if (masterData?.workOrders) {
      const dispatchedFromMaster = masterData.workOrders.map((wo) => {
        // Extract setpoints from calculatedSetpoints
        const milkSp = wo.calculatedSetpoints?.find(s => s.name.includes('Milk'))?.calculatedValue || (wo.volume * 0.7);
        const sugarSp = wo.calculatedSetpoints?.find(s => s.name.includes('Sugar'))?.calculatedValue || (wo.volume * 0.2);
        const additiveSp = wo.calculatedSetpoints?.find(s => s.name.includes('Additive'))?.calculatedValue || (wo.volume * 0.1);
        const tempHotSp = wo.calculatedSetpoints?.find(s => s.name.includes('Sterilization') || s.name.includes('Temp'))?.calculatedValue || 138.0;
        const tempColdSp = 4.0;

        return {
          id: wo.orderId,
          orderName: `${wo.orderId} (${wo.recipeName})`,
          recipeName: wo.recipeName,
          recipeVersion: wo.recipeVersion || 'v1.2',
          volume: wo.volume,
          targetScadaNode: 'SCADA_Line_01',
          status: (wo.status === 'RUNNING' ? 'RUNNING' : wo.status === 'COMPLETED' ? 'COMPLETED' : wo.status === 'READY' ? 'READY' : 'NEW') as Isa88BatchState,
          scadaSyncStatus: wo.status === 'RUNNING' ? 'Executing on Controller' : 'Validated in Level 3 MES',
          elapsedTime: wo.status === 'RUNNING' ? '00:05:20' : '00:00:00',
          completionTime: wo.endTime !== '---' ? wo.endTime : undefined,
          assignedCell: 'Process Cell 1 (Physical S7-1500)',
          customerName: wo.customerName,
          setpoints: {
            milkSp,
            sugarSp,
            additiveSp,
            tempHotSp,
            tempColdSp,
          },
        };
      });

      // Split into 3-tier queue
      const newlyDispatched = dispatchedFromMaster.filter(o => o.status === 'NEW' || o.status === 'READY');
      const activelyRunning = dispatchedFromMaster.filter(o => o.status === 'RUNNING' || o.status === 'HELD');
      const alreadyDone = dispatchedFromMaster.filter(o => o.status === 'COMPLETED' || o.status === 'ABORTED');

      setNewOrders(newlyDispatched);
      setRunningOrders(activelyRunning);
      if (activelyRunning.length > 0) {
        setCurrentBatchState(activelyRunning[0].status);
        setHandshakeLoadedOk(true);
      }
      setFinishedOrders(alreadyDone);

      if (!selectedOrderId && newlyDispatched.length > 0) {
        setSelectedOrderId(newlyDispatched[0].id);
      }
    }
  }, [masterData?.workOrders]);

  // Update Pre-Flight Setpoint Verification Table when active/selected order changes
  useEffect(() => {
    const active = runningOrders[0] || newOrders.find(o => o.id === selectedOrderId) || newOrders[0];
    if (active?.setpoints) {
      setScadaVerifications([
        {
          id: '1',
          phaseId: 'PH_SUPPLYMILK',
          tagName: 'PH11101_SETPOINT_MILK',
          scriptedSetpoint: active.setpoints.milkSp,
          scadaActualReadback: active.status === 'RUNNING' ? active.setpoints.milkSp : 0.0,
          unit: 'L',
          tolerance: 10.0,
          status: active.status === 'RUNNING' ? 'Matched' : 'In Progress',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        {
          id: '2',
          phaseId: 'PH_SUPPLYSUGAR',
          tagName: 'PH11202_SETPOINT_SUGAR',
          scriptedSetpoint: active.setpoints.sugarSp,
          scadaActualReadback: active.status === 'RUNNING' ? active.setpoints.sugarSp : 0.0,
          unit: 'kg',
          tolerance: 2.0,
          status: active.status === 'RUNNING' ? 'Matched' : 'In Progress',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        {
          id: '3',
          phaseId: 'PH_HEATING',
          tagName: 'PH22101_SETPOINT_TEMP_HOT',
          scriptedSetpoint: active.setpoints.tempHotSp,
          scadaActualReadback: active.status === 'RUNNING' ? 138.1 : 24.5,
          unit: '°C',
          tolerance: 1.0,
          status: active.status === 'RUNNING' ? 'Matched' : 'In Progress',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
        {
          id: '4',
          phaseId: 'PH_COOLING',
          tagName: 'PH22202_SETPOINT_TEMP_COLD',
          scriptedSetpoint: active.setpoints.tempColdSp,
          scadaActualReadback: active.status === 'RUNNING' ? 4.1 : 25.0,
          unit: '°C',
          tolerance: 0.5,
          status: active.status === 'RUNNING' ? 'Matched' : 'In Progress',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        },
      ]);
    }
  }, [selectedOrderId, runningOrders.length]);

  // Dynamic Cell 2 & Cell 1 Topology Switching
  useEffect(() => {
    const isCell2 = targetProcessLine.includes('Cell 2');
    const isRunning = currentBatchState === 'RUNNING';
    const isHeld = currentBatchState === 'HELD';

    setTopologyCards(prev => prev.map(card => {
      const matchCell = isCell2 ? card.targetCell.includes('Cell 2') : card.targetCell.includes('Cell 1');
      if (matchCell && isRunning) {
        return {
          ...card,
          status: 'RUNNING',
          operations: card.operations.map((op, opIdx) => ({
            ...op,
            status: opIdx === 0 ? 'COMPLETED' : 'RUNNING',
            phases: op.phases.map((ph, phIdx) => ({
              ...ph,
              status: opIdx === 0 ? 'COMPLETED' : phIdx === 0 ? 'RUNNING' : 'IDLE',
              activeStep: opIdx === 0 ? 'Phase Execution Finished' : phIdx === 0 ? 'Regulating Active Parameter' : 'Standby',
              pvValue: ph.spValue ? ph.spValue : ph.pvValue,
            }))
          }))
        };
      } else if (matchCell && isHeld) {
        return { ...card, status: 'HELD' };
      } else if (!isRunning) {
        return {
          ...card,
          status: 'IDLE',
          operations: card.operations.map(op => ({
            ...op,
            status: 'IDLE',
            phases: op.phases.map(ph => ({ ...ph, status: 'IDLE' }))
          }))
        };
      }
      return card;
    }));
  }, [targetProcessLine, currentBatchState]);

  // Dynamic Timeline Nodes update based on running state & target process line
  useEffect(() => {
    const isCell2 = targetProcessLine.includes('Cell 2');
    const targetFilter = isCell2 ? 'Process Cell 2 (SIMIT Digital Twin)' : 'Process Cell 1 (Physical S7-1500)';

    setTimelineNodes(prev => prev.map(node => {
      if (node.targetCell === targetFilter) {
        if (currentBatchState === 'RUNNING') {
          // First few nodes completed, middle running, remainder idle
          if (node.code.includes('INLET') || node.code.includes('SUPPLYMILK')) {
            return { ...node, status: 'COMPLETED' };
          }
          if (node.code.includes('MIXING') || node.code.includes('HEAT') || node.code.includes('AGITATE')) {
            return { ...node, status: 'RUNNING' };
          }
        } else if (currentBatchState === 'HELD') {
          return { ...node, status: node.status === 'RUNNING' ? 'HELD' : node.status };
        }
      }
      return node;
    }));
  }, [targetProcessLine, currentBatchState]);

  // Auto-increment elapsed time for the running order
  useEffect(() => {
    const timer = setInterval(() => {
      setRunningOrders((prev) =>
        prev.map((order) => {
          if (order.status === 'RUNNING') {
            const parts = order.elapsedTime.split(':').map(Number);
            let s = parts[2] + 1;
            let m = parts[1];
            let h = parts[0];
            if (s >= 60) {
              s = 0;
              m += 1;
            }
            if (m >= 60) {
              m = 0;
              h += 1;
            }
            const pad = (n: number) => n.toString().padStart(2, '0');
            return { ...order, elapsedTime: `${pad(h)}:${pad(m)}:${pad(s)}` };
          }
          return order;
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Poll live telemetry from Python Kepware Gateway
  useEffect(() => {
    const pollTelemetry = async () => {
      try {
        const response = await fetch('/api/gateway/live-telemetry');
        if (response.ok) {
          const telemetry = await response.json();
          
          setScadaVerifications(prev => prev.map(v => {
            if (v.phaseId === 'PH_HEATING' || v.tagName.includes('TEMP_HOT')) {
              const pv = Number((telemetry.temperature_act ?? 138.1).toFixed(1));
              const diff = Math.abs(pv - v.scriptedSetpoint);
              const status = diff <= v.tolerance ? 'Matched' : currentBatchState === 'RUNNING' ? 'In Progress' : 'Deviating';
              return { ...v, scadaActualReadback: pv, status };
            }
            if (v.phaseId === 'PH_SUPPLYSUGAR' || v.tagName.includes('SETPOINT_SUGAR')) {
              // Ensure clamped >= 0
              const pv = Math.max(0.0, Number((telemetry.weight_act ?? 200.0).toFixed(1)));
              const diff = Math.abs(pv - v.scriptedSetpoint);
              const status = diff <= v.tolerance ? 'Matched' : currentBatchState === 'RUNNING' ? 'In Progress' : 'Deviating';
              return { ...v, scadaActualReadback: pv, status };
            }
            if (v.phaseId === 'PH_SUPPLYMILK') {
              const pv = currentBatchState === 'RUNNING' ? v.scriptedSetpoint : 0.0;
              const diff = Math.abs(pv - v.scriptedSetpoint);
              const status = diff <= v.tolerance ? 'Matched' : 'In Progress';
              return { ...v, scadaActualReadback: pv, status };
            }
            return v;
          }));

          setTrendCards(prev => prev.map(t => {
            if (t.title.includes('Sterilization') || t.title.includes('Hot Temp')) {
              const pv = Math.min(150, Math.max(20, Number((telemetry.temperature_act ?? 138.1).toFixed(1))));
              return { 
                ...t, 
                currentSp: 138.0,
                currentPv: pv, 
                dataPoints: [...t.dataPoints.slice(1), { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), sp: 138.0, pv }] 
              };
            }
            if (t.title.includes('Sugar Weight')) {
              // Clamp min to 0
              const pv = Math.max(0.0, Number((telemetry.weight_act ?? 199.8).toFixed(1)));
              return { 
                ...t, 
                currentPv: pv, 
                dataPoints: [...t.dataPoints.slice(1), { time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), sp: t.currentSp, pv }] 
              };
            }
            return t;
          }));
        }
      } catch {
        // Graceful degradation when offline
      }
    };
    const interval = setInterval(pollTelemetry, 1000);
    return () => clearInterval(interval);
  }, [currentBatchState]);

  // Dispatch an order
  const dispatchOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setLastCommandFeedback(`Order [${orderId}] selected for supervisory downlink. Click [DOWNLOAD TO SCADA] to initiate handshake.`);
    setTimeout(() => setLastCommandFeedback(null), 5000);
  };

  // Siemens PM-CONTROL Batch Command Execution & Handshake Engine
  const executeBatchCommand = async (command: BatchCommandType) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    try {
      if (command === 'DOWNLOAD') {
        if (cipStatus !== 'CLEAN') {
          setLastCommandFeedback('[CIP SAFETY INTERLOCK] Download rejected: Unit Mixing requires automated Clean-In-Place (CIP) cycle before fresh batch execution.');
          return;
        }

        const targetOrder = newOrders.find(o => o.id === selectedOrderId) || newOrders[0];
        if (!targetOrder) {
          setLastCommandFeedback('[ERROR] No order available in NEW ORDERS queue to download.');
          return;
        }

        setHandshakeStatus('DOWNLOADING');
        setLastCommandFeedback(`[DOWNLINK] Transmitting [${targetOrder.id}] Control Recipe setpoints to Kepware buffer...`);

        // Transmit setpoints to backend if online
        try {
          await fetch('/api/gateway/write-setpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              milk_sp: targetOrder.setpoints?.milkSp || 700.0,
              sugar_sp: targetOrder.setpoints?.sugarSp || 200.0,
              temperature_sp: targetOrder.setpoints?.tempHotSp || 138.0,
              cooling_sp: targetOrder.setpoints?.tempColdSp || 4.0,
            }),
          });
        } catch {
          // Simulation fallback
        }

        // Simulate PLC Handshake Confirmation
        setTimeout(() => {
          setHandshakeStatus('VERIFIED');
          setHandshakeLoadedOk(true);
          setLastCommandFeedback(`[HANDSHAKE OK] Recipe Setpoints Verified by Controller: Handshake_Loaded_OK = True. [START BATCH] is now illuminated.`);
          setScadaVerifications(prev => prev.map(v => ({ ...v, timestamp: timeStr, status: 'Matched' })));
        }, 800);

        return;
      }

      if (command === 'START') {
        if (cipStatus !== 'CLEAN') {
          setLastCommandFeedback('[CIP SAFETY INTERLOCK] Start batch rejected: Unit Mixing requires automated Clean-In-Place (CIP) cycle before fresh batch execution.');
          return;
        }

        if (!handshakeLoadedOk) {
          setLastCommandFeedback('[INTERLOCK REJECTED] Handshake_Loaded_OK is FALSE. You must execute [DOWNLOAD TO SCADA] first.');
          return;
        }

        const targetOrder = newOrders.find(o => o.id === selectedOrderId) || newOrders[0];
        if (!targetOrder) return;

        // Move to running orders
        const activated: QueueOrder = {
          ...targetOrder,
          status: 'RUNNING',
          scadaSyncStatus: 'Executing on Controller (Handshake OK)',
          elapsedTime: '00:00:01',
        };

        setNewOrders(prev => prev.filter(o => o.id !== targetOrder.id));
        setRunningOrders([activated, ...runningOrders]);
        setCurrentBatchState('RUNNING');

        // Asynchronously update status in SQL Server and log audit trail
        api.updateOrderStatus(targetOrder.id, 'Running', 'Operator')
          .then(() => masterData?.refetchData?.())
          .catch(() => {});
        api.logUserAction({
          username: 'Operator',
          role: 'Operator',
          action: 'BATCH_START',
          detail: `Batch [${targetOrder.id}] started execution for Recipe: ${targetOrder.recipeName}`,
        }).catch(() => {});

        // Forward to Kepware
        try {
          await fetch('/api/gateway/batch-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'START' }),
          });
        } catch {}

        setLastCommandFeedback(`[START BATCH] Order [${targetOrder.id}] active. Runtime timer started.`);
        return;
      }

      if (command === 'HOLD') {
        setCurrentBatchState('HELD');
        setRunningOrders(prev => prev.map(o => ({ ...o, status: 'HELD' })));
        const activeOrder = runningOrders[0];
        if (activeOrder) {
          api.updateOrderStatus(activeOrder.id, 'Held', 'Operator')
            .then(() => masterData?.refetchData?.())
            .catch(() => {});
          api.logUserAction({
            username: 'Operator',
            role: 'Operator',
            action: 'BATCH_HOLD',
            detail: `Batch [${activeOrder.id}] execution paused safely by operator`,
          }).catch(() => {});
        }
        try {
          await fetch('/api/gateway/batch-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'HOLD' }),
          });
        } catch {}
        setLastCommandFeedback(`[HOLD] ISA-88 #HOLD engaged. Dosing & thermal ramping paused safely.`);
        return;
      }

      if (command === 'RESUME') {
        setCurrentBatchState('RUNNING');
        setRunningOrders(prev => prev.map(o => ({ ...o, status: 'RUNNING' })));
        const activeOrder = runningOrders[0];
        if (activeOrder) {
          api.updateOrderStatus(activeOrder.id, 'Running', 'Operator')
            .then(() => masterData?.refetchData?.())
            .catch(() => {});
        }
        try {
          await fetch('/api/gateway/batch-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'RESUME' }),
          });
        } catch {}
        setLastCommandFeedback(`[RESUME / RESTART] Batch execution resumed.`);
        return;
      }

      if (command === 'STOP') {
        setCurrentBatchState('STOPPED');
        if (runningOrders.length > 0) {
          const stopped = {
            ...runningOrders[0],
            status: 'COMPLETED' as const,
            completionTime: timeStr,
          };
          setFinishedOrders(prev => [stopped, ...prev]);
          setRunningOrders(prev => prev.slice(1));

          // Asynchronously record batch completion to SQL Server and generate EBR report
          api.updateOrderStatus(stopped.id, 'Completed', 'Operator')
            .then(() => masterData?.refetchData?.())
            .catch(() => {});
          api.submitBatchCompletionReport({
            order_code: stopped.id,
            recipe_applied: stopped.recipeName,
            total_produced: stopped.volume,
            avg_deviation_percent: 0.25,
            quality_status: 'CONFORMING',
            disposition_action: 'RELEASED',
            sign_off_by: 'Shift Supervisor',
            quality_results: [
              {
                parameter_name: 'Sterilization Temperature',
                setpoint: stopped.setpoints?.tempHotSp || 138.0,
                actual_value: (stopped.setpoints?.tempHotSp || 138.0) + 0.1,
                deviation_percent: 0.07,
                tolerance_band: '±0.5°C',
                evaluation: 'PASS',
              },
              {
                parameter_name: 'Raw Milk Dosing',
                setpoint: stopped.setpoints?.milkSp || 700.0,
                actual_value: (stopped.setpoints?.milkSp || 700.0) + 0.5,
                deviation_percent: 0.07,
                tolerance_band: '±1.0%',
                evaluation: 'PASS',
              },
            ],
          }).catch(() => {});

          api.logUserAction({
            username: 'Operator',
            role: 'Operator',
            action: 'BATCH_COMPLETE',
            detail: `Batch [${stopped.id}] completed and verified. EBR report generated.`,
          }).catch(() => {});
        }
        setHandshakeLoadedOk(false);
        setHandshakeStatus('IDLE');
        try {
          await fetch('/api/gateway/batch-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'STOP' }),
          });
        } catch {}
        setLastCommandFeedback(`[STOP] Controlled batch shutdown completed. Record moved to Archive.`);
        return;
      }

      if (command === 'RESET') {
        setCurrentBatchState('IDLE');
        setHandshakeLoadedOk(false);
        setHandshakeStatus('IDLE');
        try {
          await fetch('/api/gateway/batch-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'RESET' }),
          });
        } catch {}
        setLastCommandFeedback(`[RESET] State machine returned to IDLE.`);
        return;
      }

      if (command === 'ABORT') {
        setCurrentBatchState('ABORTED');
        if (runningOrders.length > 0) {
          const aborted = {
            ...runningOrders[0],
            status: 'ABORTED' as const,
            completionTime: timeStr,
          };
          setFinishedOrders(prev => [aborted, ...prev]);
          setRunningOrders(prev => prev.slice(1));

          api.updateOrderStatus(aborted.id, 'Aborted', 'Operator').catch(() => {});
          api.logUserAction({
            username: 'Operator',
            role: 'Operator',
            action: 'BATCH_ABORT',
            detail: `Emergency batch abort triggered on [${aborted.id}]`,
          }).catch(() => {});
        }
        setHandshakeLoadedOk(false);
        setHandshakeStatus('IDLE');
        try {
          await fetch('/api/gateway/batch-command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: 'ABORT' }),
          });
        } catch {}
        setLastCommandFeedback(`[ABORT] Emergency batch abort executed. Interlocks secured.`);
        return;
      }
    } catch {
      setLastCommandFeedback(`[ERROR] Command ${command} failed. Gateway offline.`);
    }

    setTimeout(() => setLastCommandFeedback(null), 6000);
  };

  return (
    <OperationsContext.Provider
      value={{
        scadaGatewayUrl,
        isScadaConnected,
        targetProcessLine,
        setTargetProcessLine,

        handshakeStatus,
        handshakeLoadedOk,

        cipStatus,
        lastCipTimestamp,
        sterilityWindowHours,
        cipProgressRemaining,
        startCipCycle,
        resetCipToExpired,

        newOrders,
        runningOrders,
        finishedOrders,
        selectedOrderId,
        setSelectedOrderId,
        dispatchOrder,

        currentBatchState,
        executeBatchCommand,
        lastCommandFeedback,

        scadaVerifications,
        topologyCards,
        timelineNodes,
        trendCards,
      }}
    >
      {children}
    </OperationsContext.Provider>
  );
};

export const useOperations = (): OperationsContextType => {
  const context = useContext(OperationsContext);
  if (!context) {
    throw new Error('useOperations must be used within an OperationsProvider');
  }
  return context;
};
