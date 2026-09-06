import { useEffect, useMemo, useState } from "react";
import { Radio, Router, Smartphone, WifiOff } from "lucide-react";
import { SaharaRelay, relayAvailable } from "@/lib/sahara-relay";

type ReceivedPacket = {
  id?: string;
  type?: string;
  emergency?: string;
  peopleCount?: number;
  people?: number;
  description?: string;
  message?: string;
  createdAt?: string;
  time?: string;
  source?: string;
};

export function RelayPanel() {
  const [status, setStatus] = useState("Relay ready");
  const [connectedCount, setConnectedCount] = useState(0);
  const [receivedRaw, setReceivedRaw] = useState("");

  const received = useMemo<ReceivedPacket | null>(() => {
    if (!receivedRaw) return null;
    try {
      return JSON.parse(receivedRaw) as ReceivedPacket;
    } catch {
      return { message: receivedRaw };
    }
  }, [receivedRaw]);

  useEffect(() => {
    if (!relayAvailable()) {
      setStatus("Relay controls are available in the Android app");
      return;
    }

    let connectionListener: { remove: () => Promise<void> } | undefined;
    let packetListener: { remove: () => Promise<void> } | undefined;
    let statusListener: { remove: () => Promise<void> } | undefined;
    let cancelled = false;

    void (async () => {
      try {
        connectionListener = await SaharaRelay.addListener("relayConnectionChanged", (event) => {
          setConnectedCount(event.connectedCount ?? 0);
          setStatus(event.connected ? "RELAY CONNECTED" : "RELAY DISCONNECTED");
        });
        packetListener = await SaharaRelay.addListener("relayPacketReceived", (event) => {
          setReceivedRaw(event.packet ?? "");
          setStatus("EMERGENCY RECEIVED");
        });
        statusListener = await SaharaRelay.addListener("relayStatusChanged", (event) => {
          if (event.status) setStatus(event.status.replaceAll("_", " "));
        });
        const nativeStatus = await SaharaRelay.getStatus();
        if (!cancelled) setConnectedCount(nativeStatus.connectedCount ?? 0);
      } catch {
        if (!cancelled) setStatus("Relay unavailable");
      }
    })();

    return () => {
      cancelled = true;
      void connectionListener?.remove();
      void packetListener?.remove();
      void statusListener?.remove();
    };
  }, []);

  const ensurePermissions = async () => {
    const permission = await SaharaRelay.requestRelayPermissions();
    if (!permission.granted) {
      setStatus("Permissions denied");
      return false;
    }
    return true;
  };

  const startGateway = async () => {
    try {
      if (!(await ensurePermissions())) return;
      await SaharaRelay.startGateway();
      setStatus("GATEWAY ACTIVE");
    } catch (error) {
      setStatus(`Gateway failed: ${String(error)}`);
    }
  };

  const startNode = async () => {
    try {
      if (!(await ensurePermissions())) return;
      await SaharaRelay.startOfflineNode();
      setStatus("SEARCHING FOR GATEWAY");
    } catch (error) {
      setStatus(`Node failed: ${String(error)}`);
    }
  };

  return (
    <section className="resq-card border-primary/30 bg-card p-4" aria-label="Sahara emergency relay">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Radio className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold tracking-wide">SAHARA EMERGENCY RELAY</p>
          <p className="text-sm text-muted-foreground">
            Offline phones can pass SOS packets to a nearby connected gateway.
          </p>
        </div>
      </div>

      <div className="mt-3 rounded-xl border bg-muted/40 px-3 py-2">
        <p className="text-sm font-bold">{status}</p>
        <p className="text-xs text-muted-foreground">Connected devices: {connectedCount}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={startGateway}
          className="tap-target flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground"
        >
          <Router className="h-5 w-5" aria-hidden />
          GATEWAY
        </button>
        <button
          type="button"
          onClick={startNode}
          className="tap-target flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-input bg-card px-3 text-sm font-extrabold"
        >
          <WifiOff className="h-5 w-5" aria-hidden />
          OFFLINE RELAY
        </button>
      </div>

      {received && (
        <div className="mt-3 rounded-xl border border-emergency-border bg-emergency-soft p-3">
          <div className="flex items-center gap-2 text-emergency">
            <Smartphone className="h-5 w-5" aria-hidden />
            <p className="font-extrabold">EMERGENCY RECEIVED</p>
          </div>
          <div className="mt-2 space-y-1 text-sm">
            {(received.type || received.emergency) && (
              <p><span className="font-bold">Type:</span> {received.type ?? received.emergency}</p>
            )}
            {(received.peopleCount ?? received.people) !== undefined && (
              <p><span className="font-bold">People:</span> {received.peopleCount ?? received.people}</p>
            )}
            {(received.description || received.message) && (
              <p><span className="font-bold">Details:</span> {received.description ?? received.message}</p>
            )}
            {received.id && <p className="break-all text-xs text-muted-foreground">{received.id}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
