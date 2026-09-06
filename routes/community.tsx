import { createFileRoute } from "@tanstack/react-router";
import { CommunityScreen } from "@/components/resq/CommunityScreen";

export const Route = createFileRoute("/community")({
  validateSearch: (search: Record<string, unknown>): { id?: string | undefined } => ({
    id: typeof search["id"] === "string" ? search["id"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Community Support — Sahara" },
      { name: "description", content: "Nearby assistance requests, safe structured help and local disaster updates from Sahara users." },
      { property: "og:title", content: "Community Support — Sahara" },
      { property: "og:description", content: "Safe users share information; nobody is sent into danger." },
    ],
  }),
  component: CommunityPage,
});

function CommunityPage() {
  const { id } = Route.useSearch();
  return <CommunityScreen openId={id} />;
}
