import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

import Home from "@/pages/Home";
import Booking from "@/pages/Booking";
import PaymentSuccess from "@/pages/PaymentSuccess";
import PaymentCancel from "@/pages/PaymentCancel";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";

// AuthCallback handles the Emergent OAuth redirect landing.
function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    const sessionId = match ? match[1] : null;
    const finish = async () => {
      if (!sessionId) { navigate("/admin/login"); return; }
      try {
        const { data } = await api.post("/auth/session", { session_id: sessionId });
        setUser(data);
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/admin", { replace: true, state: { user: data } });
      } catch {
        navigate("/admin/login", { replace: true });
      }
    };
    finish();
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary text-white">
      <p className="font-heading uppercase tracking-widest text-sm">Signing you in…</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) navigate("/admin/login", { replace: true });
  }, [user, loading, navigate]);
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary text-white">
        <p className="font-heading uppercase tracking-widest text-sm">Loading…</p>
      </div>
    );
  }
  if (!user || !user.is_admin) return null;
  return children;
}

function AppRouter() {
  const location = useLocation();
  // Read hash reactively from useLocation (not window.location.hash).
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/book" element={<Booking />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/cancel" element={<PaymentCancel />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRouter />
          <Toaster position="top-center" richColors />
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
