import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mail, Lock, UserPlus, LogIn, ArrowLeft, Send } from "lucide-react";

type Mode = "signin" | "signup" | "forgot" | "confirmation-sent" | "reset-sent";

export default function Auth() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              pending_org_name: orgName.trim(),
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
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (mode === "confirmation-sent" || mode === "reset-sent") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-4">
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
        </motion.div>
      </div>
    );
  }

  const subhead =
    mode === "signup"
      ? "Create your organization"
      : mode === "forgot"
      ? "Enter your email to reset your password"
      : "Sign in to continue";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <img src="/logo.png" alt="DiamondAudit" className="w-32 h-32 mx-auto mb-2 object-contain" />
          <p className="text-sm text-muted-foreground mt-1">{subhead}</p>
        </div>

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
      </motion.div>
    </div>
  );
}
