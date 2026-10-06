import { useEffect, useState } from "react";
import { Navigate, Outlet, Link, useLocation } from "react-router-dom";
import { Menu, Bell, UserRound, LogOut } from "lucide-react";
import Sidebar from "../components/management/Sidebar";
import { notifications as seedNotifications } from "../data/mockManagement";
import { getStaff, logoutStaff } from "../utils/authMock";
import { getStoredNotifications } from "../utils/managementStore";
import "../styles/management/management.css";

const access = {
  OWNER: ["dashboard","pos","orders","payments","products","inventory","stock-movements","service-types","service-requests","work-orders","technicians","schedules","customers","promos","website-content","feedback","contact-messages","facebook-requests","reports","notifications","audit-logs"],
  MANAGER: ["dashboard","pos","orders","payments","products","inventory","stock-movements","service-types","service-requests","work-orders","technicians","schedules","customers","promos","website-content","feedback","contact-messages","facebook-requests","reports","notifications"],
  SALES_CASHIER: ["dashboard","pos","orders","payments","products","customers","contact-messages","facebook-requests","notifications"],
  TECHNICIAN: ["dashboard","service-requests","work-orders","schedules","notifications"],
};

export default function ManagementLayout() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(() => getStoredNotifications(seedNotifications).filter((item) => !item.read).length);
  const staff = getStaff();
  const location = useLocation();

  useEffect(() => {
    const refresh = () => setUnread(getStoredNotifications(seedNotifications).filter((item) => !item.read).length);
    window.addEventListener("av-management-updated", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("av-management-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  if (!staff) return <Navigate to="/management/login" replace />;
  const slug = location.pathname.split("/")[2] || "dashboard";
  if (!(access[staff.role] || []).includes(slug)) return <Navigate to="/management/dashboard" replace />;

  return (
    <div className="mgmt-shell">
      <Sidebar open={open} onClose={() => setOpen(false)} />
      {open && <button className="drawer-backdrop" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <div className="mgmt-workspace">
        <header className="mgmt-topbar">
          <button className="mgmt-menu" type="button" aria-label="Open management navigation" onClick={() => setOpen(true)}><Menu size={19}/></button>
          <div><b>AV Cooling Management</b><span>Sales, inventory, service, and operations</span></div>
          <div className="mgmt-top-actions">
            <Link className="mgmt-notification-link" to="/management/notifications" title="Notifications" aria-label={`${unread} unread notifications`}><Bell size={18}/>{unread > 0 && <span className="mgmt-notification-count">{unread}</span>}</Link>
            <span className="staff-chip"><UserRound size={16}/>{staff.role.replaceAll("_"," ")}</span>
            <Link title="Log out" aria-label="Log out" to="/management/login" onClick={logoutStaff}><LogOut size={18}/></Link>
          </div>
        </header>
        <main className="mgmt-main"><Outlet/></main>
      </div>
    </div>
  );
}
