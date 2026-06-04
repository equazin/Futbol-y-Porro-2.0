import { useEffect, useState } from "react";

function diff(target: string) {
  const ms = new Date(target).getTime() - Date.now();
  const clamped = Math.max(0, ms);
  const h = Math.floor(clamped / 3600000);
  const m = Math.floor((clamped % 3600000) / 60000);
  const s = Math.floor((clamped % 60000) / 1000);
  return { h, m, s, done: clamped === 0 };
}

export function Countdown({ to, label = "Cierra en" }: { to: string; label?: string }) {
  const [t, setT] = useState(() => diff(to));
  useEffect(() => {
    const id = setInterval(() => setT(diff(to)), 1000);
    return () => clearInterval(id);
  }, [to]);

  if (t.done) {
    return <div className="text-sm font-semibold text-out">Inscripción cerrada</div>;
  }

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-end gap-1 font-display text-4xl tabular-nums leading-none">
        <Slot v={t.h} unit="h" />
        <span className="text-muted-foreground/40 pb-1">:</span>
        <Slot v={t.m} unit="m" />
        <span className="text-muted-foreground/40 pb-1">:</span>
        <Slot v={t.s} unit="s" />
      </div>
    </div>
  );
}

function Slot({ v, unit }: { v: number; unit: string }) {
  return (
    <span className="flex items-end gap-0.5">
      <span>{String(v).padStart(2, "0")}</span>
      <span className="text-xs text-muted-foreground pb-1">{unit}</span>
    </span>
  );
}
