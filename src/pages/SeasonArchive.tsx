import { useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppLayout from "@/components/AppLayout";
import ReportCardDocument from "@/components/ReportCardDocument";
import { useAuth } from "@/hooks/useAuth";
import { usePlayers } from "@/hooks/usePlayers";
import { useEvaluations } from "@/hooks/useEvaluations";
import { useEvaluationTemplate } from "@/hooks/useEvaluationTemplate";
import { usePlayerGrades } from "@/hooks/usePlayerGrades";
import { useOrgMembers } from "@/hooks/useOrgMembers";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { compareForTryout } from "@/lib/rosterOrder";
import { buildReportCardBundle } from "@/lib/reportCard";
import { generateReportCardsZip, downloadBlob } from "@/lib/reportCardsZip";
import { buildSeasonBenchmarks, buildSeasonBenchmarksZip } from "@/lib/seasonBenchmarks";
import { buildSeasonRawExportZip } from "@/lib/seasonRawExport";
import { ArrowLeft, Download, FileText, Database, BarChart3, AlertTriangle, Check, Lock, ShieldAlert } from "lucide-react";

type Scores = Record<string, number>;
type ArtifactKey = "benchmarks" | "reportCards" | "rawExport";
type ArtifactStatus = "pending" | "stale" | "done";

function ArchiveStepCard({
  icon,
  title,
  description,
  staleNote,
  status,
  onDownload,
  busy,
  disabled,
  progress,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  staleNote?: string;
  status: ArtifactStatus;
  onDownload: () => void;
  busy: boolean;
  disabled: boolean;
  progress?: { done: number; total: number };
}) {
  return (
    <div className="bg-card rounded-xl p-4 card-elevated space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 text-muted-foreground">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            {status === "done" && <Check className="w-3.5 h-3.5 text-success flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          {status === "stale" && staleNote && <p className="text-[11px] text-warning mt-1">{staleNote}</p>}
        </div>
      </div>
      <button
        onClick={onDownload}
        disabled={disabled}
        className={`w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors ${
          status === "done" ? "bg-secondary text-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        <Download className="w-4 h-4" />
        {busy
          ? progress
            ? `Generating ${progress.done} / ${progress.total}…`
            : "Generating…"
          : status === "done"
            ? "Downloaded — re-download"
            : "Download"}
      </button>
    </div>
  );
}

/**
 * Capture a complete record of the org's tryout data three ways, then unlock
 * the reset that clears it for next season. Reset is hard-gated (not just
 * copy/ordering) on all three artifacts having been freshly downloaded in
 * this session — tracked by a row-count fingerprint per artifact, so new data
 * arriving after a download flips that artifact back to "stale, re-download"
 * rather than trusting an outdated file. Replaces ManageTemplate.tsx's old,
 * disconnected "Reset Tryout Data" button.
 */
export default function SeasonArchive() {
  const navigate = useNavigate();
  const { role, organizationId } = useAuth();
  const { data: players = [], isLoading: playersLoading } = usePlayers();
  const { data: evaluations = [], isLoading: evalsLoading } = useEvaluations();
  const { data: grades = [], isLoading: gradesLoading } = usePlayerGrades();
  const { data: template } = useEvaluationTemplate();
  const { data: members = {} } = useOrgMembers();
  const { data: org } = useOrganization();

  const categories = useMemo(() => template?.categories ?? [], [template]);
  const memberNameById = useMemo(
    () => Object.fromEntries(Object.entries(members).map(([id, m]) => [id, m.name])),
    [members],
  );
  // Neutral fallback, never a real org name: this string appears in the reset
  // confirmation, so defaulting it to "DiamondAudit" could make the confirm
  // claim you're resetting a different org than the one actually loaded while
  // the org query is still resolving.
  const orgName = org?.name ?? "your organization";
  const orgSlug = org?.slug ?? "org";
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const isLoading = playersLoading || evalsLoading || gradesLoading;
  // A cheap, good-enough "has anything changed" signal — not a hash, just
  // enough to catch "someone entered more data after I downloaded."
  const currentFingerprint = players.length + evaluations.length + grades.length;

  const [downloaded, setDownloaded] = useState<Record<ArtifactKey, number | null>>({
    benchmarks: null,
    reportCards: null,
    rawExport: null,
  });
  const [busyArtifact, setBusyArtifact] = useState<ArtifactKey | null>(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const statusFor = (key: ArtifactKey): ArtifactStatus => {
    const at = downloaded[key];
    if (at === null) return "pending";
    return at === currentFingerprint ? "done" : "stale";
  };
  const allFresh = (["benchmarks", "reportCards", "rawExport"] as ArtifactKey[]).every(
    key => statusFor(key) === "done",
  );

  const evaluatedPlayers = useMemo(
    () => players.filter(p => evaluations.some(e => e.player_id === p.id)).sort(compareForTryout),
    [players, evaluations],
  );

  const bundleEvaluations = useMemo(
    () => evaluations.map(e => ({ player_id: e.player_id, coach_id: e.coach_id, scores: e.scores as Scores, notes: e.notes })),
    [evaluations],
  );

  // Always spans every age group (no filter UI here, unlike ReportCards.tsx),
  // and always includes notes — this is the internal archival record, never
  // sent to families.
  const reportCards = useMemo(
    () =>
      buildReportCardBundle({
        scopedPlayers: evaluatedPlayers,
        allPlayers: players,
        evaluations: bundleEvaluations,
        categories,
        folderPerGroup: true,
        includeNotes: true,
        memberNameById,
      }),
    [evaluatedPlayers, players, bundleEvaluations, categories, memberNameById],
  );

  const handleDownloadBenchmarks = async () => {
    const benchmarks = buildSeasonBenchmarks(
      players.map(p => ({ id: p.id, date_of_birth: p.date_of_birth, tags: p.tags })),
      evaluations.map(e => ({ player_id: e.player_id, scores: e.scores as Scores })),
      grades.map(g => ({ player_id: g.player_id, grade: g.grade })),
      categories,
      orgName,
    );
    setBusyArtifact("benchmarks");
    try {
      // Markdown + JSON bundled into one zip — see buildSeasonBenchmarksZip for
      // why (two separate downloads from one click get the second silently
      // blocked by the browser).
      const blob = await buildSeasonBenchmarksZip(benchmarks);
      downloadBlob(blob, `diamondaudit-${orgSlug}-season-benchmarks.zip`);
      setDownloaded(prev => ({ ...prev, benchmarks: currentFingerprint }));
      toast.success("Benchmarks downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate benchmarks");
    } finally {
      setBusyArtifact(null);
    }
  };

  const handleDownloadReportCards = async () => {
    const container = containerRef.current;
    if (!container || reportCards.length === 0) return;
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("[data-filename]"));
    const items = nodes.map(n => ({ filename: n.dataset.filename ?? "report.pdf", node: n }));
    setBusyArtifact("reportCards");
    setProgress({ done: 0, total: items.length });
    try {
      const blob = await generateReportCardsZip(items, (done, total) => setProgress({ done, total }));
      downloadBlob(blob, `diamondaudit-${orgSlug}-season-report-cards.zip`);
      setDownloaded(prev => ({ ...prev, reportCards: currentFingerprint }));
      toast.success(`Downloaded ${items.length} report ${items.length === 1 ? "card" : "cards"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate report cards");
    } finally {
      setBusyArtifact(null);
    }
  };

  const handleDownloadRawExport = async () => {
    setBusyArtifact("rawExport");
    try {
      const blob = await buildSeasonRawExportZip({
        orgName,
        players,
        evaluations,
        grades,
        categories,
        coachNameById: memberNameById,
      });
      downloadBlob(blob, `diamondaudit-${orgSlug}-season-raw-export.zip`);
      setDownloaded(prev => ({ ...prev, rawExport: currentFingerprint }));
      toast.success("Raw export downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't generate raw export");
    } finally {
      setBusyArtifact(null);
    }
  };

  // Relocated from ManageTemplate.tsx's old handleResetData, with a real bug
  // fixed along the way: the original three deletes never checked {error} —
  // the Supabase client doesn't throw on a DB/RLS-level failure, it returns
  // {error} — so a partial failure could silently "succeed" (toast + reload)
  // while actually leaving data behind. Each step is now checked and aborts
  // with a specific "which step failed" message.
  const handleReset = async () => {
    if (!organizationId) return;
    setResetting(true);
    try {
      const { error: gradesErr } = await supabase.from("player_grades").delete().eq("organization_id", organizationId);
      if (gradesErr) throw new Error(`Couldn't delete grades: ${gradesErr.message}`);
      const { error: evalsErr } = await supabase.from("evaluations").delete().eq("organization_id", organizationId);
      if (evalsErr) throw new Error(`Couldn't delete evaluations: ${evalsErr.message}`);
      const { error: playersErr } = await supabase.from("players").delete().eq("organization_id", organizationId);
      if (playersErr) throw new Error(`Couldn't delete players: ${playersErr.message}`);
      toast.success("Season reset — all tryout data cleared.");
      // Hard navigation: clears every cached players/evaluations/grades query
      // so nothing stale lingers elsewhere in the app.
      window.location.href = "/settings/template";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
    }
  };

  if (role !== "admin") {
    return (
      <AppLayout>
        <div className="container py-12 text-center text-muted-foreground text-sm">
          Season archive is available to organization admins.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-4 max-w-xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate("/settings/template")} aria-label="Back to settings" className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Season Archive &amp; Reset</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Capture this season's data, then clear the roster for next season.</p>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="h-40 rounded-2xl bg-secondary animate-pulse" />
        ) : players.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 card-elevated text-center text-sm text-muted-foreground">
            No roster data yet — nothing to archive.
          </div>
        ) : (
          <>
            <ArchiveStepCard
              icon={<BarChart3 className="w-4 h-4" />}
              title="1. Anonymized benchmarks"
              description="Age-group averages for every measurable + category — no names, no player-level data. Safe to keep, safe to publish."
              staleNote="Roster changed since this was downloaded — re-download to stay current."
              status={statusFor("benchmarks")}
              onDownload={handleDownloadBenchmarks}
              busy={busyArtifact === "benchmarks"}
              disabled={busyArtifact !== null}
            />
            <ArchiveStepCard
              icon={<FileText className="w-4 h-4" />}
              title="2. Report-card archive"
              description={`${reportCards.length} evaluated ${reportCards.length === 1 ? "athlete" : "athletes"}, coach notes included — this is the internal record, not for families.`}
              staleNote="Roster changed since this was downloaded — re-download to stay current."
              status={statusFor("reportCards")}
              onDownload={handleDownloadReportCards}
              busy={busyArtifact === "reportCards"}
              progress={busyArtifact === "reportCards" ? progress : undefined}
              disabled={busyArtifact !== null || reportCards.length === 0}
            />
            <ArchiveStepCard
              icon={<Database className="w-4 h-4" />}
              title="3. Raw data export"
              description="Every player, every coach's raw per-skill scores + notes, every individual grade — a reference/audit archive, not a one-click restore."
              staleNote="Roster changed since this was downloaded — re-download to stay current."
              status={statusFor("rawExport")}
              onDownload={handleDownloadRawExport}
              busy={busyArtifact === "rawExport"}
              disabled={busyArtifact !== null}
            />

            {/* Steps 2 and 3 put minors' names, dates of birth and coach notes
                on the admin's own device. Our privacy policy commits to not
                retaining players' data past the season, so say plainly what
                that means for the files they just downloaded — a promise on a
                page nobody reads isn't worth much on its own. */}
            <div className="bg-secondary/50 rounded-xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">The report card and raw export contain players' personal information.</p>
                <p>
                  Names, dates of birth, and coach notes — including minors'. Once you've checked the
                  archive is complete, delete those two files from your device. Only the anonymized
                  benchmarks are meant to be kept.
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Reset season
              </h2>
              <div className="bg-card rounded-xl p-4 card-elevated border border-destructive/20">
                {!allFresh ? (
                  <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Lock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>Download all three archives above (fresh, matching the current roster) to unlock reset.</span>
                  </div>
                ) : !resetConfirm ? (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Reset <span className="text-destructive">{orgName}</span></p>
                      <p className="text-xs text-muted-foreground">Deletes all players, evaluations, and grades in this organization. Template and org settings are kept.</p>
                    </div>
                    <button
                      onClick={() => setResetConfirm(true)}
                      className="h-9 px-4 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors flex-shrink-0"
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Lead with the org name, not just counts — the counts are
                        the only tell today that you're on the org you think you
                        are, and a wrong-account login can put you on the wrong
                        org entirely (that exact mix-up happened during testing). */}
                    <p className="text-sm text-foreground">
                      This permanently resets <strong>{orgName}</strong> — deleting{" "}
                      <strong className="tabular-nums">{players.length}</strong> players,{" "}
                      <strong className="tabular-nums">{evaluations.length}</strong> evaluations, and{" "}
                      <strong className="tabular-nums">{grades.length}</strong> grades. This can't be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setResetConfirm(false)}
                        className="flex-1 h-10 rounded-lg bg-secondary text-foreground text-sm font-medium"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReset}
                        disabled={resetting}
                        className="flex-1 h-10 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
                      >
                        {resetting ? "Resetting…" : "Confirm delete all"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Off-screen render surface for the report-card PDFs — same pattern as
          ReportCards.tsx. Not display:none, which would strip the layout the
          html2canvas capture needs. */}
      <div
        ref={containerRef}
        aria-hidden="true"
        style={{ position: "fixed", left: "-100000px", top: 0, width: 640, pointerEvents: "none" }}
      >
        {reportCards.map(c => (
          <div key={c.player.id} data-filename={c.filename} style={{ width: 640, background: "#ffffff", padding: 28 }}>
            <ReportCardDocument player={c.player} report={c.report} evalCount={c.evalCount} today={today} />
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
