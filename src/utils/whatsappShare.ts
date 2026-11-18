import { formatBDT, formatMonthLabel, formatNumber, toBanglaDigits } from '../i18n/translations';
import { Language, Payment } from '../types/mess';
import { MemberMonthlyCalculation, MonthlySummaryCalculation } from './calculations';

const BN_TO_EN_DIGIT: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function toEnglishDigits(value: string): string {
  return value.replace(/[০-৯]/g, (ch) => BN_TO_EN_DIGIT[ch] ?? ch);
}

/**
 * Normalizes Bangladeshi (and international) phone numbers for WhatsApp wa.me links.
 * Returns digits-only international number (e.g. '8801712345678') or null if unusable.
 */
export function normalizeWhatsAppPhone(rawPhone?: string | null): string | null {
  if (!rawPhone) return null;
  const ascii = toEnglishDigits(rawPhone).trim();
  // Keep digits only
  let digits = ascii.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  // Local BD number: 01XXXXXXXXX (11 digits)
  if (digits.length === 11 && digits.startsWith('01')) {
    return `88${digits}`;
  }

  // Local BD number missing leading 0: 1XXXXXXXXX (10 digits)
  if (digits.length === 10 && digits.startsWith('1')) {
    return `880${digits}`;
  }

  // Already has 8801XXXXXXXXX (13 digits)
  if (digits.length === 13 && digits.startsWith('8801')) {
    return digits;
  }

  // Generic international number (8-15 digits)
  if (digits.length >= 8 && digits.length <= 15) {
    return digits;
  }

  return null;
}

export function getWhatsAppUrl(rawPhone: string | undefined | null, message: string): string {
  const normalized = normalizeWhatsAppPhone(rawPhone);
  const encoded = encodeURIComponent(message);
  if (normalized) {
    return `https://api.whatsapp.com/send?phone=${normalized}&text=${encoded}`;
  }
  return `https://api.whatsapp.com/send?text=${encoded}`;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to execCommand fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export type WhatsAppMessageMode = 'bill' | 'due';

/**
 * Generates a well-formatted Bengali text summary of a member's monthly bill
 * including Food cost, Rent, Other charges, Guest meal (if any), Total, Paid, and Due/Advance.
 */
export function generateBengaliMemberBillSummary(params: {
  calc: MemberMonthlyCalculation;
  monthKey: string;
  messName?: string;
  contactNumber?: string;
  paymentNote?: string;
}): string {
  const {
    calc,
    monthKey,
    messName = 'Smart Mess Manager',
    contactNumber,
    paymentNote,
  } = params;

  const monthLabel = formatMonthLabel(monthKey, 'bn');
  const roomText = `${calc.member.roomNumber}${calc.member.seatNumber ? ` (${calc.member.seatNumber})` : ''}`;

  const lines = [
    `*🏠 মেস বিল সারাংশ — ${messName}*`,
    `📅 মাস: ${monthLabel}`,
    `👤 সদস্য: *${calc.member.fullName}* (${roomText})`,
    `━━━━━━━━━━━━━━`,
    `🍽️ মোট মিল: ${formatNumber(calc.totalMeals, 'bn', 1)} (মিল রেট: ${formatBDT(calc.mealRate, 'bn')})`,
    `🍛 খাবার খরচ: ${formatBDT(calc.foodCost, 'bn')}`,
    `🛏️ সিট/রুম ভাড়া: ${formatBDT(calc.roomRent, 'bn')}`,
    `⚡ অন্যান্য চার্জ: ${formatBDT(calc.otherCharges, 'bn')}`,
  ];
  if (calc.guestMealCost > 0) {
    lines.push(`👥 অতিথি মিল চার্জ: ${formatBDT(calc.guestMealCost, 'bn')}`);
  }
  lines.push(
    `━━━━━━━━━━━━━━`,
    `🧾 *মোট বিল:* ${formatBDT(calc.totalBill, 'bn')}`,
    `✅ *মোট জমা:* ${formatBDT(calc.totalPaid, 'bn')}`,
    calc.dueAmount > 0
      ? `⏳ *বকেয়া:* ${formatBDT(calc.dueAmount, 'bn')}`
      : calc.advanceAmount > 0
        ? `💚 *অগ্রিম ব্যালেন্স:* ${formatBDT(calc.advanceAmount, 'bn')}`
        : `✅ *অবস্থা:* সম্পূর্ণ পরিশোধিত (বকেয়া: ৳ ০)`
  );
  if (paymentNote?.trim()) {
    lines.push(`💳 পেমেন্ট তথ্য: ${paymentNote.trim()}`);
  } else if (contactNumber?.trim()) {
    lines.push(`📞 যোগাযোগ: ${toBanglaDigits(contactNumber.trim())}`);
  }
  lines.push(`ধন্যবাদ — ${messName}`);
  return lines.join('\n');
}

export function buildMemberBillMessage(params: {
  calc: MemberMonthlyCalculation;
  monthKey: string;
  messName?: string;
  contactNumber?: string;
  paymentNote?: string;
  mode?: WhatsAppMessageMode;
  lang?: Language;
}): string {
  const {
    calc,
    monthKey,
    messName = 'Smart Mess Manager',
    contactNumber,
    paymentNote,
    mode = 'bill',
    lang = 'bn',
  } = params;

  const monthLabel = formatMonthLabel(monthKey, lang);
  const roomText = `${calc.member.roomNumber}${calc.member.seatNumber ? ` (${calc.member.seatNumber})` : ''}`;

  if (lang === 'en') {
    if (mode === 'due') {
      const lines = [
        `*Due Payment Reminder — ${messName}*`,
        `Month: ${monthLabel}`,
        `Member: *${calc.member.fullName}* (${roomText})`,
        `--------------------`,
        `Total Bill: ${formatBDT(calc.totalBill, 'en')}`,
        `Paid: ${formatBDT(calc.totalPaid, 'en')}`,
        calc.dueAmount > 0
          ? `*Remaining Due: ${formatBDT(calc.dueAmount, 'en')}*`
          : calc.advanceAmount > 0
            ? `*Advance Balance: ${formatBDT(calc.advanceAmount, 'en')}*`
            : `*Status: Fully Paid*`,
      ];
      if (paymentNote?.trim()) {
        lines.push(`Payment Info: ${paymentNote.trim()}`);
      } else if (contactNumber?.trim()) {
        lines.push(`Contact: ${contactNumber.trim()}`);
      }
      lines.push(`Please clear your due at your earliest convenience. Thank you!`);
      return lines.join('\n');
    }

    const lines = [
      `*Monthly Mess Bill — ${messName}*`,
      `Month: ${monthLabel}`,
      `Member: *${calc.member.fullName}* (${roomText})`,
      `--------------------`,
      `Total Meals: ${formatNumber(calc.totalMeals, 'en', 1)} (Rate: ${formatBDT(calc.mealRate, 'en')})`,
      `Food Cost: ${formatBDT(calc.foodCost, 'en')}`,
      `Room Rent: ${formatBDT(calc.roomRent, 'en')}`,
      `Other Charges: ${formatBDT(calc.otherCharges, 'en')}`,
    ];
    if (calc.guestMealCost > 0) {
      lines.push(`Guest Meal: ${formatBDT(calc.guestMealCost, 'en')}`);
    }
    lines.push(
      `--------------------`,
      `*Total Bill:* ${formatBDT(calc.totalBill, 'en')}`,
      `*Total Paid:* ${formatBDT(calc.totalPaid, 'en')}`,
      calc.dueAmount > 0
        ? `*Remaining Due:* ${formatBDT(calc.dueAmount, 'en')}`
        : calc.advanceAmount > 0
          ? `*Advance Balance:* ${formatBDT(calc.advanceAmount, 'en')}`
          : `*Status:* Paid in Full`
    );
    if (paymentNote?.trim()) {
      lines.push(`Payment Info: ${paymentNote.trim()}`);
    } else if (contactNumber?.trim()) {
      lines.push(`Contact: ${contactNumber.trim()}`);
    }
    lines.push(`Thank you — ${messName}`);
    return lines.join('\n');
  }

  // Bengali template (default)
  if (mode === 'due') {
    const lines = [
      `*🔔 বকেয়া পরিশোধের রিমাইন্ডার — ${messName}*`,
      `📅 মাস: ${monthLabel}`,
      `👤 সদস্য: *${calc.member.fullName}* (${roomText})`,
      `━━━━━━━━━━━━━━`,
      `🧾 মোট বিল: ${formatBDT(calc.totalBill, 'bn')}`,
      `✅ মোট জমা: ${formatBDT(calc.totalPaid, 'bn')}`,
      calc.dueAmount > 0
        ? `⏳ *বর্তমান বকেয়া: ${formatBDT(calc.dueAmount, 'bn')}*`
        : calc.advanceAmount > 0
          ? `💚 *অগ্রিম জমা: ${formatBDT(calc.advanceAmount, 'bn')}*`
          : `✅ *অবস্থা: সম্পূর্ণ পরিশোধিত*`,
    ];
    if (paymentNote?.trim()) {
      lines.push(`💳 পেমেন্ট তথ্য: ${paymentNote.trim()}`);
    } else if (contactNumber?.trim()) {
      lines.push(`📞 যোগাযোগ: ${toBanglaDigits(contactNumber.trim())}`);
    }
    lines.push(`━━━━━━━━━━━━━━`);
    lines.push(`অনুগ্রহ করে সুবিধামতো সময়ে বকেয়া টাকা পরিশোধ করার অনুরোধ রইল। ধন্যবাদ!`);
    return lines.join('\n');
  }

  return generateBengaliMemberBillSummary({
    calc,
    monthKey,
    messName,
    contactNumber,
    paymentNote,
  });
}

export function buildPaymentReceiptMessage(params: {
  payment: Payment;
  messName?: string;
  lang?: Language;
}): string {
  const { payment, messName = 'Smart Mess Manager', lang = 'bn' } = params;
  const monthLabel = formatMonthLabel(payment.monthKey, lang);

  if (lang === 'en') {
    return [
      `*Payment Receipt — ${messName}*`,
      `Receipt No: ${payment.receiptNo}`,
      `Date: ${payment.paymentDate}`,
      `Month: ${monthLabel}`,
      `Member: *${payment.memberName}*`,
      `Method: ${payment.paymentMethod}${payment.transactionId ? ` (TrxID: ${payment.transactionId})` : ''}`,
      `*Amount Received: ${formatBDT(payment.amount, 'en')}*`,
      `Thank you!`,
    ].join('\n');
  }

  return [
    `*🧾 টাকা জমার রসিদ — ${messName}*`,
    `রসিদ নং: ${payment.receiptNo}`,
    `তারিখ: ${toBanglaDigits(payment.paymentDate)}`,
    `মাস: ${monthLabel}`,
    `👤 সদস্য: *${payment.memberName}*`,
    `💳 মাধ্যম: ${payment.paymentMethod}${payment.transactionId ? ` (TrxID: ${payment.transactionId})` : ''}`,
    `✅ *মোট জমা: ${formatBDT(payment.amount, 'bn')}*`,
    `ধন্যবাদ — ${messName}`,
  ].join('\n');
}

export function buildGroupBillSummaryMessage(params: {
  summary: MonthlySummaryCalculation;
  messName?: string;
  contactNumber?: string;
  paymentNote?: string;
  onlyDue?: boolean;
  lang?: Language;
}): string {
  const {
    summary,
    messName = 'Smart Mess Manager',
    contactNumber,
    paymentNote,
    onlyDue = false,
    lang = 'bn',
  } = params;

  const monthLabel = formatMonthLabel(summary.monthKey, lang);
  const rows = onlyDue
    ? summary.memberCalculations.filter((c) => c.dueAmount > 0)
    : summary.memberCalculations;

  if (lang === 'en') {
    const lines = [
      `*${onlyDue ? 'Due Payment List' : 'Monthly Mess Bill Summary'} — ${messName}*`,
      `Month: ${monthLabel}`,
      `Meal Rate: ${formatBDT(summary.mealRate, 'en')} | Total Meals: ${formatNumber(summary.totalMeals, 'en', 1)}`,
      `--------------------`,
    ];

    if (rows.length === 0) {
      lines.push(onlyDue ? 'No pending dues for this month!' : 'No member bills found.');
    } else {
      rows.forEach((c, idx) => {
        const status =
          c.dueAmount > 0
            ? `Due: ${formatBDT(c.dueAmount, 'en')}`
            : c.advanceAmount > 0
              ? `Adv: ${formatBDT(c.advanceAmount, 'en')}`
              : 'Paid';
        lines.push(
          `${idx + 1}. *${c.member.fullName}* (${c.member.roomNumber}) — Bill: ${formatBDT(c.totalBill, 'en')} | Paid: ${formatBDT(c.totalPaid, 'en')} | *${status}*`
        );
      });
    }

    lines.push(`--------------------`);
    lines.push(`Total Billed: ${formatBDT(summary.totalBilled, 'en')}`);
    lines.push(`Total Collected: ${formatBDT(summary.totalDeposits, 'en')}`);
    lines.push(`*Total Remaining Due: ${formatBDT(summary.totalDue, 'en')}*`);
    if (paymentNote?.trim()) {
      lines.push(`Payment Info: ${paymentNote.trim()}`);
    } else if (contactNumber?.trim()) {
      lines.push(`Contact: ${contactNumber.trim()}`);
    }
    return lines.join('\n');
  }

  const lines = [
    `*${onlyDue ? '🔔 বকেয়া তালিকা ও তাগাদা' : '📊 মাসিক মেস বিল সারাংশ'} — ${messName}*`,
    `📅 মাস: ${monthLabel}`,
    `🍽️ মোট মিল: ${formatNumber(summary.totalMeals, 'bn', 1)} | মিল রেট: ${formatBDT(summary.mealRate, 'bn')}`,
    `━━━━━━━━━━━━━━`,
  ];

  if (rows.length === 0) {
    lines.push(onlyDue ? '✅ এই মাসে কোনো সদস্যের বকেয়া নেই!' : 'কোনো সদস্যের বিল পাওয়া যায়নি।');
  } else {
    rows.forEach((c, idx) => {
      const idxBn = toBanglaDigits(idx + 1);
      const status =
        c.dueAmount > 0
          ? `বকেয়া: *${formatBDT(c.dueAmount, 'bn')}*`
          : c.advanceAmount > 0
            ? `অগ্রিম: ${formatBDT(c.advanceAmount, 'bn')}`
            : `পরিশোধিত ✅`;
      lines.push(
        `${idxBn}. *${c.member.fullName}* (${c.member.roomNumber})\n   মিল: ${formatNumber(c.totalMeals, 'bn', 1)} | বিল: ${formatBDT(c.totalBill, 'bn')} | জমা: ${formatBDT(c.totalPaid, 'bn')} | ${status}`
      );
    });
  }

  lines.push(`━━━━━━━━━━━━━━`);
  lines.push(`🧾 মোট বিল: ${formatBDT(summary.totalBilled, 'bn')}`);
  lines.push(`✅ মোট আদায়: ${formatBDT(summary.totalDeposits, 'bn')}`);
  lines.push(`⏳ *সর্বমোট বকেয়া: ${formatBDT(summary.totalDue, 'bn')}*`);
  if (paymentNote?.trim()) {
    lines.push(`💳 পেমেন্ট তথ্য: ${paymentNote.trim()}`);
  } else if (contactNumber?.trim()) {
    lines.push(`📞 যোগাযোগ: ${toBanglaDigits(contactNumber.trim())}`);
  }
  lines.push(`অনুগ্রহ করে দ্রুত হিসাব পরিশোধ করুন। ধন্যবাদ!`);
  return lines.join('\n');
}
