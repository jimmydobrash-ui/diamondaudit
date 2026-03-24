import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useAddPlayersBatch } from "@/hooks/usePlayers";
import { ArrowLeft, Upload, FileText, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ParsedPlayer {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  positions: string[];
  bats: string;
  throws: string;
  height: string | null;
  weight: number | null;
  jersey_number: number | null;
  notes: string;
}

function parseCSV(text: string): { players: ParsedPlayer[]; errors: string[] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { players: [], errors: ["CSV must have a header row and at least one data row"] };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ""));
  const players: ParsedPlayer[] = [];
  const errors: string[] = [];

  // Map common header variations
  const colMap: Record<string, string> = {};
  header.forEach((h, i) => {
    if (["firstname", "first_name", "first"].includes(h)) colMap["first_name"] = String(i);
    if (["lastname", "last_name", "last"].includes(h)) colMap["last_name"] = String(i);
    if (["dob", "dateofbirth", "date_of_birth", "birthdate", "birthday"].includes(h)) colMap["date_of_birth"] = String(i);
    if (["position", "positions", "pos"].includes(h)) colMap["positions"] = String(i);
    if (["bats", "bat"].includes(h)) colMap["bats"] = String(i);
    if (["throws", "throw"].includes(h)) colMap["throws"] = String(i);
    if (["height", "ht"].includes(h)) colMap["height"] = String(i);
    if (["weight", "wt"].includes(h)) colMap["weight"] = String(i);
    if (["jersey", "jerseynumber", "jersey_number", "number", "num", "no"].includes(h)) colMap["jersey_number"] = String(i);
    if (["notes", "note", "comments"].includes(h)) colMap["notes"] = String(i);
  });

  if (!colMap.first_name || !colMap.last_name) {
    return { players: [], errors: ["CSV must have 'first_name' and 'last_name' columns"] };
  }

  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    const get = (key: string) => colMap[key] ? vals[Number(colMap[key])] || "" : "";

    const firstName = get("first_name");
    const lastName = get("last_name");
    if (!firstName || !lastName) {
      errors.push(`Row ${i + 1}: Missing name`);
      continue;
    }

    const dob = get("date_of_birth");
    if (!dob) {
      errors.push(`Row ${i + 1}: Missing date of birth for ${firstName} ${lastName}`);
      continue;
    }

    // Validate date format
    const dateTest = new Date(dob);
    if (isNaN(dateTest.getTime())) {
      errors.push(`Row ${i + 1}: Invalid date "${dob}" for ${firstName} ${lastName}`);
      continue;
    }

    const bats = get("bats").toUpperCase();
    const throws_ = get("throws").toUpperCase();
    const positions = get("positions").split(/[\/;|]/).map(p => p.trim().toUpperCase()).filter(Boolean);
    const weight = get("weight") ? Number(get("weight")) : null;
    const jersey = get("jersey_number") ? Number(get("jersey_number")) : null;

    players.push({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dateTest.toISOString().split("T")[0],
      positions,
      bats: ["L", "R", "S"].includes(bats) ? bats : "R",
      throws: ["L", "R"].includes(throws_) ? throws_ : "R",
      height: get("height") || null,
      weight: weight && !isNaN(weight) ? weight : null,
      jersey_number: jersey && !isNaN(jersey) ? jersey : null,
      notes: get("notes"),
    });
  }

  return { players, errors };
}

export default function ImportPlayers() {
  const navigate = useNavigate();
  const batchAdd = useAddPlayersBatch();
  const [parsed, setParsed] = useState<ParsedPlayer[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { players, errors } = parseCSV(text);
      setParsed(players);
      setParseErrors(errors);
    };
    reader.readAsText(file);
  }, []);

  const handleImport = async () => {
    if (parsed.length === 0) return;
    setImporting(true);
    try {
      await batchAdd.mutateAsync(parsed);
      toast.success(`${parsed.length} players imported!`);
      navigate("/players");
    } catch (err: any) {
      toast.error(err.message);
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
