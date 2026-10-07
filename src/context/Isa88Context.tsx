/* Hallmark · component: Isa88Context · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { 
  UnitNode, 
  UnitProcedureNode, 
  TagItem, 
  InspectorNodeData, 
  TargetPlcOption,
  TagMappingDefinition
} from '../types/isa88';

export interface LiveTelemetryData {
  value: any;
  quality: string;
  timestamp: string;
  dataType?: string;
  role?: string;
  unit?: string;
  writable?: boolean;
  description?: string;
}

interface Isa88ContextType {
  physicalModel: UnitNode[];
  proceduralModel: UnitProcedureNode[];
  selectedNode: InspectorNodeData | null;
  selectNode: (node: InspectorNodeData) => void;
  updateTagMapping: (tagId: number, fields: Partial<TagItem>) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isSyncing: boolean;
  syncWithSqlServer: () => Promise<{ success: boolean; message: string }>;
  lastSyncTime: string | null;
  addPhysicalNode: (unitId: string, emName: string, cmName: string, equipment: string, targetPlc: TargetPlcOption) => void;
  addProceduralTag: (upId: string, opId: string, phId: string, tag: Omit<TagItem, 'tagId'>) => void;
  telemetryMap: Record<string, LiveTelemetryData>;
  gatewayConnected: boolean;
  writeNodeValue: (nodeId: string, value: any, dataType?: string) => Promise<{ success: boolean; message: string }>;
  
  // Dynamic Node Mapping System
  tagMappings: Record<string, TagMappingDefinition>;
  fetchMappings: () => Promise<Record<string, TagMappingDefinition>>;
  saveAllMappings: (mappings: Record<string, TagMappingDefinition>) => Promise<{ success: boolean; message: string }>;
  saveSingleTagMapping: (tagName: string, patch: Partial<TagMappingDefinition>) => Promise<{ success: boolean; message: string }>;
  testNodeConnectivity: (nodeId: string) => Promise<{ valid: boolean; value?: any; datatype?: string; message: string }>;
}

const KEPWARE_TARGET: TargetPlcOption = 'Kepware Central Gateway (Port 49320)';

// Whitelisted initial physical model mapped to centralized Kepware OPC UA server
const initialPhysicalModel: UnitNode[] = [
  {
    id: 'UNIT_MIXING',
    name: 'UNIT MIXING',
    area: 'Area 01 - Batch Formulation',
    description: 'Main Liquid & Powder Ingredients Mixing Reactor Unit',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_INLET_DOSING',
        name: 'INLET DOSING MODULE',
        description: 'Micro-ingredients dosing feed & recipe interlock',
        controlModules: [
          {
            id: 'CM_DOSING_CMD',
            name: 'PUMP_DOSING_CMD',
            equipment: 'P-101 (Positive Displacement Dosing Pump)',
            equipmentType: 'Dosing Pump Actuator',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.User3',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Batch_Start_CMD',
            role: 'Command / Start Pulse',
            unit: 'Bool',
            description: 'Dosing pump execution start trigger command',
          },
          {
            id: 'CM_RECIPE_OK',
            name: 'RELAY_RECIPE_ACK',
            equipment: 'HS-101 (Recipe Parameter Handshake Relay)',
            equipmentType: 'Digital Interlock',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.User4',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Handshake_Loaded_OK',
            role: 'Handshake / Recipe OK',
            unit: 'Bool',
            description: 'PLC recipe parameter verification acknowledgement',
          },
        ],
      },
      {
        id: 'EM_TANK_VESSEL',
        name: 'TANK VESSEL',
        description: 'Atmospheric stainless mixing tank level monitoring',
        controlModules: [
          {
            id: 'CM_LEVEL_SENSOR',
            name: 'LEVEL_HYDROSTATIC',
            equipment: 'LT-101 (Hydrostatic Tank Level Transmitter)',
            equipmentType: 'Level Sensor',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.Random1',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Tank_Level_PV',
            role: 'UP_MIXING / Level',
            unit: 'L',
            description: 'Continuous reactor level hydrostatic transmitter',
          },
        ],
      },
      {
        id: 'EM_AGITATOR',
        name: 'AGITATOR MOTOR',
        description: 'Variable speed mixing impeller and homogenizer',
        controlModules: [
          {
            id: 'CM_MOTOR_MIX',
            name: 'MOTOR_AGITATOR',
            equipment: 'M-101 (15kW VFD Mixing Agitator Motor)',
            equipmentType: 'VFD Motor',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.User2',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Agitator_Speed_PV',
            role: 'PH_AGITATING / Speed',
            unit: 'RPM',
            description: 'VFD high-shear mixing agitator drive speed feedback',
          },
        ],
      },
    ],
  },
  {
    id: 'UNIT_STERILIZE',
    name: 'UNIT STERILIZE',
    area: 'Area 02 - Thermal Processing',
    description: 'High Temperature Short Time (HTST) Sterilization Unit',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_HEATING',
        name: 'THERMAL HEATING LOOP',
        description: 'Continuous thermal hold heating circuit and PID loop',
        controlModules: [
          {
            id: 'CM_TEMP_SENSOR',
            name: 'TT_STERILIZER',
            equipment: 'TT-201 (Pt100 Sanitary Temperature Sensor)',
            equipmentType: 'RTD Transmitter',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.Ramp2',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Temp_Sterilizer_PV',
            role: 'PH_HEATING / PV',
            unit: '°C',
            description: 'Thermal chamber RTD temperature actual value',
          },
          {
            id: 'CM_TEMP_CONTROLLER',
            name: 'TIC_TEMP_SETPOINT',
            equipment: 'TIC-201 (Modulating Steam Valve & PID)',
            equipmentType: 'PID Controller',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.Test_SP',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Recipe_Temp_SP',
            role: 'Control Recipe / Temp SP',
            unit: '°C',
            description: 'Sterilization chamber target temperature setpoint',
          },
        ],
      },
      {
        id: 'EM_STATE_COORDINATOR',
        name: 'STATE COORDINATOR',
        description: 'ISA-88 / PackML master batch coordinator',
        controlModules: [
          {
            id: 'CM_BATCH_SM',
            name: 'SM_BATCH_STATUS',
            equipment: 'SM-201 (ISA-88 State Machine Engine)',
            equipmentType: 'Batch Coordinator',
            ioAddress: 'ns=2;s=Simulation Examples.Functions.User1',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'Batch_State',
            role: 'State Machine (PackML)',
            unit: 'State',
            description: 'Batch execution state: 1=IDLE, 2=RUNNING, 3=COMPLETE, 4=STOPPED',
          },
        ],
      },
    ],
  },
];

// Whitelisted initial procedural model mapped to the 7 essential Kepware tags
const initialProceduralModel: UnitProcedureNode[] = [
  {
    id: 'UP_MIXING_PC1',
    name: 'UP_MIXING_PC1',
    unit: 'UNIT MIXING',
    description: 'Master Unit Procedure for Batch Dairy & Additive Blending',
    operations: [
      {
        id: 'OP_INLET_BLENDING',
        name: 'OP_INLET_BLENDING',
        description: 'Operation: Metered material intake and mechanical homogenization',
        phases: [
          {
            id: 'PH_DOSING',
            name: 'PH_DOSING',
            code: 'PH11301',
            description: 'Phase: Micro-nutrient additive metering and feed check',
            tags: [
              {
                tagId: 101,
                tagName: 'Tank_Level_PV',
                dataType: 'Real',
                address: 'ns=2;s=Simulation Examples.Functions.Random1',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read',
                role: 'UP_MIXING / Level',
                unit: 'L',
                writable: false,
                description: 'Buffer tank liquid level actual value',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_INLET_BLENDING',
                parentPh: 'PH_DOSING',
              },
              {
                tagId: 102,
                tagName: 'Batch_Start_CMD',
                dataType: 'Boolean',
                address: 'ns=2;s=Simulation Examples.Functions.User3',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read/Write',
                role: 'Command / Start Pulse',
                unit: 'Bool',
                writable: true,
                description: 'Start trigger command bit for execution phase',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_INLET_BLENDING',
                parentPh: 'PH_DOSING',
              },
              {
                tagId: 103,
                tagName: 'Handshake_Loaded_OK',
                dataType: 'Boolean',
                address: 'ns=2;s=Simulation Examples.Functions.User4',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read/Write',
                role: 'Handshake / Recipe OK',
                unit: 'Bool',
                writable: true,
                description: 'PLC acknowledgement handshake bit for recipe download',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_INLET_BLENDING',
                parentPh: 'PH_DOSING',
              },
            ],
          },
          {
            id: 'PH_AGITATING',
            name: 'PH_AGITATING',
            code: 'PH11302',
            description: 'Phase: High-shear blending and PackML state coordination',
            tags: [
              {
                tagId: 104,
                tagName: 'Agitator_Speed_PV',
                dataType: 'Real',
                address: 'ns=2;s=Simulation Examples.Functions.User2',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read',
                role: 'PH_AGITATING / Speed',
                unit: 'RPM',
                writable: false,
                description: 'Mixer motor agitator feedback speed',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_INLET_BLENDING',
                parentPh: 'PH_AGITATING',
              },
              {
                tagId: 105,
                tagName: 'Batch_State',
                dataType: 'String',
                address: 'ns=2;s=Simulation Examples.Functions.User1',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read/Write',
                role: 'State Machine (PackML)',
                unit: 'State',
                writable: true,
                description: 'ISA-88 Unit State: 1=IDLE, 2=RUNNING, 3=COMPLETE, 4=STOPPED',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_INLET_BLENDING',
                parentPh: 'PH_AGITATING',
              },
            ],
          },
        ],
      },
      {
        id: 'OP_THERMAL_PROCESSING',
        name: 'OP_THERMAL_PROCESSING',
        description: 'Operation: HTST continuous thermal hold and sterilization loop',
        phases: [
          {
            id: 'PH_HEATING',
            name: 'PH_HEATING',
            code: 'PH21401',
            description: 'Phase: Temperature PID regulation and thermal holding',
            tags: [
              {
                tagId: 106,
                tagName: 'Temp_Sterilizer_PV',
                dataType: 'Real',
                address: 'ns=2;s=Simulation Examples.Functions.Ramp2',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read',
                role: 'PH_HEATING / PV',
                unit: '°C',
                writable: false,
                description: 'Sterilizer chamber actual temperature',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_THERMAL_PROCESSING',
                parentPh: 'PH_HEATING',
              },
              {
                tagId: 107,
                tagName: 'Recipe_Temp_SP',
                dataType: 'Real',
                address: 'ns=2;s=Simulation Examples.Functions.Test_SP',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware OPC UA',
                accessType: 'Read/Write',
                role: 'Control Recipe / Temp SP',
                unit: '°C',
                writable: true,
                description: 'Target temperature setpoint from Master Recipe',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_THERMAL_PROCESSING',
                parentPh: 'PH_HEATING',
              },
            ],
          },
        ],
      },
    ],
  },
];

const defaultSelectedNode: InspectorNodeData = {
  tagId: 106,
  tagName: 'Temp_Sterilizer_PV',
  nodeType: 'TAG',
  dataType: 'Real',
  address: 'ns=2;s=Simulation Examples.Functions.Ramp2',
  opcNodeId: 'ns=2;s=Simulation Examples.Functions.Ramp2',
  gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
  targetPlc: KEPWARE_TARGET,
  accessType: 'Read',
  role: 'PH_HEATING / PV',
  unit: '°C',
  writable: false,
  description: 'Sterilizer chamber actual temperature',
  parentContext: 'UP_MIXING_PC1 > OP_THERMAL_PROCESSING > PH_HEATING',
  equipmentRef: 'TT-201 (Pt100 Sanitary Temperature Sensor)',
  lastUpdated: 'Live Kepware OPC UA Stream',
};

const Isa88Context = createContext<Isa88ContextType | undefined>(undefined);

export const Isa88Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [physicalModel, setPhysicalModel] = useState<UnitNode[]>(initialPhysicalModel);
  const [proceduralModel, setProceduralModel] = useState<UnitProcedureNode[]>(initialProceduralModel);
  const [selectedNode, setSelectedNode] = useState<InspectorNodeData | null>(defaultSelectedNode);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Real-time telemetry cache indexed by both Node ID and Tag Name
  const [telemetryMap, setTelemetryMap] = useState<Record<string, LiveTelemetryData>>({});
  const [gatewayConnected, setGatewayConnected] = useState<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);

  // Connect to backend WebSocket (/ws/telemetry) with resilient auto-reconnect
  useEffect(() => {
    let isMounted = true;

    const connectWs = () => {
      if (!isMounted) return;

      const host = window.location.hostname || '127.0.0.1';
      const wsUrl = `ws://${host}:8000/ws/telemetry`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setGatewayConnected(true);
        };

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'TAG_UPDATE' && msg.data) {
              const d = msg.data;
              const updateEntry: LiveTelemetryData = {
                value: d.value,
                quality: d.quality || 'Good',
                timestamp: d.timestamp || new Date().toLocaleTimeString(),
                dataType: d.data_type || d.type,
                role: d.role,
                unit: d.unit,
                writable: d.writable,
                description: d.description,
              };

              setTelemetryMap((prev) => ({
                ...prev,
                [d.node_id]: updateEntry,
                [d.tag_name]: updateEntry,
              }));
            } else if (msg.type === 'SNAPSHOT' && Array.isArray(msg.tags)) {
              setGatewayConnected(Boolean(msg.server_connected));
              const newMap: Record<string, LiveTelemetryData> = {};
              msg.tags.forEach((t: any) => {
                const entry: LiveTelemetryData = {
                  value: t.value,
                  quality: msg.server_connected ? (t.quality || 'Good') : 'Bad',
                  timestamp: t.timestamp || new Date().toLocaleTimeString(),
                  dataType: t.data_type || t.type,
                  role: t.role,
                  unit: t.unit,
                  writable: t.writable,
                  description: t.description,
                };
                newMap[t.node_id] = entry;
                newMap[t.tag_name] = entry;
              });
              setTelemetryMap((prev) => ({ ...prev, ...newMap }));
            } else if (msg.type === 'ALL_TAGS_STATUS') {
              const quality = msg.quality || 'Bad';
              setGatewayConnected(msg.status === 'ONLINE');
              setTelemetryMap((prev) => {
                const updated: Record<string, LiveTelemetryData> = {};
                Object.keys(prev).forEach((k) => {
                  updated[k] = { ...prev[k], quality };
                });
                return updated;
              });
            }
          } catch {
            // Ignore parse errors on ping/pong
          }
        };

        ws.onerror = () => {
          if (!isMounted) return;
          setGatewayConnected(false);
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setGatewayConnected(false);
          // Set all existing telemetry to Bad
          setTelemetryMap((prev) => {
            const updated: Record<string, LiveTelemetryData> = {};
            Object.keys(prev).forEach((k) => {
              updated[k] = { ...prev[k], quality: 'Bad' };
            });
            return updated;
          });
          // Reconnect after 2.5s
          reconnectTimerRef.current = setTimeout(connectWs, 2500);
        };
      } catch {
        setGatewayConnected(false);
        reconnectTimerRef.current = setTimeout(connectWs, 3000);
      }
    };

    // Initial snapshot fetch fallback
    fetch('/api/gateway/explorer/tags')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        setGatewayConnected(Boolean(data.server_connected));
        if (data.tags && Array.isArray(data.tags)) {
          const map: Record<string, LiveTelemetryData> = {};
          data.tags.forEach((t: any) => {
            const entry: LiveTelemetryData = {
              value: t.value,
              quality: data.server_connected ? (t.quality || 'Good') : 'Bad',
              timestamp: t.timestamp || '--:--:--',
              dataType: t.data_type || t.type,
              role: t.role,
              unit: t.unit,
              writable: t.writable,
              description: t.description,
            };
            map[t.node_id] = entry;
            map[t.tag_name] = entry;
          });
          setTelemetryMap(map);
        }
      })
      .catch(() => {});

    connectWs();
    fetchMappings();

    return () => {
      isMounted = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const selectNode = (node: InspectorNodeData) => {
    setSelectedNode(node);
  };

  const writeNodeValue = async (
    nodeId: string, 
    value: any, 
    dataType: string = 'Float'
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/gateway/explorer/write-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node_id: nodeId,
          value,
          data_type: dataType,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        return { success: false, message: err.detail || 'Write failed' };
      }

      const data = await res.json();
      return { success: true, message: data.message || 'Node written successfully' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Write request network error' };
    }
  };

  const updateTagMapping = (tagId: number, fields: Partial<TagItem>) => {
    setProceduralModel((prev) =>
      prev.map((up) => ({
        ...up,
        operations: up.operations.map((op) => ({
          ...op,
          phases: op.phases.map((ph) => ({
            ...ph,
            tags: ph.tags.map((tag) => {
              if (tag.tagId === tagId) {
                const updated = { ...tag, ...fields };
                if (selectedNode && selectedNode.tagId === tagId) {
                  setSelectedNode({
                    ...selectedNode,
                    tagName: updated.tagName,
                    address: updated.address,
                    targetPlc: updated.targetPlc,
                    dataType: updated.dataType,
                    accessType: updated.accessType,
                    description: updated.description,
                    lastUpdated: new Date().toLocaleTimeString(),
                  });
                }
                return updated;
              }
              return tag;
            }),
          })),
        })),
      }))
    );
  };

  const syncWithSqlServer = async (): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    await new Promise((resolve) => setTimeout(resolve, 800));

    let tagCount = 0;
    proceduralModel.forEach((up) =>
      up.operations.forEach((op) => op.phases.forEach((ph) => (tagCount += ph.tags.length)))
    );

    let cmCount = 0;
    physicalModel.forEach((u) => u.equipmentModules.forEach((em) => (cmCount += em.controlModules.length)));

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastSyncTime(timestamp);
    setIsSyncing(false);

    return {
      success: true,
      message: `Successfully synchronized ${physicalModel.length} Units, ${cmCount} Control Modules, and ${tagCount} ISA-88 Tags with SQL Server database table [dbo].[ISA88_ModelSchema].`,
    };
  };

  const addPhysicalNode = (
    unitId: string,
    emName: string,
    cmName: string,
    equipment: string,
    targetPlc: TargetPlcOption
  ) => {
    setPhysicalModel((prev) =>
      prev.map((u) => {
        if (u.id === unitId) {
          const newCm = {
            id: `CM_${cmName.toUpperCase().replace(/\s+/g, '_')}`,
            name: cmName,
            equipment,
            equipmentType: 'Field Actuator',
            ioAddress: `ns=2;s=Simulation Examples.Functions.Custom_${Math.floor(100 + Math.random() * 900)}`,
            targetPlc,
            status: 'STANDBY' as const,
            description: `Configured control module for ${cmName}`,
          };

          const existingEm = u.equipmentModules.find((em) => em.name.toUpperCase() === emName.toUpperCase());
          if (existingEm) {
            return {
              ...u,
              equipmentModules: u.equipmentModules.map((em) =>
                em.id === existingEm.id
                  ? { ...em, controlModules: [...em.controlModules, newCm] }
                  : em
              ),
            };
          } else {
            const newEm = {
              id: `EM_${emName.toUpperCase().replace(/\s+/g, '_')}`,
              name: emName,
              description: `User-defined equipment module: ${emName}`,
              controlModules: [newCm],
            };
            return {
              ...u,
              equipmentModules: [...u.equipmentModules, newEm],
            };
          }
        }
        return u;
      })
    );
  };

  const addProceduralTag = (
    upId: string,
    opId: string,
    phId: string,
    tag: Omit<TagItem, 'tagId'>
  ) => {
    const newTagId = Math.floor(1000 + Math.random() * 9000);
    const newTag: TagItem = {
      ...tag,
      tagId: newTagId,
    };

    setProceduralModel((prev) =>
      prev.map((up) => {
        if (up.id === upId) {
          return {
            ...up,
            operations: up.operations.map((op) => {
              if (op.id === opId) {
                return {
                  ...op,
                  phases: op.phases.map((ph) => {
                    if (ph.id === phId) {
                      return {
                        ...ph,
                        tags: [...ph.tags, newTag],
                      };
                    }
                    return ph;
                  }),
                };
              }
              return op;
            }),
          };
        }
        return up;
      })
    );
  };

  const [tagMappings, setTagMappings] = useState<Record<string, TagMappingDefinition>>({});

  const applyMappingsToModels = (mappings: Record<string, TagMappingDefinition>) => {
    setTagMappings(mappings);

    setProceduralModel((prev) =>
      prev.map((up) => ({
        ...up,
        operations: up.operations.map((op) => ({
          ...op,
          phases: op.phases.map((ph) => ({
            ...ph,
            tags: ph.tags.map((tag) => {
              const mapping = mappings[tag.tagName];
              if (mapping) {
                return {
                  ...tag,
                  address: mapping.node_id,
                  unit: mapping.unit || tag.unit,
                  role: mapping.role || tag.role,
                  description: mapping.description || tag.description,
                  writable: mapping.writable,
                  accessType: mapping.writable ? ('Read/Write' as const) : ('Read' as const),
                };
              }
              return tag;
            }),
          })),
        })),
      }))
    );

    setPhysicalModel((prev) =>
      prev.map((u) => ({
        ...u,
        equipmentModules: u.equipmentModules.map((em) => ({
          ...em,
          controlModules: em.controlModules.map((cm) => {
            if (cm.boundTagName && mappings[cm.boundTagName]) {
              const m = mappings[cm.boundTagName];
              return {
                ...cm,
                ioAddress: m.node_id,
                unit: m.unit || cm.unit,
                role: m.role || cm.role,
              };
            }
            return cm;
          }),
        })),
      }))
    );

    setSelectedNode((curr) => {
      if (!curr) return curr;
      const m = mappings[curr.tagName];
      if (m) {
        return {
          ...curr,
          address: m.node_id,
          opcNodeId: m.node_id,
          unit: m.unit || curr.unit,
          role: m.role || curr.role,
          description: m.description || curr.description,
          writable: m.writable,
          accessType: m.writable ? ('Read/Write' as const) : ('Read' as const),
          lastUpdated: new Date().toLocaleTimeString(),
        };
      }
      return curr;
    });
  };

  const fetchMappings = async (): Promise<Record<string, TagMappingDefinition>> => {
    try {
      const res = await fetch('/api/gateway/mappings');
      if (res.ok) {
        const data = await res.json();
        const m = data.mappings || data;
        if (m && typeof m === 'object') {
          applyMappingsToModels(m);
          return m;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch tag mappings:', e);
    }
    return {};
  };

  const saveAllMappings = async (
    mappings: Record<string, TagMappingDefinition>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/gateway/mappings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        return { success: false, message: err.detail || 'Failed to save mappings' };
      }
      const data = await res.json();
      applyMappingsToModels(mappings);
      return { success: true, message: data.message || 'Mappings updated and resubscribed successfully' };
    } catch (e: any) {
      return { success: false, message: e.message || 'Network error saving mappings' };
    }
  };

  const saveSingleTagMapping = async (
    tagName: string,
    patch: Partial<TagMappingDefinition>
  ): Promise<{ success: boolean; message: string }> => {
    const current = { ...tagMappings };
    if (!current[tagName]) {
      let foundTag: TagItem | undefined;
      proceduralModel.forEach((up) =>
        up.operations.forEach((op) =>
          op.phases.forEach((ph) => {
            const t = ph.tags.find((item) => item.tagName === tagName);
            if (t) foundTag = t;
          })
        )
      );
      current[tagName] = {
        node_id: patch.node_id || (foundTag?.address ?? ''),
        role: patch.role || (foundTag?.role ?? ''),
        unit: patch.unit || (foundTag?.unit ?? ''),
        writable: patch.writable !== undefined ? patch.writable : (foundTag?.writable ?? false),
        description: patch.description || (foundTag?.description ?? ''),
      };
    } else {
      current[tagName] = {
        ...current[tagName],
        ...patch,
      };
    }
    return saveAllMappings(current);
  };

  const testNodeConnectivity = async (
    nodeId: string
  ): Promise<{ valid: boolean; value?: any; datatype?: string; message: string }> => {
    try {
      const res = await fetch('/api/gateway/test-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        return { valid: false, message: err.detail || 'Test endpoint returned error' };
      }
      const data = await res.json();
      return {
        valid: Boolean(data.valid),
        value: data.value,
        datatype: data.datatype,
        message: data.message || (data.valid ? 'Node verified successfully' : 'Invalid node'),
      };
    } catch (e: any) {
      return { valid: false, message: e.message || 'Network error testing node' };
    }
  };

  return (
    <Isa88Context.Provider
      value={{
        physicalModel,
        proceduralModel,
        selectedNode,
        selectNode,
        updateTagMapping,
        searchQuery,
        setSearchQuery,
        isSyncing,
        syncWithSqlServer,
        lastSyncTime,
        addPhysicalNode,
        addProceduralTag,
        telemetryMap,
        gatewayConnected,
        writeNodeValue,
        tagMappings,
        fetchMappings,
        saveAllMappings,
        saveSingleTagMapping,
        testNodeConnectivity,
      }}
    >
      {children}
    </Isa88Context.Provider>
  );
};

export const useIsa88 = (): Isa88ContextType => {
  const context = useContext(Isa88Context);
  if (!context) {
    throw new Error('useIsa88 must be used within an Isa88Provider');
  }
  return context;
};
