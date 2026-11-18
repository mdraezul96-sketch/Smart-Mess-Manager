import React, { useEffect, useState } from 'react';
import { HelpCircle, KeyRound, Lock, ShieldCheck, WifiOff } from 'lucide-react';
import { localDb } from '../db/localDb';
import { useMess } from '../context/MessContext';
import { Card, Modal, PWAInstallButton } from '../components/UI';

export const LoginPage: React.FC = () => {
  const {
    loginWithGoogle,
    unlockOfflineSession,
    isOnline,
    authError,
    lang,
    setLang,
    darkMode,
    toggleDarkMode,
  } = useMess();

  const [hasCachedSession, setHasCachedSession] = useState(false);
  const [cachedEmail, setCachedEmail] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  useEffect(() => {
    void localDb.cachedSession.get('current').then((c) => {
      if (c) {
        setHasCachedSession(true);
        setCachedEmail(c.email);
      }
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#F4F7FB] dark:bg-slate-950 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-5xl w-full mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/icon.svg"
            alt="Smart Mess Manager"
            className="w-10 h-10 rounded-xl shrink-0"
          />
          <div>
            <h1 className="text-lg font-bold text-[#17365D] dark:text-white leading-tight">
              Smart Mess Manager
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'একটি মেস, একটি ডিজিটাল হিসাব ব্যবস্থা'
                : 'One Mess, One Digital Accounting System'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton lang={lang} />
          <button
            type="button"
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {lang === 'bn' ? 'EN' : 'বাংলা'}
          </button>
          <button
            type="button"
            onClick={toggleDarkMode}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {darkMode ? (lang === 'bn' ? 'লাইট' : 'Light') : lang === 'bn' ? 'ডার্ক' : 'Dark'}
          </button>
        </div>
      </div>

      <div className="max-w-md w-full mx-auto my-8">
        <Card className="p-6 sm:p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#17365D]/10 dark:bg-[#0F8B8D]/20 text-[#17365D] dark:text-[#2dd4bf] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'মেস অ্যাকাউন্টে প্রবেশ করুন' : 'Sign in to Smart Mess'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'মেস মালিক, ম্যানেজার এবং সদস্যদের নিরাপদ অ্যাক্সেস'
                : 'Secure access for Mess Owner, Manager, and Members'}
            </p>
          </div>

          {!isOnline && (
            <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {lang === 'bn'
                  ? 'আপনি বর্তমানে অফলাইনে আছেন। পূর্বে অনুমোদিত ডিভাইসে ক্যাশড সেশন দিয়ে প্রবেশ করতে পারবেন।'
                  : 'You are currently offline. You can unlock your cached session on an already-authorized device.'}
              </span>
            </div>
          )}

          {authError && (
            <div className="p-3.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-semibold flex items-center justify-center gap-3 transition-colors cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {lang === 'bn'
                  ? 'Google অ্যাকাউন্ট দিয়ে সাইন ইন করুন'
                  : 'Sign in with Google'}
              </span>
            </button>

            {!isOnline && hasCachedSession && (
              <button
                type="button"
                onClick={unlockOfflineSession}
                className="w-full min-h-[46px] px-4 py-3 rounded-xl bg-[#0F8B8D] hover:bg-[#0d787a] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>
                  {lang === 'bn'
                    ? `অফলাইন সেশন খুলুন (${cachedEmail})`
                    : `Unlock Offline Session (${cachedEmail})`}
                </span>
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center gap-1.5 text-[#0F8B8D] hover:underline font-medium cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>
                {lang === 'bn'
                  ? 'অ্যাকাউন্ট রিকভারি ও রোল সহায়তা'
                  : 'Account Recovery & Role Help'}
              </span>
            </button>
            <span>BDT (৳) · PWA</span>
          </div>
        </Card>
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500">
        Smart Mess Manager · Offline-First Mess Accounting PWA
      </p>

      <Modal
        open={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title={lang === 'bn' ? 'অ্যাকাউন্ট রিকভারি ও রোল নির্দেশিকা' : 'Account Recovery & Role Guide'}
      >
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
              {lang === 'bn' ? 'পাসওয়ার্ড ভুলে গেলে বা লগইন সমস্যা হলে:' : 'Password Reset / Sign-In Help:'}
            </h4>
            <p>
              {lang === 'bn'
                ? 'এই অ্যাপটি নিরাপদ Google Sign-In ব্যবহার করে। পাসওয়ার্ড রিসেট করতে Google অ্যাকাউন্ট রিকভারি ব্যবহার করুন অথবা মেস মালিকের (Admin) সাথে যোগাযোগ করুন।'
                : 'This app uses secure Google Sign-In. To reset your password, use Google Account recovery or contact your Mess Owner.'}
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
              {lang === 'bn' ? 'রোল ও পারমিশন (Admin / Manager / Member):' : 'Roles & Permissions:'}
            </h4>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Owner / Admin:</strong>{' '}
                {lang === 'bn'
                  ? 'সম্পূর্ণ নিয়ন্ত্রণ, রোল পরিবর্তন, মাসিক হিসাব লক/আনলক, ব্যাকআপ ও রিস্টোর।'
                  : 'Full control, role assignment, month lock/unlock, backup & restore.'}
              </li>
              <li>
                <strong>Manager:</strong>{' '}
                {lang === 'bn'
                  ? 'দৈনিক মিল, বাজার খরচ, টাকা জমা, অতিথি ও মেনু পরিচালনা।'
                  : 'Daily meals, market/other expenses, deposits, guests & menu.'}
              </li>
              <li>
                <strong>Member:</strong>{' '}
                {lang === 'bn'
                  ? 'নিজের মিল, মাসিক বিল, টাকা জমার ইতিহাস, বকেয়া, মেনু ও নোটিশ দেখা।'
                  : 'View own meals, monthly bills, payments, due, weekly menu & notices.'}
              </li>
            </ul>
          </div>
        </div>
      </Modal>
    </div>
  );
};
