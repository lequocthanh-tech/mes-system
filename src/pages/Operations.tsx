/* Hallmark · component: OperationsPage · genre: modern-minimal · register: industrial-workbench
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { OperationsView } from '../views/OperationsView';
import { useOeeSummary } from '../hooks/useOeeSummary';

export const Operations: React.FC = () => {
  // Shared OEE calculation engine hook (poll interval: 2.5s)
  // Extracts overall_oee, availability, performance, quality_rate, shift_output_volume, shift_target_volume, active_batches
  const oeeSummary = useOeeSummary({ pollIntervalMs: 2500 });

  return <OperationsView oeeSummary={oeeSummary} />;
};

export default Operations;
