import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gauge, Wrench, Drop, Engine, GearSix, Snowflake, Lightning, Truck,
  ArrowRight, Phone, CheckCircle, ShieldCheck, Clock, MapPin,
} from "@phosphor-icons/react";
import { Navbar } from "@/components/Navbar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { Footer } from "@/components/Footer";
import api from "@/lib/api";

const HERO_IMG = "https://images.unsplash.com/photo-1758767355046-1986dda2d967?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzl8MHwxfHNlYXJjaHwyfHxhdXRvJTIwcmVwYWlyJTIwc2hvcCUyMG1lY2hhbmljJTIwd29ya2luZyUyMG9uJTIwZW5naW5lfGVufDB8fHx8MTc4NjE1MjA1OHww&ixlib=rb-4.1.0&q=85";
const DIAG_IMG = "https://images.unsplash.com/photo-1727893380169-4dda123e19f7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NTYxODF8MHwxfHNlYXJjaHwxfHxjYXIlMjBkaWFnbm9zdGljJTIwdG9vbCUyMHNjcmVlbnxlbnwwfHx8fDE3ODYxNTIwNTh8MA&ixlib=rb-4.1.0&q=85";
const SHOP_IMG = "https://images.unsplash.com/photo-1619335680796-54f13b88c6ba?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1NzZ8MHwxfHNlYXJjaHw0fHxjbGVhbiUyMG1vZGVybiUyMGdhcmFnZSUyMGF1dG8lMjByZXBhaXJ8ZW58MHx8fHwxNzg2MTUyMDU4fDA&ixlib=rb-4.1.0&q=85";

const SERVICE_ICONS = {
  diagnostics: Gauge, "oil-service": Drop, brakes: Wrench, "engine-repair": Engine,
  transmission: GearSix, diesel: Snowflake, performance: Lightning, fleet: Truck,
};

const VEHICLES = [
  { name: "European", note: "BMW · Mercedes · Audi · VW" },
  { name: "Asian", note: "Toyota · Honda · Nissan · Kia" },
  { name: "Domestic", note: "Ford · Chevy · Dodge · GMC" },
  { name: "Diesel", note: "Powerstroke · Cummins · Duramax" },
  { name: "Performance", note: "Tuning · Upgrades · Track" },
  { name: "Fleet", note: "Vans · Trucks · Company cars" },
];

const WHY = [
  { icon: Gauge, title: "Diagnostic-First", desc: "We pinpoint the real problem with computer diagnostics before touching a wrench — no guessing, no unnecessary parts." },
  { icon: ShieldCheck, title: "All Makes, One Shop", desc: "European, Asian, Domestic, Diesel & Performance — dealer-level expertise without the dealer price." },
  { icon: CheckCircle, title: "Honest Estimates", desc: "Transparent pricing and clear explanations before any work is approved. Your deposit goes toward the job." },
  { icon: Clock, title: "Fast Turnaround", desc: "Book online in under two minutes and get back on the road quicker with efficient, quality service." },
];

export default function Home() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);

  useEffect(() => {
    api.get("/services").then(({ data }) => setServices(data)).catch(() => {});
  }, []);

  return (
    <div className="bg-background" data-testid="home-page">
      <Navbar />

      {/* HERO */}
      <section className="relative min-h-[92vh] flex items-center">
        <img src={HERO_IMG} alt="Mechanic working on engine" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/30" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8 w-full pt-24">
          <div className="max-w-2xl animate-fade-up">
            <span className="inline-block text-primary text-xs font-bold uppercase tracking-[0.3em] mb-5">
              Lithia Springs, GA
            </span>
            <h1 className="text-white font-heading font-black uppercase text-5xl sm:text-6xl lg:text-7xl leading-[0.95] tracking-tighter">
              One Shop.<br />All Makes.<br /><span className="text-primary">Real Results.</span>
            </h1>
            <p className="text-white/80 text-base sm:text-lg mt-6 max-w-lg leading-relaxed">
              Diagnostic-first auto repair for European, Asian, Domestic, Diesel & Performance vehicles. We find the real problem before we fix it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mt-9">
              <button
                data-testid="hero-book-btn"
                onClick={() => navigate("/book")}
                className="group bg-primary text-primary-foreground px-8 py-4 text-sm font-bold uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 transition-transform hover:-translate-y-0.5"
              >
                Book an Appointment
                <ArrowRight weight="bold" size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
              <a
                href="tel:4703909940"
                data-testid="hero-call-btn"
                className="border border-white/40 text-white px-8 py-4 text-sm font-bold uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 transition-colors hover:bg-white hover:text-black"
              >
                <Phone weight="bold" size={18} /> Call Now
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-20 sm:py-24 max-w-7xl mx-auto px-5 sm:px-8 scroll-mt-20">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">What We Do</span>
          <h2 className="font-heading font-bold uppercase text-3xl sm:text-4xl tracking-tight mt-3">Services Built Around Your Vehicle</h2>
          <p className="text-muted-foreground mt-4">From routine maintenance to complex diagnostics, we handle it all under one roof.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border mt-10">
          {services.map((s, i) => {
            const Icon = SERVICE_ICONS[s.id] || Wrench;
            return (
              <button
                key={s.id}
                data-testid={`service-card-${s.id}`}
                onClick={() => navigate(`/book?service=${s.id}`)}
                className="group text-left bg-background p-7 transition-colors hover:bg-secondary hover:text-white"
              >
                <Icon weight="bold" size={32} className="text-primary" />
                <h3 className="font-heading font-bold text-lg mt-5 uppercase tracking-tight">{s.name}</h3>
                <p className="text-sm mt-2 text-muted-foreground group-hover:text-white/70 leading-relaxed">{s.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest mt-4 text-primary">
                  Book <ArrowRight weight="bold" size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* WHY ROSAS (dark) */}
      <section id="why" className="bg-secondary text-white py-20 sm:py-24 scroll-mt-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Why Rosas</span>
            <h2 className="font-heading font-bold uppercase text-3xl sm:text-4xl tracking-tight mt-3">We Diagnose First. Then We Fix.</h2>
            <p className="text-white/70 mt-4 leading-relaxed">Too many shops guess and swap parts. We use professional diagnostics to find the real issue — saving you time and money.</p>
            <div className="grid sm:grid-cols-2 gap-px bg-white/10 border border-white/10 mt-8">
              {WHY.map((w) => {
                const Icon = w.icon;
                return (
                  <div key={w.title} className="bg-secondary p-6" data-testid={`why-${w.title.toLowerCase().replace(/[^a-z]/g, "")}`}>
                    <Icon weight="bold" size={26} className="text-primary" />
                    <h3 className="font-heading font-bold text-base mt-4 uppercase">{w.title}</h3>
                    <p className="text-sm text-white/60 mt-2 leading-relaxed">{w.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="relative">
            <img src={DIAG_IMG} alt="Diagnostic computer" className="w-full h-[460px] object-cover border border-white/10" />
            <div className="absolute -bottom-5 -left-2 sm:left-5 bg-primary text-primary-foreground px-6 py-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.9)]">
              <p className="font-heading font-black text-3xl leading-none">100%</p>
              <p className="text-xs font-bold uppercase tracking-widest mt-1">Diagnostic Accuracy Focus</p>
            </div>
          </div>
        </div>
      </section>

      {/* VEHICLES */}
      <section id="vehicles" className="py-20 sm:py-24 max-w-7xl mx-auto px-5 sm:px-8 scroll-mt-20">
        <div className="max-w-2xl">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Every Kind Of Vehicle</span>
          <h2 className="font-heading font-bold uppercase text-3xl sm:text-4xl tracking-tight mt-3">If It Drives, We Service It</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-border border border-border mt-10">
          {VEHICLES.map((v) => (
            <div key={v.name} data-testid={`vehicle-${v.name.toLowerCase()}`} className="bg-background p-7 transition-colors hover:bg-muted">
              <h3 className="font-heading font-bold text-xl uppercase tracking-tight">{v.name}</h3>
              <p className="text-sm text-muted-foreground mt-2">{v.note}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CONTACT / CTA */}
      <section id="contact" className="scroll-mt-16">
        <div className="relative">
          <img src={SHOP_IMG} alt="Shop exterior" className="w-full h-[420px] object-cover" />
          <div className="absolute inset-0 bg-black/70" />
          <div className="absolute inset-0 flex items-center">
            <div className="max-w-7xl mx-auto px-5 sm:px-8 w-full">
              <div className="max-w-xl">
                <h2 className="font-heading font-black uppercase text-4xl sm:text-5xl tracking-tighter text-white leading-none">Ready When You Are</h2>
                <p className="text-white/80 mt-4">Book online in minutes or give us a call. A $100 deposit secures your slot and goes straight toward your service.</p>
                <div className="flex flex-col sm:flex-row gap-4 mt-8">
                  <button data-testid="contact-book-btn" onClick={() => navigate("/book")} className="bg-primary text-primary-foreground px-8 py-4 text-sm font-bold uppercase tracking-widest rounded-sm transition-transform hover:-translate-y-0.5">Book an Appointment</button>
                  <a href="tel:4703909940" className="border border-white/40 text-white px-8 py-4 text-sm font-bold uppercase tracking-widest rounded-sm flex items-center justify-center gap-2 transition-colors hover:bg-white hover:text-black"><Phone weight="bold" size={18} /> (470) 390-9940</a>
                </div>
                <div className="flex items-center gap-2 text-white/70 mt-6 text-sm"><MapPin weight="bold" size={18} className="text-primary" /> Lithia Springs, GA 30122</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <MobileBottomNav />
    </div>
  );
}
