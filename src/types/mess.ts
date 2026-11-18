export type UserRole = 'admin' | 'manager' | 'member';
export type Language = 'bn' | 'en';
export type PaymentMethod = 'Cash' | 'bKash' | 'Nagad' | 'Rocket' | 'Bank Transfer' | 'Other';
export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict' | 'failed';

export type PageId =
  | 'dashboard'
  | 'members'
  | 'member-profile'
  | 'rooms'
  | 'meals'
  | 'meal-calendar'
  | 'expenses'
  | 'payments'
  | 'monthly-bill'
  | 'guests'
  | 'weekly-menu'
  | 'notices'
  | 'reports'
  | 'approvals'
  | 'users'
  | 'settings'
  | 'backup'
  | 'sync-center'
  | 'access-help';

export type MemberPageId =
  | 'home'
  | 'my-meals'
  | 'my-bill'
  | 'notifications'
  | 'more'
  | 'market-expenses'
  | 'payment-request'
  | 'guest-meal'
  | 'complaints'
  | 'menu-voting'
  | 'profile'
  | 'mess-rules';

export interface UserAccount {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  memberId?: string;
  isActive: boolean;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface MessSettings {
  id: string;
  messName: string;
  messAddress?: string;
  ownerName?: string;
  contactNumber?: string;
  billingCycleStartDay: number;
  defaultGuestCharge: number;
  guestMealCharge?: number;
  mealCutoffTime?: string; // HH:mm e.g. '22:00'
  messRules?: string;
  currency: string;
  defaultLanguage: Language;
  isSeeded: boolean;
  managerUids?: string[];
  readerUids?: string[];
  updatedAt: string;
  updatedBy: string;
}

export interface Room {
  id: string;
  roomNumber: string;
  roomName?: string;
  totalSeats: number;
  monthlyRent: number;
  status: 'available' | 'full' | 'maintenance';
  notes?: string;
  managerUids?: string[];
  readerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface Member {
  id: string;
  fullName: string;
  fatherName?: string;
  mobile?: string;
  altMobile?: string;
  email?: string;
  permanentAddress?: string;
  presentAddress?: string;
  nidNumber?: string;
  emergencyContact?: string;
  joiningDate?: string;
  leavingDate?: string;
  roomId: string;
  roomNumber: string;
  seatNumber?: string;
  monthlyRent: number;
  advanceAmount: number;
  status: 'active' | 'inactive' | 'archived';
  linkedUid?: string;
  photoUrl?: string;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface MealEntry {
  id: string;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  memberId: string;
  memberUid?: string;
  memberName: string;
  breakfast: number;
  lunch: number;
  dinner: number;
  totalMeals: number;
  notes?: string;
  isLocked: boolean;
  managerUids?: string[];
  readerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface Expense {
  id: string;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  expenseGroup: 'market' | 'other';
  category: string;
  itemName: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  amount: number;
  paidByMemberId?: string;
  paidByName?: string;
  shopperName?: string;
  paymentMethod: PaymentMethod;
  receiptUrl?: string;
  notes?: string;
  isVoided: boolean;
  voidReason?: string;
  managerUids?: string[];
  readerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface Payment {
  id: string;
  memberId: string;
  memberUid?: string;
  memberName: string;
  monthKey: string; // YYYY-MM
  paymentDate: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  receiptNo: string;
  notes?: string;
  isVoided: boolean;
  voidReason?: string;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface MonthlyClosing {
  id: string; // monthKey
  monthKey: string;
  totalMarketCost: number;
  totalOtherCost: number;
  totalMeals: number;
  mealRate: number;
  otherChargePerMember: number;
  isClosed: boolean;
  closedAt?: string;
  closedBy?: string;
  notes?: string;
  managerUids?: string[];
  readerUids?: string[];
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface MonthlyBill {
  id: string; // `${monthKey}_${memberId}`
  monthKey: string;
  memberId: string;
  memberUid?: string;
  memberName: string;
  totalMeals: number;
  mealRate: number;
  foodCost: number;
  roomRent: number;
  otherCharges: number;
  guestMealCost?: number;
  totalBill: number;
  totalPaid: number;
  dueAmount: number;
  advanceAmount: number;
  isLocked: boolean;
  managerUids?: string[];
  generatedAt: string;
  updatedAt: string;
  generatedBy: string;
  syncStatus?: SyncStatus;
}

export interface Guest {
  id: string;
  guestName: string;
  mobile?: string;
  arrivalDate: string;
  departureDate?: string;
  totalDays: number;
  roomId?: string;
  roomNumber?: string;
  dailyCharge: number;
  totalAmount: number;
  paidAmount: number;
  remainingDue: number;
  notes?: string;
  status: 'staying' | 'checked_out';
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface GuestPayment {
  id: string;
  guestId: string;
  guestName: string;
  paymentDate: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  managerUids?: string[];
  createdAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface WeeklyMenu {
  id: string; // saturday..friday
  dayOrder: number;
  dayNameBn: string;
  dayNameEn: string;
  breakfast: string;
  lunch: string;
  dinner: string;
  specialNote?: string;
  managerUids?: string[];
  readerUids?: string[];
  updatedAt: string;
  updatedBy: string;
  syncStatus?: SyncStatus;
}

export interface Notice {
  id: string;
  title: string;
  description: string;
  publishDate: string;
  category: string;
  isPinned: boolean;
  managerUids?: string[];
  readerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole: string;
  timestamp: string;
  details?: string;
  managerUids?: string[];
  syncStatus?: SyncStatus;
}

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localSummary: string;
  serverSummary: string;
  localPayloadJson?: string;
  serverPayloadJson?: string;
  detectedAt: string;
  detectedBy: string;
  status: 'pending' | 'resolved_local' | 'resolved_server';
  resolvedBy?: string;
  resolvedAt?: string;
  managerUids?: string[];
}

export interface SyncQueueItem {
  id?: number;
  uuid: string;
  collectionName: string;
  docId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown> | null;
  baseUpdatedAt?: string;
  createdAt: string;
  createdBy: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'conflict';
  lastError?: string;
}

export interface CachedSession {
  id: string; // 'current'
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  memberId?: string;
  authorizedAt: string;
  lastSyncedAt?: string;
}

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface MealRequest {
  id: string;
  memberId: string;
  memberUid: string;
  memberName: string;
  date: string; // YYYY-MM-DD
  monthKey: string; // YYYY-MM
  breakfast: number;
  lunch: number;
  dinner: number;
  reason?: string;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface PaymentRequest {
  id: string;
  memberId: string;
  memberUid: string;
  memberName: string;
  monthKey: string;
  amount: number;
  paymentDate: string; // YYYY-MM-DD
  paymentMethod: PaymentMethod;
  transactionId?: string;
  receiptImageUrl?: string;
  notes?: string;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface GuestMealRequest {
  id: string;
  memberId: string;
  memberUid: string;
  memberName: string;
  guestName?: string;
  date: string;
  monthKey: string;
  breakfast: number; // 0 or 1
  lunch: number; // 0 or 1
  dinner: number; // 0 or 1
  guestCount: number;
  unitCharge: number;
  totalCharge: number;
  notes?: string;
  status: RequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface Complaint {
  id: string;
  memberId: string;
  memberUid: string;
  memberName: string;
  category: string;
  subject: string;
  description: string;
  imageUrl?: string;
  submittedDate: string;
  status: 'pending' | 'in_progress' | 'resolved';
  adminReply?: string;
  repliedBy?: string;
  repliedAt?: string;
  managerUids?: string[];
  createdAt: string;
  updatedAt: string;
  syncStatus?: SyncStatus;
}

export interface MenuPoll {
  id: string;
  title: string;
  description?: string;
  options: string[];
  deadline: string; // YYYY-MM-DD or ISO
  showResultsAfterVote: boolean;
  isClosed: boolean;
  managerUids?: string[];
  readerUids?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}

export interface MenuVote {
  id: string; // `${pollId}_${uid}`
  pollId: string;
  uid: string;
  memberId?: string;
  memberName: string;
  optionIndex: number;
  optionLabel: string;
  readerUids?: string[];
  managerUids?: string[];
  createdAt: string;
  syncStatus?: SyncStatus;
}

export type NotificationType =
  | 'notice'
  | 'meal_request'
  | 'payment_request'
  | 'guest_meal'
  | 'bill_published'
  | 'market_expense'
  | 'menu_updated'
  | 'poll_created'
  | 'complaint_reply';

export interface AppNotification {
  id: string;
  targetUid: string; // 'ALL' or specific user uid
  type: NotificationType;
  title: string;
  body: string;
  readByUids: string[];
  readerUids?: string[];
  managerUids?: string[];
  createdAt: string;
  createdBy: string;
  syncStatus?: SyncStatus;
}
