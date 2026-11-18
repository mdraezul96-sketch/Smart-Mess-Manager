import { Language } from '../types/mess';

export const MARKET_CATEGORIES = [
  'চাল',
  'ডাল',
  'মাছ',
  'মাংস',
  'মুরগি',
  'ডিম',
  'সবজি',
  'মসলা',
  'তেল',
  'বাজার (মিশ্র)',
  'অন্যান্য',
];

export const OTHER_EXPENSE_CATEGORIES = [
  'বাসা ভাড়া',
  'বিদ্যুৎ বিল',
  'গ্যাস বিল',
  'পানির বিল',
  'Wi-Fi বিল',
  'পরিষ্কার-পরিচ্ছন্নতা',
  'মেরামত',
  'কর্মচারী বেতন',
  'অন্যান্য খরচ',
];

export const PAYMENT_METHODS = ['Cash', 'bKash', 'Nagad', 'Rocket', 'Bank Transfer', 'Other'] as const;

export const COMPLAINT_CATEGORIES = [
  'খাবারের মান',
  'বাজারের সমস্যা',
  'পরিচ্ছন্নতা',
  'পানি ও বিদ্যুৎ',
  'হিসাব সংক্রান্ত সমস্যা',
  'অন্যান্য',
] as const;

export const NOTICE_CATEGORIES = [
  'সাধারণ ঘোষণা',
  'টাকা জমা',
  'বাজার ও মিল',
  'বিল ও ইউটিলিটি',
  'পরিষ্কার-পরিচ্ছন্নতা',
  'মেস মিটিং',
];

const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBanglaDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);
}

export function formatNumber(value: number, lang: Language, decimals = 0): string {
  const safe = Number.isFinite(value) ? value : 0;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return lang === 'bn' ? toBanglaDigits(formatted) : formatted;
}

export function formatBDT(value: number, lang: Language): string {
  const safe = Number.isFinite(value) ? value : 0;
  const hasFraction = Math.abs(safe - Math.round(safe)) > 0.005;
  const formatted = safe.toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `৳ ${lang === 'bn' ? toBanglaDigits(formatted) : formatted}`;
}

export function formatMonthLabel(monthKey: string, lang: Language): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIdx = Number(monthStr) - 1;
  const bnMonths = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
  ];
  const enMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  if (monthIdx < 0 || monthIdx > 11) return monthKey;
  if (lang === 'bn') {
    return `${bnMonths[monthIdx]} ${toBanglaDigits(yearStr)}`;
  }
  return `${enMonths[monthIdx]} ${yearStr}`;
}

export const TEXT = {
  bn: {
    appName: 'Smart Mess Manager',
    tagline: 'একটি মেস, একটি ডিজিটাল হিসাব ব্যবস্থা',
    dashboard: 'ড্যাশবোর্ড',
    members: 'সদস্য ব্যবস্থাপনা',
    rooms: 'রুম ও সিট',
    meals: 'মিল ম্যানেজমেন্ট',
    mealCalendar: 'মিল ক্যালেন্ডার',
    expenses: 'বাজার ও খরচ',
    payments: 'টাকা জমা',
    monthlyBill: 'মাসিক হিসাব ও বিল',
    guests: 'অতিথি ব্যবস্থাপনা',
    weeklyMenu: 'খাবারের মেনু',
    notices: 'নোটিশ বোর্ড',
    reports: 'রিপোর্ট ও এক্সপোর্ট',
    approvals: 'আবেদন ও অনুমোদন',
    users: 'ইউজার ও পারমিশন',
    settings: 'সেটিংস',
    backup: 'ব্যাকআপ ও রিস্টোর',
    syncCenter: 'সিঙ্ক সেন্টার',
    accessHelp: 'সাহায্য ও গাইড',
    online: 'অনলাইন',
    offline: 'অফলাইন মোড',
    syncNow: 'সিঙ্ক করুন',
    lastSync: 'সর্বশেষ সিঙ্ক',
    pendingSync: 'সিঙ্ক অপেক্ষমাণ',
    logout: 'লগ আউট',
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    edit: 'সম্পাদনা',
    delete: 'মুছুন',
    search: 'খুঁজুন...',
    noData: 'কোনো তথ্য পাওয়া যায়নি',
    loading: 'লোড হচ্ছে...',
    totalMembers: 'মোট সদস্য',
    totalRooms: 'মোট রুম',
    totalSeats: 'মোট সিট',
    availableSeats: 'খালি সিট',
    monthlyMeals: 'চলতি মাসের মোট মিল',
    marketExpense: 'মোট বাজার খরচ',
    otherExpense: 'অন্যান্য খরচ',
    totalDeposits: 'মোট জমা টাকা',
    totalDue: 'মোট বকেয়া টাকা',
    guestIncome: 'অতিথি থেকে আয়',
    mealRate: 'চলতি মিল রেট',
    messBalance: 'মেসের বর্তমান ব্যালেন্স',
  },
  en: {
    appName: 'Smart Mess Manager',
    tagline: 'One Mess, One Digital Accounting System',
    dashboard: 'Dashboard',
    members: 'Members',
    rooms: 'Rooms & Seats',
    meals: 'Daily Meals',
    mealCalendar: 'Meal Calendar',
    expenses: 'Market & Expenses',
    payments: 'Payments',
    monthlyBill: 'Monthly Billing',
    guests: 'Guest Management',
    weeklyMenu: 'Weekly Menu',
    notices: 'Notice Board',
    reports: 'Reports & Export',
    approvals: 'Approvals & Polls',
    users: 'Users & Roles',
    settings: 'Settings',
    backup: 'Backup & Restore',
    syncCenter: 'Sync Center',
    accessHelp: 'Guide & Help',
    online: 'Online',
    offline: 'Offline Mode',
    syncNow: 'Sync Now',
    lastSync: 'Last Sync',
    pendingSync: 'Pending Sync',
    logout: 'Sign Out',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    search: 'Search...',
    noData: 'No records found',
    loading: 'Loading...',
    totalMembers: 'Total Members',
    totalRooms: 'Total Rooms',
    totalSeats: 'Total Seats',
    availableSeats: 'Empty Seats',
    monthlyMeals: 'Monthly Total Meals',
    marketExpense: 'Total Market Cost',
    otherExpense: 'Other Expenses',
    totalDeposits: 'Total Deposits',
    totalDue: 'Total Due',
    guestIncome: 'Guest Income',
    mealRate: 'Current Meal Rate',
    messBalance: 'Current Mess Balance',
  },
} as const;
