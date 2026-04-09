import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Send, UserPlus } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InviteCoachDialog({ open, onClose }: Props) {
  const { user, organizationId } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organizationId) return;
    setLoading(true);

    try {
      const { error } = await supabase.from("organization_invites").insert({
        organization_id: organizationId,
        invited_by: user.id,
        email: email.trim().toLowerCase(),
        role: "coach" as const,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("This email has already been invited");
        } else {
          throw error;
        }
      } else {
        toast.success(`Invite sent to ${email}`);
        setEmail("");
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Invite Coach</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Send an invite to a coach's email. When they sign up or log in, they'll be able to join your organization.
        </p>

        <form onSubmit={handleInvite} className="space-y-3">
          <input
            type="email"
            placeholder="coach@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full h-12 px-4 rounded-xl bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            {loading ? "Sending..." : "Send Invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
