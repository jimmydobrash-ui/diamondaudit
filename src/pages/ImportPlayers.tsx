import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAddPlayersBatch, usePlayers } from "@/hooks/usePlayers";
import { parseRosterCsv, rosterDedupeKeys, type ParsedPlayer } from "@/lib/csvImport";
import { ArrowLeft, Upload, FileText, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function ImportPlayers() {
  const navigate = useNavigate();
  const batchAdd = useAddPlayersBatch();
  const { data: existingPlayers = [] } = usePlayers();
  const [parsed, setParsed] = useState<ParsedPlayer[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  // Dedupe against the existing roster so re-importing (or a partial retry)
  // doesn't double-create players already in the org.
  const existingKeys = useMemo(() => rosterDedupeKeys(existingPlayers), [existingPlayers]);

  // Re-parse whenever the file changes or the existing roster loads, so the
  // dedupe set is current even if the file was picked before players returned.
  const reparse = useCallback((text: string) => {
    const { players, errors } = parseRosterCsv(text, existingKeys);
    setParsed(players);
    setParseErrors(errors);
  }, [existingKeys]);

  // If the existing roster loads (or refreshes) after a file was picked,
  // re-run dedupe against the latest keys.
  useEffect(() => {
    if (fileText) reparse(fileText);
  }, [fileText, reparse]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setFileText(text);
      reparse(text);
    };
    reader.readAsText(file);
  }, [reparse]);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      await batchAdd.mutateAsync(parsed);
      toast.success(`${parsed.length} players imported!`);
      navigate("/players");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="container py-4 space-y-4 max-w-lg">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate("/players")} className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Import Players</h1>
        </motion.div>

        {/* Instructions */}
        <div className="bg-card rounded-xl p-4 card-elevated space-y-2">
          <h2 className="text-sm font-semibold text-foreground">CSV Format</h2>
          <p className="text-xs text-muted-foreground">
            Your CSV should have these columns (first_name and last_name are required):
          </p>
          <code className="block text-[11px] bg-secondary rounded-lg p-2 text-muted-foreground overflow-x-auto">
            first_name,last_name,date_of_birth,positions,bats,throws,height,weight,jersey_number,notes
          </code>
          <p className="text-xs text-muted-foreground">
            • Positions can be separated by / or ; (e.g., "SS/P")<br />
            • Date format: YYYY-MM-DD or MM/DD/YYYY<br />
            • Bats: L, R, or S · Throws: L or R
          </p>
        </div>

        {/* Upload */}
        <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-border bg-secondary/50 cursor-pointer hover:bg-secondary transition-colors">
          <Upload className="w-6 h-6 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">
            {fileName || "Choose CSV file"}
          </span>
          <input type="file" accept=".csv" onChange={handleFile} className="hidden" />
        </label>

        {/* Parse Results */}
        {parseErrors.length > 0 && (
          <div className="bg-destructive/10 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="w-4 h-4" />
              {parseErrors.length} issue{parseErrors.length > 1 ? "s" : ""}
            </div>
            {parseErrors.slice(0, 5).map((err, i) => (
              <p key={i} className="text-xs text-destructive/80">{err}</p>
            ))}
            {parseErrors.length > 5 && (
              <p className="text-xs text-destructive/80">...and {parseErrors.length - 5} more</p>
            )}
          </div>
        )}

        {parsed.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              {parsed.length} players ready to import
            </div>

            {/* Preview table */}
            <div className="bg-card rounded-xl overflow-hidden card-elevated">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary">
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">#</th>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">Name</th>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">DOB</th>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">Pos</th>
                      <th className="px-3 py-2 text-left text-muted-foreground font-medium">B/T</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 10).map((p, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-3 py-2 text-muted-foreground">{p.jersey_number ?? "-"}</td>
                        <td className="px-3 py-2 font-medium text-foreground">{p.first_name} {p.last_name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.date_of_birth}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.positions.join(", ")}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.bats}/{p.throws}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.length > 10 && (
                <div className="px-3 py-2 text-xs text-muted-foreground bg-secondary">
                  ...and {parsed.length - 10} more
                </div>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={importing}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {importing ? "Importing..." : (
                <><Check className="w-4 h-4" /> Import {parsed.length} Players</>
              )}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
