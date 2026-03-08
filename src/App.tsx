import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { fetchAndApplyTheme } from './utils/theme';
import { HomeScreen } from './components/home/HomeScreen';
import { LessonView } from './components/lesson/LessonView';
import { LoginScreen } from './components/auth/LoginScreen';
import { RegisterScreen } from './components/auth/RegisterScreen';
import { ForgotPasswordScreen } from './components/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from './components/auth/ResetPasswordScreen';
import { VerifyEmailScreen } from './components/auth/VerifyEmailScreen';
import { AdminGuard } from './components/admin/AdminGuard';
import { AdminLoginScreen } from './components/admin/AdminLoginScreen';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminStudentList } from './components/admin/AdminStudentList';
import { AdminLevelList } from './components/admin/AdminLevelList';
import { AdminLessonList } from './components/admin/AdminLessonList';
import { AdminLessonEditor } from './components/admin/AdminLessonEditor';
import { AdminStudentDetail } from './components/admin/AdminStudentDetail';
import { AdminLessonPreview } from './components/admin/AdminLessonPreview';
import { AdminThemeEditor } from './components/admin/AdminThemeEditor';
import { AdminPaletteManager } from './components/admin/AdminPaletteManager';
import { AdminContentValidator } from './components/admin/AdminContentValidator';
import { AdminAnalytics } from './components/admin/AdminAnalytics';
import { AdminEmailManager } from './components/admin/AdminEmailManager';
import { AdminOnboardingStats } from './components/admin/AdminOnboardingStats';
import { AdminNotifications } from './components/admin/AdminNotifications';
import { AdminTriage } from './components/admin/AdminTriage';
import { AIOnboarding } from './components/onboarding/AIOnboarding';
import { DashboardGuard } from './components/dashboard/DashboardGuard';
import { DashboardLayout } from './components/dashboard/DashboardLayout';
import { DashboardOverview } from './components/dashboard/DashboardOverview';
import { DashboardProfile } from './components/dashboard/DashboardProfile';
import { DashboardSettings } from './components/dashboard/DashboardSettings';
import { DashboardStats } from './components/dashboard/DashboardStats';
import { DashboardAchievements } from './components/dashboard/DashboardAchievements';
import { DashboardPlan } from './components/dashboard/DashboardPlan';
import { AchievementProvider } from './contexts/AchievementContext';
import { ImpersonationBanner } from './components/layout/ImpersonationBanner';

function App() {
  useEffect(() => {
    fetchAndApplyTheme();
  }, []);

  return (
    <AchievementProvider>
    <ImpersonationBanner />
    <div className="h-full bg-bg-primary">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/lesson/:lessonId" element={<LessonView />} />
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/register" element={<RegisterScreen />} />
        <Route path="/forgot-password" element={<ForgotPasswordScreen />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/verify-email" element={<VerifyEmailScreen />} />
        <Route path="/dashboard" element={<DashboardGuard />}>
          <Route element={<DashboardLayout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="stats" element={<DashboardStats />} />
            <Route path="achievements" element={<DashboardAchievements />} />
            <Route path="profile" element={<DashboardProfile />} />
            <Route path="settings" element={<DashboardSettings />} />
            <Route path="plan" element={<DashboardPlan />} />
          </Route>
        </Route>
        <Route path="/onboarding/ai" element={<DashboardGuard />}>
          <Route index element={<AIOnboarding />} />
        </Route>
        <Route path="/admin/login" element={<AdminLoginScreen />} />
        <Route path="/admin" element={<AdminGuard />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="students" element={<AdminStudentList />} />
            <Route path="students/:id" element={<AdminStudentDetail />} />
            <Route path="levels" element={<AdminLevelList />} />
            <Route path="lessons" element={<AdminLessonList />} />
            <Route path="lessons/:id" element={<AdminLessonEditor />} />
            <Route path="lessons/:id/preview" element={<AdminLessonPreview />} />
            <Route path="palettes" element={<AdminPaletteManager />} />
            <Route path="email" element={<AdminEmailManager />} />
            <Route path="theme" element={<AdminThemeEditor />} />
            <Route path="validate" element={<AdminContentValidator />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="onboarding" element={<AdminOnboardingStats />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="triage" element={<AdminTriage />} />
          </Route>
        </Route>
      </Routes>
    </div>
    </AchievementProvider>
  );
}

export default App;
