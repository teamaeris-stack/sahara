import { createFileRoute } from "@tanstack/react-router";
import { OfflineSafeRoute } from "@/components/resq/OfflineSafeRoute";

export const Route = createFileRoute("/safe-route/$id")({
  head: () => ({
    meta: [
      { title: "Offline Safe Route — Sahara" },
      {
        name: "description",
        content: "Cached offline walking route to a Sahara shelter with hazard-aware rerouting.",
      },
      { property: "og:title", content: "Offline Safe Route — Sahara" },
      {
        property: "og:description",
        content: "Route generated from locally stored emergency map data.",
      },
    ],
  }),
  component: RoutePage,
});

function RoutePage() {
  const { id } = Route.useParams();
  return <OfflineSafeRoute id={id} />;
}
