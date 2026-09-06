import { Link } from "@tanstack/react-router";
import { Construction, Home, type LucideIcon } from "lucide-react";

export function ComingSoon({ title, icon: Icon = Construction }: { title: string; icon?: LucideIcon }) {
  return (
    <section className="resq-card flex flex-col items-center gap-4 px-6 py-10 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-full bg-navy-soft text-primary">
        <Icon className="h-8 w-8" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold tracking-wide">{title}</h1>
      <p className="text-base text-muted-foreground">Coming in the next build phase.</p>
      <Link
        to="/"
        className="tap-target mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
      >
        <Home className="h-5 w-5" aria-hidden />
        BACK TO HOME
      </Link>
    </section>
  );
}
