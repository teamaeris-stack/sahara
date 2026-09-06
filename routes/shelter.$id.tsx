import { createFileRoute } from "@tanstack/react-router";
import { ShelterDetail } from "@/components/resq/ShelterDetail";

export const Route = createFileRoute("/shelter/$id")({
  head: () => ({
    meta: [
      { title: "Shelter Details — Sahara" },
      { name: "description", content: "Availability, capacity, facilities, accessibility and freshness for a cached Sahara shelter." },
      { property: "og:title", content: "Shelter Details — Sahara" },
      { property: "og:description", content: "Cached shelter information that works offline." },
    ],
  }),
  component: ShelterPage,
});

function ShelterPage() {
  const { id } = Route.useParams();
  return <ShelterDetail id={id} />;
}
