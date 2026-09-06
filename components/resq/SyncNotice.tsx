import { CheckCircle2, Loader2, RefreshCw, Wifi, X } from "lucide-react";
import { useResq } from "@/lib/resq-store";

/** Small non-blocking notice shown when connectivity returns with queued SOS packets. */
export function SyncNotice({ inline }: { inline?: boolean }) {
  const { syncNotice, pendingCount, syncNow, dismissSyncNotice } = useResq();
  if (!syncNotice) return null;

  const wrapper = inline
    ? "mt-4"
    : "pointer-events-none fixed inset-x-0 top-[4.5rem] z-30 px-4";

  return (
    <div className={wrapper} role="status" aria-live="polite">
      <div className="pointer-events-auto mx-auto w-full max-w-md rounded-xl border border-safe-border bg-card p-3 shadow-action">
        {syncNotice === "ready" && (
          <div className="flex items-start gap-3">
            <Wifi className="mt-0.5 h-6 w-6 shrink-0 text-safe" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-wide">Connectivity restored.</p>
              <p className="text-sm text-muted-foreground">
                {pendingCount} emergency packet{pendingCount === 1 ? " is" : "s are"} ready to synchronize.
              </p>
              <button
                type="button"
                onClick={syncNow}
                className="tap-target mt-2 flex items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                SYNC NOW
              </button>
            </div>
            <button
              type="button"
              onClick={dismissSyncNotice}
              aria-label="Dismiss"
              className="tap-target grid shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
        {syncNotice === "syncing" && (
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden />
            <p className="text-sm font-extrabold tracking-wide">SYNCING EMERGENCY PACKET…</p>
          </div>
        )}
        {syncNotice === "done" && (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-safe" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold tracking-wide">SOS SYNCHRONIZED</p>
              <p className="text-sm text-muted-foreground">Prototype synchronization only.</p>
            </div>
            <button
              type="button"
              onClick={dismissSyncNotice}
              aria-label="Dismiss"
              className="tap-target grid shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
