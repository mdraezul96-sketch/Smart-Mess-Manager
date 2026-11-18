import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে' };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendly = `${parsed.error} (${parsed.operationType || ''} ${parsed.path || ''})`;
        }
      } catch {
        // plain text error
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] dark:bg-slate-950 p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-rose-600 dark:text-rose-400">
              সিস্টেমে একটি ত্রুটি হয়েছে
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 break-words">
              {friendly}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2.5 rounded-lg bg-[#17365D] text-white text-sm font-medium hover:bg-[#1e4678] transition-colors cursor-pointer"
            >
              পুনরায় লোড করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
