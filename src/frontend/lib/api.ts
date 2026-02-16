import { treaty } from "@elysiajs/eden";

import type { App } from "@/index.ts";

import { authenticatedFetch } from "./authenticated-fetch.ts";

export const api = treaty<App>(window.location.origin, {
  fetcher: authenticatedFetch,
});
