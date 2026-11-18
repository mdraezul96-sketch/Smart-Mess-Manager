import {
  Member,
  MessSettings,
  Room,
  WeeklyMenu,
} from '../types/mess';

export const DEFAULT_MESS_ID = 'default-mess';

export function buildInitialSettings(actorUid: string, ownerName?: string): MessSettings {
  const now = new Date().toISOString();
  return {
    id: DEFAULT_MESS_ID,
    messName: 'Smart Mess Manager',
    messAddress: '',
    ownerName: ownerName || 'মেস মালিক',
    contactNumber: '',
    billingCycleStartDay: 1,
    defaultGuestCharge: 200,
    guestMealCharge: 70,
    mealCutoffTime: '22:00',
    messRules:
      '১. প্রতিদিন রাত ১০:০০ টার (২২:০০) মধ্যে আগামী দিনের মিল চালু বা বন্ধের আবেদন করতে হবে।\n২. মাসের ১০ তারিখের মধ্যে চলতি মাসের অগ্রিম ও পূর্বের বকেয়া পরিশোধ করতে হবে।\n৩. অতিথি খাবারের জন্য পূর্বেই অ্যাপ থেকে Guest Meal Request পাঠাতে হবে।\n৪. রুম ও ডাইনিং পরিষ্কার-পরিচ্ছন্ন রাখা সকল সদস্যের দায়িত্ব।',
    currency: 'BDT',
    defaultLanguage: 'bn',
    isSeeded: true,
    managerUids: [actorUid],
    readerUids: [actorUid],
    updatedAt: now,
    updatedBy: actorUid,
  };
}

export function buildInitialRooms(actorUid: string): Room[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'room-1',
      roomNumber: 'Room 1',
      roomName: 'রুম ১',
      totalSeats: 2,
      monthlyRent: 0,
      status: 'full',
      notes: '',
      managerUids: [actorUid],
      readerUids: [actorUid],
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
    },
    {
      id: 'room-2',
      roomNumber: 'Room 2',
      roomName: 'রুম ২',
      totalSeats: 2,
      monthlyRent: 0,
      status: 'full',
      notes: '',
      managerUids: [actorUid],
      readerUids: [actorUid],
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
    },
    {
      id: 'room-3',
      roomNumber: 'Room 3',
      roomName: 'রুম ৩',
      totalSeats: 2,
      monthlyRent: 0,
      status: 'full',
      notes: '',
      managerUids: [actorUid],
      readerUids: [actorUid],
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
    },
    {
      id: 'room-4',
      roomNumber: 'Room 4',
      roomName: 'রুম ৪',
      totalSeats: 3,
      monthlyRent: 0,
      status: 'available',
      notes: '২টি খালি সিট রয়েছে',
      managerUids: [actorUid],
      readerUids: [actorUid],
      createdAt: now,
      updatedAt: now,
      createdBy: actorUid,
    },
  ];
}

export function buildInitialMembers(actorUid: string): Member[] {
  const now = new Date().toISOString();
  const base = {
    fatherName: '',
    mobile: '',
    altMobile: '',
    email: '',
    permanentAddress: '',
    presentAddress: '',
    nidNumber: '',
    emergencyContact: '',
    joiningDate: '',
    leavingDate: '',
    monthlyRent: 0,
    advanceAmount: 0,
    status: 'active' as const,
    linkedUid: '',
    photoUrl: '',
    managerUids: [actorUid],
    createdAt: now,
    updatedAt: now,
    createdBy: actorUid,
  };

  return [
    { ...base, id: 'member-rani', fullName: 'রানি', roomId: 'room-1', roomNumber: 'Room 1', seatNumber: 'সিট ১' },
    { ...base, id: 'member-ali-hasan', fullName: 'আলী হাসান', roomId: 'room-1', roomNumber: 'Room 1', seatNumber: 'সিট ২' },
    { ...base, id: 'member-shahanaj', fullName: 'শাহানাজ আপু', roomId: 'room-2', roomNumber: 'Room 2', seatNumber: 'সিট ১' },
    { ...base, id: 'member-arif', fullName: 'আরিফ ভাই', roomId: 'room-2', roomNumber: 'Room 2', seatNumber: 'সিট ২' },
    { ...base, id: 'member-fatema', fullName: 'ফাতেমা', roomId: 'room-3', roomNumber: 'Room 3', seatNumber: 'সিট ১' },
    { ...base, id: 'member-jahid', fullName: 'জাহিদ হাসান', roomId: 'room-3', roomNumber: 'Room 3', seatNumber: 'সিট ২' },
    { ...base, id: 'member-riajul', fullName: 'রিয়াজুল ইসলাম', roomId: 'room-4', roomNumber: 'Room 4', seatNumber: 'সিট ১' },
  ];
}

export function buildInitialWeeklyMenus(actorUid: string): WeeklyMenu[] {
  const now = new Date().toISOString();
  const days = [
    { id: 'saturday', dayOrder: 0, dayNameBn: 'শনিবার', dayNameEn: 'Saturday', main: 'মাছ' },
    { id: 'sunday', dayOrder: 1, dayNameBn: 'রবিবার', dayNameEn: 'Sunday', main: 'ডিম' },
    { id: 'monday', dayOrder: 2, dayNameBn: 'সোমবার', dayNameEn: 'Monday', main: 'মুরগি' },
    { id: 'tuesday', dayOrder: 3, dayNameBn: 'মঙ্গলবার', dayNameEn: 'Tuesday', main: 'ডিম' },
    { id: 'wednesday', dayOrder: 4, dayNameBn: 'বুধবার', dayNameEn: 'Wednesday', main: 'মাছ' },
    { id: 'thursday', dayOrder: 5, dayNameBn: 'বৃহস্পতিবার', dayNameEn: 'Thursday', main: 'সবজি' },
    { id: 'friday', dayOrder: 6, dayNameBn: 'শুক্রবার', dayNameEn: 'Friday', main: 'খিচুড়ি / বিরিয়ানি' },
  ];

  return days.map((d) => ({
    id: d.id,
    dayOrder: d.dayOrder,
    dayNameBn: d.dayNameBn,
    dayNameEn: d.dayNameEn,
    breakfast: 'পরটা / রুটি ও ভাজি',
    lunch: d.main,
    dinner: d.main,
    specialNote: '',
    managerUids: [actorUid],
    readerUids: [actorUid],
    updatedAt: now,
    updatedBy: actorUid,
  }));
}
