import { Capacitor, registerPlugin } from "@capacitor/core";

type RelayPermissionResult = { granted: boolean; sdk?: number };
type RelayConnectionEvent = {
  endpointId?: string;
  connected?: boolean;
  connectedCount?: number;
};
type RelayPacketEvent = { endpointId?: string; packet?: string };

interface SaharaRelayNativePlugin {
  getStatus(): Promise<{ native: boolean; relayReady: boolean; connectedCount: number; message?: string }>;
  requestRelayPermissions(): Promise<RelayPermissionResult>;
  startGateway(): Promise<{ advertising: boolean; mode: string }>;
  startOfflineNode(): Promise<{ discovering: boolean; mode: string }>;
  sendPacket(options: { packet: string }): Promise<{ sent: boolean; endpointId?: string }>;
  addListener(
    eventName: "relayConnectionChanged",
    listener: (event: RelayConnectionEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "relayPacketReceived",
    listener: (event: RelayPacketEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "relayStatusChanged",
    listener: (event: { status?: string }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

export const SaharaRelay = registerPlugin<SaharaRelayNativePlugin>("SaharaRelay");

export function relayAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Best-effort relay send. Sahara always saves SOS locally first; relay transport is additive.
 * Returns false when not running natively or when no relay gateway is currently connected.
 */
export async function sendSaharaRelayPacket(packet: unknown): Promise<boolean> {
  if (!relayAvailable()) return false;
  try {
    await SaharaRelay.sendPacket({ packet: JSON.stringify(packet) });
    return true;
  } catch {
    return false;
  }
}
