import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

const ProtectedRoute = ({
  children,
  allowedRoles
}: ProtectedRouteProps) => {

//   const user = JSON.parse(
//     localStorage.getItem("user") || "null"
//   );
  const userData =
    localStorage.getItem("user") ??
    sessionStorage.getItem("user");

  if (!userData) {
    return <Navigate to="/login" replace />;
  }

  let user;
  try {
    user = JSON.parse(userData);
  } catch {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;