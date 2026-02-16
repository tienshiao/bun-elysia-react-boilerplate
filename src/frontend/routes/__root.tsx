import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

import { useAuth } from "@/frontend/lib/auth-context.tsx";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { isAuthenticated, user, signOut } = useAuth();

  return (
    <>
      <div className="flex items-center gap-4 p-4">
        <Link to="/" className="[&.active]:font-bold">
          Home
        </Link>
        <Link to="/about" className="[&.active]:font-bold">
          About
        </Link>
        <div className="ml-auto flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm">{user?.username}</span>
              <button onClick={() => signOut()} className="text-sm underline hover:no-underline">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="[&.active]:font-bold">
              Login
            </Link>
          )}
        </div>
      </div>
      <hr />
      <Outlet />
      {import.meta.env?.DEV && <TanStackRouterDevtools />}
    </>
  );
}
