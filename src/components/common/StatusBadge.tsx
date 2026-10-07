/* Hallmark · component: StatusBadge · genre: modern-minimal · register: industrial-workbench
 * states: default · active
 * contrast: WCAG AA Pass
 */

import React from 'react';
import { ConnectionState } from '../../types/config';

interface StatusBadgeProps {
  status: ConnectionState;
  connectedLabel?: string;
  disconnectedLabel?: string;
  connectingLabel?: string;
  errorLabel?: string;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  connectedLabel = 'CONNECTED',
  disconnectedLabel = 'DISCONNECTED',
  connectingLabel = 'CONNECTING...',
  errorLabel = 'FAULT / ERROR',
  showDot = true,
  size = 'md',
}) => {
  let badgeStyles = 'bg-slate-100 text-slate-600 border-slate-300';
  let dotStyles = 'bg-slate-400';
  let label = disconnectedLabel;

  if (status === 'connected') {
    // ISA-101: Green strictly reserved for active/connected state
    badgeStyles = 'bg-emerald-50 text-emerald-800 border-emerald-300';
    dotStyles = 'bg-emerald-600';
    label = connectedLabel;
  } else if (status === 'connecting') {
    badgeStyles = 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse';
    dotStyles = 'bg-amber-500';
    label = connectingLabel;
  } else if (status === 'error') {
    // ISA-101: Red reserved for alarms/faults/unhealthy connection
    badgeStyles = 'bg-rose-50 text-rose-800 border-rose-300';
    dotStyles = 'bg-rose-600';
    label = errorLabel;
  } else {
    // Disconnected (Strictly Red badge / Offline per ISA-101 requirement)
    badgeStyles = 'bg-rose-50 text-rose-800 border-rose-300';
    dotStyles = 'bg-rose-600';
    label = disconnectedLabel;
  }

  const sizeStyles = {
    sm: 'text-xs px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1 tracking-wider',
    lg: 'text-sm px-3.5 py-1.5 tracking-wide',
  }[size];

  return (
    <span
      className={`inline-flex items-center font-mono font-medium rounded-xs border uppercase ${sizeStyles} ${badgeStyles}`}
      role="status"
    >
      {showDot && (
        <span
          className={`inline-block w-2 h-2 rounded-full mr-1.5 shrink-0 ${dotStyles} ${
            status === 'connecting' ? 'animate-ping' : ''
          }`}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
};

export default StatusBadge;
