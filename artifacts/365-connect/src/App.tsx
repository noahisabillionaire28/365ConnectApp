import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

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

const queryClient = new QueryClient();

function Router() {
  return (
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
      <Route path="/home" component={HomeScreen} />
      <Route path="/jobs" component={JobsScreen} />
      <Route path="/messages" component={MessagesScreen} />
      <Route path="/notifications" component={NotificationsScreen} />
      <Route path="/profile" component={ProfileScreen} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <MobileContainer>
              <Router />
            </MobileContainer>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
