import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Home } from "lucide-react";

export default function NotFound() {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div role="main" className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-sm">
        <img src="/logo-256.png" alt="DiamondAudit" width={80} height={80} className="w-20 h-20 mx-auto object-contain opacity-90" />
        <h1 className="text-5xl font-bold text-foreground tracking-tight">404</h1>
        <p className="text-muted-foreground">
          We couldn't find that page. It may have moved or never existed.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <Home className="w-4 h-4" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
