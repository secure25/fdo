"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Radar, Users, Map as MapIcon, Megaphone, FlaskConical, BarChart3,
  Swords, PenSquare, Sparkles, Package, Plug, CreditCard, Settings, LogOut, ChevronsUpDown, Plus,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";

export type ShellUser = { name: string; email: string; role: string };
export type ShellOrg = { id: string; name: string; slug: string };

const PRIMARY = [
  { href: "/app", label: "Overview", icon: LayoutDashboard },
  { href: "/app/opportunities", label: "Opportunities", icon: Radar },
  { href: "/app/customers", label: "Customers", icon: Users },
  { href: "/app/distribution", label: "Distribution", icon: MapIcon },
  { href: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/app/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/competitors", label: "Competitors", icon: Swords },
  { href: "/app/content", label: "Content", icon: PenSquare },
  { href: "/app/strategist", label: "AI Strategist", icon: Sparkles },
];

const SECONDARY = [
  { href: "/app/product", label: "Product", icon: Package },
  { href: "/app/integrations", label: "Integrations", icon: Plug },
  { href: "/app/billing", label: "Billing", icon: CreditCard },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  user,
  org,
  orgs,
  plan,
  children,
}: {
  user: ShellUser;
  org: ShellOrg;
  orgs: ShellOrg[];
  plan: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);

  const isActive = (href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  async function switchOrg(id: string) {
    await fetch("/api/integrations", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orgId: id }) });
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-paper flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-paper-line bg-paper-raise hidden lg:flex flex-col fixed inset-y-0 z-30">
        <div className="h-14 flex items-center px-4 border-b border-paper-line relative">
          <button onClick={() => { setOrgOpen(!orgOpen); setMenuOpen(false); }} className="flex items-center gap-2 w-full text-left group">
            <span className="w-6 h-6 rounded bg-ink inline-flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-sm bg-white" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold truncate">{org.name}</span>
              <span className="block text-2xs text-ink-faint">{plan} plan</span>
            </span>
            <ChevronsUpDown size={12} className="text-ink-faint group-hover:text-ink" />
          </button>
          {orgOpen ? (
            <div className="absolute top-12 left-3 right-3 bg-paper-raise shadow-popover rounded-md py-1 z-40 animate-fade-up">
              {orgs.map((o) => (
                <button key={o.id} onClick={() => { setOrgOpen(false); if (o.id !== org.id) switchOrg(o.id); }} className={cn("w-full text-left px-3 py-2 text-xs hover:bg-paper-sunken flex items-center justify-between", o.id === org.id && "font-semibold")}>
                  {o.name} {o.id === org.id ? <span className="text-good">✓</span> : null}
                </button>
              ))}
              <div className="border-t border-paper-line mt-1 pt-1">
                <Link href="/settings?new=org" onClick={() => setOrgOpen(false)} className="w-full text-left px-3 py-2 text-xs text-ink-mute hover:bg-paper-sunken flex items-center gap-2">
                  <Plus size={12} /> New workspace
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {PRIMARY.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] transition",
                isActive(item.href) ? "bg-paper-sunken text-ink font-medium" : "text-ink-mute hover:text-ink hover:bg-paper-sunken/60"
              )}
            >
              <item.icon size={15} strokeWidth={1.75} className={isActive(item.href) ? "text-ink" : "text-ink-faint"} />
              {item.label}
            </Link>
          ))}
          <div className="pt-3 mt-3 border-t border-paper-line">
            {SECONDARY.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 h-8 rounded-md text-[13px] transition",
                  isActive(item.href) ? "bg-paper-sunken text-ink font-medium" : "text-ink-mute hover:text-ink hover:bg-paper-sunken/60"
                )}
              >
                <item.icon size={15} strokeWidth={1.75} className={isActive(item.href) ? "text-ink" : "text-ink-faint"} />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="p-3 border-t border-paper-line relative">
          <button onClick={() => { setMenuOpen(!menuOpen); setOrgOpen(false); }} className="flex items-center gap-2.5 w-full text-left rounded-md px-1.5 py-1.5 hover:bg-paper-sunken transition">
            <span className="w-7 h-7 rounded-full bg-accent-soft text-accent text-2xs font-semibold inline-flex items-center justify-center">
              {initials(user.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium truncate">{user.name}</span>
              <span className="block text-2xs text-ink-faint truncate">{user.email}</span>
            </span>
          </button>
          {menuOpen ? (
            <div className="absolute bottom-14 left-3 right-3 bg-paper-raise shadow-popover rounded-md py-1 z-40 animate-fade-up">
              <div className="px-3 py-1.5 text-2xs text-ink-faint">{user.role}</div>
              <Link href="/app/settings" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-xs hover:bg-paper-sunken">Settings</Link>
              <button onClick={logout} className="w-full text-left px-3 py-2 text-xs text-bad hover:bg-bad-soft flex items-center gap-2">
                <LogOut size={12} /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 bg-paper-raise border-b border-paper-line z-40 flex items-center px-4 justify-between">
        <Link href="/app" className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-ink inline-flex items-center justify-center"><span className="w-2 h-2 rounded-sm bg-white" /></span>
          <span className="text-sm font-semibold">Distribution OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/app/strategist" className="text-ink-mute"><Sparkles size={16} /></Link>
          <button onClick={logout} className="text-ink-mute"><LogOut size={16} /></button>
        </div>
      </div>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 h-14 bg-paper-raise border-t border-paper-line z-40 flex items-center justify-around px-2">
        {PRIMARY.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className={cn("flex flex-col items-center gap-0.5 px-2", isActive(item.href) ? "text-ink" : "text-ink-faint")}>
            <item.icon size={17} strokeWidth={1.75} />
            <span className="text-[9px]">{item.label}</span>
          </Link>
        ))}
      </nav>

      {/* Main */}
      <main className="flex-1 lg:ml-56 pb-16 lg:pb-0 min-w-0">
        <div className="lg:h-14" />
        {children}
      </main>
    </div>
  );
}
