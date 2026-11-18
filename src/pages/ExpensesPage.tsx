import React, { useMemo, useState } from 'react';
import { Ban, Edit3, Eye, Plus, Search, ShoppingBasket } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal, InputField, Modal, SelectField } from '../components/UI';
import {
  formatBDT,
  formatMonthLabel,
  MARKET_CATEGORIES,
  OTHER_EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  TEXT,
} from '../i18n/translations';
import { saveExpense, voidExpense } from '../services/messDataService';
import { Expense, PaymentMethod } from '../types/mess';
import { getTodayDateStr, round2 } from '../utils/calculations';

export const ExpensesPage: React.FC = () => {
  const { actor, currentUser, lang, selectedMonth, setSelectedMonth, expenses, members } = useMess();
  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [groupFilter, setGroupFilter] = useState<'all' | 'market' | 'other'>('all');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states
  const [date, setDate] = useState(getTodayDateStr);
  const [expenseGroup, setExpenseGroup] = useState<'market' | 'other'>('market');
  const [category, setCategory] = useState(MARKET_CATEGORIES[0]);
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('কেজি');
  const [unitPrice, setUnitPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [shopperName, setShopperName] = useState('');
  const [paidByMemberId, setPaidByMemberId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [notes, setNotes] = useState('');

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (e.monthKey !== selectedMonth) return false;
      if (groupFilter !== 'all' && e.expenseGroup !== groupFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.itemName.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.shopperName || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [expenses, selectedMonth, groupFilter, search]);

  const totals = useMemo(() => {
    const active = expenses.filter((e) => e.monthKey === selectedMonth && !e.isVoided);
    const market = round2(active.filter((e) => e.expenseGroup === 'market').reduce((s, e) => s + e.amount, 0));
    const other = round2(active.filter((e) => e.expenseGroup === 'other').reduce((s, e) => s + e.amount, 0));
    return { market, other, total: round2(market + other) };
  }, [expenses, selectedMonth]);

  const openAddModal = (defaultGroup: 'market' | 'other') => {
    setErrorMsg(null);
    setEditingExpense(null);
    setDate(getTodayDateStr());
    setExpenseGroup(defaultGroup);
    setCategory(defaultGroup === 'market' ? MARKET_CATEGORIES[0] : OTHER_EXPENSE_CATEGORIES[0]);
    setItemName('');
    setQuantity('');
    setUnit('কেজি');
    setUnitPrice('');
    setAmount('');
    setShopperName('');
    setPaidByMemberId('');
    setPaymentMethod('Cash');
    setReceiptUrl('');
    setNotes('');
    setFormOpen(true);
  };

  const openEditModal = (exp: Expense) => {
    setErrorMsg(null);
    setEditingExpense(exp);
    setDate(exp.date);
    setExpenseGroup(exp.expenseGroup);
    setCategory(exp.category);
    setItemName(exp.itemName);
    setQuantity(exp.quantity !== undefined ? String(exp.quantity) : '');
    setUnit(exp.unit || '');
    setUnitPrice(exp.unitPrice !== undefined ? String(exp.unitPrice) : '');
    setAmount(String(exp.amount));
    setShopperName(exp.shopperName || '');
    setPaidByMemberId(exp.paidByMemberId || '');
    setPaymentMethod(exp.paymentMethod);
    setReceiptUrl(exp.receiptUrl || '');
    setNotes(exp.notes || '');
    setFormOpen(true);
  };

  const handleFileReceipt = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 720;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        setReceiptUrl(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setErrorMsg(null);
    const numAmount = Number(amount);
    if (!itemName.trim() || !Number.isFinite(numAmount) || numAmount < 0) {
      setErrorMsg(lang === 'bn' ? 'সঠিক বিবরণ ও পরিমাণ লিখুন।' : 'Please enter valid description and amount.');
      return;
    }
    const payer = members.find((m) => m.id === paidByMemberId);
    try {
      await saveExpense(
        {
          id: editingExpense?.id,
          date,
          expenseGroup,
          category,
          itemName,
          quantity: quantity ? Number(quantity) : undefined,
          unit,
          unitPrice: unitPrice ? Number(unitPrice) : undefined,
          amount: numAmount,
          paidByMemberId,
          paidByName: payer?.fullName || '',
          shopperName,
          paymentMethod,
          receiptUrl,
          notes,
        },
        actor
      );
      setFormOpen(false);
      const expMonth = date.slice(0, 7);
      if (expMonth && expMonth !== selectedMonth) {
        setSelectedMonth(expMonth);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  const handleVoid = async () => {
    if (!actor || !voidTarget) return;
    try {
      await voidExpense(voidTarget.id, voidReason, actor);
      setVoidTarget(null);
      setVoidReason('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setVoidTarget(null);
    }
  };

  const activeCategories = expenseGroup === 'market' ? MARKET_CATEGORIES : OTHER_EXPENSE_CATEGORIES;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.expenses}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatMonthLabel(selectedMonth, lang)} · {lang === 'bn' ? 'বাজার ও অন্যান্য খরচ আলাদাভাবে সংরক্ষিত' : 'Market and Other Expenses'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="min-h-[40px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
          />
          {isManagerOrAdmin && (
            <>
              <button
                type="button"
                onClick={() => openAddModal('market')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShoppingBasket className="w-4 h-4" />
                <span>{lang === 'bn' ? 'বাজার খরচ যোগ' : 'Add Market'}</span>
              </button>
              <button
                type="button"
                onClick={() => openAddModal('other')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0d787a] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{lang === 'bn' ? 'অন্যান্য খরচ যোগ' : 'Add Other'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'মোট বাজার খরচ (মিল রেট ভিত্তিক)' : 'Total Market Expense'}</div>
          <div className="text-xl font-bold font-mono-nums text-[#17365D] dark:text-sky-300 mt-1">
            {formatBDT(totals.market, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'অন্যান্য খরচ (ভাড়া, বিল ও সার্ভিস)' : 'Other Expenses'}</div>
          <div className="text-xl font-bold font-mono-nums text-amber-600 dark:text-amber-400 mt-1">
            {formatBDT(totals.other, lang)}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-slate-500">{lang === 'bn' ? 'সর্বমোট মাসিক খরচ' : 'Combined Monthly Expense'}</div>
          <div className="text-xl font-bold font-mono-nums text-rose-600 dark:text-rose-400 mt-1">
            {formatBDT(totals.total, lang)}
          </div>
        </Card>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Search & Group Filter */}
      <Card className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={lang === 'bn' ? 'পণ্য, ক্যাটাগরি বা বাজারকারীর নাম দিয়ে খুঁজুন...' : 'Search item, category, shopper...'}
            className="w-full min-h-[40px] pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {([
            { id: 'all', label: lang === 'bn' ? 'সকল' : 'All' },
            { id: 'market', label: lang === 'bn' ? 'বাজার' : 'Market' },
            { id: 'other', label: lang === 'bn' ? 'অন্যান্য' : 'Other' },
          ] as const).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setGroupFilter(f.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer ${
                groupFilter === f.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Expenses Table */}
      <Card className="p-5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <th className="text-left py-2.5">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'বিবরণ ও ক্যাটাগরি' : 'Item & Category'}</th>
                <th className="text-left py-2.5">{lang === 'bn' ? 'বাজারকারী / পরিশোধকারী' : 'Shopper / Payer'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'পরিমাণ (৳)' : 'Amount'}</th>
                <th className="text-right py-2.5">{lang === 'bn' ? 'কার্যক্রম' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map((e) => (
                <tr key={e.id} className={`border-b border-slate-100 dark:border-slate-800/70 ${e.isVoided ? 'opacity-50 line-through' : ''}`}>
                  <td className="py-3 font-mono-nums text-xs text-slate-500 whitespace-nowrap pr-3">
                    {e.date}
                  </td>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{e.itemName}</div>
                    <div className="text-xs text-slate-400">
                      {e.expenseGroup === 'market' ? (lang === 'bn' ? 'বাজার' : 'Market') : (lang === 'bn' ? 'অন্যান্য' : 'Other')} · {e.category}
                      {e.quantity ? ` · ${e.quantity} ${e.unit || ''}` : ''}
                      {e.isVoided ? ` · [বাতিল: ${e.voidReason}]` : ''}
                    </div>
                  </td>
                  <td className="py-3 pr-3 text-xs text-slate-600 dark:text-slate-300">
                    {e.shopperName || e.paidByName || '—'} · {e.paymentMethod}
                  </td>
                  <td className="py-3 text-right font-bold font-mono-nums text-rose-600 dark:text-rose-400 whitespace-nowrap">
                    {formatBDT(e.amount, lang)}
                  </td>
                  <td className="py-3 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      {e.receiptUrl && (
                        <button
                          type="button"
                          onClick={() => setReceiptPreview(e.receiptUrl!)}
                          className="p-1.5 rounded-lg text-[#0F8B8D] hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          title={lang === 'bn' ? 'রসিদ দেখুন' : 'View Receipt'}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      {isManagerOrAdmin && !e.isVoided && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(e)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title={t.edit}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setVoidTarget(e);
                              setVoidReason('');
                            }}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title={lang === 'bn' ? 'বাতিল (Void)' : 'Void'}
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-400">
                    {t.noData}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add/Edit Expense Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingExpense
            ? lang === 'bn' ? 'খরচ সম্পাদনা' : 'Edit Expense'
            : expenseGroup === 'market'
              ? lang === 'bn' ? 'বাজার খরচ এন্ট্রি' : 'Add Market Expense'
              : lang === 'bn' ? 'অন্যান্য খরচ এন্ট্রি' : 'Add Other Expense'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SelectField
              label={lang === 'bn' ? 'খরচের ধরন' : 'Expense Group'}
              value={expenseGroup}
              onChange={(v) => {
                const grp = v as 'market' | 'other';
                setExpenseGroup(grp);
                setCategory(grp === 'market' ? MARKET_CATEGORIES[0] : OTHER_EXPENSE_CATEGORIES[0]);
              }}
              options={[
                { value: 'market', label: lang === 'bn' ? 'দৈনিক বাজার (মিল রেট)' : 'Market (Food)' },
                { value: 'other', label: lang === 'bn' ? 'অন্যান্য খরচ (বিল/ভাড়া)' : 'Other (Rent/Utilities)' },
              ]}
            />
            <InputField
              label={lang === 'bn' ? 'তারিখ' : 'Date'}
              type="date"
              value={date}
              onChange={setDate}
              required
            />
            <SelectField
              label={lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
              value={category}
              onChange={setCategory}
              options={activeCategories.map((c) => ({ value: c, label: c }))}
            />
            <InputField
              label={lang === 'bn' ? 'পণ্য বা খরচের বিবরণ' : 'Item / Expense Name'}
              value={itemName}
              onChange={setItemName}
              required
              placeholder={expenseGroup === 'market' ? 'যেমন: রুই মাছ ও সবজি' : 'যেমন: নভেম্বর মাসের বিদ্যুৎ বিল'}
            />
            <InputField
              label={lang === 'bn' ? 'পরিমাণ (সংখ্যা)' : 'Quantity'}
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(val) => {
                setQuantity(val);
                if (val && unitPrice) {
                  setAmount(String(round2(Number(val) * Number(unitPrice))));
                }
              }}
            />
            <InputField
              label={lang === 'bn' ? 'একক (কেজি/লিটার/পিস)' : 'Unit'}
              value={unit}
              onChange={setUnit}
            />
            <InputField
              label={lang === 'bn' ? 'একক মূল্য (৳)' : 'Unit Price (৳)'}
              type="number"
              min="0"
              step="any"
              value={unitPrice}
              onChange={(val) => {
                setUnitPrice(val);
                if (quantity && val) {
                  setAmount(String(round2(Number(quantity) * Number(val))));
                }
              }}
            />
            <InputField
              label={lang === 'bn' ? 'মোট টাকা (৳)' : 'Total Amount (৳)'}
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={setAmount}
              required
            />
            <InputField
              label={lang === 'bn' ? 'বাজার করেছেন যিনি' : 'Shopper Name'}
              value={shopperName}
              onChange={setShopperName}
            />
            <SelectField
              label={lang === 'bn' ? 'কে টাকা পরিশোধ করেছেন (ঐচ্ছিক)' : 'Paid By Member (Optional)'}
              value={paidByMemberId}
              onChange={setPaidByMemberId}
              options={[
                { value: '', label: lang === 'bn' ? 'মেস ফান্ড থেকে' : 'From Mess Fund' },
                ...members.map((m) => ({ value: m.id, label: m.fullName })),
              ]}
            />
            <SelectField
              label={lang === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}
              value={paymentMethod}
              onChange={(v) => setPaymentMethod(v as PaymentMethod)}
              options={PAYMENT_METHODS.map((pm) => ({ value: pm, label: pm }))}
            />
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                {lang === 'bn' ? 'রসিদ / ছবি আপলোড' : 'Upload Receipt Image'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileReceipt}
                className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 dark:file:bg-slate-800 file:text-slate-700 dark:file:text-slate-200"
              />
            </label>
          </div>
          <InputField
            label={lang === 'bn' ? 'মন্তব্য' : 'Notes'}
            value={notes}
            onChange={setNotes}
          />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#17365D] text-white text-sm font-medium cursor-pointer"
            >
              {t.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Void Confirmation Modal */}
      <ConfirmModal
        open={!!voidTarget}
        title={lang === 'bn' ? 'খরচ বাতিল (Void) করুন' : 'Void Expense Entry'}
        message={
          lang === 'bn'
            ? `আর্থিক অডিটের নিরাপত্তার জন্য "${voidTarget?.itemName}" স্থায়ীভাবে না মুছে বাতিল (Void) হিসেবে চিহ্নিত করা হবে।`
            : `For financial audit integrity, "${voidTarget?.itemName}" will be marked as Void rather than permanently deleted.`
        }
        confirmLabel={lang === 'bn' ? 'বাতিল (Void) নিশ্চিত করুন' : 'Confirm Void'}
        cancelLabel={t.cancel}
        danger
        onConfirm={handleVoid}
        onCancel={() => setVoidTarget(null)}
      />

      {/* Receipt Preview Modal */}
      <Modal
        open={!!receiptPreview}
        onClose={() => setReceiptPreview(null)}
        title={lang === 'bn' ? 'খরচের রসিদ' : 'Expense Receipt'}
      >
        {receiptPreview && (
          <img
            src={receiptPreview}
            alt="Receipt"
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800"
          />
        )}
      </Modal>
    </div>
  );
};
