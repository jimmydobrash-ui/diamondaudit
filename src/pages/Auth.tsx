import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, UserPlus, LogIn, ArrowLeft, Send } from "lucide-react";

type Mode = "signin" | "signup" | "forgot" | "confirmation-sent" | "reset-sent";

// get_invite_email ships in a hand-applied migration
// (supabase/migrations/20260815000000_invite_lookup_rpc.sql). The generated
// src/integrations/supabase/types.ts won't know about it until it's
// regenerated against the live schema post-apply, hence the `as never`
// casts on the .rpc() call below.
interface InviteLookup {
  email: string;
  organization_name: string;
}

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteParam = searchParams.get("invite");
  // Old links put the invitee's raw email straight in the URL
  // (?invite=1&email=...) — already-sent/copied ones must keep working.
  // Current links carry only the invite's opaque id (?invite=<uuid>); the
  // email is resolved server-side below so it never sits in the URL,
  // browser history, Referer headers, or analytics.
  const isLegacyInvite = inviteParam === "1";
  const inviteId = inviteParam && !isLegacyInvite ? inviteParam : null;
  const legacyEmail = isLegacyInvite ? (searchParams.get("email") ?? "") : "";

  const [isInvite, setIsInvite] = useState(isLegacyInvite || !!inviteId);
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(isInvite ? "signup" : "signin");
  const [email, setEmail] = useState(legacyEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!inviteId) return;
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_email" as never, {
        p_invite_id: inviteId,
      } as never);
      const invite = ((data as unknown as InviteLookup[] | null) ?? [])[0] ?? null;

      if (error || !invite) {
        toast.error("This invite link is invalid or has expired.");
        setIsInvite(false);
        setMode("signin");
        return;
      }

      setEmail(invite.email);
      setInviteOrgName(invite.organization_name);
      // Drop the id from the address bar now that it's resolved, so it
      // doesn't linger in history any longer than it has to.
      navigate("/auth", { replace: true });
    })();
  }, [inviteId, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const trimmedOrgName = orgName.trim();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              ...(isInvite ? {} : { pending_org_name: trimmedOrgName }),
            },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created! You're signed in.");
        } else {
          setMode("confirmation-sent");
        }
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/recover`,
        });
        if (error) throw error;
        setMode("reset-sent");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (mode === "confirmation-sent" || mode === "reset-sent") {
    return (
      <div role="main" className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "confirmation-sent"
              ? `We sent a confirmation link to ${email}. Click it to verify your account.`
              : `We sent a password reset link to ${email}. Click it to choose a new password.`}
          </p>
          <button
            onClick={() => { setMode("signin"); setPassword(""); }}
            className="text-sm text-primary font-medium"
          >
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  const subhead =
    mode === "signup"
      ? isInvite
        ? "Accept your invite"
        : "Create your organization"
      : mode === "forgot"
      ? "Enter your email to reset your password"
      : "Sign in to continue";

  return (
    <div role="main" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <img src="/logo-256.png" alt="DiamondAudit" width={128} height={128} className="w-32 h-32 mx-auto mb-2 object-contain" />
          <p className="text-sm text-muted-foreground mt-1">{subhead}</p>
        </div>

        {mode === "signup" && isInvite && (
          <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-foreground">
            {inviteOrgName ? (
              <>You've been invited to join <strong>{inviteOrgName}</strong>. Sign up to accept.</>
            ) : (
              "You've been invited to join an organization. Sign up to accept."
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Full name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              {!isInvite && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Organization name (e.g., Eastside Baseball)"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    required
                    className="w-full h-12 px-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {mode !== "forgot" && (
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full h-12 pl-10 pr-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? "..." : mode === "signup" ? (
              <><UserPlus className="w-4 h-4" /> Create Account</>
            ) : mode === "forgot" ? (
              <><Send className="w-4 h-4" /> Send reset link</>
            ) : (
              <><LogIn className="w-4 h-4" /> Sign In</>
            )}
          </button>
        </form>

        {mode === "signin" && (
          <button
            onClick={() => setMode("forgot")}
            className="w-full text-center text-xs text-muted-foreground mt-3 py-1 hover:text-foreground transition-colors"
          >
            Forgot password?
          </button>
        )}

        {mode === "forgot" ? (
          <button
            onClick={() => setMode("signin")}
            className="w-full flex items-center justify-center gap-1 text-sm text-muted-foreground mt-4 py-2 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
          </button>
        ) : (
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-sm text-muted-foreground mt-4 py-2 hover:text-foreground transition-colors"
          >
            {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
          </button>
        )}
      </div>
    </div>
  );
}
