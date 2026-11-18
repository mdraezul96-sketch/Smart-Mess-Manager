import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Info, Lock, Minus, Plus, Save, Unlock } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card } from '../components/UI';
import { formatBDT, formatMonthLabel, formatNumber, TEXT } from '../i18n/translations';
import { saveDailyMealsBatch, toggleMealLockForMonth } from '../services/messDataService';
import {
  calculateMonthlySummary,
  getMonthKeyFromDate,
  getTodayDateStr,
  round2,
} from '../utils/calculations';

interface DraftMealRow {
  breakfast: number;
  lunch: number;
  dinner: number;
  notes: string;
}

export const MealsPage: React.FC<{ initialTab?: 'entry' | 'calendar' | 'summary' }> = ({
  initialTab = 'entry',
}) => {
  const {
    actor,
    currentUser,
    lang,
    selectedMonth,
    setSelectedMonth,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests,
    monthlyClosings,
  } = useMess();

  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAdmin = currentUser?.role === 'admin';

  const [tab, setTab] = useState<'entry' | 'calendar' | 'summary'>(initialTab);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr);
  const [drafts, setDrafts] = useState<Record<string, DraftMealRow>>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dirtyRef = useRef<Record<string, boolean>>({});
  const draftsRef = useRef<Record<string, DraftMealRow>>({});
  const saveTimerRef = useRef<number | null>(null);
  const activeDateRef = useRef<string>(selectedDate);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(() => {
    activeDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members]
  );

  const visibleMembers = useMemo(() => {
    if (isManagerOrAdmin) return activeMembers;
    return members.filter(
      (m) => m.id === currentUser?.memberId || m.linkedUid === currentUser?.uid
    );
  }, [isManagerOrAdmin, activeMembers, members, currentUser]);

  // Reset dirty flags when selectedDate changes
  useEffect(() => {
    dirtyRef.current = {};
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const map: Record<string, DraftMealRow> = {};
    for (const m of visibleMembers) {
      const existing = mealEntries.find(
        (e) => e.date === selectedDate && e.memberId === m.id
      );
      map[m.id] = {
        breakfast: existing ? existing.breakfast : 0,
        lunch: existing ? existing.lunch : 0,
        dinner: existing ? existing.dinner : 0,
        notes: existing?.notes || '',
      };
    }
    setDrafts(map);
    draftsRef.current = map;
  }, [selectedDate]);

  // Hydrate clean rows from Dexie liveQuery without overwriting unsaved dirty cells
  useEffect(() => {
    setDrafts((prev) => {
      const next: Record<string, DraftMealRow> = { ...prev };
      let changed = false;
      for (const m of visibleMembers) {
        if (dirtyRef.current[m.id]) continue;
        const existing = mealEntries.find(
          (e) => e.date === selectedDate && e.memberId === m.id
        );
        const serverRow: DraftMealRow = {
          breakfast: existing ? existing.breakfast : 0,
          lunch: existing ? existing.lunch : 0,
          dinner: existing ? existing.dinner : 0,
          notes: existing?.notes || '',
        };
        const cur = next[m.id];
        if (
          !cur ||
          cur.breakfast !== serverRow.breakfast ||
          cur.lunch !== serverRow.lunch ||
          cur.dinner !== serverRow.dinner ||
          cur.notes !== serverRow.notes
        ) {
          next[m.id] = serverRow;
          changed = true;
        }
      }
      if (!changed) return prev;
      draftsRef.current = next;
      return next;
    });
  }, [mealEntries, visibleMembers, selectedDate]);

  const dateMonthKey = getMonthKeyFromDate(selectedDate);
  const isMonthClosed = useMemo(
    () => !!monthlyClosings.find((c) => c.monthKey === dateMonthKey)?.isClosed,
    [monthlyClosings, dateMonthKey]
  );

  const canEditSelectedDate = isManagerOrAdmin && (!isMonthClosed || isAdmin);

  const persistBatch = useCallback(
    async (memberIdsToSave?: string[]) => {
      if (!actor || !canEditSelectedDate) return;
      const targetDate = activeDateRef.current;
      const snapshotDrafts = draftsRef.current;
      const targetMembers = memberIdsToSave
        ? visibleMembers.filter((m) => memberIdsToSave.includes(m.id))
        : visibleMembers;
      if (targetMembers.length === 0) return;

      setSaving(true);
      setErrorMsg(null);
      try {
        await saveDailyMealsBatch(
          {
            date: targetDate,
            rows: targetMembers.map((m) => {
              const d = snapshotDrafts[m.id] || {
                breakfast: 0,
                lunch: 0,
                dinner: 0,
                notes: '',
              };
              return {
                member: m,
                breakfast: d.breakfast,
                lunch: d.lunch,
                dinner: d.dinner,
                notes: d.notes,
              };
            }),
          },
          actor
        );
        for (const m of targetMembers) {
          dirtyRef.current[m.id] = false;
        }
        setFeedback(
          lang === 'bn'
            ? `${targetDate} তারিখের মিল ও সকল হিসাব স্বয়ংক্রিয়ভাবে আপডেট হয়েছে।`
            : `Meals & all accounts auto-updated for ${targetDate}.`
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setSaving(false);
      }
    },
    [actor, canEditSelectedDate, visibleMembers, lang]
  );

  const scheduleAutoSave = useCallback(
    (delayMs = 280) => {
      if (!canEditSelectedDate) return;
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        saveTimerRef.current = null;
        const dirtyIds = Object.keys(dirtyRef.current).filter(
          (id) => dirtyRef.current[id]
        );
        if (dirtyIds.length > 0) {
          void persistBatch(dirtyIds);
        }
      }, delayMs);
    },
    [canEditSelectedDate, persistBatch]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const updateCell = (
    memberId: string,
    field: keyof DraftMealRow,
    val: number | string,
    autoSaveDelay = 380
  ) => {
    dirtyRef.current[memberId] = true;
    setDrafts((prev) => {
      const next = {
        ...prev,
        [memberId]: {
          ...(prev[memberId] || { breakfast: 0, lunch: 0, dinner: 0, notes: '' }),
          [field]: val,
        },
      };
      draftsRef.current = next;
      return next;
    });
    scheduleAutoSave(autoSaveDelay);
  };

  const adjustCell = (
    memberId: string,
    field: 'breakfast' | 'lunch' | 'dinner',
    delta: number
  ) => {
    if (!canEditSelectedDate) return;
    const currentVal = Number(draftsRef.current[memberId]?.[field] ?? 0);
    const nextVal = round2(Math.min(20, Math.max(0, currentVal + delta)));
    updateCell(memberId, field, nextVal, 220);
  };

  const setAllForPreset = () => {
    if (!canEditSelectedDate) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const m of visibleMembers) {
        dirtyRef.current[m.id] = true;
        next[m.id] = {
          ...(next[m.id] || { breakfast: 0, lunch: 0, dinner: 0, notes: '' }),
          breakfast: 1,
          lunch: 1,
          dinner: 1,
        };
      }
      draftsRef.current = next;
      return next;
    });
    scheduleAutoSave(120);
  };

  const handleSaveAll = async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await persistBatch();
  };

  const handleDateChange = (newDate: string) => {
    setFeedback(null);
    setSelectedDate(newDate);
    const newMonth = getMonthKeyFromDate(newDate);
    if (newMonth && newMonth !== selectedMonth) {
      setSelectedMonth(newMonth);
    }
  };

  const dailyTotals = useMemo(() => {
    let b = 0,
      l = 0,
      d = 0;
    for (const m of visibleMembers) {
      const row = drafts[m.id];
      if (row) {
        b += Number(row.breakfast || 0);
        l += Number(row.lunch || 0);
        d += Number(row.dinner || 0);
      }
    }
    return {
      breakfast: round2(b),
      lunch: round2(l),
      dinner: round2(d),
      total: round2(b + l + d),
    };
  }, [drafts, visibleMembers]);

  const activeMonthKey = tab === 'entry' ? dateMonthKey : selectedMonth;

  // Live monthly calculation (also reflects immediate unsaved edits on Entry tab!)
  const liveMealEntriesForMonth = useMemo(() => {
    const filtered = mealEntries.filter((e) => e.monthKey === activeMonthKey);
    if (tab !== 'entry') return filtered;

    const byId = new Map(filtered.map((e) => [e.id, e]));
    for (const m of visibleMembers) {
      const d = drafts[m.id];
      if (!d) continue;
      const id = `${selectedDate}_${m.id}`;
      const b = round2(Math.max(0, Number(d.breakfast || 0)));
      const l = round2(Math.max(0, Number(d.lunch || 0)));
      const dn = round2(Math.max(0, Number(d.dinner || 0)));
      const prev = byId.get(id);
      byId.set(id, {
        id,
        date: selectedDate,
        monthKey: dateMonthKey,
        memberId: m.id,
        memberUid: m.linkedUid || prev?.memberUid || '',
        memberName: m.fullName,
        breakfast: b,
        lunch: l,
        dinner: dn,
        totalMeals: round2(b + l + dn),
        notes: d.notes || '',
        isLocked: prev?.isLocked || false,
        createdAt: prev?.createdAt || '',
        updatedAt: prev?.updatedAt || '',
        createdBy: prev?.createdBy || actor?.uid || '',
      });
    }
    return Array.from(byId.values());
  }, [mealEntries, activeMonthKey, tab, visibleMembers, drafts, selectedDate, dateMonthKey, actor?.uid]);

  const liveMonthlySummary = useMemo(
    () =>
      calculateMonthlySummary({
        monthKey: activeMonthKey,
        members,
        mealEntries: liveMealEntriesForMonth,
        expenses,
        payments,
        guestMealRequests,
      }),
    [activeMonthKey, members, liveMealEntriesForMonth, expenses, payments, guestMealRequests]
  );

  // Monthly Summary & Calendar calculations
  const monthDays = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const dayNum = String(i + 1).padStart(2, '0');
      const dateStr = `${selectedMonth}-${dayNum}`;
      const entries = mealEntries.filter((e) => e.date === dateStr);
      const total = round2(entries.reduce((s, e) => s + Number(e.totalMeals || 0), 0));
      return { dayNum: i + 1, dateStr, total, count: entries.length };
    });
  }, [selectedMonth, mealEntries]);

  const memberMonthlyTotals = useMemo(() => {
    return visibleMembers.map((m) => {
      const entries = mealEntries.filter(
        (e) => e.monthKey === selectedMonth && e.memberId === m.id
      );
      const breakfast = round2(entries.reduce((s, e) => s + e.breakfast, 0));
      const lunch = round2(entries.reduce((s, e) => s + e.lunch, 0));
      const dinner = round2(entries.reduce((s, e) => s + e.dinner, 0));
      const total = round2(entries.reduce((s, e) => s + e.totalMeals, 0));
      const calc = liveMonthlySummary.memberCalculations.find((c) => c.member.id === m.id);
      return {
        member: m,
        breakfast,
        lunch,
        dinner,
        total,
        daysLogged: entries.length,
        foodCost: calc?.foodCost ?? 0,
        totalBill: calc?.totalBill ?? 0,
      };
    });
  }, [visibleMembers, mealEntries, selectedMonth, liveMonthlySummary]);

  const selectedMonthClosed = !!monthlyClosings.find((c) => c.monthKey === selectedMonth)?.isClosed;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.meals}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'মিল বাড়ালে/কমালে ড্যাশবোর্ড, মাসিক বিল ও সদস্যের হিসাব স্বয়ংক্রিয়ভাবে একসাথে আপডেট হয়'
              : 'Daily entries auto-save and immediately recalculate Dashboard, Monthly Bill & Member Accounts'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {([
            { id: 'entry', label: lang === 'bn' ? 'দৈনিক মিল এন্ট্রি' : 'Daily Entry' },
            { id: 'calendar', label: lang === 'bn' ? 'মিল ক্যালেন্ডার' : 'Calendar' },
            { id: 'summary', label: lang === 'bn' ? 'সদস্যভিত্তিক হিসাব' : 'Monthly Summary' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                tab === item.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Live Monthly Meal & Cost Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(activeMonthKey, lang)} · {lang === 'bn' ? 'মাসিক মোট মিল' : 'Monthly Total Meals'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-[#0F8B8D] dark:text-teal-300 mt-1">
            {formatNumber(liveMonthlySummary.totalMeals, lang, 1)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'মোট বাজার খরচ' : 'Market Expense'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatBDT(liveMonthlySummary.totalMarketCost, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'চলতি মিল রেট' : 'Current Meal Rate'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-[#17365D] dark:text-sky-300 mt-1">
            {formatBDT(liveMonthlySummary.mealRate, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'সদস্যদের মোট বিল' : 'Total Member Bills'}
          </div>
          <div className="text-xl font-bold font-mono-nums text-slate-900 dark:text-white mt-1">
            {formatBDT(liveMonthlySummary.totalBilled, lang)}
          </div>
        </Card>
      </div>

      {liveMonthlySummary.totalMeals > 0 && liveMonthlySummary.totalMarketCost === 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2.5">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {lang === 'bn'
              ? `${formatMonthLabel(activeMonthKey, lang)} মাসে মোট ${formatNumber(liveMonthlySummary.totalMeals, lang, 1)}টি মিল যুক্ত আছে, কিন্তু এখনো কোনো বাজার খরচ (Market Expense) এন্ট্রি না থাকায় মিল রেট ও খাবারের বিল ৳ ০ রয়েছে। "বাজার ও খরচ" পেজে বাজার খরচ যোগ করলেই সবার খাবারের টাকার হিসাব স্বয়ংক্রিয়ভাবে দেখা যাবে।`
              : `${formatNumber(liveMonthlySummary.totalMeals, lang, 1)} meals are logged for ${activeMonthKey}, but no Market Expense is recorded yet, so Meal Rate and Food Cost are currently ৳0. Add a Market Expense to automatically calculate food charges.`}
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
          {errorMsg}
        </div>
      )}
      {feedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {tab === 'entry' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 flex-wrap">
              <CalendarDays className="w-4 h-4 text-[#0F8B8D]" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
              />
              {isMonthClosed && (
                <span className="text-xs font-medium text-amber-600 inline-flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  {lang === 'bn' ? 'মাস বন্ধ' : 'Month Closed'}
                </span>
              )}
              {saving && (
                <span className="text-xs text-[#0F8B8D] font-medium">
                  {lang === 'bn' ? 'স্বয়ংক্রিয়ভাবে সেভ হচ্ছে...' : 'Auto-saving...'}
                </span>
              )}
            </div>

            {isManagerOrAdmin && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={!canEditSelectedDate}
                  onClick={setAllForPreset}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                >
                  {lang === 'bn' ? 'সবার ১-১-১ বসান' : 'Set All 1-1-1'}
                </button>
                <button
                  type="button"
                  disabled={saving || !canEditSelectedDate}
                  onClick={handleSaveAll}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {saving
                      ? lang === 'bn'
                        ? 'সংরক্ষণ হচ্ছে...'
                        : 'Saving...'
                      : lang === 'bn'
                        ? 'মিল সংরক্ষণ করুন'
                        : 'Save Meals'}
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                  <th className="text-left py-2.5 pr-2 font-medium">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
                  <th className="text-center py-2.5 px-1 font-medium">{lang === 'bn' ? 'সকাল' : 'Breakfast'}</th>
                  <th className="text-center py-2.5 px-1 font-medium">{lang === 'bn' ? 'দুপুর' : 'Lunch'}</th>
                  <th className="text-center py-2.5 px-1 font-medium">{lang === 'bn' ? 'রাত' : 'Dinner'}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{lang === 'bn' ? 'আজকের মোট' : 'Day Total'}</th>
                  <th className="text-right py-2.5 px-2 font-medium">{lang === 'bn' ? 'মাসের মিল' : 'Month Meals'}</th>
                  <th className="text-right py-2.5 pl-2 font-medium">{lang === 'bn' ? 'খাবার / মোট বিল' : 'Food / Total Bill'}</th>
                </tr>
              </thead>
              <tbody>
                {visibleMembers.map((m) => {
                  const row = drafts[m.id] || { breakfast: 0, lunch: 0, dinner: 0, notes: '' };
                  const rowTotal = round2(
                    Number(row.breakfast || 0) + Number(row.lunch || 0) + Number(row.dinner || 0)
                  );
                  const memberCalc = liveMonthlySummary.memberCalculations.find(
                    (c) => c.member.id === m.id
                  );

                  return (
                    <tr key={m.id} className="border-b border-slate-100 dark:border-slate-800/70">
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{m.fullName}</div>
                        <div className="text-xs text-slate-400">{m.roomNumber}</div>
                      </td>
                      {(['breakfast', 'lunch', 'dinner'] as const).map((mealType) => (
                        <td key={mealType} className="py-2.5 px-1 text-center">
                          <div className="inline-flex items-center gap-1">
                            {canEditSelectedDate && (
                              <button
                                type="button"
                                aria-label={`Decrease ${mealType} for ${m.fullName}`}
                                onClick={() => adjustCell(m.id, mealType, -1)}
                                className="w-7 h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                            )}
                            <input
                              type="number"
                              min="0"
                              max="20"
                              step="0.5"
                              disabled={!canEditSelectedDate}
                              value={row[mealType]}
                              onChange={(e) =>
                                updateCell(
                                  m.id,
                                  mealType,
                                  Math.min(20, Math.max(0, Number(e.target.value || 0)))
                                )
                              }
                              onBlur={() => {
                                if (dirtyRef.current[m.id]) {
                                  if (saveTimerRef.current !== null) {
                                    window.clearTimeout(saveTimerRef.current);
                                    saveTimerRef.current = null;
                                  }
                                  void persistBatch([m.id]);
                                }
                              }}
                              className="w-12 sm:w-14 min-h-[36px] text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono-nums text-sm text-slate-900 dark:text-slate-100 disabled:opacity-60"
                            />
                            {canEditSelectedDate && (
                              <button
                                type="button"
                                aria-label={`Increase ${mealType} for ${m.fullName}`}
                                onClick={() => adjustCell(m.id, mealType, 1)}
                                className="w-7 h-9 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      ))}
                      <td className="py-3 px-2 text-right font-bold font-mono-nums text-[#0F8B8D] dark:text-teal-300">
                        {formatNumber(rowTotal, lang, 1)}
                      </td>
                      <td className="py-3 px-2 text-right font-semibold font-mono-nums text-slate-800 dark:text-slate-200">
                        {formatNumber(memberCalc?.totalMeals ?? 0, lang, 1)}
                      </td>
                      <td className="py-3 pl-2 text-right font-mono-nums whitespace-nowrap">
                        <div className="font-semibold text-[#17365D] dark:text-sky-300">
                          {formatBDT(memberCalc?.foodCost ?? 0, lang)}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {lang === 'bn' ? 'মোট:' : 'Bill:'} {formatBDT(memberCalc?.totalBill ?? 0, lang)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-800/50 font-bold text-slate-900 dark:text-white">
                  <td className="py-3 px-2">{lang === 'bn' ? 'দৈনিক সর্বমোট' : 'Daily Total'}</td>
                  <td className="py-3 text-center font-mono-nums">{formatNumber(dailyTotals.breakfast, lang, 1)}</td>
                  <td className="py-3 text-center font-mono-nums">{formatNumber(dailyTotals.lunch, lang, 1)}</td>
                  <td className="py-3 text-center font-mono-nums">{formatNumber(dailyTotals.dinner, lang, 1)}</td>
                  <td className="py-3 px-2 text-right font-mono-nums text-[#0F8B8D] dark:text-teal-300">
                    {formatNumber(dailyTotals.total, lang, 1)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono-nums">
                    {formatNumber(liveMonthlySummary.totalMeals, lang, 1)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono-nums text-[#17365D] dark:text-sky-300">
                    {formatBDT(liveMonthlySummary.totalBilled, lang)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {tab === 'calendar' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {formatMonthLabel(selectedMonth, lang)} — {lang === 'bn' ? 'মিল ক্যালেন্ডার' : 'Meal Calendar'}
            </h3>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-h-[38px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            {monthDays.map((d) => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => {
                  setSelectedDate(d.dateStr);
                  setTab('entry');
                }}
                className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                  d.total > 0
                    ? 'border-[#0F8B8D]/40 bg-[#0F8B8D]/5 dark:bg-[#0F8B8D]/10'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-mono-nums font-semibold">
                    {formatNumber(d.dayNum, lang)}
                  </span>
                  <span>{d.dateStr.slice(5)}</span>
                </div>
                <div className="text-base font-bold font-mono-nums text-slate-900 dark:text-white mt-1.5">
                  {formatNumber(d.total, lang, 1)}{' '}
                  <span className="text-[11px] font-normal text-slate-400">
                    {lang === 'bn' ? 'মিল' : 'meals'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {tab === 'summary' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {formatMonthLabel(selectedMonth, lang)} — {lang === 'bn' ? 'সদস্যভিত্তিক মিল সারাংশ' : 'Member-wise Meal Summary'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="min-h-[38px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
              />
              {isAdmin && actor && (
                <button
                  type="button"
                  onClick={() => toggleMealLockForMonth(selectedMonth, !selectedMonthClosed, actor)}
                  className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {selectedMonthClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>
                    {selectedMonthClosed
                      ? lang === 'bn'
                        ? 'মিল আনলক'
                        : 'Unlock Meals'
                      : lang === 'bn'
                        ? 'মিল লক করুন'
                        : 'Lock Meals'}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <th className="text-left py-2.5">{lang === 'bn' ? 'সদস্য' : 'Member'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'এন্ট্রি দিন' : 'Days'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'সকাল' : 'Breakfast'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'দুপুর' : 'Lunch'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'রাত' : 'Dinner'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'মোট মিল' : 'Total Meals'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'খাবার বিল' : 'Food Cost'}</th>
                  <th className="text-right py-2.5">{lang === 'bn' ? 'মোট বিল' : 'Total Bill'}</th>
                </tr>
              </thead>
              <tbody>
                {memberMonthlyTotals.map((row) => (
                  <tr key={row.member.id} className="border-b border-slate-100 dark:border-slate-800/70">
                    <td className="py-2.5 font-medium text-slate-900 dark:text-white">{row.member.fullName}</td>
                    <td className="py-2.5 text-right font-mono-nums">{formatNumber(row.daysLogged, lang)}</td>
                    <td className="py-2.5 text-right font-mono-nums">{formatNumber(row.breakfast, lang, 1)}</td>
                    <td className="py-2.5 text-right font-mono-nums">{formatNumber(row.lunch, lang, 1)}</td>
                    <td className="py-2.5 text-right font-mono-nums">{formatNumber(row.dinner, lang, 1)}</td>
                    <td className="py-2.5 text-right font-bold font-mono-nums text-[#0F8B8D]">
                      {formatNumber(row.total, lang, 1)}
                    </td>
                    <td className="py-2.5 text-right font-mono-nums">{formatBDT(row.foodCost, lang)}</td>
                    <td className="py-2.5 text-right font-bold font-mono-nums text-[#17365D] dark:text-sky-300">
                      {formatBDT(row.totalBill, lang)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
};

