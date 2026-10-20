/* Hallmark · component: ConfigurationPage · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { SystemConfigView } from '../views/SystemConfigView';
import { useConfig } from '../context/ConfigContext';

export const ConfigurationPage: React.FC = () => {
  const { gatewayStatus: statusData } = useConfig();
  const isOnline = Boolean(statusData?.is_connected || statusData?.connected || statusData?.status === "ONLINE");

  return <SystemConfigView isGatewayOnline={isOnline} />;
};

export default ConfigurationPage;
