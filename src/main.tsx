import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { createBrowserHistory, createRouter, Link, RouterProvider } from "@tanstack/react-router"

import { Toaster } from "@/components/ui/toaster"
import { routeTree } from "./routeTree.gen"

const browserHistory = createBrowserHistory();
const queryClient = new QueryClient()

const router = createRouter({
  routeTree,
  history: browserHistory,
  defaultNotFoundComponent: () => (
    <div>
      <h1>Not Found</h1>
      <Link to="/">Home</Link>
    </div>
  ),
});

declare module "@tanstack/react-router" {
  interface RegisterRouter {
    router: typeof router;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  </StrictMode>,
)
