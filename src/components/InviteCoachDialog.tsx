import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { X, Send, UserPlus, Copy, Check } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function InviteCoachDialog({ open, onClose }: Props) {
  const { user, organizationId } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const reset = () => {
    setEmail("");
    setInviteLink(null);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !organizationId) return;
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data: invite, error } = await supabase
        .from("organization_invites")
        .insert({
          organization_id: organizationId,
          invited_by: user.id,
          email: cleanEmail,
          role: "coach" as const,
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("This email has already been invited");
        } else {
          throw error;
        }
      } else {
        const link = `${window.location.origin}/auth?invite=1&email=${encodeURIComponent(cleanEmail)}`;
        setInviteLink(link);

        // Try to email the link. Falls back to the copy-link UX if the email
        // function isn't deployed/configured yet, so invites always work.
        try {
          const { error: fnErr } = await supabase.functions.invoke("send-invite", {
            body: { inviteId: invite.id },
          });
          if (fnErr) throw fnErr;
          toast.success(`Invite emailed to ${cleanEmail}`);
        } catch {
          toast.success("Invite created — share the link with the coach.");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
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
          <button onClick={handleClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {inviteLink ? (
          <>
            <p className="text-sm text-muted-foreground">
              Send this link to <strong className="text-foreground">{email}</strong>. They'll be added to your organization after signing up or logging in.
            </p>
            <div className="flex items-center gap-2 p-2 rounded-xl bg-secondary">
              <input
                type="text"
                readOnly
                value={inviteLink}
                onClick={e => (e.target as HTMLInputElement).select()}
                className="flex-1 bg-transparent text-xs text-foreground focus:outline-none px-2"
              />
              <button
                onClick={handleCopy}
                className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                  copied ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button
              onClick={reset}
              className="w-full h-10 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/70 transition-colors"
            >
              Invite another coach
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Enter a coach's email. We'll email them an invite link — and you can copy it to share directly too.
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
          </>
        )}
      </div>
    </div>
  );
}
