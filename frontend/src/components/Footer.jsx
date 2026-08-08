import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Phone, Clock } from "@phosphor-icons/react";

export const Footer = () => (
  <footer className="bg-secondary text-white pt-16 pb-24 md:pb-16" data-testid="footer">
    <div className="max-w-7xl mx-auto px-5 sm:px-8 grid gap-10 md:grid-cols-4">
      <div className="md:col-span-2">
        <p className="font-heading font-extrabold text-2xl tracking-tight">
          ROSAS <span className="text-primary">AUTO WORKS</span>
        </p>
        <p className="mt-3 text-white/60 max-w-sm text-sm leading-relaxed">
          One shop. All makes. Real results. Diagnostic-first auto repair for European, Asian, Domestic, Diesel, Performance & Fleet vehicles in Lithia Springs, GA.
        </p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Visit</p>
        <p className="flex items-start gap-2 text-sm text-white/80"><MapPin weight="bold" size={18} className="text-primary mt-0.5" /> Lithia Springs, GA 30122</p>
        <p className="flex items-center gap-2 text-sm text-white/80 mt-3"><Phone weight="bold" size={18} className="text-primary" /> (770) 555-0142</p>
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/50 mb-4">Hours</p>
        <p className="flex items-start gap-2 text-sm text-white/80"><Clock weight="bold" size={18} className="text-primary mt-0.5" /> Mon–Fri 8am–5pm<br />Sat 8am–6pm<br />Sun Closed</p>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-5 sm:px-8 mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-xs text-white/40">
      <p>© {new Date().getFullYear()} Rosas Auto Works. All rights reserved.</p>
      <Link to="/admin/login" data-testid="footer-admin-link" className="hover:text-white transition-colors uppercase tracking-widest">Staff Login</Link>
    </div>
  </footer>
);
