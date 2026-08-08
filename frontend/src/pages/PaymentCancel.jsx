import React from "react";
import { useNavigate } from "react-router-dom";
import { XCircle } from "@phosphor-icons/react";

export default function PaymentCancel() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary px-5" data-testid="payment-cancel-page">
      <div className="bg-white border border-border max-w-md w-full p-8 text-center">
        <XCircle weight="fill" size={56} className="text-muted-foreground mx-auto" />
        <h1 className="font-heading font-bold text-2xl uppercase mt-5">Payment Cancelled</h1>
        <p className="text-muted-foreground mt-2 text-sm">No worries — your slot wasn't charged. You can pick up where you left off.</p>
        <button data-testid="cancel-retry-btn" onClick={() => navigate("/book")} className="w-full bg-primary text-primary-foreground py-3 text-sm font-bold uppercase tracking-widest mt-6 transition-transform hover:-translate-y-0.5">Return to Booking</button>
        <button data-testid="cancel-home-btn" onClick={() => navigate("/")} className="w-full border border-border py-3 text-sm font-bold uppercase tracking-widest mt-3 transition-colors hover:bg-muted">Back to Home</button>
      </div>
    </div>
  );
}
