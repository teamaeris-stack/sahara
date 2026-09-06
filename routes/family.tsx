import { createFileRoute } from "@tanstack/react-router";
import { FamilyScreen } from "@/components/resq/FamilyScreen";

export const Route = createFileRoute("/family")({
  head: () => ({
    meta: [
      { title: "Family Safety — Sahara" },
      { name: "description", content: "Who has responded, who has not, and the latest reliable last-seen evidence — stored on your device." },
      { property: "og:title", content: "Family Safety — Sahara" },
      { property: "og:description", content: "Offline family safety status, last-seen intelligence and check-in requests." },
    ],
  }),
  component: FamilyScreen,
});
