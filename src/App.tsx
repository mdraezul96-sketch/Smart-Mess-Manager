/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MemberAppShell } from './components/MemberAppShell';
import { MessProvider, useMess } from './context/MessContext';
import { AccessHelpPage, BackupPage, SettingsPage, SyncCenterPage, UsersPage } from './pages/AdminToolsPages';
import { ApprovalsHubPage } from './pages/ApprovalsHubPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { GuestsPage } from './pages/GuestsPage';
import { LoginPage } from './pages/LoginPage';
import { MealsPage } from './pages/MealsPage';
import { MembersPage } from './pages/MembersPage';
import { NoticesPage, WeeklyMenuPage } from './pages/MenuAndNoticesPage';
import { MonthlyBillPage } from './pages/MonthlyBillPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { RoomsPage } from './pages/RoomsPage';
import { MemberBillPage, MemberMarketViewPage } from './pages/member/MemberBillAndMarket';
import { MemberHomePage, MemberMealsPage } from './pages/member/MemberDashboardAndMeals';
import {
  MemberComplaintsPage,
  MemberGuestMealPage,
  MemberMorePage,
  MemberNotificationsPage,
  MemberPaymentRequestPage,
  MemberProfilePage,
  MemberRulesPage,
  MemberVotingPage,
} from './pages/member/MemberRequestsAndMore';
import { MemberPageId, PageId } from './types/mess';

const MemberRouter: React.FC = () => {
  const [memberPage, setMemberPage] = useState<MemberPageId>('home');

  const renderMemberPage = () => {
    switch (memberPage) {
      case 'home':
        return <MemberHomePage onNavigate={setMemberPage} />;
      case 'my-meals':
        return <MemberMealsPage />;
      case 'my-bill':
        return <MemberBillPage onNavigate={setMemberPage} />;
      case 'notifications':
        return <MemberNotificationsPage />;
      case 'more':
        return <MemberMorePage onNavigate={setMemberPage} />;
      case 'market-expenses':
        return <MemberMarketViewPage />;
      case 'payment-request':
        return <MemberPaymentRequestPage />;
      case 'guest-meal':
        return <MemberGuestMealPage />;
      case 'complaints':
        return <MemberComplaintsPage />;
      case 'menu-voting':
        return <MemberVotingPage />;
      case 'profile':
        return <MemberProfilePage />;
      case 'mess-rules':
        return <MemberRulesPage />;
      default:
        return <MemberHomePage onNavigate={setMemberPage} />;
    }
  };

  return (
    <MemberAppShell activePage={memberPage} onNavigate={setMemberPage}>
      {renderMemberPage()}
    </MemberAppShell>
  );
};

const MessRouter: React.FC = () => {
  const { authReady, currentUser } = useMess();
  const [activePage, setActivePage] = useState<PageId>('dashboard');

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F7FB] dark:bg-slate-950">
        <div className="text-center space-y-3">
          <img src="/icon.svg" alt="Smart Mess Manager" className="w-12 h-12 rounded-xl mx-auto animate-pulse" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Smart Mess Manager লোড হচ্ছে...
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  // Dedicated Simple Member App Experience for Member role
  if (currentUser.role === 'member') {
    return <MemberRouter />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setActivePage} />;
      case 'members':
      case 'member-profile':
        return <MembersPage />;
      case 'rooms':
        return <RoomsPage />;
      case 'meals':
        return <MealsPage initialTab="entry" />;
      case 'meal-calendar':
        return <MealsPage initialTab="calendar" />;
      case 'expenses':
        return <ExpensesPage />;
      case 'payments':
        return <PaymentsPage />;
      case 'monthly-bill':
        return <MonthlyBillPage />;
      case 'guests':
        return <GuestsPage />;
      case 'weekly-menu':
        return <WeeklyMenuPage />;
      case 'notices':
        return <NoticesPage />;
      case 'approvals':
        return <ApprovalsHubPage />;
      case 'reports':
        return <ReportsPage />;
      case 'users':
        return <UsersPage />;
      case 'settings':
        return <SettingsPage />;
      case 'backup':
        return <BackupPage />;
      case 'sync-center':
        return <SyncCenterPage />;
      case 'access-help':
        return <AccessHelpPage />;
      default:
        return <DashboardPage onNavigate={setActivePage} />;
    }
  };

  return (
    <AppShell activePage={activePage} onNavigate={setActivePage}>
      {renderPage()}
    </AppShell>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <MessProvider>
        <MessRouter />
      </MessProvider>
    </ErrorBoundary>
  );
}
