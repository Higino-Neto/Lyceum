import { SplinePointer } from "lucide-react";
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
    return <div className="h-screen bg-zinc-950 w-full"></div>
    // TODO Colocar spinner aqui
  }

  if (!isLoggedIn) {
    return <Navigate to={"/signup"} replace />;
  }
  return children;
}
