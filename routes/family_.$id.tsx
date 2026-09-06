import { createFileRoute } from "@tanstack/react-router";
import { FamilyDetail } from "@/components/resq/FamilyDetail";

export const Route = createFileRoute("/family_/$id")({
  head: () => ({
    meta: [
      { title: "Family Member — Last Seen — Sahara" },
      { name: "description", content: "Last-seen intelligence, evidence timeline and check-in request for a family member. Not live tracking." },
      { property: "og:title", content: "Family Member — Last Seen — Sahara" },
      { property: "og:description", content: "Latest reliable evidence about a family member, saved on this device." },
    ],
  }),
  component: FamilyPage,
});

function FamilyPage() {
  const { id } = Route.useParams();
  return <FamilyDetail id={id} />;
}
