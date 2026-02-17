import { publicFiles } from "@/_public-files.ts";

export function makeStaticRoutes(): Record<string, Response> {
  const routes: Record<string, Response> = {};
  for (const [routePath, filePath] of Object.entries(publicFiles)) {
    routes[routePath] = new Response(Bun.file(filePath));
  }
  return routes;
}
