import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, CircleNotch, XCircle } from "@phosphor-icons/react";
import api from "@/lib/api";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState("checking"); // checking | paid | failed
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (!sessionId) { setState("failed"); return; }
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const { data } = await api.get(`/payments/status/${sessionId}`);
        if (data.payment_status === "paid") {
          setState("paid");
          if (data.booking_id) {
            try { const b = await api.get(`/bookings/${data.booking_id}`); setBooking(b.data); } catch {}
          }
          return;
        }
        if (["expired", "failed"].includes(data.status)) { setState("failed"); return; }
      } catch {}
      if (attempts >= 8) { setState("failed"); return; }
      setTimeout(poll, 2000);
    };
    poll();
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-5" data-testid="payment-success-page">
      <div className="bg-card border border-border max-w-md w-full p-8 text-center" data-testid="payment-success-card">
        {state === "checking" && (
          <>
            <CircleNotch weight="bold" size={48} className="text-primary animate-spin mx-auto" />
            <h1 className="font-heading font-bold text-2xl uppercase mt-5">Confirming payment…</h1>
            <p className="text-muted-foreground mt-2 text-sm">Hang tight, this only takes a moment.</p>
          </>
        )}
        {state === "paid" && (
          <>
            <CheckCircle weight="fill" size={56} className="text-primary mx-auto" />
            <h1 className="font-heading font-black text-3xl uppercase mt-5 tracking-tight" data-testid="payment-success-title">Deposit Confirmed!</h1>
            <p className="text-muted-foreground mt-3 text-sm">Your appointment request is in. We've emailed your confirmation and our team will confirm your slot shortly.</p>
            {booking && (
              <div className="bg-muted border border-border p-4 mt-6 text-left text-sm space-y-1">
                <p><span className="text-muted-foreground">Service:</span> <strong>{booking.service_name}</strong></p>
                <p><span className="text-muted-foreground">Vehicle:</span> {booking.vehicle_year} {booking.vehicle_make} {booking.vehicle_model}</p>
                <p><span className="text-muted-foreground">When:</span> {booking.booking_date} at {booking.time_slot}</p>
              </div>
            )}
            <button data-testid="success-home-btn" onClick={() => navigate("/")} className="w-full bg-secondary text-white py-3 text-sm font-bold uppercase tracking-widest mt-6 transition-transform hover:-translate-y-0.5">Back to Home</button>
            {booking?.manage_token && (
              <button data-testid="success-manage-btn" onClick={() => navigate(`/manage/${booking.manage_token}`)} className="w-full border border-primary text-primary py-3 text-sm font-bold uppercase tracking-widest mt-3 transition-colors hover:bg-primary hover:text-primary-foreground">Manage My Appointment</button>
            )}
          </>
        )}
        {state === "failed" && (
          <>
            <XCircle weight="fill" size={56} className="text-destructive mx-auto" />
            <h1 className="font-heading font-bold text-2xl uppercase mt-5">Payment Not Confirmed</h1>
            <p className="text-muted-foreground mt-2 text-sm">We couldn't confirm your deposit. If you were charged, contact us at (470) 390-9940.</p>
            <button data-testid="failed-retry-btn" onClick={() => navigate("/book")} className="w-full bg-primary text-primary-foreground py-3 text-sm font-bold uppercase tracking-widest mt-6">Try Again</button>
          </>
        )}
      </div>
    </div>
  );
}
