import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CheckCircle, CalendarBlank, Clock, CreditCard, CircleNotch } from "@phosphor-icons/react";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import api from "@/lib/api";

const STEPS = ["Service", "Vehicle", "Date & Time", "Your Info"];

function fmtDate(d) {
  return d.toISOString().split("T")[0];
}

export default function Booking() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [step, setStep] = useState(0);
  const [services, setServices] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    service_id: params.get("service") || "",
    vehicle_make: "", vehicle_model: "", vehicle_year: "", issue: "",
    booking_date: "", time_slot: "",
    customer_name: "", customer_email: "", customer_phone: "",
  });

  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data)).catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadSlots = async (dateStr) => {
    set("booking_date", dateStr);
    set("time_slot", "");
    setLoadingSlots(true);
    try {
      const { data } = await api.get(`/availability?date_str=${dateStr}`);
      setClosed(data.closed);
      setSlots(data.slots);
    } catch {
      toast.error("Could not load availability");
    } finally {
      setLoadingSlots(false);
    }
  };

  // next 21 days for date picker
  const dates = Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

  const canNext = () => {
    if (step === 0) return !!form.service_id;
    if (step === 1) return form.vehicle_make && form.vehicle_model && form.vehicle_year;
    if (step === 2) return form.booking_date && form.time_slot;
    if (step === 3) return form.customer_name && form.customer_email && form.customer_phone;
    return false;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data: booking } = await api.post("/bookings", form);
      const { data: checkout } = await api.post("/payments/checkout", {
        booking_id: booking.id,
        origin_url: window.location.origin,
      });
      window.location.href = checkout.checkout_url;
    } catch (e) {
      const msg = e?.response?.data?.detail || "Something went wrong. Please try again.";
      toast.error(msg);
      setSubmitting(false);
      if (e?.response?.status === 409) setStep(2);
    }
  };

  const selectedService = services.find((s) => s.id === form.service_id);

  return (
    <div className="min-h-screen bg-muted/40" data-testid="booking-page">
      <Navbar />
      <div className="max-w-2xl mx-auto px-5 pt-24 pb-28 md:pb-16">
        <button onClick={() => navigate("/")} data-testid="booking-back-home" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft weight="bold" size={16} /> Back to site
        </button>

        <h1 className="font-heading font-black uppercase text-3xl sm:text-4xl tracking-tighter">Book Your Appointment</h1>
        <p className="text-muted-foreground mt-2 text-sm">A $100 deposit secures your slot and goes toward your service.</p>

        {/* Stepper */}
        <div className="flex items-center gap-2 mt-8 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
              <p className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${i <= step ? "text-foreground" : "text-muted-foreground"}`}>{s}</p>
            </div>
          ))}
        </div>

        <div className="bg-white border border-border p-6 sm:p-8 animate-fade-up" key={step}>
          {/* STEP 0: SERVICE */}
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="font-heading font-bold text-xl uppercase tracking-tight mb-2">Choose a service</h2>
              {services.map((s) => (
                <button
                  key={s.id}
                  data-testid={`booking-service-${s.id}`}
                  onClick={() => set("service_id", s.id)}
                  className={`w-full text-left p-4 border transition-colors flex items-center justify-between ${
                    form.service_id === s.id ? "border-primary bg-primary/5" : "border-border hover:border-foreground/40"
                  }`}
                >
                  <div>
                    <p className="font-bold text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                  {form.service_id === s.id && <CheckCircle weight="fill" size={22} className="text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {/* STEP 1: VEHICLE */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-heading font-bold text-xl uppercase tracking-tight">Vehicle details</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-widest font-bold">Make</Label>
                  <Input data-testid="booking-make" className="mt-2" placeholder="e.g. BMW" value={form.vehicle_make} onChange={(e) => set("vehicle_make", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-widest font-bold">Model</Label>
                  <Input data-testid="booking-model" className="mt-2" placeholder="e.g. 335i" value={form.vehicle_model} onChange={(e) => set("vehicle_model", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Year</Label>
                <Input data-testid="booking-year" className="mt-2" placeholder="e.g. 2018" value={form.vehicle_year} onChange={(e) => set("vehicle_year", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Describe the issue</Label>
                <Textarea data-testid="booking-issue" className="mt-2" rows={4} placeholder="What's going on with your vehicle?" value={form.issue} onChange={(e) => set("issue", e.target.value)} />
              </div>
            </div>
          )}

          {/* STEP 2: DATE & TIME */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-heading font-bold text-xl uppercase tracking-tight flex items-center gap-2"><CalendarBlank weight="bold" size={22} /> Pick a date</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {dates.map((d) => {
                  const ds = fmtDate(d);
                  const isSun = d.getDay() === 0;
                  const active = form.booking_date === ds;
                  return (
                    <button
                      key={ds}
                      data-testid={`booking-date-${ds}`}
                      disabled={isSun}
                      onClick={() => loadSlots(ds)}
                      className={`shrink-0 w-16 py-3 border text-center transition-colors ${
                        active ? "border-primary bg-primary text-primary-foreground" : isSun ? "border-border opacity-30 cursor-not-allowed" : "border-border hover:border-foreground/40"
                      }`}
                    >
                      <p className="text-[10px] font-bold uppercase">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                      <p className="font-heading font-bold text-lg leading-none mt-1">{d.getDate()}</p>
                      <p className="text-[10px] uppercase">{d.toLocaleDateString("en-US", { month: "short" })}</p>
                    </button>
                  );
                })}
              </div>

              {form.booking_date && (
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-widest flex items-center gap-2 mb-3"><Clock weight="bold" size={18} /> Available times</h3>
                  {loadingSlots ? (
                    <p className="text-sm text-muted-foreground">Loading…</p>
                  ) : closed ? (
                    <p className="text-sm text-muted-foreground">We're closed on this day. Please pick another date.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((s) => (
                        <button
                          key={s.time}
                          data-testid={`booking-slot-${s.time}`}
                          disabled={!s.available}
                          onClick={() => set("time_slot", s.time)}
                          className={`py-2.5 text-sm font-medium border transition-colors ${
                            form.time_slot === s.time ? "border-primary bg-primary text-primary-foreground"
                            : s.available ? "border-border hover:border-foreground/40" : "border-border opacity-30 line-through cursor-not-allowed"
                          }`}
                        >
                          {s.time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: INFO */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-heading font-bold text-xl uppercase tracking-tight">Your contact info</h2>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Full name</Label>
                <Input data-testid="booking-name" className="mt-2" value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Email</Label>
                <Input data-testid="booking-email" type="email" className="mt-2" value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} />
              </div>
              <div>
                <Label className="text-xs uppercase tracking-widest font-bold">Phone</Label>
                <Input data-testid="booking-phone" className="mt-2" value={form.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
              </div>

              <div className="bg-muted p-4 border border-border mt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Summary</p>
                <div className="text-sm space-y-1">
                  <p><span className="text-muted-foreground">Service:</span> <strong>{selectedService?.name}</strong></p>
                  <p><span className="text-muted-foreground">Vehicle:</span> {form.vehicle_year} {form.vehicle_make} {form.vehicle_model}</p>
                  <p><span className="text-muted-foreground">When:</span> {form.booking_date} at {form.time_slot}</p>
                  <p className="pt-2 border-t border-border mt-2 flex justify-between"><span className="text-muted-foreground">Deposit due now</span> <strong className="text-primary">$100.00</strong></p>
                </div>
              </div>
            </div>
          )}

          {/* NAV BUTTONS */}
          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button data-testid="booking-prev-btn" onClick={() => setStep(step - 1)} className="px-5 py-3 border border-border text-sm font-bold uppercase tracking-widest transition-colors hover:bg-muted flex items-center gap-2">
                <ArrowLeft weight="bold" size={16} /> Back
              </button>
            )}
            {step < 3 ? (
              <button
                data-testid="booking-next-btn"
                disabled={!canNext()}
                onClick={() => setStep(step + 1)}
                className="flex-1 bg-secondary text-white px-5 py-3 text-sm font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight weight="bold" size={16} />
              </button>
            ) : (
              <button
                data-testid="booking-pay-btn"
                disabled={!canNext() || submitting}
                onClick={submit}
                className="flex-1 bg-primary text-primary-foreground px-5 py-3 text-sm font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {submitting ? <><CircleNotch weight="bold" size={18} className="animate-spin" /> Redirecting…</> : <><CreditCard weight="bold" size={18} /> Pay $100 Deposit</>}
              </button>
            )}
          </div>
        </div>
      </div>
      <MobileBottomNav />
    </div>
  );
}
