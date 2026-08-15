import { createRootRouteWithContext, Outlet, Scripts } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import appCss from "@/styles.css?url";

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="stylesheet" href={appCss} />
        <link rel="icon" href="/favicon.png" type="image/png" />
      </head>
      <body style={{ margin: 0, background: "#000", color: "#e8e8e8" }}>
        {children}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <div style={{ minHeight: "100vh", background: "#000" }}>
      <Outlet />
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AXEN - Habit & Discipline" },
      { name: "description", content: "Ultra-futuristic discipline tracker. Sign in to start your streak, missions, and cosmic meditation." },
      { property: "og:title", content: "AXEN - Habit & Discipline" },
      { property: "og:description", content: "Ultra-futuristic discipline tracker. Sign in to start your streak, missions, and cosmic meditation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "AXEN - Habit & Discipline" },
      { name: "twitter:description", content: "Ultra-futuristic discipline tracker. Sign in to start your streak, missions, and cosmic meditation." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1c0e4d78-f84f-44e6-9584-e7f572e4decc/id-preview-86879ee9--c14c9cb8-3c47-4db8-a3b5-dee64dd2f905.lovable.app-1784981303889.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/1c0e4d78-f84f-44e6-9584-e7f572e4decc/id-preview-86879ee9--c14c9cb8-3c47-4db8-a3b5-dee64dd2f905.lovable.app-1784981303889.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
});
