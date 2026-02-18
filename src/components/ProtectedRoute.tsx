import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  isLoggedIn: boolean;
  children: JSX.Element;
}

export default function ProtectedRoute({
  isLoggedIn,
  children,
}: ProtectedRouteProps) {
  if (!isLoggedIn) {
    return <Navigate to={"/signup"} replace />;
  }
  return children;
}
