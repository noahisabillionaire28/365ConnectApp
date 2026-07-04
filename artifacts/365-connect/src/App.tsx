import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';

import { AuthProvider } from '@/contexts/AuthContext';
import { MobileContainer } from '@/components/MobileContainer';
import { SplashScreen } from '@/pages/SplashScreen';
import { HomeScreen } from '@/pages/HomeScreen';
import { JobsScreen } from '@/pages/JobsScreen';
import { MessagesScreen } from '@/pages/MessagesScreen';
import { NotificationsScreen } from '@/pages/NotificationsScreen';
import { ProfileScreen } from '@/pages/ProfileScreen';
import { SignUpScreen } from '@/pages/SignUpScreen';
import { RoleSelectScreen } from '@/pages/RoleSelectScreen';
import { OnboardingScreen } from '@/pages/OnboardingScreen';
import { LoginScreen } from '@/pages/LoginScreen';
import { ProfileSetupScreen } from '@/pages/ProfileSetupScreen';
import { WorkerProfileScreen } from '@/pages/WorkerProfileScreen';
import { ResetPasswordScreen } from '@/pages/ResetPasswordScreen';
import { ShiftDetailScreen } from '@/pages/ShiftDetailScreen';
import { PostShiftStep1Screen } from '@/pages/PostShiftStep1Screen';
import { PostShiftStep2Screen } from '@/pages/PostShiftStep2Screen';
import { PostShiftStep3Screen } from '@/pages/PostShiftStep3Screen';
import { ClockInScreen } from '@/pages/ClockInScreen';
import { AdminLogin } from '@/pages/admin/AdminLogin';
import { AdminDashboard } from '@/pages/admin/AdminDashboard';
import { AdminUsers } from '@/pages/admin/AdminUsers';
import { AdminShifts } from '@/pages/admin/AdminShifts';
import { AdminDisputes } from '@/pages/admin/AdminDisputes';

const queryClient = new QueryClient();

/** Worker-facing mobile app routes (wrapped in 390px MobileContainer) */
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
            <Route path="/" component={SplashScreen} />
            <Route path="/signup" component={SignUpScreen} />
            <Route path="/role-select" component={RoleSelectScreen} />
            <Route path="/onboarding" component={OnboardingScreen} />
            <Route path="/login" component={LoginScreen} />
            <Route path="/profile-setup" component={ProfileSetupScreen} />
            <Route path="/worker/:username" component={WorkerProfileScreen} />
            <Route path="/reset-password" component={ResetPasswordScreen} />
            <Route path="/shift/:id" component={ShiftDetailScreen} />
            <Route path="/post-shift/step1" component={PostShiftStep1Screen} />
            <Route path="/post-shift/step2" component={PostShiftStep2Screen} />
            <Route path="/post-shift/step3" component={PostShiftStep3Screen} />
            <Route path="/clock/:id" component={ClockInScreen} />
            <Route path="/home" component={HomeScreen} />
            <Route path="/jobs" component={JobsScreen} />
            <Route path="/messages" component={MessagesScreen} />
            <Route path="/notifications" component={NotificationsScreen} />
            <Route path="/profile" component={ProfileScreen} />
            <Route component={NotFound} />
          </Switch>
        </motion.div>
      </AnimatePresence>
    </MobileContainer>
  );
}

/** Admin panel routes (full-width, bypasses MobileContainer) */
function AdminRouter() {
  return (
    <div className="min-h-[100dvh] bg-black" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <Switch>
        <Route path="/admin/login"    component={AdminLogin}     />
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users"    component={AdminUsers}     />
        <Route path="/admin/shifts"   component={AdminShifts}    />
        <Route path="/admin/disputes" component={AdminDisputes}  />
        {/* /admin → redirect to login */}
        <Route path="/admin">
          {() => { window.location.replace(window.location.pathname.replace(/\/admin\/?$/, '/admin/login')); return null; }}
        </Route>
      </Switch>
    </div>
  );
}

/** Top-level router — splits admin vs. mobile paths */
function AppRouter() {
  const [location] = useLocation();
  const isAdmin = location === '/admin' || location.startsWith('/admin/');
  return isAdmin ? <AdminRouter /> : <MobileRouter />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
