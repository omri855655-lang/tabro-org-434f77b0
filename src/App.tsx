import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import PinGate, { usePinGate, PinSetup } from "@/components/PinGate";

import TabroAiAgent from "@/components/TabroAiAgent";
import Landing from "./pages/Landing";
import Personal from "./pages/Personal";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import InstallApp from "./pages/InstallApp";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/AdminDashboard";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { verified, verify, pinEnabled, hasPin, loading: pinLoading } = usePinGate();

  if (authLoading || pinLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">טוען...</div>
      </div>
    );
  }

  if (!user) {
    return <>{children}</>;
  }

  if (pinEnabled && !hasPin) {
    return <PinSetup onSuccess={verify} />;
  }

  if (pinEnabled && !verified) {
    return <PinGate onSuccess={verify} />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/personal"
          element={
            <ProtectedRoute>
              <Personal />
            </ProtectedRoute>
          }
        />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/creator-admin" element={<AdminDashboard />} />
        <Route path="/install/*" element={<InstallApp />} />
        <Route path="/Install/*" element={<InstallApp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <IosMusicBanner />
          <TabroAiAgent />
          <AppContent />
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
