import { Outlet, createRootRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { ThemeProvider } from "@/components/theme-provider";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="blind-peering-theme">
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex flex-1 flex-col">
          <Outlet />
        </div>
        <SiteFooter />
      </div>
    </ThemeProvider>
  );
}
