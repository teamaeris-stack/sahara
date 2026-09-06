import { createFileRoute } from "@tanstack/react-router";
import { HomeScreen } from "@/components/resq/HomeScreen";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sahara — Citizen Disaster Mode" },
      {
        name: "description",
        content: "Sahara offline-first emergency app. Mark yourself safe, request help, and stay informed when networks fail.",
      },
      { property: "og:title", content: "Sahara — Your safety. Your people. Your shelter." },
      {
        property: "og:description",
        content: "When the network disappears, Sahara doesn't. Offline-first citizen emergency home screen.",
      },
    ],
  }),
  component: HomeScreen,
});
