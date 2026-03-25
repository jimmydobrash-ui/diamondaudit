import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useEvaluationTemplate, useSaveTemplate, TemplateCategory, TemplateSkill } from "@/hooks/useEvaluationTemplate";
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Check, SlidersHorizontal, Hash } from "lucide-react";
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
        title={skill.type === "slider" ? "Subjective (1-10 slider)" : "Measurable (number input)"}
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
    onChange({
      ...category,
      skills: [...category.skills, { id, label: "", type: "slider" }],
    });
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
  const saveMutation = useSaveTemplate();

  const [name, setName] = useState("Baseball Default");
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setCategories(template.categories);
    }
  }, [template]);

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
    // Validate
    const filtered = categories
      .map(c => ({ ...c, skills: c.skills.filter(s => s.label.trim()) }))
      .filter(c => c.name.trim() && c.skills.length > 0);

    if (filtered.length === 0) {
      toast.error("Add at least one category with skills");
      return;
    }

    // Generate clean IDs for new skills
    const cleaned = filtered.map(c => ({
      ...c,
      id: c.id || c.name.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      skills: c.skills.map(s => ({
        ...s,
        id: s.id || s.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      })),
    }));

    try {
      await saveMutation.mutateAsync({ id: template?.id, name, categories: cleaned });
      setSaved(true);
      toast.success("Template saved!");
    } catch (err: any) {
      toast.error(err.message);
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
            <h1 className="text-lg font-bold text-foreground">Evaluation Template</h1>
            <p className="text-xs text-muted-foreground">Configure the metrics your coaches score on</p>
          </div>
        </motion.div>

        <div className="bg-card rounded-xl p-4 card-elevated">
          <label className="text-xs font-medium text-muted-foreground block mb-1">Template Name</label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setSaved(false); }}
            className="w-full h-10 bg-secondary rounded-lg px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Categories</h2>
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
            saved ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
          } disabled:opacity-50`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved" : "Save Template"}
        </button>
      </div>
    </AppLayout>
  );
}
