import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: { display_name: string | null; current_organization_id: string | null } | null;
  organizationId: string | null;
  role: AppRole | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  organizationId: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const ensureOrganizationForUser = async (
    userId: string,
    displayName: string | null,
    email: string | null,
  ): Promise<string | null> => {
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

    const baseName =
      displayName?.trim() ||
      email?.split("@")[0]?.replace(/[._-]+/g, " ") ||
      "My Organization";
    const orgName = `${baseName} Team`;
    const slugBase = orgName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const slug = `${slugBase || "org"}-${userId.slice(0, 8)}`;

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({ name: orgName, slug })
      .select("id")
      .single();

    if (orgError || !org) {
      console.error("Unable to bootstrap organization", orgError);
      return null;
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      organization_id: org.id,
      role: "admin",
    });

    if (roleError) {
      console.error("Unable to bootstrap user role", roleError);
      return null;
    }

    // Seed default evaluation template
    await supabase.from("evaluation_templates").insert({
      name: "Baseball Default",
      organization_id: org.id,
      is_default: true,
      sport: "baseball",
      categories: [
        { id: "hitting", name: "Hitting", skills: [
          { id: "contact", label: "Contact", type: "slider" },
          { id: "power", label: "Power", type: "slider" },
          { id: "batSpeed", label: "Bat Speed", type: "slider" },
          { id: "approach", label: "Approach", type: "slider" },
          { id: "exitVelo", label: "Exit Velocity", type: "number", unit: "mph" },
        ]},
        { id: "fielding", name: "Fielding", skills: [
          { id: "glovePresentation", label: "Glove Work", type: "slider" },
          { id: "prepStep", label: "Prep Step", type: "slider" },
          { id: "hands", label: "Hands", type: "slider" },
          { id: "footwork", label: "Footwork", type: "slider" },
          { id: "fieldingOverall", label: "Overall", type: "slider" },
        ]},
        { id: "pitching", name: "Pitching", skills: [
          { id: "command", label: "Command", type: "slider" },
          { id: "control", label: "Control", type: "slider" },
          { id: "changeup", label: "Changeup", type: "slider" },
          { id: "breakingBall", label: "Breaking Ball", type: "slider" },
          { id: "fbVelo", label: "Fastball Velo", type: "number", unit: "mph" },
          { id: "changeupVelo", label: "Changeup Velo", type: "number", unit: "mph" },
          { id: "breakingVelo", label: "Breaking Ball Velo", type: "number", unit: "mph" },
        ]},
        { id: "catching", name: "Catching", skills: [
          { id: "receiving", label: "Receiving", type: "slider" },
          { id: "transfer", label: "Transfer", type: "slider" },
          { id: "blocking", label: "Blocking", type: "slider" },
          { id: "catchingOverall", label: "Overall", type: "slider" },
          { id: "popTime", label: "Pop Time", type: "number", unit: "sec" },
        ]},
        { id: "running", name: "Running", skills: [
          { id: "lateralSpeed", label: "Lateral Speed", type: "slider" },
          { id: "homeToFirst", label: "Home to 1st", type: "number", unit: "sec" },
          { id: "sixtyYard", label: "60-Yard Dash", type: "number", unit: "sec" },
        ]},
        { id: "throwing", name: "Throwing", skills: [
          { id: "armStrength", label: "Arm Strength", type: "slider" },
          { id: "armAccuracy", label: "Arm Accuracy", type: "slider" },
          { id: "infieldVelo", label: "IF Throw Velo", type: "number", unit: "mph" },
          { id: "outfieldVelo", label: "OF Throw Velo", type: "number", unit: "mph" },
          { id: "catcherVelo", label: "C Throw Velo", type: "number", unit: "mph" },
        ]},
      ] as any,
    });

    return org.id;
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data: prof } = await supabase
              .from("profiles")
              .select("display_name, current_organization_id")
              .eq("user_id", session.user.id)
              .maybeSingle();

            const displayName = prof?.display_name ?? (session.user.user_metadata?.full_name as string | undefined) ?? null;
            let orgId = prof?.current_organization_id ?? null;

            if (!orgId) {
              orgId = await ensureOrganizationForUser(session.user.id, displayName, session.user.email ?? null);
            }

            if (orgId) {
              await supabase.from("profiles").upsert(
                {
                  user_id: session.user.id,
                  display_name: displayName,
                  current_organization_id: orgId,
                },
                { onConflict: "user_id" },
              );
            }

            setProfile({ display_name: displayName, current_organization_id: orgId });
            setOrganizationId(orgId);

            if (orgId) {
              const { data: roles } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", session.user.id)
                .eq("organization_id", orgId);

              const userRole = roles?.find(r => r.role === "admin") ? "admin" : roles?.[0]?.role ?? null;
              setRole(userRole);
            } else {
              setRole(null);
            }

            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setOrganizationId(null);
          setRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, organizationId, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
