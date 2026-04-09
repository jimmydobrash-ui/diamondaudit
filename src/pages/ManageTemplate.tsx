import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import InviteCoachDialog from "@/components/InviteCoachDialog";
import { useEvaluationTemplate, useSaveTemplate, TemplateCategory, TemplateSkill } from "@/hooks/useEvaluationTemplate";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Check, SlidersHorizontal, Hash, UserPlus, AlertTriangle, Users } from "lucide-react";
import { toast } from "sonner";

function SkillRow({ skill, onUpdate, onRemove }: { skill: TemplateSkill; onUpdate: (s: TemplateSkill) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <GripVertical className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
      <input
        value={skill.label}
        onChange={e => onUpdate({ ...skill, label: e.target.value, id: skill.id })}
        className="flex-1 h-8 bg-secondary rounded-lg px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        placeholder="Skill name"
      />
      <button
        onClick={() => onUpdate({ ...skill, type: skill.type === "slider" ? "number" : "slider" })}
        className={`flex items-center gap-1 px-2 h-8 rounded-lg text-xs font-medium transition-colors ${
          skill.type === "slider" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"
        }`}
      >
        {skill.type === "slider" ? <SlidersHorizontal className="w-3 h-3" /> : <Hash className="w-3 h-3" />}
        {skill.type === "slider" ? "Slider" : "Number"}
      </button>
      {skill.type === "number" && (
        <input
          value={skill.unit ?? ""}
          onChange={e => onUpdate({ ...skill, unit: e.target.value })}
          className="w-14 h-8 bg-secondary rounded-lg px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder="unit"
        />
      )}
      <button onClick={onRemove} className="p-1 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function CategoryEditor({ category, onChange, onRemove }: { category: TemplateCategory; onChange: (c: TemplateCategory) => void; onRemove: () => void }) {
  const updateSkill = (index: number, skill: TemplateSkill) => {
    const skills = [...category.skills];
    skills[index] = skill;
    onChange({ ...category, skills });
  };

  const removeSkill = (index: number) => {
    onChange({ ...category, skills: category.skills.filter((_, i) => i !== index) });
  };

  const addSkill = () => {
    const id = `skill_${Date.now()}`;
    onChange({ ...category, skills: [...category.skills, { id, label: "", type: "slider" }] });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="bg-card rounded-xl p-4 card-elevated space-y-2">
      <div className="flex items-center gap-2">
        <input
          value={category.name}
          onChange={e => onChange({ ...category, name: e.target.value })}
          className="flex-1 text-sm font-semibold bg-transparent text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 rounded-lg px-1 -mx-1"
          placeholder="Category name"
        />
        <button onClick={onRemove} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors rounded-lg hover:bg-destructive/10">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-0.5">
        {category.skills.map((skill, i) => (
          <SkillRow key={skill.id} skill={skill} onUpdate={s => updateSkill(i, s)} onRemove={() => removeSkill(i)} />
        ))}
      </div>
      <button onClick={addSkill} className="flex items-center gap-1.5 text-xs text-primary font-medium hover:text-primary/80 transition-colors pt-1">
        <Plus className="w-3.5 h-3.5" /> Add Metric
      </button>
    </motion.div>
  );
}

export default function ManageTemplate() {
  const navigate = useNavigate();
  const { data: template, isLoading } = useEvaluationTemplate();
  const { organizationId, role } = useAuth();
  const saveMutation = useSaveTemplate();

  const [name, setName] = useState("Baseball Default");
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [saved, setSaved] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<Array<{ id: string; email: string; role: string; created_at: string }>>([]);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategories(template.categories);
    }
  }, [template]);

  // Load pending invites
  useEffect(() => {
    if (!organizationId || role !== "admin") return;
    supabase
      .from("organization_invites")
      .select("id, email, role, created_at")
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPendingInvites(data);
      });
  }, [organizationId, role, inviteOpen]);

  const revokeInvite = async (id: string) => {
    await supabase.from("organization_invites").update({ status: "expired" }).eq("id", id);
    setPendingInvites(prev => prev.filter(i => i.id !== id));
    toast.success("Invite revoked");
  };

  const updateCategory = (index: number, cat: TemplateCategory) => {
    const updated = [...categories];
    updated[index] = cat;
    setCategories(updated);
    setSaved(false);
  };

  const removeCategory = (index: number) => {
    setCategories(categories.filter((_, i) => i !== index));
    setSaved(false);
  };

  const addCategory = () => {
    const id = `cat_${Date.now()}`;
    setCategories([...categories, { id, name: "", skills: [] }]);
    setSaved(false);
  };

  const handleSave = async () => {
    const filtered = categories
      .map(c => ({ ...c, skills: c.skills.filter(s => s.label.trim()) }))
      .filter(c => c.name.trim() && c.skills.length > 0);
    if (filtered.length === 0) { toast.error("Add at least one category with skills"); return; }
    const cleaned = filtered.map(c => ({
      ...c,
      id: c.id || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      skills: c.skills.map(s => ({ ...s, id: s.id || s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_") })),
    }));
    try {
      await saveMutation.mutateAsync({ id: template?.id, name, categories: cleaned });
      setSaved(true);
      toast.success("Template saved!");
    } catch (err: any) { toast.error(err.message); }
  };

  const handleResetData = async () => {
    if (!organizationId) return;
    setResetting(true);
    try {
      // Delete in order: grades → evaluations → players
      await supabase.from("player_grades").delete().eq("organization_id", organizationId);
      await supabase.from("evaluations").delete().eq("organization_id", organizationId);
      await supabase.from("players").delete().eq("organization_id", organizationId);
      toast.success("All tryout data has been reset!");
      setResetConfirm(false);
      // Refresh page to clear cached data
      window.location.reload();
    } catch (err: any) {
      toast.error("Reset failed: " + err.message);
    } finally {
      setResetting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-12 flex justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-4 space-y-4 max-w-2xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="touch-target flex items-center justify-center text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Settings</h1>
            <p className="text-xs text-muted-foreground">Manage your organization</p>
          </div>
        </motion.div>

        {/* --- Team Management Section (Admin only) --- */}
        {role === "admin" && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4" /> Team Management
            </h2>

            <div className="bg-card rounded-xl p-4 card-elevated space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Invite Coaches</p>
                  <p className="text-xs text-muted-foreground">Add evaluators to your organization</p>
                </div>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Invite
                </button>
              </div>

              {pendingInvites.length > 0 && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Pending Invites</p>
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="flex items-center justify-between py-1.5">
                      <div>
                        <p className="text-sm text-foreground">{inv.email}</p>
                        <p className="text-[10px] text-muted-foreground capitalize">{inv.role} · {new Date(inv.created_at).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => revokeInvite(inv.id)} className="text-xs text-muted-foreground hover:text-destructive">
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Evaluation Template Section --- */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Evaluation Template
          </h2>

          <div className="bg-card rounded-xl p-4 card-elevated">
            <label className="text-xs font-medium text-muted-foreground block mb-1">Template Name</label>
            <input
              value={name}
              onChange={e => { setName(e.target.value); setSaved(false); }}
              className="w-full h-10 bg-secondary rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Categories</span>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> Subjective 1-10</span>
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Measurable data</span>
            </div>
          </div>

          <AnimatePresence>
            {categories.map((cat, i) => (
              <CategoryEditor key={cat.id} category={cat} onChange={c => updateCategory(i, c)} onRemove={() => removeCategory(i)} />
            ))}
          </AnimatePresence>

          <button onClick={addCategory} className="w-full h-11 rounded-xl border-2 border-dashed border-muted-foreground/20 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2 hover:border-primary/40 hover:text-primary transition-colors">
            <Plus className="w-4 h-4" /> Add Category
          </button>

          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className={`w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              saved ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
            } disabled:opacity-50`}
          >
            {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? "Saved" : "Save Template"}
          </button>
        </div>

        {/* --- Danger Zone (Admin only) --- */}
        {role === "admin" && (
          <div className="space-y-3 pt-4">
            <h2 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Danger Zone
            </h2>

            <div className="bg-card rounded-xl p-4 card-elevated border border-destructive/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">Reset Tryout Data</p>
                  <p className="text-xs text-muted-foreground">Deletes all players, evaluations, and grades. Template and org settings are kept.</p>
                </div>
                {!resetConfirm ? (
                  <button
                    onClick={() => setResetConfirm(true)}
                    className="h-9 px-4 rounded-lg bg-destructive/10 text-destructive text-xs font-semibold hover:bg-destructive/20 transition-colors"
                  >
                    Reset
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResetConfirm(false)}
                      className="h-9 px-3 rounded-lg bg-secondary text-foreground text-xs font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleResetData}
                      disabled={resetting}
                      className="h-9 px-4 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold disabled:opacity-50"
                    >
                      {resetting ? "Resetting..." : "Confirm Delete All"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <InviteCoachDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </AppLayout>
  );
}
