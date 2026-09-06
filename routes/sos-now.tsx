import { createFileRoute } from "@tanstack/react-router";
import { DirectSosSaved } from "@/components/resq/DirectSosSaved";

export const Route = createFileRoute("/sos-now")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "SOS Saved — Sahara" },
      { name: "description", content: "Your one-tap Sahara SOS is saved on this device with your last known location." },
      { property: "og:title", content: "SOS Saved — Sahara" },
      { property: "og:description", content: "One-tap SOS stored locally and queued for delivery." },
    ],
  }),
  component: SosNowPage,
});

function SosNowPage() {
  const { id } = Route.useSearch();
  return <DirectSosSaved id={id} />;
}
