import React from 'react';
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react';
import { SubmissionStatus } from '../types';

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 min-h-10 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 min-h-10 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const buttonDanger =
  'inline-flex items-center justify-center gap-2 min-h-10 px-4 py-2 rounded-lg bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export const iconButton =
  'inline-flex items-center justify-center w-9 h-9 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer';

export const inputClass =
  'w-full min-h-10 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500';

export const labelClass = 'block text-sm font-semibold text-slate-800 mb-1.5';

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({ className = '', children }) => (
  <section className={`bg-white rounded-xl border border-slate-200 ${className}`}>{children}</section>
);

export const StepHeading: React.FC<{ title: string; description: string; actions?: React.ReactNode }> = ({
  title,
  description,
  actions,
}) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-600 mt-1">{description}</p>
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

const NOTICE_STYLES = {
  info: { box: 'bg-blue-50 border-blue-200 text-blue-900', icon: Info },
  warning: { box: 'bg-amber-50 border-amber-200 text-amber-900', icon: AlertCircle },
  error: { box: 'bg-rose-50 border-rose-200 text-rose-900', icon: AlertCircle },
  success: { box: 'bg-emerald-50 border-emerald-200 text-emerald-900', icon: CheckCircle2 },
};

export const Notice: React.FC<{
  tone: keyof typeof NOTICE_STYLES;
  children: React.ReactNode;
  action?: React.ReactNode;
}> = ({ tone, children, action }) => {
  const { box, icon: Icon } = NOTICE_STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-lg border text-sm ${box}`}
    >
      <span className="flex items-start gap-2 flex-1 min-w-48">
        <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <span>{children}</span>
      </span>
      {action}
    </div>
  );
};

const STATUS_STYLES: Record<SubmissionStatus, { label: string; className: string }> = {
  chua_cham: { label: 'Chưa chấm', className: 'bg-slate-100 text-slate-700' },
  dang_cham: { label: 'Đang chấm', className: 'bg-blue-100 text-blue-800' },
  cho_duyet: { label: 'Chờ duyệt', className: 'bg-amber-100 text-amber-900' },
  da_duyet: { label: 'Đã duyệt', className: 'bg-emerald-100 text-emerald-900' },
};

export const StatusBadge: React.FC<{
  status: SubmissionStatus;
  isGrading?: boolean;
  isWaiting?: boolean;
  hasFailed?: boolean;
}> = ({ status, isGrading, isWaiting, hasFailed }) => {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap';
  if (isGrading) {
    return (
      <span className={`${base} ${STATUS_STYLES.dang_cham.className}`}>
        <Loader2 className="w-3 h-3 animate-spin" />
        Đang chấm
      </span>
    );
  }
  if (isWaiting) return <span className={`${base} bg-blue-50 text-blue-800`}>Trong hàng chờ</span>;
  if (hasFailed) return <span className={`${base} bg-rose-100 text-rose-800`}>Lỗi khi chấm</span>;
  const style = STATUS_STYLES[status] || STATUS_STYLES.chua_cham;
  return <span className={`${base} ${style.className}`}>{style.label}</span>;
};

export const Modal: React.FC<{
  title: string;
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, labelledBy, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="bg-white rounded-xl w-full max-w-md border border-slate-200 shadow-xl"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200">
        <h3 id={labelledBy} className="font-bold text-slate-900">
          {title}
        </h3>
        <button type="button" onClick={onClose} aria-label="Đóng" className={iconButton}>
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);
