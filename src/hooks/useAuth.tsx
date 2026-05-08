import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { bootstrapOrganization } from "@/lib/orgBootstrap";

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
            const pendingOrgName = (session.user.user_metadata?.pending_org_name as string | undefined) ?? null;
            let orgId = prof?.current_organization_id ?? null;

            if (!orgId) {
              orgId = await bootstrapOrganization({
                userId: session.user.id,
                orgName: pendingOrgName,
                displayName,
                email: session.user.email ?? null,
              });
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
