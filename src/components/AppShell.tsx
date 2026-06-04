import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Award, Home, CalendarDays, Trophy, User, Users, Settings2, Lock, Unlock } from "lucide-react";
import { Logo } from "./Logo";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/match-store";
import { toast } from "sonner";

const tabs = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/partidos", label: "Partidos", icon: CalendarDays },
  { to: "/organizador", label: "Organizar", icon: Settings2 },
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
  const { isAdmin, adminRole, logoutAdmin, matches } = useStore();
  const votingMatch = matches.find((match) => match.dbEstado === "jugado");

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
          
          <div className="flex items-center gap-3">
            {votingMatch && (
              <Link
                to="/partidos/$id"
                params={{ id: votingMatch.id }}
                className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/20 transition"
              >
                <Award className="size-3.5" /> Votar
              </Link>
            )}
            {isAdmin && adminRole ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-lime/30 bg-lime/10 px-2.5 py-1 text-xs font-semibold text-lime shadow-glow">
                  <Unlock className="size-3" /> {adminRole === "general" ? "Admin" : "Equipos"}
                </span>
                <button
                  onClick={() => {
                    logoutAdmin();
                    toast.info("Sesión de administrador cerrada.");
                  }}
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <Link
                to="/organizador"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              >
                <Lock className="size-3" /> Admin Login
              </Link>
            )}
            <Link
              to="/organizador"
              className="inline-flex items-center gap-2 rounded-md bg-lime px-4 py-2 text-sm font-semibold text-lime-foreground hover:brightness-110 transition animate-pulse-subtle"
            >
              <Settings2 className="size-4" /> Organizar partido
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile topbar */}
      <header className="md:hidden sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            {votingMatch && (
              <Link
                to="/partidos/$id"
                params={{ id: votingMatch.id }}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-semibold text-gold"
              >
                <Award className="size-3.5" /> Votar
              </Link>
            )}
            <Link
              to="/jugadores"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground"
            >
              <Users className="size-3.5" /> Plantel
            </Link>
            {isAdmin && adminRole ? (
              <button
                onClick={() => {
                  logoutAdmin();
                  toast.info("Sesión de administrador cerrada.");
                }}
                className="inline-flex items-center justify-center rounded-md border border-lime/30 bg-lime/10 p-1.5 text-lime shadow-glow transition cursor-pointer"
                title="Cerrar sesión de admin"
              >
                <Unlock className="size-4" />
              </button>
            ) : (
              <Link
                to="/organizador"
                className="inline-flex items-center justify-center rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground transition"
                title="Login administrador"
              >
                <Lock className="size-4" />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-24 md:pb-12">
        <Outlet />
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur">
        <ul className="grid grid-cols-5">
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
