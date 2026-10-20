/* Hallmark · component: ESignatureModal · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useReports } from '../context/ReportContext';
import { signAndAuditAction, SignActionResult } from '../services/api';
import { 
  KeyRound, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  Loader2, 
  X, 
  ArrowRight, 
  FileSignature,
  FileCheck
} from 'lucide-react';

export interface ESignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: SignActionResult) => void;
  actionName: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  defaultMeaning?: string;
  detail?: string;
  isCorrection?: boolean;
  refLogId?: number;
}

const SIGNATURE_MEANINGS = [
  'Approval',
  'Parameter Override',
  'Recipe Modification',
  'Calibration Correction',
  'Batch Release',
  'Verification',
  'Review',
  'Responsibility'
];

export const ESignatureModal: React.FC<ESignatureModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  actionName,
  fieldName,
  oldValue,
  newValue,
  defaultMeaning = 'Approval',
  detail,
  isCorrection = false,
  refLogId,
}) => {
  const { user } = useAuth();
  const { refreshAuditLogs } = useReports();

  const activeUsername = user?.username || 'admin';
  const activeRole = user?.role || 'Engineer';

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signatureMeaning, setSignatureMeaning] = useState(defaultMeaning);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<SignActionResult | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setSignatureMeaning(defaultMeaning);
      setReason('');
      setErrorMessage(null);
      setSuccessResult(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultMeaning]);

  if (!isOpen) return null;

  const isReasonValid = reason.trim().length >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!password) {
      setErrorMessage('Password is required to verify electronic identity.');
      return;
    }

    if (!isReasonValid) {
      setErrorMessage('Reason for action is required (minimum 5 characters per 21 CFR §11.50).');
      return;
    }

    setIsSubmitting(true);

    try {
      const summaryDetail = detail || (
        fieldName 
          ? `Modified ${fieldName} from "${oldValue ?? '---'}" to "${newValue ?? '---'}"`
          : `Executed ${actionName}`
      );

      const result = await signAndAuditAction({
        username: activeUsername,
        password,
        action_name: actionName,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
        reason: reason.trim(),
        signature_meaning: signatureMeaning,
        detail: summaryDetail,
        is_correction: isCorrection,
        ref_log_id: refLogId,
      });

      if (result.status === 'success') {
        setSuccessResult(result);
        try {
          await refreshAuditLogs();
        } catch (err) {
          console.debug('[ESignatureModal] Auto-refresh audit trail error:', err);
        }
        setTimeout(() => {
          onSuccess(result);
          onClose();
        }, 900);
      } else {
        setErrorMessage(result.message || 'Signature verification rejected.');
      }
    } catch (err: any) {
      const msg = err?.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDelta = (oldValue !== undefined || newValue !== undefined) && (oldValue !== newValue);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="esign-modal-title"
    >
      <div className="bg-white border border-slate-300 w-full max-w-xl shadow-2xl overflow-hidden rounded-xs flex flex-col font-sans">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-emerald-400 shrink-0" />
            <h2 
              id="esign-modal-title" 
              className="text-xs font-bold uppercase tracking-wider text-white"
              style={{ fontStyle: 'normal' }}
            >
              ELECTRONIC SIGNATURE VERIFICATION (21 CFR PART 11)
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-1 rounded-xs transition-colors focus-visible:outline-2 focus-visible:outline-sky-500 focus-visible:outline-offset-2"
            aria-label="Close signature verification dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Regulatory Banner */}
        <div className="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            ALCOA+ DATA INTEGRITY &bull; IMMUTABLE AUDIT TRAIL
          </span>
          <span className="font-semibold text-slate-700">FDA 21 CFR &sect;11.200</span>
        </div>

        {/* Feedback Alert Banners */}
        {errorMessage && (
          <div 
            className="p-3 bg-rose-50 border-b border-rose-200 flex items-start gap-2 text-xs font-semibold text-rose-900"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold uppercase tracking-wide text-rose-950">Verification Challenge Failed</div>
              <div className="text-[11px] font-normal text-rose-800 mt-0.5">{errorMessage}</div>
            </div>
          </div>
        )}

        {successResult && (
          <div 
            className="p-3 bg-emerald-50 border-b border-emerald-200 flex items-start gap-2 text-xs font-semibold text-emerald-900"
            role="status"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold uppercase tracking-wide text-emerald-950">Signature Verified &bull; Record Committed</div>
              <div className="text-[11px] font-mono font-normal text-emerald-800 mt-0.5">
                Log ID: #{successResult.log_id} &bull; SHA-256: {successResult.record_hash?.substring(0, 16)}...
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Action Context Card */}
          <div className="p-3 bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase text-slate-500 font-bold">Interception Target</span>
              <span className="px-2 py-0.5 bg-slate-200 text-slate-800 font-mono font-bold text-[10px] uppercase">
                {actionName}
              </span>
            </div>

            {/* Before / After Difference Badge */}
            {hasDelta && (
              <div className="pt-2 border-t border-slate-200">
                <div className="text-[10px] text-slate-500 font-mono uppercase font-semibold mb-1">
                  Field Modification: <span className="text-slate-900 font-bold">{fieldName || 'Parameter'}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <div className="flex-1 p-2 bg-rose-50 border border-rose-200 text-rose-900 font-bold rounded-xs text-center">
                    <span className="block text-[9px] uppercase text-rose-600 font-normal">Prior Value</span>
                    {oldValue ?? '---'}
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="flex-1 p-2 bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold rounded-xs text-center">
                    <span className="block text-[9px] uppercase text-emerald-600 font-normal">New Target Value</span>
                    {newValue ?? '---'}
                  </div>
                </div>
              </div>
            )}

            {detail && !hasDelta && (
              <div className="text-[11px] text-slate-700 font-medium">
                {detail}
              </div>
            )}
          </div>

          {/* User Identity (Read Only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                Signer Identity (Current User)
              </label>
              <div className="h-9 px-3 bg-slate-100 border border-slate-300 rounded-xs flex items-center justify-between text-slate-900 font-mono">
                <span className="font-bold">{activeUsername}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-white border border-slate-200 font-sans text-slate-600 font-medium">
                  {activeRole}
                </span>
              </div>
            </div>

            {/* Meaning of Signature */}
            <div className="space-y-1">
              <label 
                htmlFor="signature-meaning-select" 
                className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide"
              >
                Meaning of Signature (21 CFR &sect;11.50) *
              </label>
              <select
                id="signature-meaning-select"
                value={signatureMeaning}
                onChange={(e) => setSignatureMeaning(e.target.value)}
                disabled={isSubmitting}
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 hover:bg-slate-50 transition-none"
              >
                {SIGNATURE_MEANINGS.map((meaning) => (
                  <option key={meaning} value={meaning}>
                    {meaning}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Re-Authentication Password */}
          <div className="space-y-1">
            <label 
              htmlFor="esign-password-input" 
              className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide flex items-center justify-between"
            >
              <span className="flex items-center gap-1">
                <KeyRound className="w-3 h-3 text-slate-500" />
                Password / Electronic Credential Verification *
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Re-authentication required</span>
            </label>
            <div className="relative">
              <input
                id="esign-password-input"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder="Enter your system password..."
                autoComplete="current-password"
                className="w-full h-9 pl-3 pr-10 bg-white border border-slate-300 text-xs font-mono text-slate-900 rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 hover:border-slate-400 transition-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-700 p-0.5 rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Reason for Change / Action */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label 
                htmlFor="esign-reason-input" 
                className="text-[11px] font-bold text-slate-700 uppercase tracking-wide"
              >
                Reason for Action / Change (Mandatory &ge; 5 Chars) *
              </label>
              <span className={`text-[10px] font-mono ${isReasonValid ? 'text-emerald-700 font-semibold' : 'text-slate-500'}`}>
                {reason.trim().length} / 5 min chars
              </span>
            </div>
            <textarea
              id="esign-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="State regulatory or engineering rationale (e.g. Setpoint adjustment per SOP-402, authorized by Shift Lead)..."
              className={`w-full p-2.5 bg-white border ${
                reason.length > 0 && !isReasonValid ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
              } text-xs font-mono text-slate-900 rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 hover:border-slate-400 transition-none`}
            />

            {/* Quick Reason Snippets */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                'Standard formulation adjustment per SOP-402',
                'Routine QA release approval after CCP verification',
                'Supervisory batch download to SCADA buffer',
                'Engineering calibration correction',
              ].map((snippet) => (
                <button
                  key={snippet}
                  type="button"
                  onClick={() => setReason(snippet)}
                  disabled={isSubmitting}
                  className="px-2 py-0.5 text-[10px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xs transition-none active:translate-y-px"
                >
                  + {snippet.substring(0, 32)}...
                </button>
              ))}
            </div>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
            <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
              <FileCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>Cryptographic SHA-256 signature stamped upon commit</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider rounded-xs focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSubmitting || !isReasonValid || !password}
                className={`h-9 px-5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-2 rounded-xs border border-slate-900 shadow-xs focus-visible:outline-2 focus-visible:outline-sky-600 focus-visible:outline-offset-2 active:translate-y-px transition-none ${
                  isSubmitting ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>Verifying Identity...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Verify Signature &amp; Commit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
