import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/game/Game";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "The Backdoor — Race the Clock Through Endless Doors" },
      { name: "description", content: "A first-person 3D door-running game. Doors open as you approach; pull levers to add time before the clock hits zero." },
      { property: "og:title", content: "The Backdoor — Race the Clock" },
      { property: "og:description", content: "Run through endless wooden rooms. Pull levers to buy more time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Game,
});
