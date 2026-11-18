import React, { useMemo, useState } from 'react';
import { Check, Eye, Lock, Plus, Unlock, Vote, X } from 'lucide-react';
import { useMess } from '../context/MessContext';
import { Card, InputField, Modal } from '../components/UI';
import { formatBDT, formatNumber } from '../i18n/translations';
import {
  closeMenuPoll,
  createMenuPoll,
  replyComplaint,
  reviewGuestMealRequest,
  reviewMealRequest,
  reviewPaymentRequest,
} from '../services/messDataService';
import { getTodayDateStr } from '../utils/calculations';

type HubTab = 'meals' | 'payments' | 'guests' | 'complaints' | 'polls';

export const ApprovalsHubPage: React.FC = () => {
  const {
    actor,
    lang,
    mealRequests,
    paymentRequests,
    guestMealRequests,
    complaints,
    menuPolls,
    menuVotes,
  } = useMess();

  const [tab, setTab] = useState<HubTab>('meals');
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New Poll Modal
  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollTitle, setPollTitle] = useState('');
  const [pollDesc, setPollDesc] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('মুরগির বিরিয়ানি\nগরুর মাংস ও ভুনা খিচুড়ি\nরুই মাছ ও ভাত');
  const [pollDeadline, setPollDeadline] = useState(getTodayDateStr);
  const [showResultsAfterVote, setShowResultsAfterVote] = useState(true);

  const pendingCounts = useMemo(
    () => ({
      meals: mealRequests.filter((r) => r.status === 'pending').length,
      payments: paymentRequests.filter((r) => r.status === 'pending').length,
      guests: guestMealRequests.filter((r) => r.status === 'pending').length,
      complaints: complaints.filter((c) => c.status !== 'resolved').length,
      polls: menuPolls.filter((p) => !p.isClosed).length,
    }),
    [mealRequests, paymentRequests, guestMealRequests, complaints, menuPolls]
  );

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actor) return;
    setErrorMsg(null);
    setFeedback(null);
    try {
      const options = pollOptionsText.split('\n').map((s) => s.trim()).filter(Boolean);
      await createMenuPoll(
        {
          title: pollTitle,
          description: pollDesc,
          options,
          deadline: pollDeadline,
          showResultsAfterVote,
        },
        actor
      );
      setPollModalOpen(false);
      setPollTitle('');
      setPollDesc('');
      setFeedback(lang === 'bn' ? 'নতুন মেনু ভোট পোল তৈরি হয়েছে।' : 'Menu poll created.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {lang === 'bn' ? 'সদস্য আবেদন, অভিযোগ ও মেনু ভোট কেন্দ্র' : 'Member Requests, Complaints & Polls'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'সদস্যদের মিল অন/অফ, পেমেন্ট, অতিথি মিল, অভিযোগ ও মেনু ভোট পরিচালনা করুন'
              : 'Review member meal requests, payment verifications, guest meals, complaints & polls'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPollModalOpen(true)}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-[#0F8B8D] hover:bg-[#0d787a] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{lang === 'bn' ? 'নতুন মেনু পোল' : 'Create Menu Poll'}</span>
        </button>
      </div>

      {errorMsg && <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-600">{errorMsg}</div>}
      {feedback && <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700">{feedback}</div>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'meals' as HubTab, label: lang === 'bn' ? 'মিল আবেদন' : 'Meal Requests', count: pendingCounts.meals },
          { id: 'payments' as HubTab, label: lang === 'bn' ? 'পেমেন্ট আবেদন' : 'Payment Requests', count: pendingCounts.payments },
          { id: 'guests' as HubTab, label: lang === 'bn' ? 'অতিথি মিল' : 'Guest Meals', count: pendingCounts.guests },
          { id: 'complaints' as HubTab, label: lang === 'bn' ? 'অভিযোগ ও পরামর্শ' : 'Complaints', count: pendingCounts.complaints },
          { id: 'polls' as HubTab, label: lang === 'bn' ? 'মেনু ভোট' : 'Menu Polls', count: pendingCounts.polls },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
              tab === item.id
                ? 'bg-[#17365D] text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            {item.label} {item.count > 0 ? `(${formatNumber(item.count, lang)})` : ''}
          </button>
        ))}
      </div>

      {/* Meal Requests Tab */}
      {tab === 'meals' && (
        <Card className="p-5 divide-y divide-slate-100 dark:divide-slate-800">
          {mealRequests.map((req) => (
            <div key={req.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {req.memberName} · <span className="font-mono-nums">{req.date}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {lang === 'bn' ? 'সকাল' : 'B'}: {req.breakfast} · {lang === 'bn' ? 'দুপুর' : 'L'}: {req.lunch} · {lang === 'bn' ? 'রাত' : 'D'}: {req.dinner}
                  {req.reason ? ` · কারণ: ${req.reason}` : ''}
                </div>
              </div>
              {req.status === 'pending' && actor ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Note'}
                    value={reviewNotes[req.id] || ''}
                    onChange={(e) => setReviewNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => reviewMealRequest(req, 'approved', reviewNotes[req.id] || '', actor)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> {lang === 'bn' ? 'অনুমোদন' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewMealRequest(req, 'rejected', reviewNotes[req.id] || '', actor)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> {lang === 'bn' ? 'প্রত্যাখ্যান' : 'Reject'}
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-bold ${req.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {req.status.toUpperCase()}
                </span>
              )}
            </div>
          ))}
          {mealRequests.length === 0 && <p className="py-6 text-center text-xs text-slate-400">কোনো মিল আবেদন নেই।</p>}
        </Card>
      )}

      {/* Payment Requests Tab */}
      {tab === 'payments' && (
        <Card className="p-5 divide-y divide-slate-100 dark:divide-slate-800">
          {paymentRequests.map((req) => (
            <div key={req.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {req.memberName} · <span className="font-mono-nums text-emerald-600">{formatBDT(req.amount, lang)}</span> ({req.paymentMethod})
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {req.paymentDate}
                  {req.transactionId ? ` · TrxID: ${req.transactionId}` : ''}
                  {req.notes ? ` · ${req.notes}` : ''}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {req.receiptImageUrl && (
                  <button
                    type="button"
                    onClick={() => setPreviewImg(req.receiptImageUrl!)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-[#0F8B8D] inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" /> {lang === 'bn' ? 'রসিদ' : 'Proof'}
                  </button>
                )}
                {req.status === 'pending' && actor ? (
                  <>
                    <input
                      type="text"
                      placeholder={lang === 'bn' ? 'মন্তব্য (ঐচ্ছিক)' : 'Note'}
                      value={reviewNotes[req.id] || ''}
                      onChange={(e) => setReviewNotes((p) => ({ ...p, [req.id]: e.target.value }))}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() => reviewPaymentRequest(req, 'approved', reviewNotes[req.id] || '', actor)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" /> {lang === 'bn' ? 'অনুমোদন ও জমা' : 'Approve & Post'}
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewPaymentRequest(req, 'rejected', reviewNotes[req.id] || '', actor)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> {lang === 'bn' ? 'বাতিল' : 'Reject'}
                    </button>
                  </>
                ) : (
                  <span className={`text-xs font-bold ${req.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {req.status.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          ))}
          {paymentRequests.length === 0 && <p className="py-6 text-center text-xs text-slate-400">কোনো পেমেন্ট আবেদন নেই।</p>}
        </Card>
      )}

      {/* Guest Meal Requests Tab */}
      {tab === 'guests' && (
        <Card className="p-5 divide-y divide-slate-100 dark:divide-slate-800">
          {guestMealRequests.map((req) => (
            <div key={req.id} className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {req.memberName} · {req.guestName || 'অতিথি'} ({formatNumber(req.guestCount, lang)} জন)
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {req.date} · {req.breakfast ? 'সকাল ' : ''}{req.lunch ? 'দুপুর ' : ''}{req.dinner ? 'রাত' : ''} · চার্জ: {formatBDT(req.totalCharge, lang)}
                </div>
              </div>
              {req.status === 'pending' && actor ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => reviewGuestMealRequest(req, 'approved', reviewNotes[req.id] || '', actor)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" /> {lang === 'bn' ? 'অনুমোদন' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewGuestMealRequest(req, 'rejected', reviewNotes[req.id] || '', actor)}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" /> {lang === 'bn' ? 'প্রত্যাখ্যান' : 'Reject'}
                  </button>
                </div>
              ) : (
                <span className={`text-xs font-bold ${req.status === 'approved' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {req.status.toUpperCase()}
                </span>
              )}
            </div>
          ))}
          {guestMealRequests.length === 0 && <p className="py-6 text-center text-xs text-slate-400">কোনো অতিথি মিল আবেদন নেই।</p>}
        </Card>
      )}

      {/* Complaints Tab */}
      {tab === 'complaints' && (
        <div className="space-y-3">
          {complaints.map((c) => (
            <Card key={c.id} className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {c.subject} · <span className="font-normal text-slate-500">{c.memberName}</span>
                  </div>
                  <div className="text-xs text-slate-400">{c.category} · {c.submittedDate}</div>
                </div>
                <div className="flex items-center gap-2">
                  {c.imageUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewImg(c.imageUrl!)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-[#0F8B8D] cursor-pointer"
                    >
                      {lang === 'bn' ? 'ছবি দেখুন' : 'Photo'}
                    </button>
                  )}
                  <span className="text-xs font-bold text-[#17365D] dark:text-sky-300">{c.status.toUpperCase()}</span>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">{c.description}</p>
              {c.adminReply && (
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 text-xs">
                  <strong>{lang === 'bn' ? 'প্রদত্ত উত্তর:' : 'Replied:'}</strong> {c.adminReply}
                </div>
              )}
              {actor && (
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder={lang === 'bn' ? 'সদস্যকে উত্তর লিখুন...' : 'Write reply to member...'}
                    value={replyTexts[c.id] ?? c.adminReply ?? ''}
                    onChange={(e) => setReplyTexts((p) => ({ ...p, [c.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-950"
                  />
                  <button
                    type="button"
                    onClick={() => replyComplaint(c, 'in_progress', replyTexts[c.id] ?? c.adminReply ?? '', actor)}
                    className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'bn' ? 'প্রক্রিয়াধীন' : 'In Progress'}
                  </button>
                  <button
                    type="button"
                    onClick={() => replyComplaint(c, 'resolved', replyTexts[c.id] ?? c.adminReply ?? '', actor)}
                    className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    {lang === 'bn' ? 'সমাধান হয়েছে' : 'Resolve'}
                  </button>
                </div>
              )}
            </Card>
          ))}
          {complaints.length === 0 && (
            <Card className="p-8 text-center text-xs text-slate-400">কোনো অভিযোগ বা পরামর্শ পাওয়া যায়নি।</Card>
          )}
        </div>
      )}

      {/* Menu Polls Tab */}
      {tab === 'polls' && (
        <div className="space-y-3">
          {menuPolls.map((poll) => {
            const votes = menuVotes.filter((v) => v.pollId === poll.id);
            return (
              <Card key={poll.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-base flex items-center gap-2">
                      <Vote className="w-4 h-4 text-[#0F8B8D]" />
                      <span>{poll.title}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      শেষ সময়: {poll.deadline} · মোট ভোট: {formatNumber(votes.length, lang)}
                    </div>
                  </div>
                  {actor && (
                    <button
                      type="button"
                      onClick={() => closeMenuPoll(poll, !poll.isClosed, actor)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      {poll.isClosed ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{poll.isClosed ? (lang === 'bn' ? 'পুনরায় চালু' : 'Reopen') : lang === 'bn' ? 'পোল বন্ধ করুন' : 'Close Poll'}</span>
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 text-xs">
                  {poll.options.map((opt, idx) => {
                    const count = votes.filter((v) => v.optionIndex === idx).length;
                    const pct = votes.length > 0 ? Math.round((count / votes.length) * 100) : 0;
                    return (
                      <div key={idx} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                        <span>{opt}</span>
                        <span className="font-mono-nums font-bold">{formatNumber(count, lang)} ({formatNumber(pct, lang)}%)</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
          {menuPolls.length === 0 && (
            <Card className="p-8 text-center text-xs text-slate-400">কোনো মেনু পোল তৈরি করা হয়নি।</Card>
          )}
        </div>
      )}

      {/* Create Poll Modal */}
      <Modal open={pollModalOpen} onClose={() => setPollModalOpen(false)} title={lang === 'bn' ? 'নতুন মেনু ভোট পোল' : 'Create Menu Poll'}>
        <form onSubmit={handleCreatePoll} className="space-y-4">
          <InputField
            label={lang === 'bn' ? 'পোলের শিরোনাম' : 'Poll Title'}
            value={pollTitle}
            onChange={setPollTitle}
            required
            placeholder="যেমন: শুক্রবারের স্পেশাল দুপুরের খাবার"
          />
          <InputField label={lang === 'bn' ? 'বিবরণ (ঐচ্ছিক)' : 'Description'} value={pollDesc} onChange={setPollDesc} />
          <label className="block space-y-1.5">
            <span className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {lang === 'bn' ? 'বিকল্পসমূহ (প্রতি লাইনে ১টি)' : 'Options (one per line)'} *
            </span>
            <textarea
              rows={4}
              value={pollOptionsText}
              onChange={(e) => setPollOptionsText(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm"
            />
          </label>
          <InputField label={lang === 'bn' ? 'ভোটের শেষ তারিখ' : 'Deadline'} type="date" value={pollDeadline} onChange={setPollDeadline} required />
          <label className="flex items-center gap-2 text-xs font-medium">
            <input type="checkbox" checked={showResultsAfterVote} onChange={(e) => setShowResultsAfterVote(e.target.checked)} />
            <span>{lang === 'bn' ? 'ভোট দেওয়ার পর সদস্যরা ফলাফল দেখতে পারবে' : 'Show results after voting'}</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setPollModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer">
              {lang === 'bn' ? 'বাতিল' : 'Cancel'}
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-[#17365D] text-white text-xs font-semibold cursor-pointer">
              {lang === 'bn' ? 'পোল প্রকাশ করুন' : 'Publish Poll'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!previewImg} onClose={() => setPreviewImg(null)} title={lang === 'bn' ? 'সংযুক্ত ছবি' : 'Attached Image'}>
        {previewImg && <img src={previewImg} alt="Attachment" className="w-full rounded-xl" />}
      </Modal>
    </div>
  );
};
