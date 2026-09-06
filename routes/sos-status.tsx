import { createFileRoute } from "@tanstack/react-router";
import { DeliveryStatus } from "@/components/resq/DeliveryStatus";

export const Route = createFileRoute("/sos-status")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof search['id'] === "string" ? search['id'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "SOS Delivery Status — Sahara" },
      { name: "description", content: "Track the delivery status of your Sahara emergency packet, online or offline." },
      { property: "og:title", content: "SOS Delivery Status — Sahara" },
      { property: "og:description", content: "Track the delivery status of your Sahara emergency packet, online or offline." },
    ],
  }),
  component: SosStatusPage,
});

function SosStatusPage() {
  const { id } = Route.useSearch();
  return <DeliveryStatus id={id} />;
}
