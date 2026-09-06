import { createFileRoute } from "@tanstack/react-router";
import { HelpChooser } from "@/components/resq/HelpChooser";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "You Need Help — Sahara" },
      { name: "description", content: "Choose one-tap SOS NOW or describe your emergency in the Sahara offline-first app." },
      { property: "og:title", content: "You Need Help — Sahara" },
      { property: "og:description", content: "One-tap SOS or a documented emergency report — both work offline." },
    ],
  }),
  component: HelpChooser,
});
