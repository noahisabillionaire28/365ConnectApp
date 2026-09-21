import { lazy, Suspense, type ComponentType } from 'react';

/**
 * Route-level code splitting: each screen is its own chunk, fetched the
 * first time it is opened. Splash/Login/Home stay in the main bundle so the
 * first paint needs nothing extra.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = ComponentType<any>;
function lazyNamed<M extends Record<string, unknown>>(loader: () => Promise<M>, name: keyof M) {
  return lazy<AnyComponent>(async () => ({ default: (await loader())[name] as AnyComponent }));
}

function RouteFallback() {
  return (
    <div className="min-h-[100dvh] bg-white flex items-center justify-center" aria-busy="true" aria-label="Loading">
      <div className="w-7 h-7 rounded-full border-2 border-[#DBDBDB] border-t-[#0A1628] animate-spin" />
    </div>
  );
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { restoreQueryCache, startQueryCachePersistence } from '@/lib/queryPersist';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Redirect, Router as WouterRouter, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

import { AuthProvider } from '@/contexts/AuthContext';
import { RoleProvider, useRole } from '@/contexts/RoleContext';
import { SuspendedGate } from '@/components/SuspendedGate';
import { AdminFab } from '@/components/AdminFab';
import { useSSE } from '@/hooks/useSSE';
import { ToastProvider } from '@/contexts/ToastContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileContainer } from '@/components/MobileContainer';
import { AdminNav } from '@/components/AdminNav';

// ── Mobile screens ─────────────────────────────────────────────────────────────
// Auth / onboarding
import { SplashScreen }         from '@/pages/SplashScreen';
import { LoginScreen }          from '@/pages/LoginScreen';
const SignUpScreen = lazyNamed(() => import('@/pages/SignUpScreen'), 'SignUpScreen');
const PhoneAuthScreen = lazyNamed(() => import('@/pages/PhoneAuthScreen'), 'PhoneAuthScreen');
const ResetPasswordScreen = lazyNamed(() => import('@/pages/ResetPasswordScreen'), 'ResetPasswordScreen');
const AuthCallbackScreen = lazyNamed(() => import('@/pages/AuthCallbackScreen'), 'AuthCallbackScreen');
const RoleSelectScreen = lazyNamed(() => import('@/pages/RoleSelectScreen'), 'RoleSelectScreen');
const OnboardingScreen = lazyNamed(() => import('@/pages/OnboardingScreen'), 'OnboardingScreen');
const WorkerSetupScreen = lazyNamed(() => import('@/pages/WorkerSetupScreen'), 'WorkerSetupScreen');
const ClientSetupScreen = lazyNamed(() => import('@/pages/ClientSetupScreen'), 'ClientSetupScreen');
const StafferSetupScreen = lazyNamed(() => import('@/pages/StafferSetupScreen'), 'StafferSetupScreen');

// Main app tabs
import { HomeScreen }            from '@/pages/HomeScreen';
const JobsScreen = lazyNamed(() => import('@/pages/JobsScreen'), 'JobsScreen');
const ExploreScreen = lazyNamed(() => import('@/pages/ExploreScreen'), 'ExploreScreen');
const MessagesScreen = lazyNamed(() => import('@/pages/MessagesScreen'), 'MessagesScreen');
const ChatScreen = lazyNamed(() => import('@/pages/ChatScreen'), 'ChatScreen');
const NotificationsScreen = lazyNamed(() => import('@/pages/NotificationsScreen'), 'NotificationsScreen');
const NotificationSettingsScreen = lazyNamed(() => import('@/pages/NotificationSettingsScreen'), 'NotificationSettingsScreen');
const PostScreen = lazyNamed(() => import('@/pages/PostScreen'), 'PostScreen');
const HashtagScreen = lazyNamed(() => import('@/pages/HashtagScreen'), 'HashtagScreen');
const SavedWorkersScreen = lazyNamed(() => import('@/pages/SavedWorkersScreen'), 'SavedWorkersScreen');
const AvailabilityScreen = lazyNamed(() => import('@/pages/AvailabilityScreen'), 'AvailabilityScreen');
const ProfileScreen = lazyNamed(() => import('@/pages/ProfileScreen'), 'ProfileScreen');

// Detail screens
const ShiftDetailScreen = lazyNamed(() => import('@/pages/ShiftDetailScreen'), 'ShiftDetailScreen');
const WorkerProfileScreen = lazyNamed(() => import('@/pages/WorkerProfileScreen'), 'WorkerProfileScreen');
const ClockInScreen = lazyNamed(() => import('@/pages/ClockInScreen'), 'ClockInScreen');
const ApplicantsScreen = lazyNamed(() => import('@/pages/ApplicantsScreen'), 'ApplicantsScreen');
const ShiftUpdatesScreen = lazyNamed(() => import('@/pages/ShiftUpdatesScreen'), 'ShiftUpdatesScreen');
const ReviewScreen = lazyNamed(() => import('@/pages/ReviewScreen'), 'ReviewScreen');
const RosterScreen = lazyNamed(() => import('@/pages/RosterScreen'), 'RosterScreen');
const AssignWorkersScreen = lazyNamed(() => import('@/pages/AssignWorkersScreen'), 'AssignWorkersScreen');

// Wizards (post-shift builders)
const PostShiftNameScreen = lazyNamed(() => import('@/pages/PostShiftNameScreen'), 'PostShiftNameScreen');
const PostShiftEventTypeScreen = lazyNamed(() => import('@/pages/PostShiftEventTypeScreen'), 'PostShiftEventTypeScreen');
const PostEventScreen = lazyNamed(() => import('@/pages/PostEventScreen'), 'PostEventScreen');
const PostShiftSuccessScreen = lazyNamed(() => import('@/pages/PostShiftSuccessScreen'), 'PostShiftSuccessScreen');
const PostShiftStep1Screen = lazyNamed(() => import('@/pages/PostShiftStep1Screen'), 'PostShiftStep1Screen');
const PostShiftStep2Screen = lazyNamed(() => import('@/pages/PostShiftStep2Screen'), 'PostShiftStep2Screen');
const PostShiftStep3Screen = lazyNamed(() => import('@/pages/PostShiftStep3Screen'), 'PostShiftStep3Screen');
const PostShiftStep4Screen = lazyNamed(() => import('@/pages/PostShiftStep4Screen'), 'PostShiftStep4Screen');
const PostShiftStep5Screen = lazyNamed(() => import('@/pages/PostShiftStep5Screen'), 'PostShiftStep5Screen');
const ProUpgradeScreen = lazyNamed(() => import('@/pages/ProUpgradeScreen'), 'ProUpgradeScreen');
const EarningsScreen = lazyNamed(() => import('@/pages/EarningsScreen'), 'EarningsScreen');

// ── Admin screens ──────────────────────────────────────────────────────────────
const AdminLogin = lazyNamed(() => import('@/pages/admin/AdminLogin'), 'AdminLogin');
const AdminDashboard = lazyNamed(() => import('@/pages/admin/AdminDashboard'), 'AdminDashboard');
const AdminUsers = lazyNamed(() => import('@/pages/admin/AdminUsers'), 'AdminUsers');
const AdminShifts = lazyNamed(() => import('@/pages/admin/AdminShifts'), 'AdminShifts');
const AdminDisputes = lazyNamed(() => import('@/pages/admin/AdminDisputes'), 'AdminDisputes');
const AdminRevenue = lazyNamed(() => import('@/pages/admin/AdminRevenue'), 'AdminRevenue');
const AdminSettings = lazyNamed(() => import('@/pages/admin/AdminSettings'), 'AdminSettings');

// ── Query client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      // Keep entries in memory for a day so navigating back is instant and the
      // on-device snapshot has something to persist even after long idle gaps.
      gcTime:               24 * 60 * 60_000,
      retry:                2,
      refetchOnWindowFocus: false,
    },
  },
});

// Offline resilience: restore the last-known data from the device immediately,
// then keep the on-device snapshot in sync. A Supabase/network blip now shows
// cached data instead of a blank screen; fresh data loads in the background.
restoreQueryCache(queryClient);
startQueryCachePersistence(queryClient);

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

// ── SSE mount — opens a live event stream once the user is authenticated ──────
function SSEMount() { useSSE(); return null; }

// ── Suspended-account gate — blocks banned (non-admin) users from the app ─────
function SuspendedGuard() {
  const { status, isAdmin } = useRole();
  if (status === 'suspended' && !isAdmin) return <SuspendedGate />;
  return null;
}

// ── Mobile router — full-width on phones, centred column on larger screens ─────────────────────────────────────
function MobileRouter() {
  const [location] = useLocation();
  return (
    <MobileContainer>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.13, ease: 'easeInOut' }}
          style={{ width: '100%' }}
        >
          <Suspense fallback={<RouteFallback />}>
          <Switch>
            {/* ── Auth (Supabase) ───────────────────────────────── */}
            <Route path="/login"          component={LoginScreen}         />
            <Route path="/signup"         component={SignUpScreen}        />
            <Route path="/phone-auth"     component={PhoneAuthScreen}     />
            <Route path="/reset-password" component={ResetPasswordScreen} />
            <Route path="/auth/callback"  component={AuthCallbackScreen}  />

            {/* Legacy aliases so old Clerk links still resolve */}
            <Route path="/sign-in/*?"  component={LoginScreen}  />
            <Route path="/sign-up/*?"  component={SignUpScreen} />

            {/* ── Auth / onboarding ─────────────────────────────── */}
            <Route path="/"              component={SplashScreen}       />
            <Route path="/role-select"   component={RoleSelectScreen}    />
            <Route path="/onboarding"    component={OnboardingScreen}    />
            <Route path="/worker-setup"  component={WorkerSetupScreen}   />
            <Route path="/client-setup"  component={ClientSetupScreen}   />
            <Route path="/staffer-setup" component={StafferSetupScreen}  />

            {/* Legacy alias so any saved links still work */}
            <Route path="/profile-setup" component={WorkerSetupScreen}   />

            {/* ── Main tabs ─────────────────────────────────────── */}
            <Route path="/home"          component={HomeScreen}          />
            <Route path="/jobs"          component={JobsScreen}          />
            <Route path="/explore"       component={ExploreScreen}       />
            <Route path="/messages"      component={MessagesScreen}      />
            <Route path="/messages/:conversationId" component={ChatScreen} />
            <Route path="/notifications" component={NotificationsScreen} />
            <Route path="/notification-settings" component={NotificationSettingsScreen} />
            <Route path="/profile"       component={ProfileScreen}       />

            {/* ── Detail & misc ─────────────────────────────────── */}
            <Route path="/shift/:id"        component={ShiftDetailScreen}   />
            <Route path="/shift/:id/applicants" component={ApplicantsScreen} />
            <Route path="/shift/:id/updates"    component={ShiftUpdatesScreen} />
            {/* Legacy: offers now live on Home → Requests */}
            <Route path="/requests">{() => <Redirect to="/home" />}</Route>
            <Route path="/worker/:username" component={WorkerProfileScreen}  />
            <Route path="/post/:id"      component={PostScreen}          />
            <Route path="/hashtag/:tag"  component={HashtagScreen}        />
            <Route path="/saved"         component={SavedWorkersScreen}   />
            <Route path="/availability"  component={AvailabilityScreen}   />
            <Route path="/clock/:id"        component={ClockInScreen}        />
            <Route path="/review/:shiftId/:toUserId" component={ReviewScreen} />
            <Route path="/pro-upgrade"              component={ProUpgradeScreen} />
            <Route path="/earnings"                 component={EarningsScreen} />

            {/* ── Staffer: roster + assign workers ──────────────── */}
            <Route path="/roster"           component={RosterScreen}         />
            <Route path="/shift/:id/assign" component={AssignWorkersScreen}  />

            {/* ── Client post-shift wizard ──────────────────────── */}
            <Route path="/post-shift/name"  component={PostShiftNameScreen} />
            <Route path="/post-shift/event" component={PostShiftEventTypeScreen} />
            <Route path="/post-event"       component={PostEventScreen} />
            <Route path="/post-shift/step1" component={PostShiftStep1Screen} />
            <Route path="/post-shift/step2" component={PostShiftStep2Screen} />
            <Route path="/post-shift/step3" component={PostShiftStep3Screen} />
            <Route path="/post-shift/step4" component={PostShiftStep4Screen} />
            <Route path="/post-shift/step5" component={PostShiftStep5Screen} />
            <Route path="/post-shift/success" component={PostShiftSuccessScreen} />

            <Route component={NotFound} />
          </Switch>
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </MobileContainer>
  );
}

// ── Admin router — fixed top-bar nav + content ────────────────────────────────
function AdminRouter() {
  const [location] = useLocation();
  const showNav = location !== '/admin/login' && location !== '/admin';

  return (
    <div
      className="min-h-[100dvh] bg-[#FAFAFA]"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {showNav && <AdminNav />}

      <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/admin/login"     component={AdminLogin}     />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users"     component={AdminUsers}     />
        <Route path="/admin/shifts"    component={AdminShifts}    />
        <Route path="/admin/disputes"  component={AdminDisputes}  />
        <Route path="/admin/revenue"   component={AdminRevenue}   />
        <Route path="/admin/settings"  component={AdminSettings}  />
        <Route path="/admin">
          {() => {
            window.location.replace(
              window.location.pathname.replace(/\/admin\/?$/, '/admin/login'),
            );
            return null;
          }}
        </Route>
      </Switch>
      </Suspense>
    </div>
  );
}

// ── Root splitter ─────────────────────────────────────────────────────────────
function AppRouter() {
  const [location] = useLocation();
  const isAdmin = location === '/admin' || location.startsWith('/admin/');
  return isAdmin ? <AdminRouter /> : <MobileRouter />;
}

// ── App shell — auth + providers around the router ────────────────────────────
function AppShell() {
  return (
    <AuthProvider>
      <SSEMount />
      <RoleProvider>
        <ToastProvider>
          <TooltipProvider>
            <ErrorBoundary>
              <AppRouter />
              <AdminFab />
              <SuspendedGuard />
            </ErrorBoundary>
          </TooltipProvider>
        </ToastProvider>
      </RoleProvider>
    </AuthProvider>
  );
}

// ── App root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <AppShell />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
