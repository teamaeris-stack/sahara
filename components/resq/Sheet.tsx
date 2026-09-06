import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Bottom sheet on phones, centered dialog on larger screens. */
export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-navy/60 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border bg-card shadow-action outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b bg-card p-5">
            <div className="min-w-0">
              <Dialog.Title className="text-xl font-extrabold tracking-tight">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-base text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label="Close"
              className="tap-target grid shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-6 w-6" aria-hidden />
            </Dialog.Close>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-8"
            style={{ WebkitOverflowScrolling: "touch", scrollbarGutter: "stable" }}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SheetButton({
  children,
  onClick,
  variant = "primary",
  autoFocus,
}: {
  children: ReactNode;
  onClick: () => void;
  variant?: "primary" | "safe" | "outline";
  autoFocus?: boolean;
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    safe: "bg-safe text-safe-foreground hover:bg-safe/90",
    outline: "border-2 border-input bg-card text-foreground hover:bg-muted",
  }[variant];
  return (
    <button
      type="button"
      onClick={onClick}
      autoFocus={autoFocus}
      className={`tap-target w-full rounded-xl px-4 py-4 text-base font-extrabold tracking-wide ${styles}`}
    >
      {children}
    </button>
  );
}
