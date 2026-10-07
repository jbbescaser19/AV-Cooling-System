import { Navigate, Outlet } from "react-router-dom";
import { getStaff } from "../../utils/authMock";

export default function RoleGuard({ roles = [] }) {
  const staff = getStaff();

  // Not logged in
  if (!staff) {
    return <Navigate to="/management/login" replace />;
  }

  // Logged in but role is not allowed
  if (roles.length > 0 && !roles.includes(staff.role)) {
    return <Navigate to="/management" replace />;
  }

  return <Outlet />;
}
