import React, { useEffect } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Language } from '../types/mess';

export const Card: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}> = ({ children, className = '', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl ${
      onClick ? 'cursor-pointer hover:border-[#0F8B8D]/60 transition-colors' : ''
    } ${className}`}
  >
    {children}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}> = ({ open, onClose, title, children, maxWidth = 'max-w-lg' }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate pr-4">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

export const ConfirmModal: React.FC<{
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger = false,
  onConfirm,
  onCancel,
}) => (
  <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
    <div className="space-y-5">
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer ${
            danger
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-[#17365D] hover:bg-[#1e4678]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </Modal>
);

export const InputField: React.FC<{
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
}> = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  min,
  max,
  step,
  disabled,
}) => (
  <label className="block space-y-1.5">
    <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40 focus:border-[#0F8B8D] disabled:opacity-60"
    />
  </label>
);

export const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  disabled?: boolean;
}> = ({ label, value, onChange, options, required, disabled }) => (
  <label className="block space-y-1.5">
    <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
      {label} {required && <span className="text-rose-500">*</span>}
    </span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#0F8B8D]/40 focus:border-[#0F8B8D] disabled:opacity-60"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </label>
);

export const PWAInstallButton: React.FC<{ lang: Language }> = ({ lang }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = React.useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0F8B8D] text-white text-xs font-medium hover:bg-[#0d787a] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="w-4 h-4" />
        <span>{lang === 'bn' ? 'অ্যাপ ইনস্টল করুন' : 'Install App'}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Share className="w-4 h-4" />
          <span>{lang === 'bn' ? 'হোম স্ক্রিনে যোগ করুন' : 'Install on iOS'}</span>
        </button>

        <Modal
          open={showIOSGuide}
          onClose={() => setShowIOSGuide(false)}
          title={lang === 'bn' ? 'iPhone / iPad-এ ইনস্টল করুন' : 'Install on iPhone / iPad'}
          maxWidth="max-w-sm"
        >
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <p>
              {lang === 'bn'
                ? '১. Safari ব্রাউজারের নিচের Share বাটনে ট্যাপ করুন।'
                : '1. Tap the Share button in Safari toolbar.'}
            </p>
            <p>
              {lang === 'bn'
                ? '২. স্ক্রল করে "Add to Home Screen" নির্বাচন করুন।'
                : '2. Scroll down and tap "Add to Home Screen".'}
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-lg bg-[#17365D] text-white text-sm font-medium cursor-pointer"
            >
              {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
            </button>
          </div>
        </Modal>
      </>
    );
  }

  return null;
};
