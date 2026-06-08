import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Route pages are lazy-loaded so each becomes its own chunk, keeping the
// initial bundle small. The auth wrappers below stay eager since they gate
// every route.
const Index = lazy(() => import("./pages/Index"));
const Players = lazy(() => import("./pages/Players"));
const AddPlayer = lazy(() => import("./pages/AddPlayer"));
const ImportPlayers = lazy(() => import("./pages/ImportPlayers"));
const EvaluateList = lazy(() => import("./pages/EvaluateList"));
const EvaluatePlayer = lazy(() => import("./pages/EvaluatePlayer"));
const Leaderboard = lazy(() => import("./pages/Leaderboard"));
const ManageTemplate = lazy(() => import("./pages/ManageTemplate"));
const TeamBuilder = lazy(() => import("./pages/TeamBuilder"));
const ScoringGuide = lazy(() => import("./pages/ScoringGuide"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthRecover = lazy(() => import("./pages/AuthRecover"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Surface data-loading failures instead of silently showing empty screens.
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Something went wrong loading data.");
    },
  }),
});

const PageFallback = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
  <Suspense fallback={<PageFallback />}>
    <Routes>
      <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
      <Route path="/auth/recover" element={<AuthRecover />} />
      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
      <Route path="/players/add" element={<ProtectedRoute><AddPlayer /></ProtectedRoute>} />
      <Route path="/players/import" element={<ProtectedRoute><ImportPlayers /></ProtectedRoute>} />
      <Route path="/evaluate" element={<ProtectedRoute><EvaluateList /></ProtectedRoute>} />
      <Route path="/evaluate/:playerId" element={<ProtectedRoute><EvaluatePlayer /></ProtectedRoute>} />
      <Route path="/team-builder" element={<ProtectedRoute><TeamBuilder /></ProtectedRoute>} />
      <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
      <Route path="/settings/template" element={<ProtectedRoute><ManageTemplate /></ProtectedRoute>} />
      <Route path="/scoring-guide" element={<ProtectedRoute><ScoringGuide /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
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
