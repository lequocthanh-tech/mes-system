/* Hallmark · component: InboundReceipt · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { InboundReceipt as InboundReceiptType, MaterialCode } from '../../types/inventory';
import { 
  PackagePlus, 
  Edit3, 
  Trash2, 
  RotateCcw, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertTriangle,
  Clock,
  Truck,
  Lock,
  Layers,
  CheckCheck
} from 'lucide-react';

const MATERIAL_MAP: Record<MaterialCode, { name: string; unit: string; tankId: string; tankName: string }> = {
  RAW_MILK: { 
    name: 'Sữa bò tươi nguyên chất (Raw Fresh Milk)', 
    unit: 'L', 
    tankId: 'TANK-01', 
    tankName: 'Bồn chứa Sữa tươi (Raw Milk Silo 01)' 
  },
  SUGAR: { 
    name: 'Đường tinh luyện RE (Granulated Sugar)', 
    unit: 'kg', 
    tankId: 'TANK-02', 
    tankName: 'Silo chứa Đường tinh luyện (Sugar Silo 02)' 
  },
  ADDITIVE: { 
    name: 'Phụ gia hương liệu & vi chất (Food Additives)', 
    unit: 'L', 
    tankId: 'TANK-03', 
    tankName: 'Bồn chứa Phụ gia & Vi chất (Additive Tank 03)' 
  },
};

export const InboundReceipt: React.FC = () => {
  const { 
    receipts, 
    stocks, 
    addInboundReceipt, 
    updateInboundReceipt, 
    deleteInboundReceipt,
    getHeadspace 
  } = useInventory();

  // Form State
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptCode, setReceiptCode] = useState<string>(
    `INB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(receipts.length + 1).padStart(3, '0')}`
  );
  const [materialCode, setMaterialCode] = useState<MaterialCode>('RAW_MILK');
  const [quantity, setQuantity] = useState<number | ''>(5000);
  const [supplierLot, setSupplierLot] = useState<string>('LOT-VINAMILK-2026-09A');
  const [note, setNote] = useState<string>('Tiếp nhận kiểm định đạt tiêu chuẩn HACCP/ISO 22000');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'warning'; message: string } | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [materialFilter, setMaterialFilter] = useState<string>('ALL');

  // Headspace & Safety Gate Calculations
  const currentHeadspace = getHeadspace(materialCode);
  const targetTank = stocks.find((s) => s.materialCode === materialCode);
  const numQuantity = Number(quantity) || 0;
  const isOverflowRisk = numQuantity > currentHeadspace;

  const handleMaterialChange = (code: MaterialCode) => {
    setMaterialCode(code);
    if (code === 'RAW_MILK') setSupplierLot('LOT-VINAMILK-2026-09A');
    if (code === 'SUGAR') setSupplierLot('LOT-BIENHOA-SUGAR-88');
    if (code === 'ADDITIVE') setSupplierLot('LOT-DSM-ADD-441');
  };

  const handleClear = () => {
    setSelectedReceiptId(null);
    setReceiptCode(
      `INB-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(receipts.length + 1).padStart(3, '0')}`
    );
    setMaterialCode('RAW_MILK');
    setQuantity(5000);
    setSupplierLot('LOT-VINAMILK-2026-09A');
    setNote('Tiếp nhận kiểm định đạt tiêu chuẩn HACCP/ISO 22000');
    setFeedback(null);
  };

  const handleSelectRow = (receipt: InboundReceiptType) => {
    setSelectedReceiptId(receipt.id);
    setReceiptCode(receipt.receiptCode);
    setMaterialCode(receipt.materialCode);
    setQuantity(receipt.quantity);
    setSupplierLot(receipt.supplierLot);
    setNote(receipt.note);
    setFeedback({
      type: 'success',
      message: `Đã chọn phiếu nhập [${receipt.receiptCode}] để chỉnh sửa.`,
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptCode.trim()) {
      setFeedback({ type: 'error', message: 'Mã phiếu nhập (Receipt Code) không được để trống.' });
      return;
    }
    if (quantity === '' || numQuantity <= 0) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập số lượng hợp lệ lớn hơn 0.' });
      return;
    }
    if (isOverflowRisk) {
      setFeedback({ 
        type: 'error', 
        message: `Khóa an toàn: Số lượng nhập vượt quá dung tích khả dụng của bồn (${currentHeadspace.toLocaleString()} ${MATERIAL_MAP[materialCode].unit}).` 
      });
      return;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const result = addInboundReceipt({
      receiptCode: receiptCode.trim(),
      materialCode,
      materialName: MATERIAL_MAP[materialCode].name,
      quantity: numQuantity,
      unit: MATERIAL_MAP[materialCode].unit,
      timestamp,
      supplierLot: supplierLot.trim() || 'LOT-STANDARD',
      note: note.trim() || 'Tiếp nhận nguyên liệu',
    });

    if (result.success) {
      setFeedback({ type: 'success', message: result.message });
      handleClear();
    } else {
      setFeedback({ type: 'error', message: result.message });
    }
  };

  const handleUpdate = () => {
    if (!selectedReceiptId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn một phiếu nhập từ bảng để cập nhật.' });
      return;
    }
    if (quantity === '' || numQuantity <= 0) {
      setFeedback({ type: 'error', message: 'Vui lòng nhập số lượng hợp lệ lớn hơn 0.' });
      return;
    }

    updateInboundReceipt(selectedReceiptId, {
      receiptCode: receiptCode.trim(),
      materialCode,
      materialName: MATERIAL_MAP[materialCode].name,
      quantity: numQuantity,
      unit: MATERIAL_MAP[materialCode].unit,
      supplierLot: supplierLot.trim() || 'LOT-STANDARD',
      note: note.trim(),
    });

    setFeedback({
      type: 'success',
      message: `Phiếu nhập [${receiptCode}] đã được cập nhật thành công.`,
    });
    handleClear();
  };

  const handleDelete = () => {
    if (!selectedReceiptId) {
      setFeedback({ type: 'error', message: 'Vui lòng chọn phiếu nhập cần xóa.' });
      return;
    }

    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa phiếu nhập [${receiptCode}] và hoàn nguyên tồn kho bồn chứa?`);
    if (!confirmed) return;

    deleteInboundReceipt(selectedReceiptId);
    setFeedback({
      type: 'success',
      message: `Đã xóa phiếu nhập [${receiptCode}] và hoàn nguyên số lượng tồn kho.`,
    });
    handleClear();
  };

  // Filter receipts
  const filteredReceipts = receipts.filter((r) => {
    const matchMaterial = materialFilter === 'ALL' || r.materialCode === materialFilter;
    const matchSearch = 
      r.receiptCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.supplierLot.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.note.toLowerCase().includes(searchTerm.toLowerCase());
    return matchMaterial && matchSearch;
  });

  return (
    <div className="space-y-5 font-mono text-xs">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 border flex items-center justify-between shadow-xs font-mono transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : feedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            )}
            <span className="font-semibold">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-500 hover:text-slate-900 font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid: Left Form (Inbound Entry) / Right Table (Ledger) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Form & Safety Gate Panel (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 shadow-xs flex flex-col">
          {/* Card Header */}
          <div className="px-5 py-3.5 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-slate-800" />
              <h2 className="font-bold text-slate-900 uppercase tracking-wide not-italic">
                {selectedReceiptId ? 'Chỉnh sửa phiếu nhập kho' : 'Thêm mới phiếu nhập nguyên liệu'}
              </h2>
            </div>
            <span className="text-[10px] text-slate-500">
              {selectedReceiptId ? `ID: ${selectedReceiptId}` : 'MẪU ISA-95'}
            </span>
          </div>

          <form onSubmit={handleAdd} className="p-5 space-y-4">
            {/* Field 1: Material Selection */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Nguyên vật liệu tiếp nhận (Material Selection):
              </label>
              <select
                value={materialCode}
                onChange={(e) => handleMaterialChange(e.target.value as MaterialCode)}
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              >
                <option value="RAW_MILK">RAW_MILK - Sữa bò tươi nguyên chất (L)</option>
                <option value="SUGAR">SUGAR - Đường tinh luyện RE (kg)</option>
                <option value="ADDITIVE">ADDITIVE - Phụ gia hương liệu & vi chất (L)</option>
              </select>
            </div>

            {/* Target Tank & Headspace Telemetry Strip */}
            <div className="p-3 bg-slate-50 border border-slate-200 space-y-2 rounded-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-slate-500" />
                  Bồn chứa đích (Target Silo):
                </span>
                <span className="font-bold text-slate-900 text-xs">
                  {MATERIAL_MAP[materialCode].tankId}
                </span>
              </div>
              <div className="text-[11px] text-slate-700">
                {MATERIAL_MAP[materialCode].tankName}
              </div>

              {/* Headspace Gauge Progress */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
                  <span>Tồn hiện tại: <strong>{targetTank?.currentStock.toLocaleString()} {MATERIAL_MAP[materialCode].unit}</strong></span>
                  <span>Dung tích: <strong>{targetTank?.capacity.toLocaleString()} {MATERIAL_MAP[materialCode].unit}</strong></span>
                </div>
                <div className="w-full h-2.5 bg-slate-200 rounded-xs overflow-hidden border border-slate-300">
                  <div
                    className={`h-full transition-all ${
                      (targetTank ? targetTank.currentStock / targetTank.capacity : 0) > 0.9
                        ? 'bg-rose-600'
                        : 'bg-slate-700'
                    }`}
                    style={{
                      width: `${Math.min(100, targetTank ? (targetTank.currentStock / targetTank.capacity) * 100 : 0)}%`,
                    }}
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Dung tích bồn còn trống (Available Headspace):</span>
                  <span className="font-bold font-mono text-emerald-700 text-xs">
                    {currentHeadspace.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {MATERIAL_MAP[materialCode].unit}
                  </span>
                </div>
              </div>
            </div>

            {/* Field 2 & 3: Receipt Code & Quantity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Mã phiếu nhập (Code):
                </label>
                <input
                  type="text"
                  value={receiptCode}
                  onChange={(e) => setReceiptCode(e.target.value)}
                  placeholder="INB-2026-001"
                  className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Số lượng nhập ({MATERIAL_MAP[materialCode].unit}):
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="1000"
                  className={`w-full bg-white border h-9 px-3 text-xs font-mono font-bold rounded-xs hallmark-focus ${
                    isOverflowRisk ? 'border-rose-500 bg-rose-50/30 text-rose-900' : 'border-slate-300 text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* Inline Headspace Safety Gate Warning */}
            {isOverflowRisk && (
              <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2.5 rounded-xs animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-[11px] block">
                    Cảnh báo an toàn: Vượt quá dung tích bồn chứa!
                  </span>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    Số lượng nhập (<strong>{numQuantity.toLocaleString()} {MATERIAL_MAP[materialCode].unit}</strong>) vượt quá dung tích còn trống khả dụng của bồn {MATERIAL_MAP[materialCode].tankId} (Khả dụng: <strong>{currentHeadspace.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {MATERIAL_MAP[materialCode].unit}</strong>). Nút [THÊM PHIẾU NHẬP] bị khóa để ngăn chặn nguy cơ tràn bồn.
                  </p>
                </div>
              </div>
            )}

            {/* Field 4 & 5: Supplier Lot & Note */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-slate-500" />
                Số lô nhà cung cấp (Supplier Lot Code):
              </label>
              <input
                type="text"
                value={supplierLot}
                onChange={(e) => setSupplierLot(e.target.value)}
                placeholder="LOT-VINAMILK-2026-09A"
                className="w-full bg-white border border-slate-300 h-9 px-3 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                Ghi chú kiểm định & Xe bồn (Notes):
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú xe bồn, độ chua, độ brix, tem niêm phong chì..."
                className="w-full bg-white border border-slate-300 p-2.5 text-xs font-mono text-slate-900 rounded-xs hallmark-focus"
              />
            </div>

            {/* Action Buttons Row */}
            <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center gap-2">
              {/* Add Button - Locked on overflow */}
              <button
                type="submit"
                disabled={isOverflowRisk}
                className={`h-9 px-4 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  isOverflowRisk
                    ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-800 text-white hallmark-focus active:translate-y-px'
                }`}
                title={isOverflowRisk ? 'Bị khóa: Số lượng vượt quá dung tích bồn' : 'Thêm phiếu nhập và tăng tồn kho bồn'}
              >
                {isOverflowRisk ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Khóa (Tràn bồn)</span>
                  </>
                ) : (
                  <>
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Thêm phiếu nhập</span>
                  </>
                )}
              </button>

              {/* Update Button */}
              <button
                type="button"
                onClick={handleUpdate}
                disabled={!selectedReceiptId || isOverflowRisk}
                className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  !selectedReceiptId || isOverflowRisk
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 hallmark-focus active:translate-y-px'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                <span>Cập nhật</span>
              </button>

              {/* Delete Button */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={!selectedReceiptId}
                className={`h-9 px-3.5 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs transition-all shadow-xs ${
                  !selectedReceiptId
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                    : 'bg-white hover:bg-rose-50 text-rose-700 border border-slate-300 hover:border-rose-300 hallmark-focus active:translate-y-px'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa</span>
              </button>

              {/* Clear Button */}
              <button
                type="button"
                onClick={handleClear}
                className="h-9 px-3.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5 rounded-xs hallmark-focus active:translate-y-px shadow-xs ml-auto"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Làm mới</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Inbound Transaction Ledger Table (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 shadow-xs flex flex-col">
          {/* Card Header & Search Bar */}
          <div className="p-4 bg-slate-100/70 border-b border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-slate-800" />
                <h3 className="font-bold text-slate-900 uppercase tracking-wide not-italic text-xs">
                  Sổ cái tiếp nhận nguyên vật liệu (Inbound Transaction Ledger)
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {filteredReceipts.length} PHIẾU NHẬP
              </span>
            </div>

            {/* Filter and Search Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm mã phiếu, số lô NCC, ghi chú..."
                  className="w-full bg-white border border-slate-300 h-9 pl-8 pr-3 text-xs font-mono rounded-xs hallmark-focus"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={materialFilter}
                  onChange={(e) => setMaterialFilter(e.target.value)}
                  className="bg-white border border-slate-300 h-9 px-2.5 text-xs font-mono rounded-xs hallmark-focus"
                >
                  <option value="ALL">Tất cả nguyên liệu</option>
                  <option value="RAW_MILK">RAW_MILK (Sữa tươi)</option>
                  <option value="SUGAR">SUGAR (Đường)</option>
                  <option value="ADDITIVE">ADDITIVE (Phụ gia)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 text-[10px] uppercase font-bold">
                  <th className="py-2.5 px-3 border-r border-slate-200 text-center w-28">Mã phiếu</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Nguyên vật liệu</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right w-24">Số lượng</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-36">Lô nhà cung cấp</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-36">Thời gian</th>
                  <th className="py-2.5 px-3 text-center w-28">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      Không có phiếu nhập nguyên liệu nào phù hợp với bộ lọc.
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((receipt) => {
                    const isSelected = selectedReceiptId === receipt.id;

                    return (
                      <tr
                        key={receipt.id}
                        onClick={() => handleSelectRow(receipt)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-[#E0F2FE] text-slate-900 font-semibold border-l-4 border-l-sky-600'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Receipt Code */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-center font-bold text-slate-900">
                          {receipt.receiptCode}
                        </td>

                        {/* Material & Target Tank */}
                        <td className="py-2.5 px-3 border-r border-slate-200">
                          <div className="font-bold text-slate-900">
                            {receipt.materialCode}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate max-w-[200px]" title={receipt.materialName}>
                            {receipt.materialName}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-right font-bold text-emerald-700">
                          +{receipt.quantity.toLocaleString()} {receipt.unit}
                        </td>

                        {/* Supplier Lot */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800">
                          <span className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded-xs text-[10px]">
                            {receipt.supplierLot}
                          </span>
                        </td>

                        {/* Timestamp */}
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 text-[10px]">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{receipt.timestamp}</span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-2.5 px-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs font-bold text-[10px] bg-emerald-100/70 text-emerald-800 border border-emerald-300">
                            <CheckCheck className="w-3 h-3 text-emerald-700" />
                            ĐÃ NHẬP KHO
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[10px] text-slate-500 font-mono">
            <div>
              <span>ĐANG CHỌN: <strong className="text-slate-800">{selectedReceiptId ? receiptCode : 'CHƯA CHỌN'}</strong></span>
              <span className="mx-2">•</span>
              <span>ĐỒNG BỘ: TỨC THÌ VÀO REAL-TIME STOCK (TAB 2)</span>
            </div>
            <div>
              <span>ISA-95 LEVEL 3 MATERIAL RECEIPT CONTROL</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
