import { Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  isLoggedIn: boolean;
  children: JSX.Element;
}

export default function ProtectedRoute({
  isLoggedIn,
  children,
}: ProtectedRouteProps) {
  if (isLoggedIn === null) {
    return (
      <div className="h-screen bg-zinc-950 w-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to={"/signup"} replace />;
  }
  return children;
}
