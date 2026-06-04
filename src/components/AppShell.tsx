import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Home, CalendarDays, Trophy, User, Users, Settings2 } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/partidos", label: "Partidos", icon: CalendarDays },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/perfil", label: "Perfil", icon: User },
] as const;

const desktopNav = [
  { to: "/", label: "Inicio" },
  { to: "/partidos", label: "Partidos" },
  { to: "/jugadores", label: "Jugadores" },
  { to: "/ranking", label: "Ranking" },
  { to: "/organizador", label: "Organizador" },
] as const;

export function AppShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Desktop topbar */}
      <header className="hidden md:flex sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1">
            {desktopNav.map((item) => {
              const active =
                item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "text-foreground bg-secondary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            to="/organizador"
            className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground hover:brightness-110 transition"
          >
            <Settings2 className="size-4" /> Organizar picado
          </Link>
        </div>
      </header>

      {/* Mobile topbar */}
      <header className="md:hidden sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/"><Logo /></Link>
          <Link
            to="/jugadores"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
          >
            <Users className="size-3.5" /> Plantel
          </Link>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-12">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur">
        <ul className="grid grid-cols-4">
          {tabs.map((tab) => {
            const active =
              tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <li key={tab.to}>
                <Link
                  to={tab.to}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium uppercase tracking-wider transition-colors",
                    active ? "text-lime" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("size-5", active && "drop-shadow-[0_0_8px_var(--lime)]")} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
