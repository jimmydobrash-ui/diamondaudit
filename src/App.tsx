import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Players from "./pages/Players";
import AddPlayer from "./pages/AddPlayer";
import ImportPlayers from "./pages/ImportPlayers";
import EvaluateList from "./pages/EvaluateList";
import EvaluatePlayer from "./pages/EvaluatePlayer";
import Leaderboard from "./pages/Leaderboard";
import ManageTemplate from "./pages/ManageTemplate";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
    <Route path="/players/add" element={<ProtectedRoute><AddPlayer /></ProtectedRoute>} />
    <Route path="/players/import" element={<ProtectedRoute><ImportPlayers /></ProtectedRoute>} />
    <Route path="/evaluate" element={<ProtectedRoute><EvaluateList /></ProtectedRoute>} />
    <Route path="/evaluate/:playerId" element={<ProtectedRoute><EvaluatePlayer /></ProtectedRoute>} />
    <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
