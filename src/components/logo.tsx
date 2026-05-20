import { GraduationCap } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-primary shadow-glow">
        <GraduationCap className="h-5 w-5 text-primary-foreground" />
      </div>
      <div className="leading-tight">
        <div className="text-base font-bold tracking-tight">Scholar OS</div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Study companion</div>
      </div>
    </div>
  );
}
