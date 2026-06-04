import { cn } from "@/lib/utils";

export function Logo({ className, showWord = true }: { className?: string; showWord?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 40 40"
        className="size-8 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <circle cx="20" cy="20" r="18" stroke="var(--lime)" strokeWidth="2.5" />
        <path
          d="M20 6 L25 14 L33 14 L26 20 L29 28 L20 24 L11 28 L14 20 L7 14 L15 14 Z"
          fill="var(--lime)"
          opacity="0.95"
        />
        <circle cx="20" cy="20" r="2" fill="var(--background)" />
      </svg>
      {showWord && (
        <span className="font-display text-2xl leading-none tracking-wide">
          F Y P<span className="text-lime"> FC</span>
        </span>
      )}
    </div>
  );
}
