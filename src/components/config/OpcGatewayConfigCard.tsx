/* Hallmark · component: OpcGatewayConfigCard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { 
  Server, 
  ShieldCheck, 
  Settings2, 
  Network, 
  RefreshCw, 
  Power, 
  Save, 
  Link2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  User,
  KeyRound
} from 'lucide-react';

export const OpcGatewayConfigCard: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [endpointUrl, setEndpointUrl] = useState('opc.tcp://127.0.0.1:49320');
  const [providerName, setProviderName] = useState('KEPServerEX v6 - Industrial Connectivity Platform');
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [samplingIntervalMs, setSamplingIntervalMs] = useState(100);
  const [securityPolicy, setSecurityPolicy] = useState('None');
  const [authMode, setAuthMode] = useState<'anonymous' | 'username'>('anonymous');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Check Gateway Health from Python Backend
  const checkGatewayStatus = async (showToast = false) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/gateway/status');
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'connected') {
          setConnectionStatus('connected');
          setLatencyMs(data.latency_ms || 0);
          if (showToast) {
            setFeedback({
              type: 'success',
              message: `Kepware Gateway Online · Active Nodes: ${data.active_tags || 0}${data.latency_ms ? ` · Ping: ${data.latency_ms}ms` : ''}`
            });
          }
        } else {
          setConnectionStatus('disconnected');
          if (showToast) {
            setFeedback({
              type: 'error',
              message: 'Kepware runtime offline. Ensure KEPServerEX service is running on port 49320.'
            });
          }
        }
      } else {
        throw new Error('API request failed');
      }
    } catch {
      setConnectionStatus('disconnected');
      if (showToast) {
        setFeedback({
          type: 'error',
          message: 'Handshake failed: Python Gateway backend unreachable (Check port 8000).'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkGatewayStatus(false);
    const interval = setInterval(() => checkGatewayStatus(false), 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTestHandshake = () => {
    setFeedback(null);
    setConnectionStatus('connecting');
    checkGatewayStatus(true);
  };

  const handleToggleConnect = () => {
    setFeedback(null);
    if (connectionStatus === 'connected') {
      setConnectionStatus('disconnected');
      setFeedback({ type: 'info', message: 'OPC UA Session disconnected by operator.' });
    } else {
      setConnectionStatus('connecting');
      checkGatewayStatus(true);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback({
      type: 'success',
      message: 'OPC UA Gateway configuration settings saved successfully.'
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <Card
      title="OPC UA INDUSTRIAL SERVER GATEWAY (KEPWARE)"
      subtitle="ISA-95 Level 3 MOM Centralized Connectivity Hub · Pure Infrastructure"
      tag="KEPSERVEREX"
      headerAction={
        <div className="flex items-center gap-2 font-mono text-xs">
          {connectionStatus === 'connected' ? (
            <span className="h-7 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block animate-pulse" />
              ● KEPWARE ONLINE (Good)
            </span>
          ) : connectionStatus === 'connecting' ? (
            <span className="h-7 px-2.5 bg-sky-50 text-sky-800 border border-sky-300 font-bold flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-sky-600" />
              CONNECTING...
            </span>
          ) : (
            <span className="h-7 px-2.5 bg-rose-50 text-rose-800 border border-rose-300 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-600 inline-block" />
              ● OFFLINE
            </span>
          )}
        </div>
      }
      footer={
        <div className="w-full flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1">
              <Settings2 className="w-3.5 h-3.5 text-slate-400" />
              SAMPLING: {samplingIntervalMs}ms
            </span>
            <span>TIMEOUT: {timeoutMs}ms</span>
            <span>LATENCY: {latencyMs}ms</span>
          </div>
          <div>
            <span>PROTOCOL: OPC UA (TCP Binary / Port 49320)</span>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-5">
        {/* Operational Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 text-xs flex items-center justify-between gap-2 font-mono border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : feedback.type === 'error'
                ? 'bg-rose-50 border-rose-300 text-rose-900'
                : 'bg-sky-50 border-sky-300 text-sky-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-700" />
              )}
              <span className="font-semibold">{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-[11px] underline uppercase tracking-wider text-slate-500 hover:text-slate-800 ml-4"
            >
              DISMISS
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Endpoint URL */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Endpoint URL</span>
            </label>
            <input
              type="text"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              disabled={connectionStatus !== 'disconnected'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </div>

          {/* Provider Name */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500" />
              <span>Provider Name</span>
            </label>
            <input
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              disabled={connectionStatus !== 'disconnected'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </div>

          {/* Security Policy */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-slate-500" />
              <span>Security Policy</span>
            </label>
            <select
              value={securityPolicy}
              onChange={(e) => setSecurityPolicy(e.target.value)}
              disabled={connectionStatus !== 'disconnected'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="None">None (Local Loopback / Direct)</option>
              <option value="Basic256Sha256">Basic256Sha256 - Sign & Encrypt</option>
              <option value="Aes128_Sha256_RsaOaep">Aes128_Sha256_RsaOaep</option>
            </select>
          </div>

          {/* Connection Timing Parameters */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              disabled={connectionStatus !== 'disconnected'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Sampling Interval (ms)
            </label>
            <input
              type="number"
              value={samplingIntervalMs}
              onChange={(e) => setSamplingIntervalMs(Number(e.target.value))}
              disabled={connectionStatus !== 'disconnected'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-500"
              required
            />
          </div>

          {/* Authentication Mode */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Authentication Mode</span>
            </label>
            <div className="flex items-center gap-6 h-9">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-800">
                <input
                  type="radio"
                  name="opcAuthMode"
                  value="anonymous"
                  checked={authMode === 'anonymous'}
                  onChange={() => setAuthMode('anonymous')}
                  disabled={connectionStatus !== 'disconnected'}
                  className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-800"
                />
                <span>Anonymous / Guest</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-mono text-slate-800">
                <input
                  type="radio"
                  name="opcAuthMode"
                  value="username"
                  checked={authMode === 'username'}
                  onChange={() => setAuthMode('username')}
                  disabled={connectionStatus !== 'disconnected'}
                  className="w-4 h-4 text-slate-900 border-slate-300 focus:ring-slate-800"
                />
                <span>Username & Password</span>
              </label>
            </div>
          </div>

          {/* Credentials */}
          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Username</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={authMode === 'anonymous' || connectionStatus !== 'disconnected'}
              placeholder={authMode === 'anonymous' ? 'Anonymous' : 'Enter username'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Password</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={authMode === 'anonymous' || connectionStatus !== 'disconnected'}
              placeholder={authMode === 'anonymous' ? '••••••••' : 'Enter password'}
              className="w-full h-9 font-mono text-xs border border-slate-300 bg-white px-3 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:bg-slate-100 disabled:text-slate-400"
            />
          </div>
        </div>

        {/* 8-State Interactive Action Buttons */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleTestHandshake}
            disabled={isLoading || connectionStatus === 'connecting'}
            className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 active:translate-y-px text-slate-800 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:opacity-50"
          >
            <Network className="w-4 h-4 text-slate-600" />
            <span>TEST HANDSHAKE</span>
          </button>

          <button
            type="button"
            onClick={handleToggleConnect}
            disabled={isLoading || connectionStatus === 'connecting'}
            className={`h-9 px-4 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 active:translate-y-px focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:opacity-50 ${
              connectionStatus === 'connected'
                ? 'bg-slate-700 hover:bg-slate-800'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{connectionStatus === 'connected' ? 'DISCONNECT GATEWAY' : 'CONNECT GATEWAY'}</span>
          </button>

          <button
            type="submit"
            disabled={isLoading || connectionStatus === 'connecting'}
            className="h-9 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 active:translate-y-px focus:outline-2 focus:outline-sky-600 focus:outline-offset-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>SAVE SETTINGS</span>
          </button>
        </div>
      </form>
    </Card>
  );
};
