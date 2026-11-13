import { Outlet } from "react-router-dom";
import PublicNavbar from "../components/common/PublicNavbar";
import RealtimeBridge from "../components/realtime/RealtimeBridge.jsx";
import Footer from "../components/common/Footer";
import "../styles/ecommerce/snowflake-pattern.css";

export default function EcommerceLayout() {
  return (
    <>
      <RealtimeBridge audience="public" />
      <PublicNavbar />

      <main className="ecommerce-main">
        <Outlet />
      </main>

      <Footer />
    </>
  );
}
