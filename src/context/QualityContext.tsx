/* Hallmark · component: QualityContext · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  BatchQualityRecord, 
  BatchQualityDetailItem, 
  QualityToleranceRule,
  BatchDisposition,
  CapaTicket
} from '../types/quality';
import * as api from '../services/api';

export type QualitySubTab = 'overview' | 'detail' | 'summary' | 'config';

interface QualityContextType {
  batchRecords: BatchQualityRecord[];
  selectedReportId: number;
  setSelectedReportId: (id: number) => void;
  selectedBatch: BatchQualityRecord | undefined;
  activeSubTab: QualitySubTab;
  setActiveSubTab: (tab: QualitySubTab) => void;
  viewBatchDetail: (reportId: number) => void;

  // Detail inspection
  currentBatchDetails: BatchQualityDetailItem[];
  hasCriticalFailure: boolean;

  // QA Batch Disposition Workflow
  dispositionBatch: (reportId: number, disposition: BatchDisposition, notes: string) => { success: boolean; message: string };

  // Tolerance Configuration
  toleranceRules: QualityToleranceRule[];
  updateToleranceRule: (id: string, tol: number, isCritical: boolean) => boolean;

  // CAPA Ticket
  activeCapaTicket: CapaTicket;
  resolveCapaTicket: (ticketId: string) => void;

  // Date range filter
  fromDate: string;
  setFromDate: (d: string) => void;
  toDate: string;
  setToDate: (d: string) => void;
  applyDateFilter: () => void;
  filteredBatchRecords: BatchQualityRecord[];
}

const initialBatchRecords: BatchQualityRecord[] = [
  {
    reportId: 10,
    reportCode: 'QAR-2026-010',
    orderId: 'WO-2026-001',
    recipeId: 'RCP-MILK-UHT-01',
    recipeName: 'Fresh Pasteurized UHT Milk',
    recipeVersion: 'v1.2',
    startTime: '2026-09-07 08:00 AM',
    endTime: '2026-09-07 08:45 AM',
    totalProduced: 1000,
    status: 'FAIL',
    disposition: 'QUARANTINED',
    avgError: 5.2,
    checkedAt: '2026-09-07 08:46 AM',
    reviewerNotes: 'Thermal sterilization cycle suffered heater element fluctuation at 08:24 AM, holding at 131.5°C instead of required 138.0°C. Critical Control Point CCP-1 failed.',
    failingParameter: 'PH_HEATING (-4.71% deviation)',
  },
  {
    reportId: 9,
    reportCode: 'QAR-2026-009',
    orderId: 'WO-2026-002',
    recipeId: 'RCP-MILK-UHT-01',
    recipeName: 'Fresh Pasteurized UHT Milk',
    recipeVersion: 'v1.2',
    startTime: '2026-09-06 02:15 PM',
    endTime: '2026-09-06 03:00 PM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.4,
    checkedAt: '2026-09-06 03:01 PM',
    reviewerNotes: 'Batch fully compliant with ISO 22000 and HACCP specifications. All critical control points within tolerance bands.',
  },
  {
    reportId: 8,
    reportCode: 'QAR-2026-008',
    orderId: 'WO-2026-003',
    recipeId: 'RCP-CHOCO-02',
    recipeName: 'Chocolate Flavored Dairy',
    recipeVersion: 'v1.0',
    startTime: '2026-09-06 09:30 AM',
    endTime: '2026-09-06 10:15 AM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.6,
    checkedAt: '2026-09-06 10:16 AM',
    reviewerNotes: 'Viscosity and sweetness profile compliant. Quality certificate issued.',
  },
  {
    reportId: 7,
    reportCode: 'QAR-2026-007',
    orderId: 'WO-2026-004',
    recipeId: 'RCP-MILK-UHT-01',
    recipeName: 'Fresh Pasteurized UHT Milk',
    recipeVersion: 'v1.2',
    startTime: '2026-09-05 03:00 PM',
    endTime: '2026-09-05 03:45 PM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.3,
    checkedAt: '2026-09-05 03:46 PM',
    reviewerNotes: 'Microbiological hold clear. Automated packaging authorized.',
  },
  {
    reportId: 6,
    reportCode: 'QAR-2026-006',
    orderId: 'WO-2026-005',
    recipeId: 'RCP-CHOCO-02',
    recipeName: 'Chocolate Flavored Dairy',
    recipeVersion: 'v1.0',
    startTime: '2026-09-05 10:00 AM',
    endTime: '2026-09-05 10:45 AM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.5,
    checkedAt: '2026-09-05 10:46 AM',
    reviewerNotes: 'Routine QC inspection complete. All parameters green.',
  },
  {
    reportId: 5,
    reportCode: 'QAR-2026-005',
    orderId: 'WO-2026-006',
    recipeId: 'RCP-MILK-UHT-01',
    recipeName: 'Fresh Pasteurized UHT Milk',
    recipeVersion: 'v1.2',
    startTime: '2026-09-04 01:30 PM',
    endTime: '2026-09-04 02:15 PM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.7,
    checkedAt: '2026-09-04 02:16 PM',
    reviewerNotes: 'Standard release for retail distribution.',
  },
  {
    reportId: 4,
    reportCode: 'QAR-2026-004',
    orderId: 'WO-2026-007',
    recipeId: 'RCP-CHOCO-02',
    recipeName: 'Chocolate Flavored Dairy',
    recipeVersion: 'v1.0',
    startTime: '2026-09-04 08:30 AM',
    endTime: '2026-09-04 09:15 AM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.4,
    checkedAt: '2026-09-04 09:16 AM',
    reviewerNotes: 'All critical sensors in conformity.',
  },
  {
    reportId: 3,
    reportCode: 'QAR-2026-003',
    orderId: 'WO-2026-008',
    recipeId: 'RCP-MILK-UHT-01',
    recipeName: 'Fresh Pasteurized UHT Milk',
    recipeVersion: 'v1.2',
    startTime: '2026-09-03 02:00 PM',
    endTime: '2026-09-03 02:45 PM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.5,
    checkedAt: '2026-09-03 02:46 PM',
    reviewerNotes: 'Quality verified against national dairy standards.',
  },
  {
    reportId: 2,
    reportCode: 'QAR-2026-002',
    orderId: 'WO-2026-009',
    recipeId: 'RCP-CHOCO-02',
    recipeName: 'Chocolate Flavored Dairy',
    recipeVersion: 'v1.0',
    startTime: '2026-09-03 09:00 AM',
    endTime: '2026-09-03 09:45 AM',
    totalProduced: 1000,
    status: 'PASS',
    disposition: 'RELEASED',
    avgError: 0.3,
    checkedAt: '2026-09-03 09:46 AM',
    reviewerNotes: 'Verified clean run.',
  },
];

const batchDetailsDatabase: Record<number, BatchQualityDetailItem[]> = {
  10: [
    {
      qualityId: 1,
      reportId: 10,
      phaseId: 'PH_DISP_RAW',
      parameterName: 'Raw Milk Dispensing',
      unit: 'L',
      setValue: 5000.0,
      actualValue: 5002.5,
      diffPercent: 0.05,
      tolerancePercent: 0.5,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
    {
      qualityId: 2,
      reportId: 10,
      phaseId: 'PH_DISP_SUGAR',
      parameterName: 'Sugar Dispensing',
      unit: 'kg',
      setValue: 350.0,
      actualValue: 350.8,
      diffPercent: 0.23,
      tolerancePercent: 1.0,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
    {
      qualityId: 3,
      reportId: 10,
      phaseId: 'PH_MIXING',
      parameterName: 'Agitation Speed',
      unit: 'RPM',
      setValue: 45.0,
      actualValue: 44.8,
      diffPercent: -0.44,
      tolerancePercent: 2.0,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
    {
      qualityId: 4,
      reportId: 10,
      phaseId: 'PH_HEATING',
      parameterName: 'Sterilization Temp (CCP-1)',
      unit: '°C',
      setValue: 138.0,
      actualValue: 131.5,
      diffPercent: -4.71,
      tolerancePercent: 1.0,
      result: 'FAIL',
      isCritical: true,
      haccpCategory: 'CRITICAL (CCP)',
    },
    {
      qualityId: 5,
      reportId: 10,
      phaseId: 'PH_COOLING',
      parameterName: 'Aseptic Storage Temp',
      unit: '°C',
      setValue: 4.0,
      actualValue: 4.1,
      diffPercent: 2.50,
      tolerancePercent: 5.0,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
  ],
  9: [
    {
      qualityId: 1,
      reportId: 9,
      phaseId: 'PH_DISP_RAW',
      parameterName: 'Raw Milk Dispensing',
      unit: 'L',
      setValue: 5000.0,
      actualValue: 5001.2,
      diffPercent: 0.02,
      tolerancePercent: 0.5,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
    {
      qualityId: 2,
      reportId: 9,
      phaseId: 'PH_DISP_SUGAR',
      parameterName: 'Sugar Dispensing',
      unit: 'kg',
      setValue: 350.0,
      actualValue: 350.2,
      diffPercent: 0.06,
      tolerancePercent: 1.0,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
    {
      qualityId: 3,
      reportId: 9,
      phaseId: 'PH_MIXING',
      parameterName: 'Agitation Speed',
      unit: 'RPM',
      setValue: 45.0,
      actualValue: 45.1,
      diffPercent: 0.22,
      tolerancePercent: 2.0,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
    {
      qualityId: 4,
      reportId: 9,
      phaseId: 'PH_HEATING',
      parameterName: 'Sterilization Temp (CCP-1)',
      unit: '°C',
      setValue: 138.0,
      actualValue: 138.2,
      diffPercent: 0.14,
      tolerancePercent: 1.0,
      result: 'PASS',
      isCritical: true,
      haccpCategory: 'CRITICAL (CCP)',
    },
    {
      qualityId: 5,
      reportId: 9,
      phaseId: 'PH_COOLING',
      parameterName: 'Aseptic Storage Temp',
      unit: '°C',
      setValue: 4.0,
      actualValue: 4.0,
      diffPercent: 0.00,
      tolerancePercent: 5.0,
      result: 'PASS',
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY',
    },
  ],
};

const initialToleranceRules: QualityToleranceRule[] = [
  {
    id: 'tol_1',
    phaseId: 'PH_DISP_RAW',
    parameterName: 'Raw Milk Dispensing',
    targetUnit: 'Liters (L)',
    standardTolerance: 0.5,
    isCritical: false,
    haccpCategory: 'STANDARD QUALITY',
    description: 'Bulk raw milk intake volumetric dispensing tolerance',
  },
  {
    id: 'tol_2',
    phaseId: 'PH_DISP_SUGAR',
    parameterName: 'Sugar Dispensing',
    targetUnit: 'Kilograms (kg)',
    standardTolerance: 1.0,
    isCritical: false,
    haccpCategory: 'STANDARD QUALITY',
    description: 'Sucrose / syrup granular gravimetric dosing tolerance',
  },
  {
    id: 'tol_3',
    phaseId: 'PH_MIXING',
    parameterName: 'Agitation Speed',
    targetUnit: 'Revolutions / Min (RPM)',
    standardTolerance: 2.0,
    isCritical: false,
    haccpCategory: 'STANDARD QUALITY',
    description: 'Mixing tank impeller agitation rate for homogeneous dispersion',
  },
  {
    id: 'tol_4',
    phaseId: 'PH_HEATING',
    parameterName: 'Sterilization Temp (CCP-1)',
    targetUnit: 'Celsius (°C)',
    standardTolerance: 1.0,
    isCritical: true,
    haccpCategory: 'CRITICAL (CCP)',
    description: 'Ultra-high temperature pasteurization thermal destruction limit (Critical Control Point CCP-1)',
  },
  {
    id: 'tol_5',
    phaseId: 'PH_COOLING',
    parameterName: 'Aseptic Storage Temp',
    targetUnit: 'Celsius (°C)',
    standardTolerance: 5.0,
    isCritical: false,
    haccpCategory: 'STANDARD QUALITY',
    description: 'Post-sterilization aseptic cooling & jacket chilling control',
  },
];

const initialCapaTicket: CapaTicket = {
  ticketId: '#CAPA-101',
  title: 'Sterilization Loop H-201 Thermal Droop',
  orderId: 'WO-2026-001',
  reportCode: 'QAR-2026-010',
  severity: 'CRITICAL',
  rootCause: 'Heating resistor loop H-201 experienced SCR controller droop at 08:24 AM during pre-sterilize ramp, holding at 131.5°C instead of required 138.0°C.',
  correctiveAction: 'Generate Maintenance Work Order WO-MAINT-402 to recalibrate TC-201 temperature transmitter and inspect SCR firing card before re-authorizing Line 01.',
  assignedModule: 'Equipment & Maintenance (Module 07)',
  status: 'OPEN',
  createdAt: '2026-09-07 08:50 AM',
};

const QualityContext = createContext<QualityContextType | undefined>(undefined);

export const QualityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [batchRecords, setBatchRecords] = useState<BatchQualityRecord[]>(initialBatchRecords);
  const [selectedReportId, setSelectedReportId] = useState<number>(10);
  const [activeSubTab, setActiveSubTab] = useState<QualitySubTab>('overview');
  const [toleranceRules, setToleranceRules] = useState<QualityToleranceRule[]>(initialToleranceRules);
  const [activeCapaTicket, setActiveCapaTicket] = useState<CapaTicket>(initialCapaTicket);

  const [fromDate, setFromDate] = useState<string>('2026-09-01');
  const [toDate, setToDate] = useState<string>('2026-09-08');
  const [appliedFilter, setAppliedFilter] = useState<{ from: string; to: string }>({
    from: '2026-09-01',
    to: '2026-09-08',
  });

  const fetchLiveReports = async () => {
    try {
      const liveReports = await api.getReports();
      if (liveReports && liveReports.length > 0) {
        const formatted: BatchQualityRecord[] = liveReports.map((r: any, idx: number) => ({
          reportId: r.Report_ID || (idx + 1),
          reportCode: r.ReportCode || `QAR-${r.Report_ID || idx + 1}`,
          orderId: r.OrderCode || 'WO-UNKNOWN',
          recipeId: 'RCP-01',
          recipeName: r.RecipeApplied || 'Fresh Pasteurized UHT Milk',
          recipeVersion: 'v1.2',
          startTime: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
          endTime: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
          totalProduced: Number(r.TotalProduced || 1000),
          status: (r.QualityStatus === 'CONFORMING' || r.QualityStatus === 'PASS') ? 'PASS' : 'FAIL',
          disposition: (r.DispositionAction || 'RELEASED') as any,
          avgError: Number(r.AvgDeviationPercent || 0.35),
          checkedAt: r.CreatedTime ? String(r.CreatedTime).replace('T', ' ').substring(0, 16) : '---',
          reviewerNotes: `Sign-off: ${r.SignOffBy || 'Lead QA Specialist'}. SQL Server verified.`,
        }));
        setBatchRecords(formatted);
        setSelectedReportId(formatted[0].reportId);
      }
    } catch (err) {
      console.debug('[QualityContext] Loading reports error:', err);
    }
  };

  useEffect(() => {
    fetchLiveReports();
  }, []);

  const selectedBatch = batchRecords.find((b) => b.reportId === selectedReportId) || batchRecords[0];

  // Dynamically resolve details for selected batch
  const currentBatchDetails = batchDetailsDatabase[selectedReportId] || [
    {
      qualityId: 1,
      reportId: selectedReportId,
      phaseId: 'PH_DISP_RAW',
      parameterName: 'Raw Milk Dispensing',
      unit: 'L',
      setValue: 5000.0,
      actualValue: 5001.0,
      diffPercent: 0.02,
      tolerancePercent: 0.5,
      result: 'PASS' as const,
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY' as const,
    },
    {
      qualityId: 2,
      reportId: selectedReportId,
      phaseId: 'PH_DISP_SUGAR',
      parameterName: 'Sugar Dispensing',
      unit: 'kg',
      setValue: 350.0,
      actualValue: 350.3,
      diffPercent: 0.09,
      tolerancePercent: 1.0,
      result: 'PASS' as const,
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY' as const,
    },
    {
      qualityId: 3,
      reportId: selectedReportId,
      phaseId: 'PH_MIXING',
      parameterName: 'Agitation Speed',
      unit: 'RPM',
      setValue: 45.0,
      actualValue: 45.0,
      diffPercent: 0.00,
      tolerancePercent: 2.0,
      result: 'PASS' as const,
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY' as const,
    },
    {
      qualityId: 4,
      reportId: selectedReportId,
      phaseId: 'PH_HEATING',
      parameterName: 'Sterilization Temp (CCP-1)',
      unit: '°C',
      setValue: 138.0,
      actualValue: 138.1,
      diffPercent: 0.07,
      tolerancePercent: 1.0,
      result: 'PASS' as const,
      isCritical: true,
      haccpCategory: 'CRITICAL (CCP)' as const,
    },
    {
      qualityId: 5,
      reportId: selectedReportId,
      phaseId: 'PH_COOLING',
      parameterName: 'Aseptic Storage Temp',
      unit: '°C',
      setValue: 4.0,
      actualValue: 4.0,
      diffPercent: 0.00,
      tolerancePercent: 5.0,
      result: 'PASS' as const,
      isCritical: false,
      haccpCategory: 'STANDARD QUALITY' as const,
    },
  ];

  // Critical CCP Failure Detection
  const hasCriticalFailure = currentBatchDetails.some(
    (item) => item.isCritical && item.result === 'FAIL'
  );

  const viewBatchDetail = (reportId: number) => {
    setSelectedReportId(reportId);
    setActiveSubTab('detail');
  };

  const applyDateFilter = () => {
    setAppliedFilter({ from: fromDate, to: toDate });
  };

  const filteredBatchRecords = batchRecords.filter((b) => {
    if (!appliedFilter.from && !appliedFilter.to) return true;
    const batchDateStr = b.startTime.split(' ')[0];
    if (appliedFilter.from && batchDateStr < appliedFilter.from) return false;
    if (appliedFilter.to && batchDateStr > appliedFilter.to) return false;
    return true;
  });

  const updateToleranceRule = (id: string, tol: number, isCritical: boolean): boolean => {
    setToleranceRules((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              standardTolerance: tol,
              isCritical,
              haccpCategory: isCritical ? 'CRITICAL (CCP)' : 'STANDARD QUALITY',
            }
          : r
      )
    );
    return true;
  };

  const dispositionBatch = (
    reportId: number,
    disposition: BatchDisposition,
    notes: string
  ): { success: boolean; message: string } => {
    // Critical HACCP / ISO 22000 Security Interlock Rule
    if (disposition === 'RELEASED') {
      const details = batchDetailsDatabase[reportId] || currentBatchDetails;
      const criticalFail = details.some((item) => item.isCritical && item.result === 'FAIL');
      if (criticalFail) {
        return {
          success: false,
          message: 'CRITICAL HACCP VIOLATION: Batch cannot be released while Critical Control Point (CCP) parameters are in breach.',
        };
      }
    }

    setBatchRecords((prev) =>
      prev.map((b) =>
        b.reportId === reportId
          ? {
              ...b,
              disposition,
              status: disposition === 'RELEASED' ? 'PASS' : disposition === 'QUARANTINED' ? 'FAIL' : b.status,
              reviewerNotes: notes,
            }
          : b
      )
    );

    return {
      success: true,
      message: `Batch #${reportId} disposition updated to ${disposition}.`,
    };
  };

  const resolveCapaTicket = (ticketId: string) => {
    setActiveCapaTicket((prev) =>
      prev.ticketId === ticketId ? { ...prev, status: 'RESOLVED' } : prev
    );
  };

  return (
    <QualityContext.Provider
      value={{
        batchRecords,
        selectedReportId,
        setSelectedReportId,
        selectedBatch,
        activeSubTab,
        setActiveSubTab,
        viewBatchDetail,
        currentBatchDetails,
        hasCriticalFailure,
        dispositionBatch,
        toleranceRules,
        updateToleranceRule,
        activeCapaTicket,
        resolveCapaTicket,
        fromDate,
        setFromDate,
        toDate,
        setToDate,
        applyDateFilter,
        filteredBatchRecords,
      }}
    >
      {children}
    </QualityContext.Provider>
  );
};

export const useQuality = (): QualityContextType => {
  const context = useContext(QualityContext);
  if (!context) {
    throw new Error('useQuality must be used within a QualityProvider');
  }
  return context;
};
