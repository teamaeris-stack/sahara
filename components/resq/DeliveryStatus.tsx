import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, Circle, Loader2, Siren } from "lucide-react";
import { Fragment } from "react";
import { useLang } from "@/lib/i18n";
import { formatTime, useResq } from "@/lib/resq-store";
import { flagLabel, peopleRangeLabel, typeLabel, type SOSPacket } from "@/lib/sos";
import { answerLabel, questionLabel, subTypeLabel } from "@/lib/sos-flows";
import { DeliveryBadge, PrototypeFooter } from "./DeliveryBadge";
import { SyncNotice } from "./SyncNotice";

export function DeliveryStatus({ id }: { id?: string | undefined }) {
  const { packets, hydrated, networkStatus, pendingCount, latestPacket } = useResq();
  const { lang } = useLang();
  const packet = (id ? packets.find((p) => p.id === id) : undefined) ?? latestPacket;

  if (!hydrated) return null;

  if (!packet) {
    return (
      <section className="resq-card flex flex-col items-center gap-4 px-6 py-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-muted text-primary">
          <Siren className="h-8 w-8" aria-hidden />
        </span>
        <h1 className="text-2xl font-extrabold tracking-wide">NO SOS PACKETS</h1>
        <p className="text-base text-muted-foreground">
          No emergency request has been created on this device.
        </p>
        <Link
          to="/"
          className="tap-target mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          BACK TO HOME
        </Link>
      </section>
    );
  }

  const status = packet.deliveryStatus;
  const steps: { label: string; state: "done" | "active" | "todo" }[] =
    status === "DELIVERED_DEMO"
      ? [
          { label: "Emergency created", state: "done" },
          { label: "Location attached", state: "done" },
          { label: "Saved on device", state: "done" },
          { label: "Synchronized", state: "done" },
          { label: "Demo delivery complete", state: "done" },
        ]
      : status === "SYNCING"
        ? [
            { label: "Emergency created", state: "done" },
            { label: "Location attached", state: "done" },
            { label: "Saved on device", state: "done" },
            { label: "Synchronizing…", state: "active" },
            { label: "Demo delivery not yet confirmed", state: "todo" },
          ]
        : [
            { label: "Emergency created", state: "done" },
            { label: "Location attached", state: "done" },
            { label: "Saved on device", state: "done" },
            { label: "Waiting for delivery path", state: "active" },
            { label: "Responder delivery not yet confirmed", state: "todo" },
          ];

  const previous = [...packets].reverse().filter((p) => p.id !== packet.id);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-xs font-extrabold tracking-widest text-muted-foreground">SOS PACKET</p>
        <h1 className="text-2xl font-extrabold tracking-tight">{packet.id}</h1>
        <p className="mt-1 text-base font-bold">
          {typeLabel(packet.type, lang)} ·{" "}
          {peopleRangeLabel(packet.peopleRange, packet.peopleCount)}{" "}
          {packet.peopleRange || packet.peopleCount !== 1 ? "people" : "person"}
        </p>
        <div className="mt-2">
          <DeliveryBadge status={status} large />
        </div>
      </header>

      <SyncNotice inline />

      <section className="resq-card p-4" aria-label="Delivery timeline">
        <ol className="flex flex-col">
          {steps.map((s, i) => (
            <li key={s.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 ${
                    s.state === "done"
                      ? "border-safe bg-safe text-safe-foreground"
                      : s.state === "active"
                        ? "border-warning bg-warning text-warning-foreground"
                        : "border-input bg-card text-muted-foreground"
                  }`}
                  aria-hidden
                >
                  {s.state === "done" ? (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  ) : s.state === "active" ? (
                    status === "SYNCING" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="h-3 w-3 rounded-full bg-current" />
                    )
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </span>
                {i < steps.length - 1 && (
                  <span
                    className={`w-0.5 flex-1 ${s.state === "done" ? "bg-safe" : "bg-border"}`}
                  />
                )}
              </div>
              <p
                className={`pb-5 pt-1 text-base ${s.state === "todo" ? "text-muted-foreground" : "font-bold"}`}
              >
                <span className="sr-only">
                  {s.state === "done"
                    ? "Done: "
                    : s.state === "active"
                      ? "In progress: "
                      : "Pending: "}
                </span>
                {s.label}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="resq-card p-4">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2 text-base">
          <dt className="text-muted-foreground">Priority:</dt>
          <dd className="font-extrabold text-emergency">P0 CRITICAL</dd>
          <dt className="text-muted-foreground">Network:</dt>
          <dd className="font-extrabold">{networkStatus}</dd>
          <dt className="text-muted-foreground">Hop Count:</dt>
          <dd className="font-extrabold tabular-nums">{packet.hopCount}</dd>
          <dt className="text-muted-foreground">Created:</dt>
          <dd className="font-extrabold">{formatTime(packet.createdAt)}</dd>
          <dt className="text-muted-foreground">Location:</dt>
          <dd className="font-bold">
            {packet.locationLabel}
            <span className="block text-sm font-normal tabular-nums text-muted-foreground">
              {packet.latitude.toFixed(4)}, {packet.longitude.toFixed(4)}
            </span>
          </dd>
          {packet.subType && (
            <>
              <dt className="text-muted-foreground">Situation:</dt>
              <dd className="font-bold">{subTypeLabel(packet.type, packet.subType, lang)}</dd>
            </>
          )}
          {packet.responses &&
            Object.entries(packet.responses).map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-muted-foreground">{questionLabel(packet.type, k, lang)}:</dt>
                <dd className="font-bold">{answerLabel(packet.type, k, v, lang)}</dd>
              </Fragment>
            ))}
          {packet.flags.length > 0 && (
            <>
              <dt className="text-muted-foreground">Flags:</dt>
              <dd className="font-bold">
                {packet.flags.map((f) => flagLabel(f, lang)).join(", ")}
              </dd>
            </>
          )}
          {packet.description && (
            <>
              <dt className="text-muted-foreground">Details:</dt>
              <dd className="break-words">{packet.description}</dd>
            </>
          )}
        </dl>
      </section>

      <section
        className={`resq-card p-4 ${pendingCount ? "border-warning-border bg-warning-soft" : ""}`}
      >
        <h2 className="text-xs font-extrabold tracking-widest text-muted-foreground">
          OFFLINE QUEUE
        </h2>
        <p className="mt-1 text-lg font-extrabold">
          {pendingCount === 0
            ? "No emergency packets waiting"
            : `${pendingCount} emergency packet${pendingCount === 1 ? "" : "s"} waiting`}
        </p>
      </section>

      {previous.length > 0 && (
        <section className="resq-card p-4">
          <h2 className="text-xs font-extrabold tracking-widest text-muted-foreground">
            PREVIOUS REPORTS
          </h2>
          <ul className="mt-2 divide-y">
            {previous.map((p) => (
              <li key={p.id}>
                <Link
                  to="/sos-status"
                  search={{ id: p.id }}
                  className="tap-target flex items-center justify-between gap-3 py-3 hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{p.id}</span>
                    <span className="block text-xs text-muted-foreground">
                      {typeLabel(p.type, lang)} · {formatTime(p.createdAt)}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-extrabold tracking-wide">
                    {shortStatus(p)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Your emergency packet remains stored until delivery status changes.
      </p>

      <Link
        to="/"
        className="tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-extrabold tracking-wide text-primary-foreground hover:bg-primary/90"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        BACK TO HOME
      </Link>
      <PrototypeFooter />
    </div>
  );
}

function shortStatus(p: SOSPacket) {
  return { QUEUED_OFFLINE: "Waiting", SYNCING: "Syncing", DELIVERED_DEMO: "Delivered" }[
    p.deliveryStatus
  ];
}
