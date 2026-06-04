import { cn } from "@/lib/utils";
import type { Player } from "@/lib/mock-data";

export function PlayerAvatar({
  player,
  size = "md",
  className,
}: {
  player: Pick<Player, "initials" | "color" | "nickname">;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-14 text-lg",
  };
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-display font-medium tracking-wide text-background ring-1 ring-inset ring-black/20",
        sizes[size],
        className,
      )}
      style={{ backgroundColor: player.color }}
      title={player.nickname}
    >
      {player.initials}
    </div>
  );
}
