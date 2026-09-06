import { createFileRoute } from "@tanstack/react-router";
import { MoreScreen } from "@/components/resq/MoreScreen";

export const Route = createFileRoute("/more")({
  head: () => ({
    meta: [
      { title: "More — Sahara" },
      { name: "description", content: "Sahara demo controls, upcoming features and about Sahara." },
      { property: "og:title", content: "More — Sahara" },
      { property: "og:description", content: "Sahara demo controls, upcoming features and about Sahara." },
    ],
  }),
  component: MoreScreen,
});
