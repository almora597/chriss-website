import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  SignOut, ListChecks, CalendarBlank, CheckCircle, XCircle, Clock, Car,
  CurrencyDollar, ArrowsClockwise, Wrench,
} from "@phosphor-icons/react";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUS_TABS = ["all", "pending", "confirmed", "completed", "cancelled"];
const STATUS_STYLE = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  completed: "bg-blue-100 text-blue-800 border-blue-300",
  cancelled: "bg-red-100 text-red-700 border-red-300",
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("all");
  const [view, setView] = useState("list"); // list | calendar
  const [reschedule, setReschedule] = useState(null);
  const [rescheduleData, setRescheduleData] = useState({ booking_date: "", time_slot: "" });

  const load = useCallback(async () => {
    try {
      const [b, s] = await Promise.all([
        api.get(`/admin/bookings?status=${tab}`),
        api.get("/admin/stats"),
      ]);
      setBookings(b.data);
      setStats(s.data);
    } catch {
      toast.error("Failed to load bookings");
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const doLogout = async () => { await logout(); navigate("/admin/login"); };

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/admin/bookings/${id}/status`, { status });
      toast.success(`Marked ${status}`);
      load();
    } catch { toast.error("Update failed"); }
  };

  const submitReschedule = async () => {
    try {
      await api.patch(`/admin/bookings/${reschedule.id}/reschedule`, rescheduleData);
      toast.success("Rescheduled");
      setReschedule(null);
      load();
    } catch { toast.error("Reschedule failed"); }
  };

  const statCards = stats ? [
    { label: "Total", value: stats.total, icon: ListChecks },
    { label: "Pending", value: stats.pending, icon: Clock },
    { label: "Confirmed", value: stats.confirmed, icon: CheckCircle },
    { label: "Deposits", value: `$${stats.deposit_revenue.toFixed(0)}`, icon: CurrencyDollar },
  ] : [];

  // group by date for calendar view
  const byDate = bookings.reduce((acc, b) => {
    (acc[b.booking_date] = acc[b.booking_date] || []).push(b);
    return acc;
  }, {});
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="min-h-screen bg-muted/40" data-testid="admin-dashboard">
      {/* Top bar */}
      <header className="bg-secondary text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench weight="fill" size={22} className="text-primary" />
            <span className="font-heading font-extrabold text-lg tracking-tight">ROSAS <span className="text-primary">ADMIN</span></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/60 hidden sm:block" data-testid="admin-user-email">{user?.email}</span>
            <button onClick={doLogout} data-testid="admin-logout-btn" className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest hover:text-primary transition-colors">
              <SignOut weight="bold" size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        <h1 className="font-heading font-black text-3xl uppercase tracking-tighter">Bookings</h1>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border mt-6">
          {statCards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="bg-white p-5" data-testid={`stat-${c.label.toLowerCase()}`}>
                <Icon weight="bold" size={22} className="text-primary" />
                <p className="font-heading font-black text-3xl mt-3 leading-none">{c.value}</p>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{c.label}</p>
              </div>
            );
          })}
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-8">
          <div className="flex flex-wrap gap-1 bg-white border border-border p-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t}
                data-testid={`tab-${t}`}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${tab === t ? "bg-secondary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-white border border-border p-1">
            <button data-testid="view-list" onClick={() => setView("list")} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${view === "list" ? "bg-secondary text-white" : "text-muted-foreground"}`}><ListChecks weight="bold" size={16} /> List</button>
            <button data-testid="view-calendar" onClick={() => setView("calendar")} className={`px-4 py-2 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${view === "calendar" ? "bg-secondary text-white" : "text-muted-foreground"}`}><CalendarBlank weight="bold" size={16} /> Calendar</button>
          </div>
        </div>

        {bookings.length === 0 && (
          <div className="bg-white border border-border p-12 text-center mt-6" data-testid="no-bookings">
            <Car weight="light" size={48} className="text-muted-foreground mx-auto" />
            <p className="font-heading font-bold uppercase mt-4">No bookings here yet</p>
          </div>
        )}

        {/* LIST VIEW */}
        {view === "list" && bookings.length > 0 && (
          <div className="border border-border mt-6 bg-white overflow-x-auto">
            <table className="w-full text-sm" data-testid="bookings-table">
              <thead className="bg-muted text-left">
                <tr className="text-xs uppercase tracking-widest text-muted-foreground">
                  <th className="p-4">Customer</th>
                  <th className="p-4">Vehicle</th>
                  <th className="p-4">Service</th>
                  <th className="p-4">When</th>
                  <th className="p-4">Deposit</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-t border-border align-top" data-testid={`booking-row-${b.id}`}>
                    <td className="p-4">
                      <p className="font-bold">{b.customer_name}</p>
                      <p className="text-xs text-muted-foreground">{b.customer_phone}</p>
                      <p className="text-xs text-muted-foreground">{b.customer_email}</p>
                    </td>
                    <td className="p-4">{b.vehicle_year} {b.vehicle_make} {b.vehicle_model}<p className="text-xs text-muted-foreground max-w-[180px]">{b.issue}</p></td>
                    <td className="p-4">{b.service_name}</td>
                    <td className="p-4 whitespace-nowrap">{b.booking_date}<br /><span className="text-muted-foreground">{b.time_slot}</span></td>
                    <td className="p-4">{b.deposit_paid ? <span className="text-emerald-600 font-bold">${b.deposit_amount.toFixed(0)} ✓</span> : <span className="text-muted-foreground">Unpaid</span>}</td>
                    <td className="p-4"><span className={`inline-block px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border ${STATUS_STYLE[b.status]}`}>{b.status}</span></td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {b.status !== "confirmed" && b.status !== "cancelled" && (
                          <button data-testid={`confirm-${b.id}`} onClick={() => updateStatus(b.id, "confirmed")} className="px-2.5 py-1.5 bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider">Confirm</button>
                        )}
                        {b.status !== "completed" && b.status !== "cancelled" && (
                          <button data-testid={`complete-${b.id}`} onClick={() => updateStatus(b.id, "completed")} className="px-2.5 py-1.5 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">Complete</button>
                        )}
                        {b.status !== "cancelled" && (
                          <>
                            <button data-testid={`reschedule-${b.id}`} onClick={() => { setReschedule(b); setRescheduleData({ booking_date: b.booking_date, time_slot: b.time_slot }); }} className="px-2.5 py-1.5 bg-secondary text-white text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"><ArrowsClockwise weight="bold" size={12} /></button>
                            <button data-testid={`cancel-${b.id}`} onClick={() => updateStatus(b.id, "cancelled")} className="px-2.5 py-1.5 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider">Cancel</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CALENDAR VIEW */}
        {view === "calendar" && bookings.length > 0 && (
          <div className="grid gap-4 mt-6 md:grid-cols-2 lg:grid-cols-3" data-testid="calendar-view">
            {sortedDates.map((d) => (
              <div key={d} className="bg-white border border-border">
                <div className="bg-secondary text-white px-4 py-2.5 flex items-center gap-2">
                  <CalendarBlank weight="bold" size={16} className="text-primary" />
                  <span className="text-xs font-bold uppercase tracking-widest">{new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</span>
                </div>
                <div className="divide-y divide-border">
                  {byDate[d].sort((a, z) => a.time_slot.localeCompare(z.time_slot)).map((b) => (
                    <div key={b.id} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-sm">{b.time_slot} · {b.customer_name}</p>
                        <p className="text-xs text-muted-foreground">{b.vehicle_make} {b.vehicle_model} — {b.service_name}</p>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase border ${STATUS_STYLE[b.status]}`}>{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reschedule dialog */}
      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent data-testid="reschedule-dialog">
          <DialogHeader><DialogTitle className="font-heading uppercase">Reschedule Appointment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-widest font-bold">Date</Label>
              <Input data-testid="reschedule-date" type="date" className="mt-2" value={rescheduleData.booking_date} onChange={(e) => setRescheduleData((d) => ({ ...d, booking_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-widest font-bold">Time (HH:MM)</Label>
              <Input data-testid="reschedule-time" placeholder="09:00" className="mt-2" value={rescheduleData.time_slot} onChange={(e) => setRescheduleData((d) => ({ ...d, time_slot: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <button data-testid="reschedule-submit" onClick={submitReschedule} className="bg-primary text-primary-foreground px-6 py-2.5 text-sm font-bold uppercase tracking-widest">Save & Notify</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
