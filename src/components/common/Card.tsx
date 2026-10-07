/* Hallmark · component: Card · genre: modern-minimal · register: industrial-workbench
 * states: default
 * contrast: WCAG AA Pass
 */

import React from 'react';

interface CardProps {
  title: string;
  subtitle?: string;
  tag?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  tag,
  headerAction,
  children,
  footer,
  className = '',
}) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-none shadow-xs flex flex-col ${className}`}>
      {/* Card Header - Roman typography strictly enforced */}
      <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 tracking-tight font-sans not-italic">
              {title}
            </h2>
            {tag && (
              <span className="text-[11px] font-mono px-2 py-0.5 bg-slate-200 text-slate-700 font-medium">
                {tag}
              </span>
            )}
          </div>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-normal">{subtitle}</p>}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1">{children}</div>

      {/* Card Footer (Optional) */}
      {footer && (
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/60 text-xs text-slate-600 flex items-center justify-between font-mono">
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
