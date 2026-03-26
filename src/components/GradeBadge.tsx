import type { PlayerGradeValue } from "@/hooks/usePlayerGrades";

const gradeConfig: Record<PlayerGradeValue, { label: string; className: string }> = {
  offer: { label: "Offer", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  bubble: { label: "Bubble", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  pass: { label: "Pass", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
};

interface GradeBadgeProps {
  grade: PlayerGradeValue;
  size?: "sm" | "md";
}

export default function GradeBadge({ grade, size = "sm" }: GradeBadgeProps) {
  const config = gradeConfig[grade];
  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${config.className} ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      }`}
    >
      {config.label}
    </span>
  );
}
