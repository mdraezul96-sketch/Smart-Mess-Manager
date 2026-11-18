import React, { useState } from 'react';
import { Edit3, Pin, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, ConfirmModal, InputField, Modal, SelectField } from '../components/UI';
import { NOTICE_CATEGORIES, TEXT } from '../i18n/translations';
import { deleteNotice, saveNotice, saveWeeklyMenu } from '../services/messDataService';
import { Notice, WeeklyMenu } from '../types/mess';
import { getTodayDateStr } from '../utils/calculations';

export const WeeklyMenuPage: React.FC = () => {
  const { actor, currentUser, lang, weeklyMenus } = useMess();
  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [editingDay, setEditingDay] = useState<WeeklyMenu | null>(null);
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [specialNote, setSpecialNote] = useState('');

  const openEdit = (m: WeeklyMenu) => {
    setEditingDay(m);
    setBreakfast(m.breakfast);
    setLunch(m.lunch);
    setDinner(m.dinner);
    setSpecialNote(m.specialNote || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !editingDay) return;
    await saveWeeklyMenu(
      {
        ...editingDay,
        breakfast,
        lunch,
        dinner,
        specialNote,
      },
      actor
    );
    setEditingDay(null);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.weeklyMenu}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'শনিবার থেকে শুক্রবার পর্যন্ত সাপ্তাহিক খাবারের তালিকা'
            : 'Weekly meal schedule from Saturday to Friday'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {weeklyMenus.map((day) => (
          <Card key={day.id} className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-[#0F8B8D]" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn' ? day.dayNameBn : day.dayNameEn}
                </h3>
              </div>
              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => openEdit(day)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title={t.edit}
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-2 text-sm pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 text-xs">{lang === 'bn' ? 'সকাল:' : 'Breakfast:'}</span>
                <span className="font-medium text-right">{day.breakfast || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 text-xs">{lang === 'bn' ? 'দুপুর:' : 'Lunch:'}</span>
                <span className="font-semibold text-[#17365D] dark:text-sky-300 text-right">{day.lunch || '—'}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-slate-400 text-xs">{lang === 'bn' ? 'রাত:' : 'Dinner:'}</span>
                <span className="font-semibold text-[#0F8B8D] dark:text-teal-300 text-right">{day.dinner || '—'}</span>
              </div>
              {day.specialNote && (
                <p className="text-xs text-slate-500 pt-1">{day.specialNote}</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={!!editingDay}
        onClose={() => setEditingDay(null)}
        title={editingDay ? `${lang === 'bn' ? editingDay.dayNameBn : editingDay.dayNameEn} — ${lang === 'bn' ? 'মেনু পরিবর্তন' : 'Edit Menu'}` : ''}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <InputField label={lang === 'bn' ? 'সকালের খাবার' : 'Breakfast'} value={breakfast} onChange={setBreakfast} />
          <InputField label={lang === 'bn' ? 'দুপুরের খাবার' : 'Lunch'} value={lunch} onChange={setLunch} />
          <InputField label={lang === 'bn' ? 'রাতের খাবার' : 'Dinner'} value={dinner} onChange={setDinner} />
          <InputField label={lang === 'bn' ? 'বিশেষ নোট' : 'Special Note'} value={specialNote} onChange={setSpecialNote} />
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setEditingDay(null)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer">{t.cancel}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#17365D] text-white text-sm font-medium cursor-pointer">{t.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const NoticesPage: React.FC = () => {
  const { actor, currentUser, lang, notices } = useMess();
  const t = TEXT[lang];
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notice | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [publishDate, setPublishDate] = useState(getTodayDateStr);
  const [category, setCategory] = useState(NOTICE_CATEGORIES[0]);
  const [isPinned, setIsPinned] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setPublishDate(getTodayDateStr());
    setCategory(NOTICE_CATEGORIES[0]);
    setIsPinned(true);
    setFormOpen(true);
  };

  const openEdit = (n: Notice) => {
    setEditing(n);
    setTitle(n.title);
    setDescription(n.description);
    setPublishDate(n.publishDate);
    setCategory(n.category);
    setIsPinned(n.isPinned);
    setFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor || !title.trim() || !description.trim()) return;
    await saveNotice(
      {
        id: editing?.id,
        title,
        description,
        publishDate,
        category,
        isPinned,
      },
      actor
    );
    setFormOpen(false);
  };

  const handleDelete = async () => {
    if (!actor || !deleteTarget) return;
    await deleteNotice(deleteTarget.id, actor);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t.notices}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn' ? 'মেসের সকল ঘোষণা, নিয়মকানুন ও জরুরি বিজ্ঞপ্তি' : 'Mess announcements, billing deadlines & rules'}
          </p>
        </div>

        {isManagerOrAdmin && (
          <button
            type="button"
            onClick={openAdd}
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#17365D] hover:bg-[#1e4678] text-white text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'bn' ? 'নতুন নোটিশ প্রকাশ' : 'Post Notice'}</span>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notices.map((n) => (
          <Card key={n.id} className="p-5 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  {n.isPinned && <Pin className="w-4 h-4 text-amber-500 shrink-0" />}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">{n.title}</h3>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {n.category} · {n.publishDate}
                </div>
              </div>
              {isManagerOrAdmin && (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(n)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(n)} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {n.description}
            </p>
          </Card>
        ))}

        {notices.length === 0 && (
          <Card className="p-8 text-center text-sm text-slate-400">
            {lang === 'bn' ? 'এখনো কোনো নোটিশ প্রকাশ করা হয়নি।' : 'No notices posted yet.'}
          </Card>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? (lang === 'bn' ? 'নোটিশ সম্পাদনা' : 'Edit Notice') : (lang === 'bn' ? 'নতুন নোটিশ' : 'New Notice')}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <InputField label={lang === 'bn' ? 'নোটিশের শিরোনাম' : 'Title'} value={title} onChange={setTitle} required />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label={lang === 'bn' ? 'ক্যাটাগরি' : 'Category'}
              value={category}
              onChange={setCategory}
              options={NOTICE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
            <InputField label={lang === 'bn' ? 'প্রকাশের তারিখ' : 'Publish Date'} type="date" value={publishDate} onChange={setPublishDate} required />
          </div>
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'বিস্তারিত বিবরণ' : 'Description'} *
            </span>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="w-full p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} className="rounded" />
            <span>{lang === 'bn' ? 'গুরুত্বপূর্ণ হিসেবে Pin করুন' : 'Pin to top of Notice Board'}</span>
          </label>
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm cursor-pointer">{t.cancel}</button>
            <button type="submit" className="px-5 py-2 rounded-lg bg-[#17365D] text-white text-sm font-medium cursor-pointer">{t.save}</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title={lang === 'bn' ? 'নোটিশ মুছুন' : 'Delete Notice'}
        message={lang === 'bn' ? `"${deleteTarget?.title}" নোটিশটি মুছে ফেলতে চান?` : `Delete notice "${deleteTarget?.title}"?`}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
