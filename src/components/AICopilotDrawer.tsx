/* Hallmark · component: AICopilotDrawer · genre: modern-minimal · register: industrial-workbench
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: WCAG AA Pass
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2,
  Cpu,
  Layers,
  Thermometer,
  Boxes
} from 'lucide-react';

export interface ActionProposal {
  action_type: 'LOAD_RECIPE_SETPOINTS' | 'EXECUTE_BATCH_COMMAND';
  summary: string;
  payload: {
    action: string;
    recipe_code?: string;
    recipe_name?: string;
    order_code?: string;
    temperature_sp?: number;
    weight_sp?: number;
    target_nodes?: Array<{ tag: string; node_id: string; value: number; unit: string }>;
    command?: string;
    target_node?: string;
    reason?: string;
    [key: string]: any;
  };
  status?: 'pending' | 'confirmed' | 'cancelled';
  executedAt?: string;
  executionResult?: string;
}

export interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actionProposal?: ActionProposal | null;
}

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  { label: 'Kiểm tra tồn kho Silo', icon: Boxes, query: 'Kiểm tra mức nguyên liệu tồn kho trong các bồn chứa Silo và cảnh báo bồn nào dưới mức an toàn.' },
  { label: 'Tiến độ đơn hàng', icon: Layers, query: 'Báo cáo danh sách các lệnh sản xuất đang chạy (RUNNING) hoặc sẵn sàng (READY) trong hệ thống.' },
  { label: 'Nhiệt độ tiệt trùng PV', icon: Thermometer, query: 'Đọc giá trị Process Values (PV) thời gian thực từ trạm Kepware: nhiệt độ tiệt trùng, mức bồn và tốc độ khuấy.' },
  { label: 'Sức khỏe thiết bị', icon: Cpu, query: 'Kiểm tra tình trạng vận hành và cảnh báo bảo trì cho các thiết bị chính trong dây chuyền.' },
];

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: 'msg-welcome',
      role: 'assistant',
      content: `Xin chào Operator! Tôi là **MES Operations AI Copilot** (Level 3 MOM & ISA-88 Batch Supervisor).\n\nTôi có thể hỗ trợ bạn:\n* 🔍 **Tra cứu đơn hàng** và trạng thái mẻ sản xuất từ SQL Server.\n* 🥛 **Giám sát tồn kho** Silo sữa thô, đường, phụ gia thời gian thực.\n* 🌡️ **Đọc cảm biến SCADA/Kepware** (Nhiệt độ tiệt trùng, áp suất, cánh khuấy).\n* ⚙️ **Lập đề xuất nạp công thức** (Setpoints) hoặc phát lệnh điều khiển mẻ (START / STOP / HOLD) với cơ chế kiểm duyệt **Human-in-the-Loop** an toàn.\n\nBạn có thể chọn phím tắt bên dưới hoặc nhập câu hỏi trực tiếp:`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);
  const [copilotStatus, setCopilotStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [activeModel, setActiveModel] = useState<string>('claude-3.5-sonnet');
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      checkCopilotHealth();
    }
  }, [isOpen, messages]);

  // Health check on OpenRouter backend
  const checkCopilotHealth = async () => {
    try {
      const res = await fetch('/api/ai/health');
      if (res.ok) {
        const data = await res.json();
        setCopilotStatus(data.status === 'online' ? 'online' : 'offline');
        if (data.model) {
          const modelParts = data.model.split('/');
          setActiveModel(modelParts[modelParts.length - 1] || data.model);
        }
      } else {
        setCopilotStatus('offline');
      }
    } catch {
      setCopilotStatus('offline');
    }
  };

  // Toast feedback auto-clear
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => setToastNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Handle Send message
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessageItem = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      // Build conversation payload
      const historyPayload = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: historyPayload
        })
      });

      if (!res.ok) {
        throw new Error(`Mã lỗi máy chủ HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.model) {
        const parts = data.model.split('/');
        setActiveModel(parts[parts.length - 1] || data.model);
      }
      
      const assistantMessage: ChatMessageItem = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: data.message || 'Đã hoàn tất xử lý yêu cầu.',
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        actionProposal: data.action_proposal ? {
          ...data.action_proposal,
          status: 'pending'
        } : null
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessageItem = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `⚠️ **Không thể kết nối đến AI Copilot:** ${err?.message || 'Lỗi mạng hoặc máy chủ không phản hồi.'}\n\n*Hệ thống MES và dữ liệu SQL Server vẫn hoạt động bình thường.*`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Human-in-the-Loop Action Confirmation
  const handleConfirmAction = async (msgId: string, proposal: ActionProposal) => {
    setExecutingActionId(msgId);
    try {
      const res = await fetch('/api/ai/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_type: proposal.action_type,
          payload: proposal.payload,
          user: 'Operator'
        })
      });

      const data = await res.json();
      const isSuccess = res.ok && (data.status === 'success' || data.status === 'partial_success');

      if (isSuccess) {
        setMessages(prev => prev.map(m => {
          if (m.id === msgId && m.actionProposal) {
            return {
              ...m,
              actionProposal: {
                ...m.actionProposal,
                status: 'confirmed',
                executedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                executionResult: data.message || 'Thao tác đã được nạp thành công.'
              }
            };
          }
          return m;
        }));

        setToastNotification({
          type: 'success',
          message: data.message || 'Đã nạp thành công lệnh xuống trạm điều khiển PLC!'
        });
      } else {
        throw new Error(data.detail || data.message || 'Thao tác thất bại');
      }
    } catch (err: any) {
      setToastNotification({
        type: 'error',
        message: `Lỗi thực thi: ${err?.message || 'Không thể gửi lệnh xuống PLC.'}`
      });
    } finally {
      setExecutingActionId(null);
    }
  };

  // Operator Action Cancellation
  const handleCancelAction = (msgId: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id === msgId && m.actionProposal) {
        return {
          ...m,
          actionProposal: {
            ...m.actionProposal,
            status: 'cancelled',
            executedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
            executionResult: 'Người vận hành đã từ chối thực thi đề xuất này.'
          }
        };
      }
      return m;
    }));
    setToastNotification({
      type: 'error',
      message: 'Đã hủy bỏ đề xuất điều khiển.'
    });
  };

  // Clear chat history
  const handleClearChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `Đã làm mới phiên hội thoại. Tôi đã sẵn sàng tiếp nhận các yêu cầu tra cứu mẻ và đề xuất nạp công thức.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      }
    ]);
  };

  // Textarea dynamic height
  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Basic Markdown Renderer for Industrial Technical Register
  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 text-xs text-slate-800 font-sans leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();

          // Header level 3 / 2
          if (trimmed.startsWith('### ')) {
            return (
              <h4 key={idx} className="font-mono font-bold text-slate-900 uppercase text-xs pt-2 pb-0.5 border-b border-slate-200">
                {trimmed.replace('### ', '')}
              </h4>
            );
          }
          if (trimmed.startsWith('## ')) {
            return (
              <h3 key={idx} className="font-mono font-bold text-slate-900 uppercase text-sm pt-2 pb-1 border-b border-slate-200">
                {trimmed.replace('## ', '')}
              </h3>
            );
          }
          if (trimmed.startsWith('# ')) {
            return (
              <h2 key={idx} className="font-mono font-bold text-slate-900 uppercase text-sm pt-2 pb-1">
                {trimmed.replace('# ', '')}
              </h2>
            );
          }

          // Bullet point
          if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
            const content = trimmed.substring(2);
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-slate-400 font-mono mt-0.5">•</span>
                <span className="flex-1">{formatInlineStyles(content)}</span>
              </div>
            );
          }

          // Numbered item
          const matchNum = trimmed.match(/^(\d+)\.\s+(.*)/);
          if (matchNum) {
            return (
              <div key={idx} className="flex items-start gap-1.5 pl-1">
                <span className="text-slate-500 font-mono text-[11px] font-semibold">{matchNum[1]}.</span>
                <span className="flex-1">{formatInlineStyles(matchNum[2])}</span>
              </div>
            );
          }

          // Blank line
          if (!trimmed) {
            return <div key={idx} className="h-1" />;
          }

          // Regular paragraph
          return <p key={idx}>{formatInlineStyles(line)}</p>;
        })}
      </div>
    );
  };

  // Helper for inline bold, code, tags
  const formatInlineStyles = (str: string) => {
    // Split by code backticks or bold asterisks
    const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-semibold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="font-mono text-[11px] bg-slate-200 text-slate-800 px-1 py-0.5 rounded-xs border border-slate-300">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/25 backdrop-blur-[1px] z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Drawer Panel */}
      <aside 
        role="dialog"
        aria-modal="true"
        aria-label="MES Operations AI Copilot"
        className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[480px] lg:w-[540px] bg-white border-l border-slate-300 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
      >
        {/* ==================================================================== */}
        {/* DRAWER HEADER (HALLMARK INDUSTRIAL-WORKBENCH)                        */}
        {/* ==================================================================== */}
        <div className="h-14 border-b border-slate-200 px-4 bg-slate-50 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xs bg-slate-900 flex items-center justify-center text-white border border-slate-800 shadow-xs">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-xs text-slate-900 tracking-wider uppercase">
                  MES OPERATIONS COPILOT
                </span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-xs text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {copilotStatus === 'online' ? 'ACTIVE' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <span>MODEL:</span>
                <span className="text-slate-800 font-semibold">{activeModel}</span>
                <span>•</span>
                <span>ISA-88 BATCH</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleClearChat}
              title="Làm mới lịch sử chat"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-xs transition-colors hallmark-focus"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              title="Đóng cửa sổ Copilot"
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xs transition-colors hallmark-focus"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Toast Alert */}
        {toastNotification && (
          <div className={`px-4 py-2 text-xs font-mono flex items-center justify-between border-b ${
            toastNotification.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <span className="truncate">{toastNotification.message}</span>
            <button 
              type="button" 
              onClick={() => setToastNotification(null)}
              className="text-slate-400 hover:text-slate-700 ml-2"
            >
              ×
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MESSAGE STREAM AREA                                                  */}
        {/* ==================================================================== */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isSystem = msg.role === 'system';

            return (
              <div 
                key={msg.id} 
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Message Header Tag */}
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400 mb-1 px-1">
                  <span>{isUser ? 'OPERATOR' : (isSystem ? 'SYSTEM ALERT' : 'AI COPILOT')}</span>
                  <span>•</span>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Message Container */}
                <div className={`max-w-[94%] rounded-xs p-3 text-xs leading-relaxed border transition-all ${
                  isUser 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                    : isSystem
                    ? 'bg-rose-50 border-rose-300 text-rose-900'
                    : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                }`}>
                  {isUser ? (
                    <div className="whitespace-pre-wrap font-sans text-xs">{msg.content}</div>
                  ) : (
                    renderMarkdown(msg.content)
                  )}

                  {/* ============================================================ */}
                  {/* HUMAN-IN-THE-LOOP ACTION CONFIRMATION CARD (AMBER CAUTION)   */}
                  {/* ============================================================ */}
                  {msg.actionProposal && (
                    <div className="mt-3.5 pt-3 border-t border-slate-200">
                      <div className="border border-amber-300 bg-amber-50/80 rounded-xs p-3 font-sans">
                        {/* Caution Header */}
                        <div className="flex items-center gap-2 text-amber-800 font-mono font-bold text-[11px] uppercase tracking-wider mb-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>YÊU CẦU XÁC NHẬN ĐIỀU KHIỂN (OPERATOR APPROVAL)</span>
                        </div>

                        {/* Summary */}
                        <p className="text-xs text-slate-800 mb-2.5 font-medium leading-snug">
                          {msg.actionProposal.summary}
                        </p>

                        {/* Technical Specs Details Table */}
                        <div className="bg-white border border-amber-200 rounded-xs p-2 text-[11px] font-mono space-y-1 mb-3 text-slate-700">
                          <div className="flex justify-between border-b border-slate-100 pb-1">
                            <span className="text-slate-500">LOẠI THAO TÁC:</span>
                            <span className="font-bold text-slate-900">{msg.actionProposal.action_type}</span>
                          </div>

                          {msg.actionProposal.payload.order_code && (
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">MÃ ĐƠN HÀNG:</span>
                              <span className="font-semibold text-slate-900">{msg.actionProposal.payload.order_code}</span>
                            </div>
                          )}

                          {msg.actionProposal.payload.temperature_sp !== undefined && (
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">NHIỆT ĐỘ CÀI ĐẶT SP:</span>
                              <span className="font-bold text-emerald-700">{msg.actionProposal.payload.temperature_sp} °C</span>
                            </div>
                          )}

                          {msg.actionProposal.payload.weight_sp !== undefined && (
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">KHỐI LƯỢNG MẺ SP:</span>
                              <span className="font-bold text-slate-900">{msg.actionProposal.payload.weight_sp} L/kg</span>
                            </div>
                          )}

                          {msg.actionProposal.payload.command && (
                            <div className="flex justify-between border-b border-slate-100 pb-1">
                              <span className="text-slate-500">LỆNH ISA-88:</span>
                              <span className="font-bold text-blue-700 uppercase">{msg.actionProposal.payload.command}</span>
                            </div>
                          )}

                          {msg.actionProposal.payload.target_node && (
                            <div className="flex justify-between text-[10px] pt-0.5">
                              <span className="text-slate-400">OPC UA NODE:</span>
                              <span className="text-slate-600 truncate max-w-[240px]">{msg.actionProposal.payload.target_node}</span>
                            </div>
                          )}
                        </div>

                        {/* State 1: Pending Authorization */}
                        {msg.actionProposal.status === 'pending' && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={executingActionId === msg.id}
                              onClick={() => handleConfirmAction(msg.id, msg.actionProposal!)}
                              className="flex-1 flex items-center justify-center gap-1.5 h-8 px-3 rounded-xs font-mono font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 transition-all hallmark-focus"
                            >
                              {executingActionId === msg.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>ĐANG GHI XUỐNG PLC...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>[✓ XÁC NHẬN NẠP XUỐNG PLC]</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={executingActionId === msg.id}
                              onClick={() => handleCancelAction(msg.id)}
                              className="h-8 px-3 rounded-xs font-mono text-xs text-rose-700 bg-white border border-rose-300 hover:bg-rose-50 active:bg-rose-100 disabled:opacity-60 transition-all hallmark-focus"
                            >
                              [✕ HỦY BỎ]
                            </button>
                          </div>
                        )}

                        {/* State 2: Confirmed Execution */}
                        {msg.actionProposal.status === 'confirmed' && (
                          <div className="flex items-center gap-2 p-2 bg-emerald-50 border border-emerald-300 rounded-xs text-[11px] font-mono text-emerald-800">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <div className="flex-1">
                              <div className="font-bold">ĐÃ NẠP XUỐNG PLC THÀNH CÔNG</div>
                              <div className="text-[10px] text-emerald-700">{msg.actionProposal.executionResult} ({msg.actionProposal.executedAt})</div>
                            </div>
                          </div>
                        )}

                        {/* State 3: Cancelled by Operator */}
                        {msg.actionProposal.status === 'cancelled' && (
                          <div className="flex items-center gap-2 p-2 bg-slate-100 border border-slate-300 rounded-xs text-[11px] font-mono text-slate-600">
                            <XCircle className="w-4 h-4 text-slate-500 shrink-0" />
                            <span>ĐÃ HỦY BỎ BỞI OPERATOR ({msg.actionProposal.executedAt})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-xs text-xs text-slate-600 font-mono shadow-xs animate-pulse">
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
              <span>Copilot đang phân tích telemetry và truy vấn dữ liệu MES...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ==================================================================== */}
        {/* QUICK ACTION PROMPT CHIPS                                            */}
        {/* ==================================================================== */}
        <div className="px-3 py-2 bg-slate-100 border-t border-slate-200 shrink-0 select-none">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold shrink-0">
              GỢI Ý:
            </span>
            {QUICK_PROMPTS.map((p, i) => {
              const Icon = p.icon;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSendMessage(p.query)}
                  className="flex items-center gap-1 shrink-0 px-2 py-1 bg-white hover:bg-slate-200 active:bg-slate-300 border border-slate-300 rounded-xs text-[11px] font-medium text-slate-700 transition-colors hallmark-focus disabled:opacity-50"
                >
                  <Icon className="w-3 h-3 text-slate-500" />
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ==================================================================== */}
        {/* BOTTOM INPUT TEXTAREA                                                */}
        {/* ==================================================================== */}
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <div className="relative flex items-end gap-2 border border-slate-300 rounded-xs focus-within:ring-2 focus-within:ring-sky-500 focus-within:border-sky-500 bg-white p-1.5 transition-all">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Nhập yêu cầu: 'Kiểm tra tồn kho', 'Đề xuất nạp công thức Fresh Milk 140°C'..."
              className="flex-1 max-h-28 min-h-[36px] resize-none bg-transparent text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none p-1 font-sans leading-relaxed"
            />

            <button
              type="button"
              disabled={!inputMessage.trim() || isLoading}
              onClick={() => handleSendMessage()}
              className="h-8 w-8 rounded-xs bg-slate-900 hover:bg-slate-800 active:bg-slate-950 disabled:bg-slate-200 disabled:text-slate-400 text-white flex items-center justify-center transition-colors hallmark-focus shrink-0"
              title="Gửi tin nhắn (Enter)"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1.5 px-0.5">
            <span>Enter gửi tin nhắn • Shift+Enter xuống dòng</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>AN TOÀN CÔNG NGHIỆP ISA-88</span>
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
