import { Loader2 } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";

interface ProtectedRouteProps {
  isLoggedIn: boolean | null;
  children: JSX.Element;
}

export default function ProtectedRoute({
  isLoggedIn,
  children,
}: ProtectedRouteProps) {
  const location = useLocation();

  if (isLoggedIn === null) {
    return (
      <div className="h-screen bg-zinc-950 w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/signin"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }
  return children;
}
