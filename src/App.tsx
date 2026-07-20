import { QueryClient, QueryClientProvider, QueryCache } from "@tanstack/react-query";
import { toast } from "sonner";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

// Route pages are lazy-loaded so each becomes its own chunk, keeping the
// initial bundle small. The auth wrappers below stay eager since they gate
// every route.
//
// The five main bottom-nav tabs get their import() pulled into a named
// function so idle-time prefetching (see useIdlePrefetchMainTabs below) can
// call the exact same dynamic import as React.lazy — that just warms the
// chunk cache, it doesn't render or duplicate anything.
const importPlayers = () => import("./pages/Players");
const importEvaluateList = () => import("./pages/EvaluateList");
const importEvaluatePlayer = () => import("./pages/EvaluatePlayer");
const importTeamBuilder = () => import("./pages/TeamBuilder");
const importLeaderboard = () => import("./pages/Leaderboard");

const Index = lazy(() => import("./pages/Index"));
const Players = lazy(importPlayers);
const AddPlayer = lazy(() => import("./pages/AddPlayer"));
const EditPlayer = lazy(() => import("./pages/EditPlayer"));
const ImportPlayers = lazy(() => import("./pages/ImportPlayers"));
const EvaluateList = lazy(importEvaluateList);
const EvaluatePlayer = lazy(importEvaluatePlayer);
const Leaderboard = lazy(importLeaderboard);
const ManageTemplate = lazy(() => import("./pages/ManageTemplate"));
const TeamBuilder = lazy(importTeamBuilder);
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const PlayerReport = lazy(() => import("./pages/PlayerReport"));
const ReportCards = lazy(() => import("./pages/ReportCards"));
const ScoringGuide = lazy(() => import("./pages/ScoringGuide"));
const Auth = lazy(() => import("./pages/Auth"));
const AuthRecover = lazy(() => import("./pages/AuthRecover"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Surface data-loading failures instead of silently showing empty screens.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // v5 defaults staleTime to 0, so every remount (tapping back to a tab)
      // and every refetchOnWindowFocus (default: on — e.g. a coach glancing at
      // another app on an iPad, then back) refires every query — players,
      // evaluations, grades, template — even when nothing changed. On a
      // ~186-player org that's a burst of refetches on each nav, which reads
      // as loading flicker/jank mid-tryout. A short stale window lets cached
      // data serve instantly for routine navigation, while refetchOnWindowFocus
      // (left at its default) still refreshes anything genuinely stale.
      // Mutations already call invalidateQueries on success (see
      // src/hooks/usePlayers.ts, useEvaluations.ts, usePlayerGrades.ts,
      // useEvaluationTemplate.ts), so a save is reflected immediately
      // regardless of this window.
      staleTime: 60_000,
    },
  },
  queryCache: new QueryCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Something went wrong loading data.");
    },
  }),
});

// Idle-time chunk prefetch: the bottom-nav tabs (Players, Evaluate,
// Team Builder, Leaderboard, and the per-player evaluate screen) are
// React.lazy, so the first tap on each one waits on a network fetch for its
// JS chunk — noticeable on field wifi. Once a user is signed in, warm the
// chunk cache for those tabs during idle time so subsequent navigation is
// instant. Safari (the default browser on iPad, the primary device here) has
// no requestIdleCallback, so this leans on the setTimeout fallback there.
function prefetchMainTabChunks() {
  importPlayers();
  importEvaluateList();
  importEvaluatePlayer();
  importTeamBuilder();
  importLeaderboard();
}

function useIdlePrefetchMainTabs(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    const run = () => {
      if (!cancelled) prefetchMainTabChunks();
    };

    if (typeof window.requestIdleCallback === "function") {
      idleHandle = window.requestIdleCallback(run, { timeout: 5000 });
    } else {
      // setTimeout fallback (Safari/iPad): give the current route's own data
      // fetches a head start before spending bandwidth on prefetching.
      timeoutHandle = window.setTimeout(run, 2000);
    }

    return () => {
      cancelled = true;
      if (idleHandle !== undefined) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
    };
  }, [enabled]);
}

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

const AppRoutes = () => {
  // Only worth warming the tab chunks once someone is actually signed in —
  // an anonymous visitor sitting on /auth has no use for the app shell yet.
  const { user } = useAuth();
  useIdlePrefetchMainTabs(!!user);

  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
        <Route path="/auth/recover" element={<AuthRecover />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
        <Route path="/players/add" element={<ProtectedRoute><AddPlayer /></ProtectedRoute>} />
        <Route path="/players/import" element={<ProtectedRoute><ImportPlayers /></ProtectedRoute>} />
        <Route path="/players/report-cards" element={<ProtectedRoute><ReportCards /></ProtectedRoute>} />
        <Route path="/players/:playerId" element={<ProtectedRoute><PlayerDetail /></ProtectedRoute>} />
        <Route path="/players/:playerId/report" element={<ProtectedRoute><PlayerReport /></ProtectedRoute>} />
        <Route path="/players/:playerId/edit" element={<ProtectedRoute><EditPlayer /></ProtectedRoute>} />
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
};

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
