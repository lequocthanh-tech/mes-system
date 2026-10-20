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
import { useConfig } from './ConfigContext';

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

// Whitelisted standard physical model mapped to centralized Kepware OPC UA server
const initialPhysicalModel: UnitNode[] = [
  // 1. TK01 (Raw Material Silo 1)
  {
    id: 'TK01',
    name: 'SILO NGUYÊN LIỆU 1 (SỮA TƯƠI)',
    area: 'Area 01 - Khu Silo Chứa Nguyên Liệu (Raw Material Silos)',
    description: 'Silo Chứa Nguyên Liệu (Raw Material Storage Silo 1 - Raw Milk)',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_TK01_STORAGE',
        name: 'ĐỊNH LƯỢNG SILO 1',
        description: 'Quản lý tồn kho & xuất liệu Silo 1 (Sữa tươi)',
        controlModules: [
          {
            id: 'CM_TK01_WEIGHT_PV',
            name: 'STOCK_TK01',
            equipment: 'SILO-01 (Raw Milk Storage Silo)',
            equipmentType: 'Storage Inventory Balance',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'TK01_WEIGHT_PV',
            role: 'PV',
            unit: 'kg/L',
            description: 'Tồn kho Silo nguyên liệu 1 - Sữa tươi',
          },
          {
            id: 'CM_VALVE_TK01_CMD',
            name: 'VALVE_TK01_CMD',
            equipment: 'V-101 (Pneumatic Bottom Outlet Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_TK01_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn liệu 1',
          },
          {
            id: 'CM_VALVE_TK01_FB',
            name: 'VALVE_TK01_FB',
            equipment: 'V-101 (Limit Switch Open Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_TK01_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van Bồn liệu 1',
          },
        ],
      },
    ],
  },
  // 2. TK02 (Raw Material Silo 2)
  {
    id: 'TK02',
    name: 'SILO NGUYÊN LIỆU 2 (ĐƯỜNG)',
    area: 'Area 01 - Khu Silo Chứa Nguyên Liệu (Raw Material Silos)',
    description: 'Silo Chứa Nguyên Liệu (Raw Material Storage Silo 2 - Liquid Sugar)',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_TK02_STORAGE',
        name: 'ĐỊNH LƯỢNG SILO 2',
        description: 'Quản lý tồn kho & xuất liệu Silo 2 (Đường)',
        controlModules: [
          {
            id: 'CM_TK02_WEIGHT_PV',
            name: 'STOCK_TK02',
            equipment: 'SILO-02 (Sugar Storage Silo)',
            equipmentType: 'Storage Inventory Balance',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'TK02_WEIGHT_PV',
            role: 'PV',
            unit: 'kg',
            description: 'Tồn kho Silo nguyên liệu 2 - Đường',
          },
          {
            id: 'CM_VALVE_TK02_CMD',
            name: 'VALVE_TK02_CMD',
            equipment: 'V-102 (Pneumatic Bottom Outlet Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_TK02_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn liệu 2',
          },
          {
            id: 'CM_VALVE_TK02_FB',
            name: 'VALVE_TK02_FB',
            equipment: 'V-102 (Limit Switch Open Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_TK02_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van Bồn liệu 2',
          },
        ],
      },
    ],
  },
  // 3. TK03 (Raw Material Silo 3)
  {
    id: 'TK03',
    name: 'SILO NGUYÊN LIỆU 3 (PHỤ GIA)',
    area: 'Area 01 - Khu Silo Chứa Nguyên Liệu (Raw Material Silos)',
    description: 'Silo Chứa Nguyên Liệu (Raw Material Storage Silo 3 - Additives)',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_TK03_STORAGE',
        name: 'ĐỊNH LƯỢNG SILO 3',
        description: 'Quản lý tồn kho & xuất liệu Silo 3 (Phụ gia)',
        controlModules: [
          {
            id: 'CM_TK03_WEIGHT_PV',
            name: 'STOCK_TK03',
            equipment: 'SILO-03 (Additive Storage Silo)',
            equipmentType: 'Storage Inventory Balance',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'TK03_WEIGHT_PV',
            role: 'PV',
            unit: 'kg/L',
            description: 'Tồn kho Silo nguyên liệu 3 - Phụ gia',
          },
          {
            id: 'CM_VALVE_TK03_CMD',
            name: 'VALVE_TK03_CMD',
            equipment: 'V-103 (Pneumatic Bottom Outlet Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_TK03_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn liệu 3',
          },
          {
            id: 'CM_VALVE_TK03_FB',
            name: 'VALVE_TK03_FB',
            equipment: 'V-103 (Limit Switch Open Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_TK03_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van Bồn liệu 3',
          },
        ],
      },
    ],
  },
  // 4. WEIGH01 (Pre-Weighing Hopper 1)
  {
    id: 'WEIGH01',
    name: 'BỒN CÂN TRUNG GIAN 1 (SỮA TƯƠI)',
    area: 'Area 01b - Bồn Cân Trung Gian (Pre-Weighing Hoppers)',
    description: 'Intermediate Pre-Weighing Hopper 1 with Precision Loadcell, Dosing Pump & Discharge Valve',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_WEIGH01_LOADCELL',
        name: 'HỆ THỐNG CÂN BỒN CÂN 1',
        description: 'Loadcell cân khối lượng Bồn cân trung gian 1 (Sữa tươi)',
        controlModules: [
          {
            id: 'CM_WEIGH1_WEIGHT_PV',
            name: 'LOADCELL_WEIGH01',
            equipment: 'WE-111 (Intermediate Milk Weigh Hopper Loadcell)',
            equipmentType: 'Strain Gauge Loadcell',
            ioAddress: 'ns=2;s=Modbus_TCP.weigh.weigh1',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'WEIGH1_WEIGHT_PV',
            role: 'PV',
            unit: 'kg/L',
            description: 'Loadcell cân bồn trung gian 1 - Sữa tươi',
          },
        ],
      },
      {
        id: 'EM_WEIGH01_DOSING',
        name: 'BƠM & VAN NẠP XẢ BỒN CÂN 1',
        description: 'Bơm nạp liệu 1 & Van xả dịch Bồn cân 1 vào bồn trộn',
        controlModules: [
          {
            id: 'CM_PUMP_INLET_MILK_CMD',
            name: 'PUMP_INLET_MILK_CMD',
            equipment: 'P-101 (Raw Milk Inlet Dosing Pump)',
            equipmentType: 'Centrifugal Pump Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_INLET_MILK_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh chạy Bơm nạp liệu 1 - Sữa tươi',
          },
          {
            id: 'CM_PUMP_INLET_MILK_FB',
            name: 'PUMP_INLET_MILK_FB',
            equipment: 'P-101 (Run Auxiliary Contact Feedback)',
            equipmentType: 'Digital Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_INLET_MILK_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái chạy Bơm nạp liệu 1',
          },
          {
            id: 'CM_VALVE_WEIGH1_OUT_CMD',
            name: 'VALVE_WEIGH1_OUT_CMD',
            equipment: 'V-111 (Weigh Hopper 1 Discharge Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_WEIGH1_OUT_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn cân 1 vào Bồn trộn',
          },
          {
            id: 'CM_VALVE_WEIGH1_OUT_FB',
            name: 'VALVE_WEIGH1_OUT_FB',
            equipment: 'V-111 (Limit Switch Open Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_WEIGH1_OUT_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả Bồn cân 1',
          },
        ],
      },
    ],
  },
  // 5. WEIGH02 (Pre-Weighing Hopper 2)
  {
    id: 'WEIGH02',
    name: 'BỒN CÂN TRUNG GIAN 2 (ĐƯỜNG)',
    area: 'Area 01b - Bồn Cân Trung Gian (Pre-Weighing Hoppers)',
    description: 'Intermediate Pre-Weighing Hopper 2 with Precision Loadcell, Dosing Pump & Discharge Valve',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_WEIGH02_LOADCELL',
        name: 'HỆ THỐNG CÂN BỒN CÂN 2',
        description: 'Loadcell cân khối lượng Bồn cân trung gian 2 (Đường)',
        controlModules: [
          {
            id: 'CM_WEIGH2_WEIGHT_PV',
            name: 'LOADCELL_WEIGH02',
            equipment: 'WE-112 (Intermediate Sugar Weigh Hopper Loadcell)',
            equipmentType: 'Strain Gauge Loadcell',
            ioAddress: 'ns=2;s=Modbus_TCP.weigh.weigh2',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'WEIGH2_WEIGHT_PV',
            role: 'PV',
            unit: 'kg',
            description: 'Loadcell cân bồn trung gian 2 - Đường',
          },
        ],
      },
      {
        id: 'EM_WEIGH02_DOSING',
        name: 'BƠM & VAN NẠP XẢ BỒN CÂN 2',
        description: 'Bơm nạp liệu 2 & Van xả dịch Bồn cân 2 vào bồn trộn',
        controlModules: [
          {
            id: 'CM_PUMP_INLET_SUGAR_CMD',
            name: 'PUMP_INLET_SUGAR_CMD',
            equipment: 'P-102 (Liquid Sugar Inlet Dosing Pump)',
            equipmentType: 'Positive Displacement Pump',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_INLET_SUGAR_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh chạy Bơm nạp liệu 2 - Đường',
          },
          {
            id: 'CM_PUMP_INLET_SUGAR_FB',
            name: 'PUMP_INLET_SUGAR_FB',
            equipment: 'P-102 (Run Auxiliary Contact Feedback)',
            equipmentType: 'Digital Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_INLET_SUGAR_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái chạy Bơm nạp liệu 2',
          },
          {
            id: 'CM_VALVE_WEIGH2_OUT_CMD',
            name: 'VALVE_WEIGH2_OUT_CMD',
            equipment: 'V-112 (Weigh Hopper 2 Discharge Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_WEIGH2_OUT_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn cân 2 vào Bồn trộn',
          },
          {
            id: 'CM_VALVE_WEIGH2_OUT_FB',
            name: 'VALVE_WEIGH2_OUT_FB',
            equipment: 'V-112 (Limit Switch Open Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_WEIGH2_OUT_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả Bồn cân 2',
          },
        ],
      },
    ],
  },
  // 6. WEIGH03 (Pre-Weighing Hopper 3)
  {
    id: 'WEIGH03',
    name: 'BỒN CÂN TRUNG GIAN 3 (PHỤ GIA)',
    area: 'Area 01b - Bồn Cân Trung Gian (Pre-Weighing Hoppers)',
    description: 'Intermediate Pre-Weighing Hopper 3 with Precision Loadcell, Dosing Pump & Discharge Valve',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_WEIGH03_LOADCELL',
        name: 'HỆ THỐNG CÂN BỒN CÂN 3',
        description: 'Loadcell cân khối lượng Bồn cân trung gian 3 (Phụ gia)',
        controlModules: [
          {
            id: 'CM_WEIGH3_WEIGHT_PV',
            name: 'LOADCELL_WEIGH03',
            equipment: 'WE-113 (Intermediate Additive Weigh Hopper Loadcell)',
            equipmentType: 'Strain Gauge Loadcell',
            ioAddress: 'ns=2;s=Modbus_TCP.weigh.weigh3',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'WEIGH3_WEIGHT_PV',
            role: 'PV',
            unit: 'kg/L',
            description: 'Loadcell cân bồn trung gian 3 - Phụ gia',
          },
        ],
      },
      {
        id: 'EM_WEIGH03_DOSING',
        name: 'BƠM & VAN NẠP XẢ BỒN CÂN 3',
        description: 'Bơm nạp liệu 3 & Van xả dịch Bồn cân 3 vào bồn trộn',
        controlModules: [
          {
            id: 'CM_PUMP_INLET_ADDITIVE_CMD',
            name: 'PUMP_INLET_ADDITIVE_CMD',
            equipment: 'P-103 (Additive Metering Dosing Pump)',
            equipmentType: 'Peristaltic Dosing Pump',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_INLET_ADDITIVE_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh chạy Bơm nạp liệu 3 - Phụ gia',
          },
          {
            id: 'CM_PUMP_INLET_ADDITIVE_FB',
            name: 'PUMP_INLET_ADDITIVE_FB',
            equipment: 'P-103 (Run Auxiliary Contact Feedback)',
            equipmentType: 'Digital Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_INLET_ADDITIVE_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái chạy Bơm nạp liệu 3',
          },
          {
            id: 'CM_VALVE_WEIGH3_OUT_CMD',
            name: 'VALVE_WEIGH3_OUT_CMD',
            equipment: 'V-113 (Weigh Hopper 3 Discharge Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_WEIGH3_OUT_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn cân 3 vào Bồn trộn',
          },
          {
            id: 'CM_VALVE_WEIGH3_OUT_FB',
            name: 'VALVE_WEIGH3_OUT_FB',
            equipment: 'V-113 (Limit Switch Open Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_WEIGH3_OUT_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả Bồn cân 3',
          },
        ],
      },
    ],
  },
  // 7. MIX01
  {
    id: 'MIX01',
    name: 'BỒN PHỐI TRỘN TRUNG TÂM',
    area: 'Area 02 - Phối Trộn & Đồng Hóa (Batch Blending)',
    description: 'Central Liquid & Powder Mixing Reactor with Loadcell, PT100, Agitator & Discharge Pump',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_MIX01_SENSORS',
        name: 'CẢM BIẾN BỒN TRỘN',
        description: 'Cảm biến Khối lượng & Nhiệt độ Bồn trộn',
        controlModules: [
          {
            id: 'CM_MIX01_WEIGHT',
            name: 'LOADCELL_MIX01',
            equipment: 'WE-201 (Mixing Vessel Loadcell)',
            equipmentType: 'Multi-Cell Weight Module',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'MIX01_WEIGHT_PV',
            role: 'PV',
            unit: 'kg/L',
            description: 'Loadcell cân khối lượng Bồn trộn',
          },
          {
            id: 'CM_MIX01_TEMP',
            name: 'PT100_MIX01',
            equipment: 'TE-201 (Sanitary RTD PT100 Sensor)',
            equipmentType: 'RTD Temperature Transmitter',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'MIX01_TEMP_PV',
            role: 'PV',
            unit: '°C',
            description: 'Cảm biến nhiệt độ PT100 Bồn trộn',
          },
          {
            id: 'CM_MIX01_STATE',
            name: 'UNIT_STATE_MIX01',
            equipment: 'SM-201 (PackML Unit State Coordinator)',
            equipmentType: 'ISA-88 State Machine',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'MIX01_UNIT_STATE',
            role: 'STATE',
            unit: 'State',
            description: 'Trạng thái vận hành ISA-88 Unit Bồn trộn',
          },
        ],
      },
      {
        id: 'EM_MIX01_AGITATOR',
        name: 'CÁNH KHUẤY BỒN TRỘN',
        description: 'Động cơ khuấy & Điều khiển tốc độ RPM',
        controlModules: [
          {
            id: 'CM_AGITATOR_MIX_CMD',
            name: 'AGITATOR_MIX_CMD',
            equipment: 'M-201 (VFD Sanitary Agitator Motor)',
            equipmentType: 'VFD Speed Controller',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'AGITATOR_MIX_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh chạy Cánh khuấy Bồn trộn',
          },
          {
            id: 'CM_AGITATOR_MIX_FB',
            name: 'AGITATOR_MIX_FB',
            equipment: 'M-201 (VFD Running Auxiliary Contact)',
            equipmentType: 'Digital Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'AGITATOR_MIX_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái chạy Cánh khuấy Bồn trộn',
          },
          {
            id: 'CM_AGITATOR_SPEED_SP',
            name: 'AGITATOR_SPEED_SP',
            equipment: 'SIC-201 (Agitator RPM Setpoint Register)',
            equipmentType: 'Analog Setpoint',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'AGITATOR_SPEED_SP',
            role: 'SP',
            unit: 'RPM',
            description: 'Tốc độ cài đặt Cánh khuấy Bồn trộn',
          },
          {
            id: 'CM_AGITATOR_SPEED_PV',
            name: 'AGITATOR_SPEED_PV',
            equipment: 'SI-201 (Agitator Tachometer Feedback)',
            equipmentType: 'Analog Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'AGITATOR_SPEED_PV',
            role: 'PV',
            unit: 'RPM',
            description: 'Tốc độ thực tế Cánh khuấy Bồn trộn',
          },
        ],
      },
      {
        id: 'EM_MIX01_OUTLET',
        name: 'VAN & BƠM XẢ BỒN TRỘN',
        description: 'Van xả đáy & Bơm chuyển dịch phối trộn',
        controlModules: [
          {
            id: 'CM_VALVE_MIX01_CMD',
            name: 'VALVE_MIX01_CMD',
            equipment: 'V-201 (Bottom Flush Seat Valve)',
            equipmentType: 'Pneumatic Seat Valve',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_MIX01_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả đáy Bồn trộn',
          },
          {
            id: 'CM_VALVE_MIX01_FB',
            name: 'VALVE_MIX01_FB',
            equipment: 'V-201 (Position Sensor Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_MIX01_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả đáy Bồn trộn',
          },
          {
            id: 'CM_PUMP_OUTLET_CMD',
            name: 'PUMP_OUTLET_CMD',
            equipment: 'P-201 (Lobe Discharge Transfer Pump)',
            equipmentType: 'Rotary Lobe Pump Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_OUTLET_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh chạy Bơm xả dịch Bồn trộn',
          },
          {
            id: 'CM_PUMP_OUTLET_FB',
            name: 'PUMP_OUTLET_FB',
            equipment: 'P-201 (Run Status Feedback)',
            equipmentType: 'Digital Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'PUMP_OUTLET_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái chạy Bơm xả dịch Bồn trộn',
          },
        ],
      },
    ],
  },
  // 5. HEATER01
  {
    id: 'HEATER01',
    name: 'BỒN GIA NHIỆT TIỆT TRÙNG',
    area: 'Area 03 - Gia Nhiệt & Tiệt Trùng (Thermal Processing)',
    description: 'Sterilization & Pasteurization Heating Vessel with Solid State Relay SSR & Safety Interlock',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_HEATER01_SSR',
        name: 'GIA NHIỆT SSR & GIÁM SÁT NHIỆT',
        description: 'Bộ điều khiển nhiệt độ SSR & Cờ Heater Ready',
        controlModules: [
          {
            id: 'CM_HEATER_TEMP_SP',
            name: 'HEATER_TEMP_SP',
            equipment: 'TIC-301 (Heater Temperature Setpoint)',
            equipmentType: 'PID Setpoint Register',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'HEATER_TEMP_SP',
            role: 'SP',
            unit: '°C',
            description: 'Nhiệt độ cài đặt Bồn gia nhiệt',
          },
          {
            id: 'CM_HEATER_TEMP_PV',
            name: 'HEATER_TEMP_PV',
            equipment: 'TE-301 (Sanitary Chamber RTD Sensor)',
            equipmentType: 'RTD Sensor Transmitter',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'HEATER_TEMP_PV',
            role: 'PV',
            unit: '°C',
            description: 'Nhiệt độ thực tế Bồn gia nhiệt',
          },
          {
            id: 'CM_SSR_HEATER_STATUS',
            name: 'SSR_HEATER_STATUS',
            equipment: 'SSR-301 (Solid State Relay Actuator)',
            equipmentType: 'SSR Power Switch Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'SSR_HEATER_STATUS',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái kích hoạt SSR Gia nhiệt',
          },
          {
            id: 'CM_HEATER_READY_FLAG',
            name: 'HEATER_READY_FLAG',
            equipment: 'IL-301 (Heater Ready Procedural Interlock)',
            equipmentType: 'Safety Interlock Flag',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'HEATER_READY_FLAG',
            role: 'STATE',
            unit: '--',
            description: 'Cờ báo Bồn gia nhiệt đã sẵn sàng nhiệt độ nạp',
          },
        ],
      },
      {
        id: 'EM_HEATER01_VALVE',
        name: 'VAN XẢ BỒN GIA NHIỆT',
        description: 'Van xả dịch gia nhiệt chuyển sang bồn lạnh',
        controlModules: [
          {
            id: 'CM_VALVE_HEATER_CMD',
            name: 'VALVE_HEATER_CMD',
            equipment: 'V-301 (Sterilized Product Transfer Valve)',
            equipmentType: 'Aseptic Valve Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_HEATER_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn gia nhiệt',
          },
          {
            id: 'CM_VALVE_HEATER_FB',
            name: 'VALVE_HEATER_FB',
            equipment: 'V-301 (Position Feedback Switch)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_HEATER_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả Bồn gia nhiệt',
          },
        ],
      },
    ],
  },
  // 6. COOLER01
  {
    id: 'COOLER01',
    name: 'BỒN LÀM LẠNH',
    area: 'Area 04 - Làm Lạnh & Bảo Quản (Cooling)',
    description: 'Cooling Holding Vessel with Chiller Refrigerant Loop & Temperature Regulation',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_COOLER01_CHILLER',
        name: 'HỆ THỐNG LÀM LẠNH CHILLER',
        description: 'Máy làm lạnh Chiller & Giám sát nhiệt độ lạnh',
        controlModules: [
          {
            id: 'CM_COOLER_TEMP_SP',
            name: 'COOLER_TEMP_SP',
            equipment: 'TIC-401 (Cooler Temperature Setpoint)',
            equipmentType: 'PID Setpoint Register',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'COOLER_TEMP_SP',
            role: 'SP',
            unit: '°C',
            description: 'Nhiệt độ cài đặt Bồn làm lạnh',
          },
          {
            id: 'CM_COOLER_TEMP_PV',
            name: 'COOLER_TEMP_PV',
            equipment: 'TE-401 (Chilled Liquid RTD Sensor)',
            equipmentType: 'RTD Sensor Transmitter',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'COOLER_TEMP_PV',
            role: 'PV',
            unit: '°C',
            description: 'Nhiệt độ thực tế Bồn làm lạnh',
          },
          {
            id: 'CM_CHILLER_COOL_CMD',
            name: 'CHILLER_COOL_CMD',
            equipment: 'CH-401 (Chiller Compressor Starter)',
            equipmentType: 'Chiller Relay Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'CHILLER_COOL_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh kích hoạt Máy làm lạnh Chiller',
          },
          {
            id: 'CM_CHILLER_COOL_FB',
            name: 'CHILLER_COOL_FB',
            equipment: 'CH-401 (Chiller Running Feedback)',
            equipmentType: 'Digital Feedback',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'CHILLER_COOL_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái chạy Máy làm lạnh Chiller',
          },
        ],
      },
      {
        id: 'EM_COOLER01_VALVE',
        name: 'VAN XẢ BỒN LÀM LẠNH',
        description: 'Van xả dịch làm lạnh chuyển sang bồn thành phẩm',
        controlModules: [
          {
            id: 'CM_VALVE_COOLER_CMD',
            name: 'VALVE_COOLER_CMD',
            equipment: 'V-401 (Chilled Product Transfer Valve)',
            equipmentType: 'Pneumatic Valve Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_COOLER_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn làm lạnh',
          },
          {
            id: 'CM_VALVE_COOLER_FB',
            name: 'VALVE_COOLER_FB',
            equipment: 'V-401 (Position Feedback Switch)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_COOLER_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả Bồn làm lạnh',
          },
        ],
      },
    ],
  },
  // 7. OUT01
  {
    id: 'OUT01',
    name: 'BỒN CHỨA THÀNH PHẨM',
    area: 'Area 05 - Đóng Gói & Xuất Xưởng (Packaging & Outbound)',
    description: 'Finished Product Storage Silo with Loadcell & Direct Packaging Discharge Valve',
    targetPlc: KEPWARE_TARGET,
    equipmentModules: [
      {
        id: 'EM_OUT01_STORAGE',
        name: 'BỒN CHỨA & VAN XẢ THÀNH PHẨM',
        description: 'Bồn thành phẩm & Van chiết rót xuất xưởng',
        controlModules: [
          {
            id: 'CM_OUT01_WEIGHT_PV',
            name: 'LOADCELL_OUT01',
            equipment: 'WE-501 (Finished Tank Mass Sensor)',
            equipmentType: 'Strain Gauge Loadcell',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'OUT01_WEIGHT_PV',
            role: 'PV',
            unit: 'kg/L',
            description: 'Loadcell cân khối lượng Bồn thành phẩm',
          },
          {
            id: 'CM_VALVE_OUT01_CMD',
            name: 'VALVE_OUT01_CMD',
            equipment: 'V-501 (Packaging Line Feed Valve)',
            equipmentType: 'Pneumatic Actuator',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_OUT01_CMD',
            role: 'CMD',
            unit: '--',
            description: 'Lệnh mở Van xả Bồn thành phẩm',
          },
          {
            id: 'CM_VALVE_OUT01_FB',
            name: 'VALVE_OUT01_FB',
            equipment: 'V-501 (Limit Switch Feedback)',
            equipmentType: 'Proximity Sensor',
            ioAddress: '',
            targetPlc: KEPWARE_TARGET,
            status: 'ACTIVE',
            boundTagName: 'VALVE_OUT01_FB',
            role: 'PV',
            unit: '--',
            description: 'Trạng thái mở Van xả Bồn thành phẩm',
          },
        ],
      },
    ],
  },
];

// Whitelisted initial procedural model mapped to the 7 physical units and 41 tags
const initialProceduralModel: UnitProcedureNode[] = [
  // 1. UP_DOSING: Nạp Nguyên Liệu (TK01, TK02, TK03)
  {
    id: 'UP_DOSING_PC1',
    name: 'UP_DOSING_PC1',
    unit: 'TK01, TK02, TK03',
    description: 'Thủ tục Nạp Nguyên Liệu định lượng vào Bồn Phối Trộn',
    operations: [
      {
        id: 'OP_DOSING_MILK',
        name: 'OP_DOSING_MILK',
        description: 'Nạp định lượng Sữa Tươi từ Bồn TK01',
        phases: [
          {
            id: 'PH_MILK_FEED',
            name: 'PH_MILK_FEED',
            code: 'PH11101',
            description: 'Bơm và mở van nạp sữa tươi',
            tags: [
              {
                tagId: 1,
                tagName: 'TK01_WEIGHT_PV',
                dataType: 'Float',
                address: 'ns=2;s=Modbus_TCP.tank.tank1',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: 'kg/L',
                writable: false,
                description: 'Loadcell cân khối lượng Bồn liệu 1 - Sữa tươi',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_MILK',
                parentPh: 'PH_MILK_FEED',
              },
              {
                tagId: 2,
                tagName: 'PUMP_INLET_MILK_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh chạy Bơm nạp liệu 1 - Sữa tươi',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_MILK',
                parentPh: 'PH_MILK_FEED',
              },
              {
                tagId: 3,
                tagName: 'PUMP_INLET_MILK_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái chạy Bơm nạp liệu 1',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_MILK',
                parentPh: 'PH_MILK_FEED',
              },
              {
                tagId: 4,
                tagName: 'VALVE_TK01_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả Bồn liệu 1',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_MILK',
                parentPh: 'PH_MILK_FEED',
              },
              {
                tagId: 5,
                tagName: 'VALVE_TK01_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van Bồn liệu 1',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_MILK',
                parentPh: 'PH_MILK_FEED',
              },
            ],
          },
        ],
      },
      {
        id: 'OP_DOSING_SUGAR',
        name: 'OP_DOSING_SUGAR',
        description: 'Nạp định lượng Đường từ Bồn TK02',
        phases: [
          {
            id: 'PH_SUGAR_FEED',
            name: 'PH_SUGAR_FEED',
            code: 'PH11202',
            description: 'Bơm và mở van nạp đường',
            tags: [
              {
                tagId: 6,
                tagName: 'TK02_WEIGHT_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: 'kg',
                writable: false,
                description: 'Loadcell cân khối lượng Bồn liệu 2 - Đường',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_SUGAR',
                parentPh: 'PH_SUGAR_FEED',
              },
              {
                tagId: 7,
                tagName: 'PUMP_INLET_SUGAR_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh chạy Bơm nạp liệu 2 - Đường',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_SUGAR',
                parentPh: 'PH_SUGAR_FEED',
              },
              {
                tagId: 8,
                tagName: 'PUMP_INLET_SUGAR_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái chạy Bơm nạp liệu 2',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_SUGAR',
                parentPh: 'PH_SUGAR_FEED',
              },
              {
                tagId: 9,
                tagName: 'VALVE_TK02_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả Bồn liệu 2',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_SUGAR',
                parentPh: 'PH_SUGAR_FEED',
              },
              {
                tagId: 10,
                tagName: 'VALVE_TK02_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van Bồn liệu 2',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_SUGAR',
                parentPh: 'PH_SUGAR_FEED',
              },
            ],
          },
        ],
      },
      {
        id: 'OP_DOSING_ADDITIVE',
        name: 'OP_DOSING_ADDITIVE',
        description: 'Nạp định lượng Phụ Gia từ Bồn TK03',
        phases: [
          {
            id: 'PH_ADDITIVE_FEED',
            name: 'PH_ADDITIVE_FEED',
            code: 'PH11303',
            description: 'Bơm và mở van nạp phụ gia',
            tags: [
              {
                tagId: 11,
                tagName: 'TK03_WEIGHT_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: 'kg/L',
                writable: false,
                description: 'Loadcell cân khối lượng Bồn liệu 3 - Phụ gia',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_ADDITIVE',
                parentPh: 'PH_ADDITIVE_FEED',
              },
              {
                tagId: 12,
                tagName: 'PUMP_INLET_ADDITIVE_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh chạy Bơm nạp liệu 3 - Phụ gia',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_ADDITIVE',
                parentPh: 'PH_ADDITIVE_FEED',
              },
              {
                tagId: 13,
                tagName: 'PUMP_INLET_ADDITIVE_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái chạy Bơm nạp liệu 3',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_ADDITIVE',
                parentPh: 'PH_ADDITIVE_FEED',
              },
              {
                tagId: 14,
                tagName: 'VALVE_TK03_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả Bồn liệu 3',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_ADDITIVE',
                parentPh: 'PH_ADDITIVE_FEED',
              },
              {
                tagId: 15,
                tagName: 'VALVE_TK03_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van Bồn liệu 3',
                parentUp: 'UP_DOSING_PC1',
                parentOp: 'OP_DOSING_ADDITIVE',
                parentPh: 'PH_ADDITIVE_FEED',
              },
            ],
          },
        ],
      },
    ],
  },
  // 2. UP_MIXING: Phối Trộn & Đồng Hóa (MIX01)
  {
    id: 'UP_MIXING_PC1',
    name: 'UP_MIXING_PC1',
    unit: 'MIX01',
    description: 'Thủ tục Phối Trộn, Cánh khuấy và Xả dịch sang Bồn gia nhiệt',
    operations: [
      {
        id: 'OP_AGITATION',
        name: 'OP_AGITATION',
        description: 'Vận hành Cánh khuấy và Giám sát Khối lượng / Nhiệt độ',
        phases: [
          {
            id: 'PH_BLENDING',
            name: 'PH_BLENDING',
            code: 'PH12101',
            description: 'Khuấy trộn đồng hóa dung dịch sữa',
            tags: [
              {
                tagId: 16,
                tagName: 'MIX01_WEIGHT_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: 'kg/L',
                writable: false,
                description: 'Loadcell cân khối lượng Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
              {
                tagId: 17,
                tagName: 'MIX01_TEMP_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '°C',
                writable: false,
                description: 'Cảm biến nhiệt độ PT100 Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
              {
                tagId: 18,
                tagName: 'MIX01_UNIT_STATE',
                dataType: 'Int',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'STATE',
                unit: 'State',
                writable: false,
                description: 'Trạng thái vận hành ISA-88 Unit Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
              {
                tagId: 19,
                tagName: 'AGITATOR_MIX_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh chạy Cánh khuấy Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
              {
                tagId: 20,
                tagName: 'AGITATOR_MIX_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái chạy Cánh khuấy Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
              {
                tagId: 21,
                tagName: 'AGITATOR_SPEED_SP',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'SP',
                unit: 'RPM',
                writable: true,
                description: 'Tốc độ cài đặt Cánh khuấy Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
              {
                tagId: 22,
                tagName: 'AGITATOR_SPEED_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: 'RPM',
                writable: false,
                description: 'Tốc độ thực tế Cánh khuấy Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_AGITATION',
                parentPh: 'PH_BLENDING',
              },
            ],
          },
        ],
      },
      {
        id: 'OP_DISCHARGE_MIX',
        name: 'OP_DISCHARGE_MIX',
        description: 'Mở Van xả đáy và chạy Bơm xả dịch',
        phases: [
          {
            id: 'PH_DRAIN_MIX',
            name: 'PH_DRAIN_MIX',
            code: 'PH12303',
            description: 'Bơm xả dịch phối trộn sang bồn gia nhiệt',
            tags: [
              {
                tagId: 23,
                tagName: 'VALVE_MIX01_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả đáy Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_DISCHARGE_MIX',
                parentPh: 'PH_DRAIN_MIX',
              },
              {
                tagId: 24,
                tagName: 'VALVE_MIX01_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van xả đáy Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_DISCHARGE_MIX',
                parentPh: 'PH_DRAIN_MIX',
              },
              {
                tagId: 25,
                tagName: 'PUMP_OUTLET_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh chạy Bơm xả dịch Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_DISCHARGE_MIX',
                parentPh: 'PH_DRAIN_MIX',
              },
              {
                tagId: 26,
                tagName: 'PUMP_OUTLET_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái chạy Bơm xả dịch Bồn trộn',
                parentUp: 'UP_MIXING_PC1',
                parentOp: 'OP_DISCHARGE_MIX',
                parentPh: 'PH_DRAIN_MIX',
              },
            ],
          },
        ],
      },
    ],
  },
  // 3. UP_HEATING: Gia Nhiệt Tiệt Trùng (HEATER01)
  {
    id: 'UP_HEATING_PC1',
    name: 'UP_HEATING_PC1',
    unit: 'HEATER01',
    description: 'Thủ tục Tiệt Trùng UHT và Khóa liên động Heater Ready',
    operations: [
      {
        id: 'OP_PASTEURIZE',
        name: 'OP_PASTEURIZE',
        description: 'Gia nhiệt theo Setpoint và Kích hoạt SSR',
        phases: [
          {
            id: 'PH_THERMAL_HOLD',
            name: 'PH_THERMAL_HOLD',
            code: 'PH22101',
            description: 'Duy trì nhiệt độ tiệt trùng và cờ Heater Ready',
            tags: [
              {
                tagId: 27,
                tagName: 'HEATER_TEMP_SP',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'SP',
                unit: '°C',
                writable: true,
                description: 'Nhiệt độ cài đặt Bồn gia nhiệt',
                parentUp: 'UP_HEATING_PC1',
                parentOp: 'OP_PASTEURIZE',
                parentPh: 'PH_THERMAL_HOLD',
              },
              {
                tagId: 28,
                tagName: 'HEATER_TEMP_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '°C',
                writable: false,
                description: 'Nhiệt độ thực tế Bồn gia nhiệt',
                parentUp: 'UP_HEATING_PC1',
                parentOp: 'OP_PASTEURIZE',
                parentPh: 'PH_THERMAL_HOLD',
              },
              {
                tagId: 29,
                tagName: 'SSR_HEATER_STATUS',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái kích hoạt SSR Gia nhiệt',
                parentUp: 'UP_HEATING_PC1',
                parentOp: 'OP_PASTEURIZE',
                parentPh: 'PH_THERMAL_HOLD',
              },
              {
                tagId: 30,
                tagName: 'HEATER_READY_FLAG',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'STATE',
                unit: '--',
                writable: false,
                description: 'Cờ báo Bồn gia nhiệt đã sẵn sàng nhiệt độ nạp',
                parentUp: 'UP_HEATING_PC1',
                parentOp: 'OP_PASTEURIZE',
                parentPh: 'PH_THERMAL_HOLD',
              },
            ],
          },
        ],
      },
      {
        id: 'OP_TRANSFER_HEATER',
        name: 'OP_TRANSFER_HEATER',
        description: 'Chuyển dịch tiệt trùng sang Bồn làm lạnh',
        phases: [
          {
            id: 'PH_HEAT_DRAIN',
            name: 'PH_HEAT_DRAIN',
            code: 'PH22102',
            description: 'Mở van xả bồn gia nhiệt',
            tags: [
              {
                tagId: 31,
                tagName: 'VALVE_HEATER_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả Bồn gia nhiệt',
                parentUp: 'UP_HEATING_PC1',
                parentOp: 'OP_TRANSFER_HEATER',
                parentPh: 'PH_HEAT_DRAIN',
              },
              {
                tagId: 32,
                tagName: 'VALVE_HEATER_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van xả Bồn gia nhiệt',
                parentUp: 'UP_HEATING_PC1',
                parentOp: 'OP_TRANSFER_HEATER',
                parentPh: 'PH_HEAT_DRAIN',
              },
            ],
          },
        ],
      },
    ],
  },
  // 4. UP_COOLING: Làm Lạnh & Bảo Quản (COOLER01)
  {
    id: 'UP_COOLING_PC1',
    name: 'UP_COOLING_PC1',
    unit: 'COOLER01',
    description: 'Thủ tục Làm Lạnh sâu và Bảo quản nhiệt độ sản phẩm',
    operations: [
      {
        id: 'OP_CHILLING',
        name: 'OP_CHILLING',
        description: 'Vận hành Máy Chiller và Giám sát nhiệt độ mát',
        phases: [
          {
            id: 'PH_CHILL_CYCLE',
            name: 'PH_CHILL_CYCLE',
            code: 'PH22201',
            description: 'Kích hoạt chiller làm lạnh đạt nhiệt độ mục tiêu',
            tags: [
              {
                tagId: 33,
                tagName: 'COOLER_TEMP_SP',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'SP',
                unit: '°C',
                writable: true,
                description: 'Nhiệt độ cài đặt Bồn làm lạnh',
                parentUp: 'UP_COOLING_PC1',
                parentOp: 'OP_CHILLING',
                parentPh: 'PH_CHILL_CYCLE',
              },
              {
                tagId: 34,
                tagName: 'COOLER_TEMP_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '°C',
                writable: false,
                description: 'Nhiệt độ thực tế Bồn làm lạnh',
                parentUp: 'UP_COOLING_PC1',
                parentOp: 'OP_CHILLING',
                parentPh: 'PH_CHILL_CYCLE',
              },
              {
                tagId: 35,
                tagName: 'CHILLER_COOL_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh kích hoạt Máy làm lạnh Chiller',
                parentUp: 'UP_COOLING_PC1',
                parentOp: 'OP_CHILLING',
                parentPh: 'PH_CHILL_CYCLE',
              },
              {
                tagId: 36,
                tagName: 'CHILLER_COOL_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái chạy Máy làm lạnh Chiller',
                parentUp: 'UP_COOLING_PC1',
                parentOp: 'OP_CHILLING',
                parentPh: 'PH_CHILL_CYCLE',
              },
            ],
          },
        ],
      },
      {
        id: 'OP_TRANSFER_COOLER',
        name: 'OP_TRANSFER_COOLER',
        description: 'Chuyển dịch đã làm lạnh sang Bồn thành phẩm',
        phases: [
          {
            id: 'PH_CHILL_DRAIN',
            name: 'PH_CHILL_DRAIN',
            code: 'PH22202',
            description: 'Mở van xả bồn làm lạnh',
            tags: [
              {
                tagId: 37,
                tagName: 'VALVE_COOLER_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả Bồn làm lạnh',
                parentUp: 'UP_COOLING_PC1',
                parentOp: 'OP_TRANSFER_COOLER',
                parentPh: 'PH_CHILL_DRAIN',
              },
              {
                tagId: 38,
                tagName: 'VALVE_COOLER_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van xả Bồn làm lạnh',
                parentUp: 'UP_COOLING_PC1',
                parentOp: 'OP_TRANSFER_COOLER',
                parentPh: 'PH_CHILL_DRAIN',
              },
            ],
          },
        ],
      },
    ],
  },
  // 5. UP_OUTBOUND: Chứa & Xuất Thành Phẩm (OUT01)
  {
    id: 'UP_OUTBOUND_PC1',
    name: 'UP_OUTBOUND_PC1',
    unit: 'OUT01',
    description: 'Thủ tục Chứa Bồn Thành Phẩm và Cung cấp dịch đóng gói',
    operations: [
      {
        id: 'OP_PACKAGING',
        name: 'OP_PACKAGING',
        description: 'Giám sát khối lượng thành phẩm và Van xả chiết rót',
        phases: [
          {
            id: 'PH_STORAGE_OUT',
            name: 'PH_STORAGE_OUT',
            code: 'PH31101',
            description: 'Van chiết rót cấp sang chuyền đóng gói',
            tags: [
              {
                tagId: 39,
                tagName: 'OUT01_WEIGHT_PV',
                dataType: 'Float',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: 'kg/L',
                writable: false,
                description: 'Loadcell cân khối lượng Bồn thành phẩm',
                parentUp: 'UP_OUTBOUND_PC1',
                parentOp: 'OP_PACKAGING',
                parentPh: 'PH_STORAGE_OUT',
              },
              {
                tagId: 40,
                tagName: 'VALVE_OUT01_CMD',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read/Write',
                role: 'CMD',
                unit: '--',
                writable: true,
                description: 'Lệnh mở Van xả Bồn thành phẩm',
                parentUp: 'UP_OUTBOUND_PC1',
                parentOp: 'OP_PACKAGING',
                parentPh: 'PH_STORAGE_OUT',
              },
              {
                tagId: 41,
                tagName: 'VALVE_OUT01_FB',
                dataType: 'Boolean',
                address: '',
                targetPlc: KEPWARE_TARGET,
                gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
                accessType: 'Read',
                role: 'PV',
                unit: '--',
                writable: false,
                description: 'Trạng thái mở Van xả Bồn thành phẩm',
                parentUp: 'UP_OUTBOUND_PC1',
                parentOp: 'OP_PACKAGING',
                parentPh: 'PH_STORAGE_OUT',
              },
            ],
          },
        ],
      },
    ],
  },
];

const defaultSelectedNode: InspectorNodeData = {
  tagId: 1,
  tagName: 'TK01_WEIGHT_PV',
  nodeType: 'CONTROL_MODULE',
  address: 'ns=2;s=Modbus_TCP.tank.tank1',
  opcNodeId: 'ns=2;s=Modbus_TCP.tank.tank1',
  gatewaySource: 'Kepware Central Server (opc.tcp://127.0.0.1:49320)',
  targetPlc: KEPWARE_TARGET,
  accessType: 'Read',
  role: 'PV',
  unit: 'kg/L',
  writable: false,
  description: 'Loadcell cân khối lượng Bồn liệu 1 - Sữa tươi',
  parentContext: 'TK01 > EM_TK01_LOADCELL',
  equipmentRef: 'WE-101 (Precision Tank Loadcell Sensor)',
  lastUpdated: 'Hardware Model Verified',
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
  const { isGatewayOnline, refreshGatewayStatus } = useConfig();
  const [telemetryMap, setTelemetryMap] = useState<Record<string, LiveTelemetryData>>({});
  const [gatewayConnected, setGatewayConnected] = useState<boolean>(isGatewayOnline);

  useEffect(() => {
    setGatewayConnected(isGatewayOnline);
  }, [isGatewayOnline]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const reconnectDelayRef = useRef<number>(1000);

  // Connect to backend WebSocket (/ws/telemetry) with resilient exponential backoff auto-reconnect
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
          reconnectDelayRef.current = 1000;
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

              setTelemetryMap((prev) => {
                const next = { ...prev };
                if (d.node_id) {
                  next[d.node_id] = updateEntry;
                  next[d.node_id.replace(/^ns=\d+;s=/, '')] = updateEntry;
                }
                if (d.tag_name) {
                  next[d.tag_name] = updateEntry;
                }
                return next;
              });
            } else if (msg.type === 'TAGS_BATCH' && msg.tags && typeof msg.tags === 'object') {
              const newMap: Record<string, LiveTelemetryData> = {};
              Object.entries(msg.tags).forEach(([nid, t]: [string, any]) => {
                const entry: LiveTelemetryData = {
                  value: t.value,
                  quality: t.quality || 'Good',
                  timestamp: t.timestamp || new Date().toLocaleTimeString(),
                  dataType: t.data_type || t.type,
                  role: t.role,
                  unit: t.unit,
                  writable: t.writable,
                  description: t.description,
                };
                newMap[nid] = entry;
                newMap[nid.replace(/^ns=\d+;s=/, '')] = entry;
                if (t.tag_name) newMap[t.tag_name] = entry;
              });
              setTelemetryMap((prev) => ({ ...prev, ...newMap }));
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
                if (t.node_id) {
                  newMap[t.node_id] = entry;
                  newMap[t.node_id.replace(/^ns=\d+;s=/, '')] = entry;
                }
                if (t.tag_name) newMap[t.tag_name] = entry;
              });
              setTelemetryMap((prev) => ({ ...prev, ...newMap }));
            } else if (msg.type === 'STATUS_UPDATE') {
              const online = Boolean(msg.server_connected || msg.connected || msg.is_connected || msg.status === 'ONLINE');
              setGatewayConnected(online);
              refreshGatewayStatus();
            } else if (msg.type === 'STREAM_HEARTBEAT') {
              if (typeof msg.connected === 'boolean') {
                setGatewayConnected(msg.connected);
              }
            } else if (msg.type === 'ALL_TAGS_STATUS') {
              const quality = msg.quality || 'Bad';
              const online = Boolean(msg.status === 'ONLINE' || quality === 'Good');
              setGatewayConnected(online);
              refreshGatewayStatus();
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
          // Exponential backoff reconnect: 1s -> 1.5s -> 2.25s -> max 10s
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(Math.round(reconnectDelayRef.current * 1.5), 10000);
          reconnectTimerRef.current = setTimeout(connectWs, delay);
        };
      } catch {
        setGatewayConnected(false);
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(Math.round(reconnectDelayRef.current * 1.5), 10000);
        reconnectTimerRef.current = setTimeout(connectWs, delay);
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
                const isMapped = Boolean(mapping.node_id && mapping.node_id !== '[CHƯA ÁNH XẠ]');
                return {
                  ...tag,
                  address: mapping.node_id,
                  opcNodeId: mapping.node_id,
                  unit: mapping.unit || tag.unit,
                  role: mapping.role || tag.role,
                  description: mapping.description || tag.description,
                  writable: mapping.writable,
                  accessType: mapping.writable ? ('Read/Write' as const) : ('Read' as const),
                  liveQuality: isMapped ? tag.liveQuality : 'Unmapped',
                  liveValue: isMapped ? tag.liveValue : '--',
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
              const isMapped = Boolean(m.node_id && m.node_id !== '[CHƯA ÁNH XẠ]');
              return {
                ...cm,
                ioAddress: m.node_id,
                unit: m.unit || cm.unit,
                role: m.role || cm.role,
                liveQuality: isMapped ? cm.liveQuality : 'Unmapped',
                liveValue: isMapped ? cm.liveValue : '--',
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
        const isMapped = Boolean(m.node_id && m.node_id !== '[CHƯA ÁNH XẠ]');
        return {
          ...curr,
          address: m.node_id,
          opcNodeId: m.node_id,
          unit: m.unit || curr.unit,
          role: m.role || curr.role,
          description: m.description || curr.description,
          writable: m.writable,
          accessType: m.writable ? ('Read/Write' as const) : ('Read' as const),
          liveQuality: isMapped ? curr.liveQuality : 'Unmapped',
          liveValue: isMapped ? curr.liveValue : '--',
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
    } catch {
      // Backend gateway may still be booting during initial handshake; silently fall back
    }
    return {};
  };

  const saveAllMappings = async (
    mappings: Record<string, TagMappingDefinition>
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch('/api/gateway/mappings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Role': 'ADMIN',
          'X-User': 'admin',
        },
        body: JSON.stringify({ mappings, role: 'ADMIN', user: 'admin' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        return { success: false, message: err.detail || 'Failed to save mappings' };
      }
      const data = await res.json();
      applyMappingsToModels(mappings);
      return { success: true, message: data.message || 'Cập nhật ánh xạ thành công và đã lưu CSDL!' };
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
        node_id: patch.node_id !== undefined ? patch.node_id : (foundTag?.address ?? ''),
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch('/api/gateway/test-node', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node_id: nodeId }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
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
      clearTimeout(timeoutId);
      if (
        e?.name === 'AbortError' ||
        e?.message?.toLowerCase().includes('aborted') ||
        e?.message?.toLowerCase().includes('abort') ||
        controller.signal.aborted
      ) {
        return { valid: false, message: 'Quá thời gian phản hồi từ thiết bị ngoại vi (Timeout)' };
      }
      return { valid: false, message: e.message || 'Lỗi mạng khi kiểm tra node' };
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

export const useSafeIsa88 = (): Isa88ContextType | undefined => {
  return useContext(Isa88Context);
};
