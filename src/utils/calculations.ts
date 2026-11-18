import {
  Expense,
  Guest,
  GuestMealRequest,
  MealEntry,
  Member,
  MonthlyBill,
  MonthlyClosing,
  Payment,
  Room,
} from '../types/mess';

export function round2(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getMonthKeyFromDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 7) {
    return getCurrentMonthKey();
  }
  return dateStr.slice(0, 7);
}

export function getCurrentMonthKey(): string {
  return formatLocalDate(new Date()).slice(0, 7);
}

export function getTodayDateStr(): string {
  return formatLocalDate(new Date());
}

export function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

export function isPastMealCutoff(targetDateStr: string, cutoffTime = '22:00'): {
  locked: boolean;
  reasonBn: string;
  reasonEn: string;
} {
  const todayStr = getTodayDateStr();
  const tomorrowStr = getTomorrowDateStr();

  if (targetDateStr < todayStr) {
    return {
      locked: true,
      reasonBn: 'অতীতের তারিখের মিল পরিবর্তন করা যাবে না।',
      reasonEn: 'Cannot modify meals for a past date.',
    };
  }

  if (targetDateStr === todayStr) {
    return {
      locked: true,
      reasonBn: 'আজকের মিল পরিবর্তনের সময়সীমা শেষ হয়েছে।',
      reasonEn: "Cutoff time for today's meals has passed.",
    };
  }

  if (targetDateStr === tomorrowStr) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const nowHm = `${hh}:${mm}`;
    const safeCutoff = /^\d{2}:\d{2}$/.test(cutoffTime) ? cutoffTime : '22:00';
    if (nowHm >= safeCutoff) {
      return {
        locked: true,
        reasonBn: `আগামীকালের মিল আবেদনের শেষ সময় (${safeCutoff}) পার হয়ে গেছে।`,
        reasonEn: `Cutoff time (${safeCutoff}) for tomorrow's meal request has passed.`,
      };
    }
  }

  return { locked: false, reasonBn: '', reasonEn: '' };
}

export function compressImageToDataUrl(file: File, maxW = 720, quality = 0.62): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 90000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.4);
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export interface RoomOccupancyInfo {
  room: Room;
  assignedMembers: Member[];
  occupiedSeats: number;
  availableSeats: number;
}

export function computeRoomOccupancy(rooms: Room[], members: Member[]): RoomOccupancyInfo[] {
  const activeMembers = members.filter((m) => m.status === 'active');
  return rooms.map((room) => {
    const assignedMembers = activeMembers.filter((m) => m.roomId === room.id);
    const occupiedSeats = assignedMembers.length;
    const availableSeats = Math.max(0, room.totalSeats - occupiedSeats);
    return {
      room,
      assignedMembers,
      occupiedSeats,
      availableSeats,
    };
  });
}

export interface MemberMonthlyCalculation {
  member: Member;
  totalMeals: number;
  mealRate: number;
  foodCost: number;
  roomRent: number;
  otherCharges: number;
  guestMealCost: number;
  totalBill: number;
  totalPaid: number;
  dueAmount: number;
  advanceAmount: number;
}

export interface MonthlySummaryCalculation {
  monthKey: string;
  totalMarketCost: number;
  totalOtherCost: number;
  totalMeals: number;
  mealRate: number;
  otherChargePerMember: number;
  totalDeposits: number;
  totalBilled: number;
  totalDue: number;
  totalAdvance: number;
  memberCalculations: MemberMonthlyCalculation[];
}

export function calculateMonthlySummary(params: {
  monthKey: string;
  members: Member[];
  mealEntries: MealEntry[];
  expenses: Expense[];
  payments: Payment[];
  guestMealRequests?: GuestMealRequest[];
  savedBills?: MonthlyBill[];
  closing?: MonthlyClosing;
  useClosingRates?: boolean;
  customOtherPerMember?: number;
}): MonthlySummaryCalculation {
  const {
    monthKey,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests = [],
    savedBills = [],
    closing,
    useClosingRates = false,
    customOtherPerMember,
  } = params;

  const activeMembers = members.filter((m) => m.status === 'active');
  const monthMeals = mealEntries.filter((e) => e.monthKey === monthKey);
  const monthExpenses = expenses.filter((e) => e.monthKey === monthKey && !e.isVoided);
  const monthPayments = payments.filter((p) => p.monthKey === monthKey && !p.isVoided);
  const monthGuestMeals = guestMealRequests.filter((g) => g.monthKey === monthKey && g.status === 'approved');

  const computedMarketCost = round2(
    monthExpenses
      .filter((e) => e.expenseGroup === 'market')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  );

  const computedOtherCost = round2(
    monthExpenses
      .filter((e) => e.expenseGroup === 'other')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0)
  );

  const computedTotalMeals = round2(
    monthMeals.reduce((sum, e) => sum + Number(e.totalMeals || 0), 0)
  );

  const totalMarketCost =
    useClosingRates && closing ? round2(closing.totalMarketCost) : computedMarketCost;
  const totalOtherCost =
    useClosingRates && closing ? round2(closing.totalOtherCost) : computedOtherCost;
  const totalMeals =
    useClosingRates && closing ? round2(closing.totalMeals) : computedTotalMeals;

  // Prevent division by zero; prefer authoritative mess-wide closing rates in Member view
  const mealRate =
    useClosingRates && closing
      ? round2(closing.mealRate)
      : totalMeals > 0
        ? round2(totalMarketCost / totalMeals)
        : 0;

  const otherChargePerMember =
    customOtherPerMember !== undefined
      ? round2(customOtherPerMember)
      : useClosingRates && closing
        ? round2(closing.otherChargePerMember)
        : activeMembers.length > 0
          ? round2(totalOtherCost / activeMembers.length)
          : 0;

  // Include active members plus any non-active member who has meals, payments, or approved guest meals in this month
  const relevantMembers = members.filter((m) => {
    if (m.status === 'active') return true;
    const hasMeals = monthMeals.some((me) => me.memberId === m.id);
    const hasPays = monthPayments.some((p) => p.memberId === m.id);
    const hasGuests = monthGuestMeals.some((g) => g.memberId === m.id);
    return hasMeals || hasPays || hasGuests;
  });

  const memberCalculations: MemberMonthlyCalculation[] = relevantMembers.map((member) => {
    const memberMealRows = monthMeals.filter((e) => e.memberId === member.id);
    const savedBill = savedBills.find(
      (b) => b.monthKey === monthKey && b.memberId === member.id
    );

    const rawMeals = round2(
      memberMealRows.reduce((sum, e) => sum + Number(e.totalMeals || 0), 0)
    );
    const mMeals =
      useClosingRates && memberMealRows.length === 0 && savedBill
        ? round2(savedBill.totalMeals)
        : rawMeals;

    const foodCost = round2(mMeals * mealRate);
    const roomRent = round2(Number(member.monthlyRent || 0));
    const otherCharges = member.status === 'active' ? otherChargePerMember : 0;
    const guestMealCost = round2(
      monthGuestMeals
        .filter((g) => g.memberId === member.id)
        .reduce((sum, g) => sum + Number(g.totalCharge || 0), 0)
    );
    const totalBill = round2(foodCost + roomRent + otherCharges + guestMealCost);

    const memberPaymentRows = monthPayments.filter((p) => p.memberId === member.id);
    const rawPaid = round2(
      memberPaymentRows.reduce((sum, p) => sum + Number(p.amount || 0), 0)
    );
    const totalPaid =
      useClosingRates && memberPaymentRows.length === 0 && savedBill
        ? round2(savedBill.totalPaid)
        : rawPaid;

    const diff = round2(totalBill - totalPaid);
    const dueAmount = diff > 0 ? diff : 0;
    const advanceAmount = diff < 0 ? round2(Math.abs(diff)) : 0;

    return {
      member,
      totalMeals: mMeals,
      mealRate,
      foodCost,
      roomRent,
      otherCharges,
      guestMealCost,
      totalBill,
      totalPaid,
      dueAmount,
      advanceAmount,
    };
  });

  const totalDeposits = round2(
    monthPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0)
  );
  const totalBilled = round2(memberCalculations.reduce((s, c) => s + c.totalBill, 0));
  const totalDue = round2(memberCalculations.reduce((s, c) => s + c.dueAmount, 0));
  const totalAdvance = round2(memberCalculations.reduce((s, c) => s + c.advanceAmount, 0));

  return {
    monthKey,
    totalMarketCost,
    totalOtherCost,
    totalMeals,
    mealRate,
    otherChargePerMember,
    totalDeposits,
    totalBilled,
    totalDue,
    totalAdvance,
    memberCalculations,
  };
}

export interface DashboardKPIs {
  totalActiveMembers: number;
  totalRooms: number;
  totalSeats: number;
  availableSeats: number;
  monthlyTotalMeals: number;
  monthlyMarketCost: number;
  monthlyOtherCost: number;
  monthlyTotalDeposits: number;
  monthlyTotalDue: number;
  guestIncome: number;
  currentMealRate: number;
  messBalance: number;
}

export function calculateDashboardKPIs(params: {
  monthKey: string;
  rooms: Room[];
  members: Member[];
  mealEntries: MealEntry[];
  expenses: Expense[];
  payments: Payment[];
  guests: Guest[];
  guestMealRequests?: GuestMealRequest[];
}): DashboardKPIs {
  const { monthKey, rooms, members, mealEntries, expenses, payments, guests, guestMealRequests = [] } = params;
  const activeMembers = members.filter((m) => m.status === 'active');
  const totalSeats = rooms.reduce((sum, r) => sum + Number(r.totalSeats || 0), 0);
  const occupiedSeats = activeMembers.filter((m) => rooms.some((r) => r.id === m.roomId)).length;
  const availableSeats = Math.max(0, totalSeats - occupiedSeats);

  const summary = calculateMonthlySummary({
    monthKey,
    members,
    mealEntries,
    expenses,
    payments,
    guestMealRequests,
  });

  // Guest income from paid amounts of guests arriving in the selected month (or total overall if month matches)
  const monthGuests = guests.filter((g) => g.arrivalDate?.startsWith(monthKey));
  const guestIncome = round2(
    monthGuests.reduce((sum, g) => sum + Number(g.paidAmount || 0), 0)
  );

  // Mess current balance = (all non-voided member payments + all guest paid amounts) - all non-voided expenses
  const allDeposits = payments
    .filter((p) => !p.isVoided)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const allGuestPaid = guests.reduce((sum, g) => sum + Number(g.paidAmount || 0), 0);
  const allExpenses = expenses
    .filter((e) => !e.isVoided)
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const messBalance = round2(allDeposits + allGuestPaid - allExpenses);

  return {
    totalActiveMembers: activeMembers.length,
    totalRooms: rooms.length,
    totalSeats,
    availableSeats,
    monthlyTotalMeals: summary.totalMeals,
    monthlyMarketCost: summary.totalMarketCost,
    monthlyOtherCost: summary.totalOtherCost,
    monthlyTotalDeposits: summary.totalDeposits,
    monthlyTotalDue: summary.totalDue,
    guestIncome,
    currentMealRate: summary.mealRate,
    messBalance,
  };
}
