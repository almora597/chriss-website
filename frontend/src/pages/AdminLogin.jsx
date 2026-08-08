import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { GoogleLogo, Wrench, ArrowLeft } from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user?.is_admin) navigate("/admin", { replace: true });
  }, [user, loading, navigate]);

  const login = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/admin";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-5" data-testid="admin-login-page">
      <div className="max-w-md w-full">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors mb-8" data-testid="admin-back-home">
          <ArrowLeft weight="bold" size={16} /> Back to site
        </button>
        <div className="bg-card border border-border p-8">
          <div className="flex items-center gap-3 mb-6">
            <img src="/logo.jpg" alt="Rosas emblem" className="h-11 w-11 object-cover rounded-sm ring-1 ring-primary/40" />
            <span className="font-heading font-extrabold text-xl tracking-tight"><span className="logo-silver">ROSAS</span> <span className="text-primary">AUTO WORKS</span></span>
          </div>
          <h1 className="font-heading font-black text-3xl uppercase tracking-tighter">Staff Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-sm">Sign in with your authorized Google account to manage bookings.</p>
          <button
            data-testid="google-login-btn"
            onClick={login}
            className="w-full mt-8 border border-border py-3.5 flex items-center justify-center gap-3 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-muted"
          >
            <GoogleLogo weight="bold" size={20} className="text-primary" /> Continue with Google
          </button>
          <p className="text-xs text-muted-foreground mt-6 text-center">Access is restricted to Rosas Auto Works staff.</p>
        </div>
      </div>
    </div>
  );
}
