import { useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import ReportCardDocument from "@/components/ReportCardDocument";
import { useAuth } from "@/hooks/useAuth";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { playerAgeGroup, sortAgeGroups } from "@/lib/mock-data";
import { compareForTryout } from "@/lib/rosterOrder";
import { buildReportCardBundle } from "@/lib/reportCard";
import { generateReportCardsZip, downloadBlob } from "@/lib/reportCardsZip";
import { ArrowLeft, Download, FileText } from "lucide-react";

type Scores = Record<string, number>;

export default function ReportCards() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role } = useAuth();
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: evaluations = [], isLoading: evalsLoading } = useEvaluations();
  const { data: template } = useEvaluationTemplate();

  const containerRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const categories = useMemo(() => template?.categories ?? [], [template]);
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const evalCounts = useMemo(() => {
    const m: Record<string, number> = {};
    evaluations.forEach(e => { m[e.player_id] = (m[e.player_id] ?? 0) + 1; });
    return m;
  }, [evaluations]);

  // Age groups that actually have an evaluated athlete.
  const ageGroups = useMemo(() => {
    const set = new Set(players.filter(p => (evalCounts[p.id] ?? 0) > 0).map(p => playerAgeGroup(p)));
    return sortAgeGroups([...set]);
  }, [players, evalCounts]);

  // "all" matches the sentinel Leaderboard already uses for its age filter.
  const paramAge = searchParams.get("age");
  const [group, setGroup] = useState<string>(() => (paramAge && paramAge !== "all" ? paramAge : "all"));
  const activeGroup = group === "all" || ageGroups.includes(group) ? group : "all";
  const isAllGroups = activeGroup === "all";

  // Evaluated athletes in scope, in tryout (age group, then jersey) order.
  // compareForTryout already sorts by age group first, so an "all" export
  // naturally comes out grouped rather than shuffled.
  const groupPlayers = useMemo(
    () => players
      .filter(p => (evalCounts[p.id] ?? 0) > 0 && (isAllGroups || playerAgeGroup(p) === activeGroup))
      .sort(compareForTryout),
    [players, activeGroup, isAllGroups, evalCounts],
  );

  // folderPerGroup nests each file under a per-age-group folder only when
  // spanning multiple groups — jersey numbers reset per group, so a flat
  // "all" zip could otherwise let a 10U and 11U player with the same #
  // overwrite each other. Each player's percentile still compares against
  // their OWN age group's peers (buildReportCardBundle scopes peer values off
  // `players`, the full roster, regardless of what's in `scopedPlayers`).
  // includeNotes stays unset (false) — this export is family-facing ("ready
  // to send to families" below), so coach notes never appear here.
  const cards = useMemo(
    () => buildReportCardBundle({
      scopedPlayers: groupPlayers,
      allPlayers: players,
      evaluations: evaluations.map(e => ({ player_id: e.player_id, coach_id: e.coach_id, scores: e.scores as Scores, notes: e.notes })),
      categories,
      folderPerGroup: isAllGroups,
    }),
    [groupPlayers, players, evaluations, categories, isAllGroups],
  );

  const isLoading = playersLoading || evalsLoading;
  // ~1.1s/card measured in testing (rasterize + PDF page); rough estimate so
  // the "keep this screen open" ask doesn't feel like a black box on a big
  // multi-group export.
  const estSeconds = Math.ceil(cards.length * 1.1);
  const estLabel = estSeconds < 60 ? `~${estSeconds}s` : `~${Math.ceil(estSeconds / 60)} min`;

  const handleDownload = async () => {
    const container = containerRef.current;
    if (!container || cards.length === 0) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-filename]"));
    const items = nodes.map(n => ({ filename: n.dataset.filename ?? "report.pdf", node: n }));
    setBusy(true);
    setProgress({ done: 0, total: items.length });
    try {
      const blob = await generateReportCardsZip(items, (done, total) => setProgress({ done, total }));
      downloadBlob(blob, isAllGroups ? "diamondaudit-all-report-cards.zip" : `diamondaudit-${activeGroup}-report-cards.zip`);
      toast.success(`Downloaded ${items.length} report ${items.length === 1 ? "card" : "cards"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate report cards");
    } finally {
      setBusy(false);
    }
  };

  if (role !== "admin") {
    return (
      <AppLayout>
        <div className="container py-12 text-center text-muted-foreground text-sm">
          Report card export is available to organization admins.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-5 max-w-xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate("/players")} aria-label="Back to players" className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Report cards</h1>
            <p className="text-sm text-muted-foreground mt-0.5">One PDF per athlete, ready to send to families.</p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="h-40 rounded-2xl bg-secondary animate-pulse" />
        ) : ageGroups.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 card-elevated text-center text-sm text-muted-foreground">
            No evaluated athletes yet — score some players first.
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-5 card-elevated space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">Age group</label>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setGroup("all")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    isAllGroups ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  All ages
                </button>
                {ageGroups.map(ag => (
                  <button
                    key={ag}
                    onClick={() => setGroup(ag)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                      ag === activeGroup ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-foreground">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span>
                <strong className="tabular-nums">{cards.length}</strong> {cards.length === 1 ? "athlete" : "athletes"}{" "}
                {isAllGroups ? `across ${ageGroups.length} age groups` : `in ${activeGroup}`} with evaluations
              </span>
            </div>

            <button
              onClick={handleDownload}
              disabled={busy || cards.length === 0}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              {busy
                ? `Generating ${progress.done} / ${progress.total}…`
                : `Download ${cards.length} report ${cards.length === 1 ? "card" : "cards"} (.zip)`}
            </button>

            {busy && (
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-[width] duration-200"
                  style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
            )}

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Each athlete gets their own PDF (named by jersey + name{isAllGroups ? ", nested in an age-group folder" : ""}),
              bundled in one zip. Each report shows only that athlete's results — safe to forward to their family.
              {cards.length > 20 && ` Estimated time: ${estLabel} — keep this screen open.`}
            </p>
          </div>
        )}
      </div>

      {/* Off-screen render surface: real report cards at a fixed width, laid out
          so html2canvas can rasterize each into its own PDF. Not display:none —
          that would strip the layout the capture needs. */}
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{ position: "fixed", left: "-100000px", top: 0, width: 640, pointerEvents: "none" }}
      >
        {cards.map(c => (
          <div key={c.player.id} data-filename={c.filename} style={{ width: 640, background: "#ffffff", padding: 28 }}>
            <ReportCardDocument player={c.player} report={c.report} evalCount={c.evalCount} today={today} />
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
