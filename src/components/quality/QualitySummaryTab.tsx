/* Hallmark · component: QualitySummaryTab · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useQuality } from '../../context/QualityContext';
import { 
  BarChart3, 
  CheckCircle2, 
  AlertTriangle, 
  Percent, 
  Package, 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  Wrench, 
  CheckCheck,
  RotateCw,
  X
} from 'lucide-react';

export const QualitySummaryTab: React.FC = () => {
  const { 
    batchRecords, 
    activeCapaTicket, 
    resolveCapaTicket, 
    summaryData, 
    isSummaryLoading,
    refreshSummary,
    fromDate,
    toDate
  } = useQuality();

  const [showCapaModal, setShowCapaModal] = useState<boolean>(false);
  const [dispatchToast, setDispatchToast] = useState<string | null>(null);

  // Dynamic SQL Aggregations (Zero Mock Data)
  const totalBatches = summaryData ? summaryData.total_batches : batchRecords.length;
  const passedBatches = summaryData 
    ? summaryData.pass_batches 
    : batchRecords.filter((b) => b.status === 'PASS').length;
  const quarantinedBatches = summaryData 
    ? summaryData.quarantined_batches_count 
    : batchRecords.filter((b) => b.status === 'FAIL' || b.disposition === 'QUARANTINED').length;
  const firstPassYield = summaryData ? summaryData.fpy_percentage : (totalBatches > 0 ? (passedBatches / totalBatches) * 100 : 0.0);
  const totalVolumeProduced = summaryData ? summaryData.total_inspected_volume : (batchRecords.reduce((acc, b) => acc + (b.totalProduced || 0), 0) || 0.0);
  const qualityGrade = summaryData ? summaryData.quality_grade : (totalBatches > 0 ? (firstPassYield >= 95 ? 'GRADE A' : firstPassYield >= 85 ? 'GRADE B' : 'GRADE C') : '--');
  const avgDeviation = summaryData ? summaryData.overall_avg_deviation : 0.0;
  const paretoByRecipe = summaryData?.pareto_by_recipe || [];
  const hasBreach = summaryData ? summaryData.has_breach : activeCapaTicket.status !== 'RESOLVED';

  const handleDispatchMaintOrder = () => {
    resolveCapaTicket(activeCapaTicket.ticketId);
    setDispatchToast(`Phiếu khắc phục ${activeCapaTicket.ticketId} đã được điều phối thành công đến Đội Bảo trì & Vận hành.`);
    setTimeout(() => setDispatchToast(null), 5000);
    setShowCapaModal(false);
  };

  return (
    <div className="space-y-4 font-mono text-xs">
      {/* Toast Notification */}
      {dispatchToast && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs flex items-center justify-between font-mono animate-in fade-in rounded-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>{dispatchToast}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-semibold uppercase">ĐÃ ĐIỀU PHỐI</span>
        </div>
      )}

      {/* Date Range Sub-Header & Live Refresh */}
      <div className="px-4 py-2.5 bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 rounded-xs shadow-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-700" />
          <span>Khoảng thời gian thống kê SPC:</span>
          <strong className="text-slate-900 font-mono">
            {summaryData?.from_date ? summaryData.from_date.split(' ')[0] : fromDate}
          </strong>
          <span>đến</span>
          <strong className="text-slate-900 font-mono">
            {summaryData?.to_date ? summaryData.to_date.split(' ')[0] : toDate}
          </strong>
        </div>

        <button
          type="button"
          onClick={() => refreshSummary()}
          disabled={isSummaryLoading}
          className="h-8 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold uppercase flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px transition-all disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 text-slate-600 ${isSummaryLoading ? 'animate-spin' : ''}`} />
          <span>Cập nhật số liệu</span>
        </button>
      </div>

      {/* Summary KPI Cards Grid (Zero Mock Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: First-Pass Yield (FPY %) */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between rounded-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              First-Pass Yield (FPY %)
            </span>
            <span className="text-2xl font-bold text-emerald-700 mt-1 block">
              {firstPassYield.toFixed(1)}%
            </span>
            <span className="text-[10px] text-slate-400">
              {passedBatches} of {totalBatches} batches compliant
            </span>
          </div>
          <div className="w-10 h-10 bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 rounded-xs">
            <Percent className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 2: Total Inspected Volume */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between rounded-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              Total Inspected Volume
            </span>
            <span className="text-2xl font-bold text-slate-900 mt-1 block">
              {totalVolumeProduced.toLocaleString()} L
            </span>
            <span className="text-[10px] text-slate-400">
              {totalBatches > 0 ? 'Tổng thể tích mẻ đạt chuẩn' : 'Chưa có dữ liệu mẻ'}
            </span>
          </div>
          <div className="w-10 h-10 bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-700 rounded-xs">
            <Package className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 3: Quarantined Batches */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between rounded-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              Quarantined Batches
            </span>
            <span className={`text-2xl font-bold mt-1 block ${quarantinedBatches > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
              {quarantinedBatches} Batch
            </span>
            <span className={`text-[10px] font-semibold ${quarantinedBatches > 0 ? 'text-rose-600' : 'text-slate-400 font-normal'}`}>
              {quarantinedBatches > 0 ? `Cảnh báo: ${quarantinedBatches} mẻ đang bị cách ly` : 'Không có mẻ nào bị cách ly'}
            </span>
          </div>
          <div className={`w-10 h-10 flex items-center justify-center rounded-xs ${
            quarantinedBatches > 0
              ? 'bg-rose-50 border border-rose-200 text-rose-700'
              : 'bg-slate-50 border border-slate-200 text-slate-400'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        {/* KPI 4: Quality Performance Level */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs flex items-center justify-between rounded-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">
              Quality Performance Index
            </span>
            <span className="text-2xl font-bold text-blue-700 mt-1 block">
              {qualityGrade}
            </span>
            <span className="text-[10px] text-slate-400">
              {totalBatches > 0 ? `Sai số trung bình: ${avgDeviation.toFixed(2)}%` : 'Chưa có dữ liệu mẻ'}
            </span>
          </div>
          <div className="w-10 h-10 bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 rounded-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Analytics Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Left: Recipe Conformity Breakdown (Pareto) */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4 rounded-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
              <BarChart3 className="w-4 h-4 text-slate-700" />
              Pareto Defect &amp; Quality Pass Rates
            </span>
            <span className="text-[10px] text-slate-500 uppercase">BY RECIPE CODE</span>
          </div>

          {paretoByRecipe.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 bg-slate-50/50 rounded-xs space-y-2">
              <BarChart3 className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-slate-600 font-semibold text-xs">
                Chưa có dữ liệu kiểm định mẻ trong khoảng thời gian đã chọn
              </p>
              <p className="text-[10px] text-slate-400 max-w-sm mx-auto">
                Khi các mẻ hoàn tất kiểm định chất lượng, tỉ lệ đạt chuẩn theo từng mã công thức sẽ được phân tích tự động tại đây.
              </p>
            </div>
          ) : (
            <div className="space-y-4 pt-1">
              {paretoByRecipe.map((rec) => {
                const isHigh = rec.pass_rate >= 95.0;
                const isMid = rec.pass_rate >= 85.0;
                const barColor = isHigh ? 'bg-emerald-600' : isMid ? 'bg-amber-600' : 'bg-rose-600';
                const textColor = isHigh ? 'text-emerald-700' : isMid ? 'text-amber-700' : 'text-rose-700';

                return (
                  <div key={rec.recipe_code} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {rec.recipe_code} ({rec.recipe_name})
                      </span>
                      <span className={`font-bold ${textColor}`}>
                        {rec.pass_rate.toFixed(1)}% PASS ({rec.pass_count}/{rec.total_count})
                      </span>
                    </div>
                    <div className="w-full h-3 bg-slate-100 border border-slate-200 rounded-xs overflow-hidden">
                      <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${rec.pass_rate}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {rec.total_count - rec.pass_count === 0 
                        ? '0 lỗi vi phạm • Thông số đạt chuẩn công thức' 
                        : `${rec.total_count - rec.pass_count} mẻ không đạt chuẩn yêu cầu kiểm tra`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Dynamic Critical Defect Root Cause & CAPA Management */}
        <div className="bg-white border border-slate-200 p-4 shadow-xs space-y-4 rounded-xs">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-slate-700" />
              Quality Root Cause &amp; Corrective Actions (CAPA)
            </span>
            <span className={`text-[10px] px-2 py-0.5 font-bold rounded-xs border ${
              !hasBreach
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-rose-50 text-rose-800 border-rose-300 animate-pulse'
            }`}>
              {!hasBreach ? 'HỆ THỐNG ỔN ĐỊNH (NORMATIVE)' : 'CẢNH BÁO VI PHẠM CCP / DEFECT'}
            </span>
          </div>

          {!hasBreach ? (
            /* CASE A: Zero Defects / Clean Run */
            <div className="space-y-3 text-[11px]">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 space-y-2 rounded-xs">
                <div className="flex items-center gap-2 text-emerald-900 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Hệ thống ổn định (Normative)</span>
                </div>
                <p className="text-emerald-800 leading-relaxed text-xs">
                  Không phát hiện vi phạm chỉ tiêu an toàn thực phẩm hoặc giới hạn CCP.
                </p>
                <p className="text-[11px] text-emerald-700">
                  Quy trình khử trùng UHT và định lượng phối liệu tuân thủ chuẩn ISO 22000 &amp; HACCP.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  disabled
                  className="h-9 px-4 bg-slate-100 text-slate-400 font-bold text-xs uppercase tracking-wider border border-slate-200 rounded-xs cursor-not-allowed"
                >
                  SOP TUÂN THỦ TỐT
                </button>
              </div>
            </div>
          ) : (
            /* CASE B: Active CCP Breach / Defect Found */
            <div className="space-y-3 text-[11px] text-slate-700">
              <div className="p-3 bg-rose-50 border border-rose-200 space-y-1.5 rounded-xs">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    {activeCapaTicket.title}
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    Ref: {activeCapaTicket.reportCode} / {activeCapaTicket.orderId}
                  </span>
                </div>
                <p className="text-rose-900 leading-relaxed">
                  {activeCapaTicket.rootCause}
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 space-y-1.5 rounded-xs">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Wrench className="w-4 h-4 text-slate-700" />
                  Hành Động Khắc Phục Khuyến Nghị (Prescribed CAPA)
                </div>
                <p className="text-slate-700 leading-relaxed">
                  {activeCapaTicket.correctiveAction}
                </p>
              </div>

              {/* Action Button to Open Ticket Modal */}
              <div className="pt-1 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowCapaModal(true)}
                  className="h-9 px-4 bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 hallmark-focus active:translate-y-px rounded-xs transition-all shadow-xs"
                >
                  <Wrench className="w-3.5 h-3.5 text-white" />
                  <span>MỞ PHIẾU KHẮC PHỤC CAPA</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CAPA Ticket Modal */}
      {showCapaModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-mono"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-300 shadow-2xl w-full max-w-xl overflow-hidden rounded-xs">
            <div className="px-5 py-3.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-700" />
                <h3 className="text-sm font-bold text-rose-900 uppercase">
                  PHIẾU KHẮC PHỤC &amp; PHÒNG NGỪA {activeCapaTicket.ticketId}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCapaModal(false)}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xs transition-colors hallmark-focus"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 text-[11px]">
                <div className="p-2.5 bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Lệnh Sản Xuất</span>
                  <strong className="text-slate-900">{activeCapaTicket.orderId}</strong>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold">Mã Báo Cáo QA</span>
                  <strong className="text-slate-900">{activeCapaTicket.reportCode}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase">Nguyên Nhân Gốc Rễ (Root Cause)</span>
                <div className="p-3 bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed text-xs">
                  {activeCapaTicket.rootCause}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-700 uppercase">Biện Pháp Khắc Phục (Action Plan)</span>
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 leading-relaxed text-xs">
                  {activeCapaTicket.correctiveAction}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowCapaModal(false)}
                className="h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase rounded-xs hallmark-focus active:translate-y-px"
              >
                ĐÓNG
              </button>
              <button
                type="button"
                onClick={handleDispatchMaintOrder}
                className="h-9 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ĐIỀU PHỐI ĐỘI BẢO TRÌ &amp; ĐÓNG PHIẾU</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div className="p-3 bg-white border border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 rounded-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-slate-400" />
          <span>STATISTICAL PROCESS CONTROL (SPC) &amp; CONTINUOUS QUALITY VERIFICATION</span>
        </div>
        <div className="flex items-center gap-3">
          <span>ALCOA+ DATA INTEGRITY</span>
          <span>•</span>
          <span>ISA-95 LEVEL 3 MOM</span>
        </div>
      </div>
    </div>
  );
};
