/* Hallmark · component: QualityTypes · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

export type BatchQualityStatus = 'PASS' | 'FAIL' | 'PENDING_REVIEW';
export type BatchDisposition = 'RELEASED' | 'QUARANTINED' | 'PENDING_REVIEW';

export interface BatchQualityRecord {
  reportId: number;
  reportCode: string;       // e.g. "QAR-2026-010"
  orderId: string;          // e.g. "WO-2026-001"
  recipeId: string;         // e.g. "RCP-MILK-UHT-01"
  recipeName: string;       // e.g. "Fresh Pasteurized UHT Milk"
  recipeVersion: string;    // e.g. "v1.2"
  startTime: string;
  endTime: string;
  totalProduced: number;
  status: BatchQualityStatus;
  disposition: BatchDisposition;
  avgError: number;
  checkedAt: string;
  reviewerNotes?: string;
  failingParameter?: string;
}

export interface BatchQualityDetailItem {
  qualityId: number;
  reportId: number;
  phaseId: string;          // e.g. "PH_SUPPLYMILK", "PH_HEATING"
  parameterName: string;    // e.g. "Raw Milk Intake", "Sterilization Temp (CCP-1)"
  unit: string;             // e.g. "L", "kg", "°C"
  setValue: number;
  actualValue: number;
  diffPercent: number;
  tolerancePercent: number;
  result: BatchQualityStatus;
  isCritical: boolean;      // HACCP Critical Control Point
  haccpCategory?: 'CRITICAL (CCP)' | 'STANDARD QUALITY';
}

export interface QualityToleranceRule {
  id: string;
  phaseId: string;
  parameterName: string;
  targetUnit: string;
  standardTolerance: number;
  isCritical: boolean;
  haccpCategory: 'CRITICAL (CCP)' | 'STANDARD QUALITY';
  description: string;
}

export interface CapaTicket {
  ticketId: string;
  title: string;
  orderId: string;
  reportCode: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  rootCause: string;
  correctiveAction: string;
  assignedModule: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
  createdAt: string;
}
