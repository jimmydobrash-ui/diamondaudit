import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TEMPLATE_CATEGORIES = [
  {
    id: "hitting",
    name: "Hitting",
    skills: [
      { id: "contact", label: "Contact", type: "slider" },
      { id: "power", label: "Power", type: "slider" },
      { id: "batSpeed", label: "Bat Speed", type: "slider" },
      { id: "approach", label: "Approach", type: "slider" },
      { id: "exitVelo", label: "Exit Velocity", type: "number", unit: "mph" },
    ],
  },
  {
    id: "fielding",
    name: "Fielding",
    skills: [
      { id: "glovePresentation", label: "Glove Work", type: "slider" },
      { id: "prepStep", label: "Prep Step", type: "slider" },
      { id: "hands", label: "Hands", type: "slider" },
      { id: "footwork", label: "Footwork", type: "slider" },
      { id: "fieldingOverall", label: "Overall", type: "slider" },
    ],
  },
  {
    id: "pitching",
    name: "Pitching",
    skills: [
      { id: "command", label: "Command", type: "slider" },
      { id: "control", label: "Control", type: "slider" },
      { id: "changeup", label: "Changeup", type: "slider" },
      { id: "breakingBall", label: "Breaking Ball", type: "slider" },
      { id: "fbVelo", label: "Fastball Velo", type: "number", unit: "mph" },
      { id: "changeupVelo", label: "Changeup Velo", type: "number", unit: "mph" },
      { id: "breakingVelo", label: "Breaking Ball Velo", type: "number", unit: "mph" },
    ],
  },
  {
    id: "catching",
    name: "Catching",
    skills: [
      { id: "receiving", label: "Receiving", type: "slider" },
      { id: "transfer", label: "Transfer", type: "slider" },
      { id: "blocking", label: "Blocking", type: "slider" },
      { id: "catchingOverall", label: "Overall", type: "slider" },
      { id: "popTime", label: "Pop Time", type: "number", unit: "sec" },
    ],
  },
  {
    id: "running",
    name: "Running",
    skills: [
      { id: "lateralSpeed", label: "Lateral Speed", type: "slider" },
      { id: "homeToFirst", label: "Home to 1st", type: "number", unit: "sec" },
      { id: "sixtyYard", label: "60-Yard Dash", type: "number", unit: "sec" },
    ],
  },
  {
    id: "throwing",
    name: "Throwing",
    skills: [
      { id: "armStrength", label: "Arm Strength", type: "slider" },
      { id: "armAccuracy", label: "Arm Accuracy", type: "slider" },
      { id: "infieldVelo", label: "IF Throw Velo", type: "number", unit: "mph" },
      { id: "outfieldVelo", label: "OF Throw Velo", type: "number", unit: "mph" },
      { id: "catcherVelo", label: "C Throw Velo", type: "number", unit: "mph" },
    ],
  },
];

interface BootstrapInput {
  userId: string;
  orgName?: string | null;
  displayName?: string | null;
  email?: string | null;
}

/**
 * Creates an org for a user who has no existing role, using a client-generated
 * UUID so we don't need to .select() the new row through RLS (the user isn't
 * yet a member of the org they just created, so RLS would filter it out).
 *
 * Idempotent: if the user already has a role in any org, returns that org's id
 * without creating a new one.
 */
export async function bootstrapOrganization({
  userId,
  orgName,
  displayName,
  email,
}: BootstrapInput): Promise<string | null> {
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingRole?.organization_id) {
    return existingRole.organization_id;
  }

  const trimmedOrgName = orgName?.trim();

  // If signing up without an org name AND a pending invite exists for this
  // email, skip auto-creating an org — PendingInviteBanner will let the user
  // accept the invite into the inviter's org.
  if (!trimmedOrgName && email) {
    const { data: pendingInvite } = await supabase
      .from("organization_invites")
      .select("id")
      .eq("status", "pending")
      .ilike("email", email)
      .gt("expires_at", new Date().toISOString())
      .limit(1)
      .maybeSingle();

    if (pendingInvite) {
      return null;
    }
  }

  const baseName =
    trimmedOrgName ||
    displayName?.trim() ||
    email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
    "My Organization";
  const finalName = trimmedOrgName ? trimmedOrgName : `${baseName} Team`;

  const slugBase = finalName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slug = `${slugBase || "org"}-${userId.slice(0, 8)}`;

  const orgId = crypto.randomUUID();

  const { error: orgError } = await supabase
    .from("organizations")
    .insert({ id: orgId, name: finalName, slug });

  if (orgError) {
    console.error("Unable to create organization", orgError);
    return null;
  }

  const { error: roleError } = await supabase.from("user_roles").insert({
    user_id: userId,
    organization_id: orgId,
    role: "admin",
  });

  if (roleError) {
    console.error("Unable to assign admin role", roleError);
    return null;
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      user_id: userId,
      display_name: displayName ?? null,
      current_organization_id: orgId,
    },
    { onConflict: "user_id" },
  );

  if (profileError) {
    console.error("Unable to update profile", profileError);
  }

  const { error: templateError } = await supabase
    .from("evaluation_templates")
    .insert({
      name: "Baseball Default",
      organization_id: orgId,
      is_default: true,
      sport: "baseball",
      categories: DEFAULT_TEMPLATE_CATEGORIES as never,
    });

  if (templateError) {
    console.error("Unable to seed default template", templateError);
  }

  return orgId;
}
