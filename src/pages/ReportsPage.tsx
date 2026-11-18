import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card } from '../components/UI';
import { formatBDT, formatMonthLabel, TEXT } from '../i18n/translations';
import { ExportColumn, exportToCSV, exportToExcel, exportToPDF } from '../services/exportService';
import { calculateMonthlySummary, computeRoomOccupancy, getTodayDateStr, round2 } from '../utils/calculations';

type ReportType =
  | 'monthly'
  | 'daily'
  | 'weekly'
  | 'yearly'
  | 'member'
  | 'market'
  | 'meal'
  | 'payment'
  | 'due'
  | 'guest'
  | 'room';

export const ReportsPage: React.FC = () => {
  const {
    lang,
    selectedMonth,
    setSelectedMonth,
    rooms,
    members,
    mealEntries,
    expenses,
    payments,
    guests,
    guestMealRequests,
  } = useMess();

  const t = TEXT[lang];
  const [reportType, setReportType] = useState<ReportType>('monthly');
  const [selectedDate, setSelectedDate] = useState(getTodayDateStr);
  const [selectedMemberId, setSelectedMemberId] = useState(members[0]?.id || '');

  const reportOptions: { id: ReportType; label: string }[] = [
    { id: 'monthly', label: lang === 'bn' ? 'মাসিক বিল ও ক্যাশ ফ্লো রিপোর্ট' : 'Monthly Bill & Cash Flow' },
    { id: 'daily', label: lang === 'bn' ? 'দৈনিক রিপোর্ট' : 'Daily Report' },
    { id: 'weekly', label: lang === 'bn' ? 'সাপ্তাহিক রিপোর্ট' : 'Weekly Report' },
    { id: 'yearly', label: lang === 'bn' ? 'বার্ষিক রিপোর্ট' : 'Yearly Report' },
    { id: 'member', label: lang === 'bn' ? 'সদস্যভিত্তিক রিপোর্ট' : 'Member-wise Report' },
    { id: 'market', label: lang === 'bn' ? 'বাজার খরচ রিপোর্ট' : 'Market Expense Report' },
    { id: 'meal', label: lang === 'bn' ? 'মিল রিপোর্ট' : 'Meal Report' },
    { id: 'payment', label: lang === 'bn' ? 'পেমেন্ট রিপোর্ট' : 'Payment Report' },
    { id: 'due', label: lang === 'bn' ? 'বকেয়া রিপোর্ট' : 'Due Report' },
    { id: 'guest', label: lang === 'bn' ? 'অতিথি রিপোর্ট' : 'Guest Report' },
    { id: 'room', label: lang === 'bn' ? 'রুম ও সিট রিপোর্ট' : 'Room & Seat Report' },
  ];

  const reportData = useMemo((): {
    title: string;
    subtitle: string;
    columns: ExportColumn[];
    rows: Record<string, unknown>[];
    summaryLines: string[];
  } => {
    const summary = calculateMonthlySummary({
      monthKey: selectedMonth,
      members,
      mealEntries,
      expenses,
      payments,
      guestMealRequests,
    });
    const yearPrefix = selectedMonth.slice(0, 4);

    switch (reportType) {
      case 'daily': {
        const dayMeals = mealEntries.filter((e) => e.date === selectedDate);
        const dayExps = expenses.filter((e) => e.date === selectedDate && !e.isVoided);
        const rows = [
          ...dayMeals.map((m) => ({
            type: 'Meal',
            name: m.memberName,
            detail: `B:${m.breakfast} L:${m.lunch} D:${m.dinner}`,
            value: m.totalMeals,
          })),
          ...dayExps.map((e) => ({
            type: e.expenseGroup === 'market' ? 'Market' : 'Other',
            name: e.itemName,
            detail: e.category,
            value: e.amount,
          })),
        ];
        return {
          title: `Daily Report (${selectedDate})`,
          subtitle: `Meals & Expenses on ${selectedDate}`,
          columns: [
            { header: 'Type', key: 'type' },
            { header: 'Name / Item', key: 'name' },
            { header: 'Detail', key: 'detail' },
            { header: 'Value / BDT', key: 'value' },
          ],
          rows,
          summaryLines: [
            `Total Meals: ${dayMeals.reduce((s, m) => s + m.totalMeals, 0)}`,
            `Total Expense: BDT ${dayExps.reduce((s, e) => s + e.amount, 0)}`,
          ],
        };
      }

      case 'weekly': {
        const end = new Date(selectedDate);
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        const startStr = start.toISOString().slice(0, 10);
        const weekExps = expenses.filter((e) => !e.isVoided && e.date >= startStr && e.date <= selectedDate);
        return {
          title: `Weekly Report (${startStr} to ${selectedDate})`,
          subtitle: '7-day expense summary',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Group', key: 'group' },
            { header: 'Category', key: 'category' },
            { header: 'Item', key: 'item' },
            { header: 'Amount', key: 'amount' },
          ],
          rows: weekExps.map((e) => ({
            date: e.date,
            group: e.expenseGroup,
            category: e.category,
            item: e.itemName,
            amount: e.amount,
          })),
          summaryLines: [`Weekly Total Expense: BDT ${round2(weekExps.reduce((s, e) => s + e.amount, 0))}`],
        };
      }

      case 'yearly': {
        const months = Array.from({ length: 12 }, (_, i) => `${yearPrefix}-${String(i + 1).padStart(2, '0')}`);
        const rows = months.map((mk) => {
          const mExp = expenses.filter((e) => e.monthKey === mk && !e.isVoided).reduce((s, e) => s + e.amount, 0);
          const mPay = payments.filter((p) => p.monthKey === mk && !p.isVoided).reduce((s, p) => s + p.amount, 0);
          const mMeals = mealEntries.filter((m) => m.monthKey === mk).reduce((s, m) => s + m.totalMeals, 0);
          return {
            month: mk,
            meals: round2(mMeals),
            expense: round2(mExp),
            deposit: round2(mPay),
            net: round2(mPay - mExp),
          };
        });
        return {
          title: `Yearly Report (${yearPrefix})`,
          subtitle: 'Month-by-month Cash Flow & Meal Totals',
          columns: [
            { header: 'Month', key: 'month' },
            { header: 'Meals', key: 'meals' },
            { header: 'Expenses', key: 'expense' },
            { header: 'Deposits', key: 'deposit' },
            { header: 'Net Flow', key: 'net' },
          ],
          rows,
          summaryLines: [
            `Total Year Expense: BDT ${round2(rows.reduce((s, r) => s + r.expense, 0))}`,
            `Total Year Deposits: BDT ${round2(rows.reduce((s, r) => s + r.deposit, 0))}`,
          ],
        };
      }

      case 'member': {
        const m = members.find((mem) => mem.id === selectedMemberId) || members[0];
        const mCalc = summary.memberCalculations.find((c) => c.member.id === m?.id);
        const mPays = payments.filter((p) => p.memberId === m?.id && p.monthKey === selectedMonth && !p.isVoided);
        return {
          title: `Member Report: ${m?.fullName || ''}`,
          subtitle: `Month: ${selectedMonth}`,
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Method', key: 'method' },
            { header: 'Receipt', key: 'receipt' },
            { header: 'Amount', key: 'amount' },
          ],
          rows: mPays.map((p) => ({
            date: p.paymentDate,
            method: p.paymentMethod,
            receipt: p.receiptNo,
            amount: p.amount,
          })),
          summaryLines: mCalc
            ? [
                `Meals: ${mCalc.totalMeals} | Food Cost: BDT ${mCalc.foodCost}`,
                `Total Bill: BDT ${mCalc.totalBill} | Paid: BDT ${mCalc.totalPaid} | Due: BDT ${mCalc.dueAmount}`,
              ]
            : [],
        };
      }

      case 'market': {
        const marketList = expenses.filter((e) => e.monthKey === selectedMonth && !e.isVoided && e.expenseGroup === 'market');
        return {
          title: `Market Expense Report (${selectedMonth})`,
          subtitle: 'All daily market purchases',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Category', key: 'category' },
            { header: 'Item', key: 'item' },
            { header: 'Shopper', key: 'shopper' },
            { header: 'Amount', key: 'amount' },
          ],
          rows: marketList.map((e) => ({
            date: e.date,
            category: e.category,
            item: e.itemName,
            shopper: e.shopperName || e.paidByName || '-',
            amount: e.amount,
          })),
          summaryLines: [`Total Market Cost: BDT ${summary.totalMarketCost}`],
        };
      }

      case 'meal': {
        return {
          title: `Meal Report (${selectedMonth})`,
          subtitle: `Meal Rate: BDT ${summary.mealRate}`,
          columns: [
            { header: 'Member', key: 'name' },
            { header: 'Room', key: 'room' },
            { header: 'Total Meals', key: 'meals' },
            { header: 'Food Cost', key: 'foodCost' },
          ],
          rows: summary.memberCalculations.map((c) => ({
            name: c.member.fullName,
            room: c.member.roomNumber,
            meals: c.totalMeals,
            foodCost: c.foodCost,
          })),
          summaryLines: [`Total Meals: ${summary.totalMeals}`, `Meal Rate: BDT ${summary.mealRate}`],
        };
      }

      case 'payment': {
        const list = payments.filter((p) => p.monthKey === selectedMonth && !p.isVoided);
        return {
          title: `Payment Report (${selectedMonth})`,
          subtitle: 'All recorded member deposits',
          columns: [
            { header: 'Date', key: 'date' },
            { header: 'Member', key: 'member' },
            { header: 'Method', key: 'method' },
            { header: 'Receipt', key: 'receipt' },
            { header: 'Amount', key: 'amount' },
          ],
          rows: list.map((p) => ({
            date: p.paymentDate,
            member: p.memberName,
            method: p.paymentMethod,
            receipt: p.receiptNo,
            amount: p.amount,
          })),
          summaryLines: [`Total Deposits: BDT ${summary.totalDeposits}`],
        };
      }

      case 'due': {
        const dueList = summary.memberCalculations.filter((c) => c.dueAmount > 0);
        return {
          title: `Due Report (${selectedMonth})`,
          subtitle: 'Members with remaining balance due',
          columns: [
            { header: 'Member', key: 'name' },
            { header: 'Total Bill', key: 'bill' },
            { header: 'Paid', key: 'paid' },
            { header: 'Due Amount', key: 'due' },
          ],
          rows: dueList.map((c) => ({
            name: c.member.fullName,
            bill: c.totalBill,
            paid: c.totalPaid,
            due: c.dueAmount,
          })),
          summaryLines: [`Total Remaining Due: BDT ${summary.totalDue}`],
        };
      }

      case 'guest': {
        return {
          title: 'Guest Billing Report',
          subtitle: 'All temporary guests and dues',
          columns: [
            { header: 'Guest', key: 'name' },
            { header: 'Arrival', key: 'arrival' },
            { header: 'Days', key: 'days' },
            { header: 'Total', key: 'total' },
            { header: 'Paid', key: 'paid' },
            { header: 'Due', key: 'due' },
          ],
          rows: guests.map((g) => ({
            name: g.guestName,
            arrival: g.arrivalDate,
            days: g.totalDays,
            total: g.totalAmount,
            paid: g.paidAmount,
            due: g.remainingDue,
          })),
          summaryLines: [
            `Total Guest Revenue: BDT ${round2(guests.reduce((s, g) => s + g.paidAmount, 0))}`,
          ],
        };
      }

      case 'room': {
        const occ = computeRoomOccupancy(rooms, members);
        return {
          title: 'Room & Seat Report',
          subtitle: 'Current seat capacity and vacancy',
          columns: [
            { header: 'Room', key: 'room' },
            { header: 'Total Seats', key: 'total' },
            { header: 'Occupied', key: 'occupied' },
            { header: 'Available', key: 'available' },
            { header: 'Members', key: 'members' },
          ],
          rows: occ.map((r) => ({
            room: r.room.roomNumber,
            total: r.room.totalSeats,
            occupied: r.occupiedSeats,
            available: r.availableSeats,
            members: r.assignedMembers.map((m) => m.fullName).join(', ') || '-',
          })),
          summaryLines: [],
        };
      }

      case 'monthly':
      default: {
        return {
          title: `Monthly Accounting Report (${selectedMonth})`,
          subtitle: `Meal Rate: BDT ${summary.mealRate} | Total Market: BDT ${summary.totalMarketCost}`,
          columns: [
            { header: 'Member', key: 'name' },
            { header: 'Meals', key: 'meals' },
            { header: 'Food Cost', key: 'food' },
            { header: 'Rent', key: 'rent' },
            { header: 'Other', key: 'other' },
            { header: 'Total Bill', key: 'bill' },
            { header: 'Paid', key: 'paid' },
            { header: 'Due', key: 'due' },
          ],
          rows: summary.memberCalculations.map((c) => ({
            name: c.member.fullName,
            meals: c.totalMeals,
            food: c.foodCost,
            rent: c.roomRent,
            other: c.otherCharges,
            bill: c.totalBill,
            paid: c.totalPaid,
            due: c.dueAmount,
          })),
          summaryLines: [
            `Total Market: BDT ${summary.totalMarketCost} | Total Other: BDT ${summary.totalOtherCost}`,
            `Total Meals: ${summary.totalMeals} | Meal Rate: BDT ${summary.mealRate}`,
            `Total Deposits: BDT ${summary.totalDeposits} | Total Due: BDT ${summary.totalDue}`,
          ],
        };
      }
    }
  }, [reportType, selectedMonth, selectedDate, selectedMemberId, rooms, members, mealEntries, expenses, payments, guests, guestMealRequests]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.reports}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth, lang)} · {lang === 'bn' ? 'PDF, Excel, CSV এবং Print এক্সপোর্ট' : 'PDF, Excel, CSV & Print Exports'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportToPDF(
                `smart-mess-${reportType}-${selectedMonth}`,
                reportData.title,
                reportData.subtitle,
                reportData.columns,
                reportData.rows,
                reportData.summaryLines
              )
            }
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileDown className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportToExcel(
                `smart-mess-${reportType}-${selectedMonth}`,
                reportType,
                reportData.columns,
                reportData.rows
              )
            }
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button
            type="button"
            onClick={() =>
              exportToCSV(`smart-mess-${reportType}-${selectedMonth}`, reportData.columns, reportData.rows)
            }
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold cursor-pointer"
          >
            CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>{lang === 'bn' ? 'প্রিন্ট' : 'Print'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap items-center gap-3 no-print">
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
          className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-medium"
        >
          {reportOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>

        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
        />

        {(reportType === 'daily' || reportType === 'weekly') && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          />
        )}

        {reportType === 'member' && (
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.fullName}
              </option>
            ))}
          </select>
        )}
      </Card>

      {/* Report Preview */}
      <Card className="p-6 space-y-4">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h3 className="text-lg font-bold text-[#17365D] dark:text-white">{reportData.title}</h3>
          <p className="text-xs text-slate-500">{reportData.subtitle}</p>
          {reportData.summaryLines.length > 0 && (
            <div className="mt-2 space-y-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              {reportData.summaryLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                {reportData.columns.map((col) => (
                  <th key={col.key} className="text-left py-2.5 px-2 font-semibold">
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reportData.rows.map((row, idx) => (
                <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/70">
                  {reportData.columns.map((col) => {
                    const val = row[col.key];
                    const isNum = typeof val === 'number';
                    return (
                      <td
                        key={col.key}
                        className={`py-2.5 px-2 ${isNum ? 'font-mono-nums' : ''}`}
                      >
                        {isNum && ['amount', 'food', 'rent', 'other', 'bill', 'paid', 'due', 'expense', 'deposit', 'net', 'foodCost', 'total'].includes(col.key)
                          ? formatBDT(val, lang)
                          : String(val ?? '—')}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {reportData.rows.length === 0 && (
                <tr>
                  <td colSpan={reportData.columns.length} className="py-8 text-center text-xs text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
