import { Link, useLocation } from "react-router-dom";
import { Users, ClipboardList, BarChart3, Home, LogOut, Settings, Layers, HelpCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import OrgSwitcher from "@/components/OrgSwitcher";
import PendingInviteBanner from "@/components/PendingInviteBanner";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/players", icon: Users, label: "Players" },
  { to: "/evaluate", icon: ClipboardList, label: "Evaluate" },
  { to: "/team-builder", icon: Layers, label: "Build" },
  { to: "/leaderboard", icon: BarChart3, label: "Results" },
  { to: "/settings/template", icon: Settings, label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { profile, role, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b">
        <div className="container flex items-center justify-between h-14">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo-256.png" alt="DiamondAudit" className="h-9 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/scoring-guide" title="Scoring guide" aria-label="Scoring guide"
              className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <HelpCircle className="w-4 h-4" />
            </Link>
            <OrgSwitcher />
            <div className="h-8 px-3 rounded-full bg-secondary flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-primary">{role === "admin" ? "A" : "C"}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
                {profile?.display_name ?? (role === "admin" ? "Admin" : "Coach")}
              </span>
            </div>
            <button onClick={signOut} aria-label="Sign out" title="Sign out" className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      <PendingInviteBanner />

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-lg border-t safe-area-pb">
        <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to || (item.to !== "/" && location.pathname.startsWith(item.to));
            return (
              <Link key={item.to} to={item.to}
                className={`touch-target flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                <item.icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
