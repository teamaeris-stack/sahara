import { createFileRoute } from "@tanstack/react-router";
import { GuideScreen } from "@/components/resq/GuideScreen";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Offline Emergency Assistant — Sahara" },
      { name: "description", content: "Step-by-step flood, earthquake, fire, storm, first aid and evacuation guidance stored on your device." },
      { property: "og:title", content: "Offline Emergency Assistant — Sahara" },
      { property: "og:description", content: "Critical safety guidance that works with zero signal." },
    ],
  }),
  component: GuideScreen,
});
