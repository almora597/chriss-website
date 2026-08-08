import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { House, CalendarPlus, Wrench, Phone } from "@phosphor-icons/react";

export const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const items = [
    { label: "Home", icon: House, action: () => navigate("/"), testid: "bottom-nav-home" },
    { label: "Services", icon: Wrench, action: () => { navigate("/"); setTimeout(() => { window.location.hash = "#services"; }, 50); }, testid: "bottom-nav-services" },
    { label: "Book", icon: CalendarPlus, action: () => navigate("/book"), testid: "bottom-nav-book", primary: true },
    { label: "Contact", icon: Phone, action: () => { navigate("/"); setTimeout(() => { window.location.hash = "#contact"; }, 50); }, testid: "bottom-nav-contact" },
  ];

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/90 backdrop-blur-md border-t border-border"
    >
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.label === "Book" && location.pathname === "/book";
          return (
            <button
              key={it.label}
              data-testid={it.testid}
              onClick={it.action}
              className={`flex flex-col items-center gap-1 py-2.5 transition-colors ${
                it.primary ? "text-primary" : active ? "text-primary" : "text-foreground/70"
              }`}
            >
              <Icon weight={it.primary ? "fill" : "regular"} size={22} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
