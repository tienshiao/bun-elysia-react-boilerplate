import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

export const Route = createRootRoute({
  component: () => (
    <>
      <div className="flex gap-4 p-4">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
        <Link to="/login" className="[&.active]:font-bold">
          Login
        </Link>
      </div>
      <hr />
      <Outlet />
      {import.meta.env?.DEV && <TanStackRouterDevtools />}
    </>
  ),
});
