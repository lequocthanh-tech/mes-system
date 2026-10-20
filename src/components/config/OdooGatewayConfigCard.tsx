/* Hallmark · component: OdooGatewayConfigCard · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { 
  Globe, 
  Database, 
  User, 
  KeyRound, 
  Eye, 
  EyeOff, 
  Save, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck
} from 'lucide-react';
import { 
  getOdooConfig, 
  saveOdooConfig, 
  testOdooConnection, 
  getOdooStatus,
  OdooStatusResponse 
} from '../../services/api';

export const OdooGatewayConfigCard: React.FC = () => {
  const [url, setUrl] = useState<string>('http://localhost:8069');
  const [db, setDb] = useState<string>('dairy_erp');
  const [username, setUsername] = useState<string>('thanh.lethanhlequoc@hcmut.edu.vn');
  const [password, setPassword] = useState<string>('quocthanh');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [status, setStatus] = useState<OdooStatusResponse | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    meta?: string;
  } | null>(null);

  // Load initial persisted configuration and probe Odoo status on mount
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const [cfg, currentStatus] = await Promise.allSettled([
          getOdooConfig(),
          getOdooStatus()
        ]);

        if (isMounted) {
          if (cfg.status === 'fulfilled' && cfg.value) {
            if (cfg.value.url) setUrl(cfg.value.url);
            if (cfg.value.db) setDb(cfg.value.db);
            if (cfg.value.username) setUsername(cfg.value.username);
            if (cfg.value.password) {
              setPassword(cfg.value.password);
            } else if (cfg.value.password_masked && cfg.value.password_masked !== '********') {
              setPassword(cfg.value.password_masked);
            } else {
              setPassword('quocthanh');
            }
          }

          if (currentStatus.status === 'fulfilled' && currentStatus.value) {
            setStatus(currentStatus.value);
          }
        }
      } catch (err) {
        console.debug('[OdooConfig] Initial load error:', err);
      }
    };

    init();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshStatus = async () => {
    try {
      const res = await getOdooStatus();
      setStatus(res);
    } catch {
      setStatus({
        connected: false,
        latency_ms: 0,
        status: 'OFFLINE'
      });
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setFeedback(null);

    try {
      const payload = {
        url: url.trim(),
        db: db.trim(),
        username: username.trim(),
        password: password.trim()
      };

      const res = await testOdooConnection(payload);

      if (res.success) {
        setFeedback({
          type: 'success',
          title: 'KẾT NỐI ODOO ERP THÀNH CÔNG',
          message: res.message || 'Xác thực tài khoản và XML-RPC endpoint thành công!',
          meta: `Độ trễ: ${res.latency_ms || 0}ms · User ID: ${res.uid || 1} · Phiên bản: Odoo ${res.version || '18.0'}`
        });
        // Re-probe status to refresh global badge
        await refreshStatus();
      } else {
        setFeedback({
          type: 'error',
          title: 'LỖI KẾT NỐI ODOO ERP',
          message: res.message || 'Không thể kết nối hoặc sai tài khoản/mật khẩu!',
          meta: res.error || 'Vui lòng kiểm tra địa chỉ máy chủ, tên cơ sở dữ liệu và mật khẩu.'
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({
        type: 'error',
        title: 'LỖI THỰC THI KIỂM TRA',
        message: 'Không thể gửi yêu cầu kiểm tra đến gateway cục bộ.',
        meta: errMsg
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        url: url.trim(),
        db: db.trim(),
        username: username.trim(),
        password: password.trim()
      };

      const res = await saveOdooConfig(payload);

      if (res.success) {
        setFeedback({
          type: 'success',
          title: 'ĐÃ LƯU CẤU HÌNH ODOO ERP',
          message: res.message || 'Đã lưu cấu hình vào backend/odoo_config.json và cập nhật bộ kết nối runtime!',
          meta: `Cấu hình đã sẵn sàng cho quy trình đồng bộ ISA-95 Level 4 -> Level 3.`
        });
        // Probe connection with newly saved config
        await refreshStatus();
      } else {
        setFeedback({
          type: 'error',
          title: 'LỖI LƯU CẤU HÌNH',
          message: res.message || 'Không thể lưu cấu hình Odoo ERP.',
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setFeedback({
        type: 'error',
        title: 'LỖI THỰC THI LƯU',
        message: 'Lỗi khi gọi API lưu cấu hình Odoo ERP.',
        meta: errMsg
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isOnline = Boolean(status?.connected);

  return (
    <Card
      title="ENTERPRISE ERP GATEWAY (ISA-95 LEVEL 4)"
      subtitle="Configure Level 4 ERP XML-RPC Downlink parameters, manage credentials, and monitor connection status"
      tag="ISA-95 LEVEL 4"
      headerAction={
        <div className="flex items-center gap-2 font-mono text-xs">
          {isOnline ? (
            <span className="h-7 px-2.5 bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-pulse" />
              <span>● ERP GATEWAY: ONLINE</span>
              <span className="text-emerald-700 text-[11px] font-normal">
                ({status?.latency_ms ? `${status.latency_ms}ms` : '<5ms'}
                {status?.uid ? ` · UID: ${status.uid}` : ''})
              </span>
            </span>
          ) : status?.status === 'AUTH_FAILED' ? (
            <span className="h-7 px-2.5 bg-amber-50 text-amber-800 border border-amber-300 font-bold flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B] inline-block" />
              <span>● ERP GATEWAY: AUTH_FAILED</span>
            </span>
          ) : (
            <span className="h-7 px-2.5 bg-rose-50 text-rose-800 border border-rose-300 font-bold flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-[#F43F5E] inline-block" />
              <span>● ERP GATEWAY: OFFLINE</span>
            </span>
          )}
        </div>
      }
      footer={
        <div className="w-full flex flex-wrap items-center justify-between text-xs text-slate-500 font-mono">
          <div className="flex items-center gap-4">
            <span>PROTOCOL: XML-RPC / 2 / COMMON & OBJECT</span>
            <span>MODEL: mrp.production (MANUFACTURING)</span>
            <span>STANDARD: ISA-95 ENTERPRISE INTEGRATION</span>
          </div>
          <div>
            {isOnline ? (
              <span className="text-emerald-700 font-medium">STATUS: READY / SYNCHRONIZED</span>
            ) : (
              <span>STATUS: DISCONNECTED</span>
            )}
          </div>
        </div>
      }
    >
      <form onSubmit={handleSaveConfig} className="space-y-5">
        {/* Feedback Alert Notice */}
        {feedback && (
          <div 
            className={`p-3.5 border font-mono text-xs flex items-start gap-3 transition-colors ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                : 'bg-rose-50 border-rose-300 text-rose-900'
            }`}
            role="status"
            aria-live="polite"
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1 flex-1">
              <div className="font-bold uppercase tracking-wider text-[11px]">
                {feedback.title}
              </div>
              <div className="leading-relaxed">
                {feedback.message}
              </div>
              {feedback.meta && (
                <div className={`text-[11px] pt-0.5 ${feedback.type === 'success' ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {feedback.meta}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Grid: Row 1 (URL & DB Name) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* ERP Server URL */}
          <div>
            <label
              htmlFor="odoo-url"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              <span>ERP Server URL</span>
            </label>
            <input
              id="odoo-url"
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="http://localhost:8069"
              className="w-full h-9 font-mono text-sm border border-slate-300 rounded-none px-3 bg-white text-slate-900 hover:border-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
              required
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default: <code className="bg-slate-100 px-1 py-0.5 text-slate-700 font-bold">http://localhost:8069</code> (Odoo XML-RPC service)
            </span>
          </div>

          {/* Database Name */}
          <div>
            <label
              htmlFor="odoo-db"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" />
              <span>Database Name</span>
            </label>
            <input
              id="odoo-db"
              type="text"
              value={db}
              onChange={(e) => setDb(e.target.value)}
              placeholder="dairy_erp"
              className="w-full h-9 font-mono text-sm border border-slate-300 rounded-none px-3 bg-white text-slate-900 hover:border-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
              required
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default: <code className="bg-slate-100 px-1 py-0.5 text-slate-700 font-bold">dairy_erp</code> (PostgreSQL active schema)
            </span>
          </div>
        </div>

        {/* Input Grid: Row 2 (Username & Password) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Username / Email */}
          <div>
            <label
              htmlFor="odoo-username"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-slate-500" />
              <span>Username / Email</span>
            </label>
            <input
              id="odoo-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="thanh.lethanhlequoc@hcmut.edu.vn"
              className="w-full h-9 font-mono text-sm border border-slate-300 rounded-none px-3 bg-white text-slate-900 hover:border-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
              required
            />
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default: <code className="bg-slate-100 px-1 py-0.5 text-slate-700 font-bold">thanh.lethanhlequoc@hcmut.edu.vn</code>
            </span>
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="odoo-password"
              className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Password</span>
            </label>
            <div className="relative">
              <input
                id="odoo-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password or API key"
                className="w-full h-9 font-mono text-sm border border-slate-300 rounded-none pl-3 pr-10 bg-white text-slate-900 hover:border-slate-400 focus:border-slate-800 focus:outline-none transition-colors"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
              Default: <code className="bg-slate-100 px-1 py-0.5 text-slate-700 font-bold">quocthanh</code>. Editable password or Odoo API key.
            </span>
          </div>
        </div>

        {/* Integration Architecture Summary Box */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-slate-900 block uppercase tracking-wide text-[11px]">
              ISA-95 Level 4 to Level 3 Downlink Architecture
            </span>
            <span className="text-slate-500 text-[11px] block leading-relaxed">
              When production orders reach <code className="text-slate-700 font-bold">confirmed</code> status in Odoo MRP, MES operators can downlink them directly into the Microsoft SQL Server database (<code className="text-slate-700 font-bold">dbo.Orders</code>). Recipes and customer codes are automatically matched and persisted atomically.
            </span>
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {/* Test ERP Connection Button */}
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isSaving}
            className="h-9 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hallmark-focus active:translate-y-px rounded-none transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Đang kiểm tra XML-RPC...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-slate-500" />
                <span>TEST ERP CONNECTION</span>
              </>
            )}
          </button>

          {/* Save ERP Settings Button */}
          <button
            type="submit"
            disabled={isSaving || isTesting}
            className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-2 hallmark-focus active:translate-y-px rounded-none transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                <span>Đang lưu cấu hình...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>SAVE ERP SETTINGS</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Card>
  );
};

export default OdooGatewayConfigCard;
