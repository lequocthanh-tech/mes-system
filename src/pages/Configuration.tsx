/* Hallmark · component: Configuration · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { SystemConfigView } from '../views/SystemConfigView';
import { useConfig } from '../context/ConfigContext';

export const Configuration: React.FC = () => {
  const { gatewayStatus: statusData } = useConfig();
  const isOnline = Boolean(statusData?.is_connected || statusData?.connected || statusData?.status === "ONLINE");

  return <SystemConfigView isGatewayOnline={isOnline} />;
};

export default Configuration;
