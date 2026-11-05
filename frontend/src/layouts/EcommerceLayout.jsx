import { Outlet } from "react-router-dom";
import PublicNavbar from "../components/common/PublicNavbar";
import Footer from "../components/common/Footer";
import "../styles/ecommerce/snowflake-pattern.css";

export default function EcommerceLayout() {
  return (
    <>
      <PublicNavbar />

      <main className="ecommerce-main">
        <Outlet />
      </main>

      <Footer />
    </>
  );
}
