import { createFileRoute } from "@tanstack/react-router";
import { AlarmScreen } from "@/components/wake/AlarmScreen";
export const Route = createFileRoute("/_authenticated/alarm")({
  head: () => ({ meta: [
    { title: "Wake Alarm — AXEN" },
    { name: "description", content: "Your AXEN wake alarm and private solve-to-stop challenge." },
    { property: "og:title", content: "Wake Alarm — AXEN" },
    { property: "og:description", content: "Your AXEN wake alarm and private solve-to-stop challenge." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }), component: AlarmScreen,
});