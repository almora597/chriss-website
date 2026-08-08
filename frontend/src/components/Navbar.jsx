import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { List, X, Phone } from "@phosphor-icons/react";

const PHONE = "(770) 555-0142";

export const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Services", href: "/#services" },
    { label: "Why Rosas", href: "/#why" },
    { label: "Vehicles", href: "/#vehicles" },
    { label: "Contact", href: "/#contact" },
  ];

  return (
    <header
      data-testid="navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-200 ${
        scrolled ? "bg-white/85 backdrop-blur-md border-b border-border" : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link to="/" data-testid="logo-link" className="font-heading font-extrabold text-xl tracking-tight">
          <span className={scrolled ? "text-foreground" : "text-white"}>ROSAS</span>
          <span className="text-primary"> AUTO WORKS</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              data-testid={`nav-${l.label.toLowerCase().replace(" ", "-")}`}
              className={`text-xs font-bold uppercase tracking-[0.15em] transition-colors hover:text-primary ${
                scrolled ? "text-foreground" : "text-white/90"
              }`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <a
            href={`tel:${PHONE.replace(/[^0-9]/g, "")}`}
            data-testid="nav-call-btn"
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors hover:text-primary ${
              scrolled ? "text-foreground" : "text-white"
            }`}
          >
            <Phone weight="bold" size={16} /> {PHONE}
          </a>
          <button
            data-testid="nav-book-btn"
            onClick={() => navigate("/book")}
            className="bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest rounded-sm transition-transform hover:-translate-y-0.5"
          >
            Book Now
          </button>
        </div>

        <button
          className="md:hidden"
          data-testid="mobile-menu-toggle"
          onClick={() => setOpen(!open)}
        >
          {open ? (
            <X size={26} className={scrolled ? "text-foreground" : "text-white"} />
          ) : (
            <List size={26} className={scrolled ? "text-foreground" : "text-white"} />
          )}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-b border-border px-5 py-4 flex flex-col gap-4">
          {links.map((l) => (
            <a key={l.label} href={l.href} onClick={() => setOpen(false)}
              className="text-sm font-bold uppercase tracking-widest text-foreground">
              {l.label}
            </a>
          ))}
          <a href={`tel:${PHONE.replace(/[^0-9]/g, "")}`} className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
            <Phone weight="bold" size={16} /> {PHONE}
          </a>
        </div>
      )}
    </header>
  );
};
