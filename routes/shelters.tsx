import { createFileRoute } from "@tanstack/react-router";
import { SheltersScreen } from "@/components/resq/SheltersScreen";

export const Route = createFileRoute("/shelters")({
  head: () => ({
    meta: [
      { title: "Safe Places Near You — Sahara" },
      { name: "description", content: "Cached shelters, safe zones and medical safe points with availability, freshness and offline routes." },
      { property: "og:title", content: "Safe Places Near You — Sahara" },
      { property: "og:description", content: "Offline shelter list, cached emergency map and safe routes that work with zero signal." },
    ],
  }),
  component: SheltersScreen,
});
