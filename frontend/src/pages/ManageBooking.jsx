import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  CalendarBlank, Clock, CheckCircle, XCircle, ArrowsClockwise, CircleNotch, Car, Phone, ArrowLeft,
} from "@phosphor-icons/react";
import api from "@/lib/api";

const STATUS_STYLE = {
  pending: "text-amber-400 border-amber-400/40",
  confirmed: "text-emerald-400 border-emerald-400/40",
  completed: "text-blue-400 border-blue-400/40",
  cancelled: "text-red-400 border-red-400/40",
};

function fmtDate(d) { return d.toISOString().split("T")[0]; }

export default function ManageBooking() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [busy, setBusy] = useState(false);

  const [selDate, setSelDate] = useState("");
  const [selSlot, setSelSlot] = useState("");
  const [slots, setSlots] = useState([]);
  const [closed, setClosed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/bookings/manage/${token}`);
      setBooking(data);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const dates = Array.from({ length: 21 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });

  const pickDate = async (ds) => {
    setSelDate(ds); setSelSlot(""); setLoadingSlots(true);
    try {
      const { data } = await api.get(`/availability?date_str=${ds}`);
      setClosed(data.closed); setSlots(data.slots);
    } catch { toast.error("Could not load times"); }
    finally { setLoadingSlots(false); }
  };

  const doReschedule = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/bookings/manage/${token}/reschedule`, { booking_date: selDate, time_slot: selSlot });
      setBooking(data);
      setRescheduling(false);
      toast.success("Appointment rescheduled");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Reschedule failed");
    } finally { setBusy(false); }
  };

  const doCancel = async () => {
    if (!window.confirm("Cancel this appointment? Your deposit refund will be handled by the shop.")) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/bookings/manage/${token}/cancel`);
      setBooking(data);
      toast.success("Appointment cancelled");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Cancel failed");
    } finally { setBusy(false); }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-foreground"><CircleNotch weight="bold" size={40} className="text-primary animate-spin" /></div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-5" data-testid="manage-notfound">
        <div className="bg-card border border-border max-w-md w-full p-8 text-center">
          <XCircle weight="fill" size={52} className="text-destructive mx-auto" />
          <h1 className="font-heading font-bold text-2xl uppercase mt-4">Booking Not Found</h1>
          <p className="text-muted-foreground mt-2 text-sm">This link may be invalid or expired. Call us at (470) 390-9940 for help.</p>
          <button onClick={() => navigate("/")} className="w-full bg-primary text-primary-foreground py-3 text-sm font-bold uppercase tracking-widest mt-6">Back to Home</button>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";
  const isCompleted = booking.status === "completed";
  const locked = isCancelled || isCompleted;

  return (
    <div className="min-h-screen bg-background py-10 px-5" data-testid="manage-page">
      <div className="max-w-xl mx-auto">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6" data-testid="manage-back-home">
          <ArrowLeft weight="bold" size={16} /> Rosas Auto Works
        </button>

        <div className="bg-card border border-border p-6 sm:p-8">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-heading font-black text-3xl uppercase tracking-tighter">Your Appointment</h1>
            <span data-testid="manage-status" className={`shrink-0 px-3 py-1 text-[11px] font-bold uppercase tracking-wider border ${STATUS_STYLE[booking.status]}`}>{booking.status}</span>
          </div>

          <div className="border border-border mt-6 divide-y divide-border text-sm">
            <div className="flex items-center gap-3 p-4"><Car weight="bold" size={20} className="text-primary" /><div><p className="text-xs text-muted-foreground uppercase tracking-widest">Service & Vehicle</p><p className="font-bold">{booking.service_name}</p><p className="text-muted-foreground">{booking.vehicle_year} {booking.vehicle_make} {booking.vehicle_model}</p></div></div>
            <div className="flex items-center gap-3 p-4"><CalendarBlank weight="bold" size={20} className="text-primary" /><div><p className="text-xs text-muted-foreground uppercase tracking-widest">Date & Time</p><p className="font-bold" data-testid="manage-datetime">{booking.booking_date} at {booking.time_slot}</p></div></div>
            <div className="flex items-center gap-3 p-4"><CheckCircle weight="bold" size={20} className="text-primary" /><div><p className="text-xs text-muted-foreground uppercase tracking-widest">Deposit</p><p className="font-bold">{booking.deposit_paid ? `$${booking.deposit_amount.toFixed(0)} paid` : "Unpaid"}</p></div></div>
          </div>

          {locked ? (
            <p className="text-muted-foreground text-sm mt-6" data-testid="manage-locked-note">
              {isCancelled ? "This appointment has been cancelled." : "This appointment is complete. Thanks for choosing Rosas Auto Works!"}
            </p>
          ) : !rescheduling ? (
            <div className="flex flex-col sm:flex-row gap-3 mt-7">
              <button data-testid="manage-reschedule-btn" onClick={() => setRescheduling(true)} className="flex-1 bg-secondary text-white py-3 text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"><ArrowsClockwise weight="bold" size={16} /> Reschedule</button>
              <button data-testid="manage-cancel-btn" disabled={busy} onClick={doCancel} className="flex-1 border border-destructive text-red-400 py-3 text-sm font-bold uppercase tracking-widest transition-colors hover:bg-destructive hover:text-white disabled:opacity-40">Cancel Appointment</button>
            </div>
          ) : (
            <div className="mt-7 border-t border-border pt-6" data-testid="manage-reschedule-panel">
              <h2 className="font-heading font-bold text-lg uppercase tracking-tight flex items-center gap-2"><CalendarBlank weight="bold" size={20} /> Pick a new date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 mt-3">
                {dates.map((d) => {
                  const ds = fmtDate(d); const isSun = d.getDay() === 0; const active = selDate === ds;
                  return (
                    <button key={ds} data-testid={`manage-date-${ds}`} disabled={isSun} onClick={() => pickDate(ds)}
                      className={`shrink-0 w-16 py-3 border text-center transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : isSun ? "border-border opacity-30 cursor-not-allowed" : "border-border hover:border-foreground/40"}`}>
                      <p className="text-[10px] font-bold uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                      <p className="font-heading font-bold text-lg leading-none mt-1">{d.getDate()}</p>
                      <p className="text-[10px] uppercase">{d.toLocaleDateString("en-US", { month: "short" })}</p>
                    </button>
                  );
                })}
              </div>
              {selDate && (
                <div className="mt-3">
                  <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2 mb-3"><Clock weight="bold" size={18} /> Times</h3>
                  {loadingSlots ? <p className="text-sm text-muted-foreground">Loading…</p>
                    : closed ? <p className="text-sm text-muted-foreground">Closed that day. Pick another.</p>
                    : <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {slots.map((s) => (
                          <button key={s.time} data-testid={`manage-slot-${s.time}`} disabled={!s.available} onClick={() => setSelSlot(s.time)}
                            className={`py-2.5 text-sm font-medium border transition-colors ${selSlot === s.time ? "border-primary bg-primary text-primary-foreground" : s.available ? "border-border hover:border-foreground/40" : "border-border opacity-30 line-through cursor-not-allowed"}`}>
                            {s.time}
                          </button>
                        ))}
                      </div>}
                </div>
              )}
              <div className="flex gap-3 mt-6">
                <button data-testid="manage-reschedule-cancel" onClick={() => setRescheduling(false)} className="px-5 py-3 border border-border text-sm font-bold uppercase tracking-widest transition-colors hover:bg-muted">Back</button>
                <button data-testid="manage-reschedule-confirm" disabled={!selDate || !selSlot || busy} onClick={doReschedule} className="flex-1 bg-primary text-primary-foreground py-3 text-sm font-bold uppercase tracking-widest disabled:opacity-40 flex items-center justify-center gap-2">
                  {busy ? <><CircleNotch weight="bold" size={16} className="animate-spin" /> Saving…</> : "Confirm New Time"}
                </button>
              </div>
            </div>
          )}

          <a href="tel:4703909940" className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mt-8"><Phone weight="bold" size={16} /> Questions? Call (470) 390-9940</a>
        </div>
      </div>
    </div>
  );
}
