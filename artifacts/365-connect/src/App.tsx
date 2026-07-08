import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { APIProvider } from '@vis.gl/react-google-maps';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

import { AuthProvider } from '@/contexts/AuthContext';
import { RoleProvider } from '@/contexts/RoleContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { MobileContainer } from '@/components/MobileContainer';
import { AdminNav } from '@/components/AdminNav';

// ── Mobile screens ─────────────────────────────────────────────────────────────
// Auth / onboarding
import { SplashScreen }         from '@/pages/SplashScreen';
import { SignUpScreen }          from '@/pages/SignUpScreen';
import { LoginScreen }           from '@/pages/LoginScreen';
import { RoleSelectScreen }      from '@/pages/RoleSelectScreen';
import { OnboardingScreen }      from '@/pages/OnboardingScreen';
import { WorkerSetupScreen }     from '@/pages/WorkerSetupScreen';
import { ClientSetupScreen }     from '@/pages/ClientSetupScreen';
import { StafferSetupScreen }    from '@/pages/StafferSetupScreen';
import { PhoneAuthScreen }       from '@/pages/PhoneAuthScreen';
import { AuthCallbackScreen }    from '@/pages/AuthCallbackScreen';
import { ResetPasswordScreen }   from '@/pages/ResetPasswordScreen';

// Main app tabs
import { HomeScreen }            from '@/pages/HomeScreen';
import { JobsScreen }            from '@/pages/JobsScreen';
import { ExploreScreen }         from '@/pages/ExploreScreen';
import { MessagesScreen }        from '@/pages/MessagesScreen';
import { ChatScreen }            from '@/pages/ChatScreen';
import { NotificationsScreen }   from '@/pages/NotificationsScreen';
import { ProfileScreen }         from '@/pages/ProfileScreen';

// Detail screens
import { ShiftDetailScreen }     from '@/pages/ShiftDetailScreen';
import { WorkerProfileScreen }   from '@/pages/WorkerProfileScreen';
import { ClockInScreen }         from '@/pages/ClockInScreen';
import { ApplicantsScreen }      from '@/pages/ApplicantsScreen';
import { ShiftRequestsScreen }   from '@/pages/ShiftRequestsScreen';
import { ReviewScreen }          from '@/pages/ReviewScreen';
import { RosterScreen }          from '@/pages/RosterScreen';
import { AssignWorkersScreen }   from '@/pages/AssignWorkersScreen';

// Wizards (post-shift builders)
import { PostShiftStep1Screen }  from '@/pages/PostShiftStep1Screen';
import { PostShiftStep2Screen }  from '@/pages/PostShiftStep2Screen';
import { PostShiftStep3Screen }  from '@/pages/PostShiftStep3Screen';
import { PostShiftStep4Screen }  from '@/pages/PostShiftStep4Screen';
import { PostShiftStep5Screen }  from '@/pages/PostShiftStep5Screen';
import { StafferPostStep1Screen } from '@/pages/StafferPostStep1Screen';
import { StafferPostStep2Screen } from '@/pages/StafferPostStep2Screen';
import { StafferPostStep3Screen } from '@/pages/StafferPostStep3Screen';
import { StafferPostStep4Screen } from '@/pages/StafferPostStep4Screen';
import { StafferPostStep5Screen } from '@/pages/StafferPostStep5Screen';
import { StafferPostStep6Screen } from '@/pages/StafferPostStep6Screen';
import { StafferPostStep7Screen } from '@/pages/StafferPostStep7Screen';
import { ProUpgradeScreen }       from '@/pages/ProUpgradeScreen';
import { EarningsScreen }         from '@/pages/EarningsScreen';

// ── Admin screens ──────────────────────────────────────────────────────────────
import { AdminLogin }     from '@/pages/admin/AdminLogin';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminUsers }     from '@/pages/admin/AdminUsers';
import { AdminShifts }    from '@/pages/admin/AdminShifts';
import { AdminDisputes }  from '@/pages/admin/AdminDisputes';
import { AdminRevenue }   from '@/pages/admin/AdminRevenue';
import { AdminSettings }  from '@/pages/admin/AdminSettings';

// ── Query client ──────────────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            30_000,
      gcTime:               5 * 60_000,
      retry:                2,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Mobile router — 390 px centred column ─────────────────────────────────────
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
          <Switch>
            {/* ── Auth / onboarding ─────────────────────────────────── */}
            <Route path="/"              component={SplashScreen}       />
            <Route path="/signup"        component={SignUpScreen}        />
            <Route path="/login"         component={LoginScreen}         />
            <Route path="/role-select"   component={RoleSelectScreen}    />
            <Route path="/onboarding"    component={OnboardingScreen}    />
            <Route path="/worker-setup"  component={WorkerSetupScreen}   />
            <Route path="/client-setup"  component={ClientSetupScreen}   />
            <Route path="/staffer-setup" component={StafferSetupScreen}  />
            <Route path="/phone-auth"    component={PhoneAuthScreen}     />
            <Route path="/auth/callback" component={AuthCallbackScreen}  />
            <Route path="/reset-password" component={ResetPasswordScreen} />

            {/* Legacy alias so any saved links still work */}
            <Route path="/profile-setup" component={WorkerSetupScreen}   />

            {/* ── Main tabs ─────────────────────────────────────────── */}
            <Route path="/home"          component={HomeScreen}          />
            <Route path="/jobs"          component={JobsScreen}          />
            <Route path="/explore"       component={ExploreScreen}       />
            <Route path="/messages"      component={MessagesScreen}      />
            <Route path="/messages/:conversationId" component={ChatScreen} />
            <Route path="/notifications" component={NotificationsScreen} />
            <Route path="/profile"       component={ProfileScreen}       />

            {/* ── Detail & misc ─────────────────────────────────────── */}
            <Route path="/shift/:id"        component={ShiftDetailScreen}   />
            <Route path="/shift/:id/applicants" component={ApplicantsScreen} />
            <Route path="/requests"         component={ShiftRequestsScreen}  />
            <Route path="/worker/:username" component={WorkerProfileScreen}  />
            <Route path="/clock/:id"        component={ClockInScreen}        />
            <Route path="/review/:shiftId/:toUserId" component={ReviewScreen} />
            <Route path="/pro-upgrade"              component={ProUpgradeScreen} />
            <Route path="/earnings"                 component={EarningsScreen} />

            {/* ── Staffer: roster + assign workers ──────────────────── */}
            <Route path="/roster"           component={RosterScreen}         />
            <Route path="/shift/:id/assign" component={AssignWorkersScreen}  />

            {/* ── Client post-shift wizard ──────────────────────────── */}
            <Route path="/post-shift/step1" component={PostShiftStep1Screen} />
            <Route path="/post-shift/step2" component={PostShiftStep2Screen} />
            <Route path="/post-shift/step3" component={PostShiftStep3Screen} />
            <Route path="/post-shift/step4" component={PostShiftStep4Screen} />
            <Route path="/post-shift/step5" component={PostShiftStep5Screen} />

            {/* ── Staffer post-shift wizard ─────────────────────────── */}
            <Route path="/staffer-shift/step1" component={StafferPostStep1Screen} />
            <Route path="/staffer-shift/step2" component={StafferPostStep2Screen} />
            <Route path="/staffer-shift/step3" component={StafferPostStep3Screen} />
            <Route path="/staffer-shift/step4" component={StafferPostStep4Screen} />
            <Route path="/staffer-shift/step5" component={StafferPostStep5Screen} />
            <Route path="/staffer-shift/step6" component={StafferPostStep6Screen} />
            <Route path="/staffer-shift/step7" component={StafferPostStep7Screen} />

            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </MobileContainer>
  );
}

// ── Admin router — full-width left-sidebar layout ────────────────────────────
function AdminRouter() {
  const [location] = useLocation();
  const showSidebar = location !== '/admin/login' && location !== '/admin';

  return (
    <div
      className="min-h-[100dvh] flex"
      style={{ fontFamily: "'Space Grotesk', sans-serif", background: '#0A1628' }}
    >
      {showSidebar && <AdminNav />}

      <main className="flex-1 bg-white overflow-auto min-h-[100dvh]">
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
      </main>
    </div>
  );
}

// ── Root splitter ─────────────────────────────────────────────────────────────
function AppRouter() {
  const [location] = useLocation();
  const isAdmin = location === '/admin' || location.startsWith('/admin/');
  return isAdmin ? <AdminRouter /> : <MobileRouter />;
}

// ── App root ──────────────────────────────────────────────────────────────────
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''} libraries={['places']}>
        <AuthProvider>
          <RoleProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <ErrorBoundary>
                  <AppRouter />
                </ErrorBoundary>
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </RoleProvider>
        </AuthProvider>
      </APIProvider>
    </QueryClientProvider>
  );
}

export default App;
