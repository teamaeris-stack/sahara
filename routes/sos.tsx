import { createFileRoute } from "@tanstack/react-router";
import { SosFlow } from "@/components/resq/SosFlow";
import { EMERGENCY_TYPES, type EmergencyType, type SOSResponses } from "@/lib/sos";

type SosSearch = { type?: EmergencyType | undefined; prefill?: SOSResponses | undefined; subject?: string | undefined };

export const Route = createFileRoute("/sos")({
  validateSearch: (search: Record<string, unknown>): SosSearch => {
    const type = EMERGENCY_TYPES.some((t) => t.key === search["type"]) ? (search["type"] as EmergencyType) : undefined;
    const raw = search["prefill"];
    const prefill =
      raw && typeof raw === "object"
        ? Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [string, string][])
        : undefined;
    const subject = typeof search["subject"] === "string" ? search["subject"] : undefined;
    return { type, prefill, subject };
  },
  head: () => ({
    meta: [
      { title: "I Need Help — Sahara SOS" },
      { name: "description", content: "Create an offline-capable Sahara emergency request in a few taps." },
      { property: "og:title", content: "I Need Help — Sahara SOS" },
      { property: "og:description", content: "Create an offline-capable Sahara emergency request in a few taps." },
    ],
  }),
  component: SosPage,
});

function SosPage() {
  const { type, prefill, subject } = Route.useSearch();
  return <SosFlow key={type ?? "fresh"} prefill={{ type, responses: prefill, subjectMemberId: subject }} />;
}
