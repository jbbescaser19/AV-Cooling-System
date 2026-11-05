import { Routes, Route, Navigate } from "react-router-dom";

import EcommerceLayout from "./layouts/EcommerceLayout";
import ManagementLayout from "./layouts/ManagementLayout";
import CustomerLayout from "./layouts/CustomerLayout";

import HomePage from "./pages/ecommerce/HomePage";
import ShopPage from "./pages/ecommerce/ShopPage";
import ProductDetailsPage from "./pages/ecommerce/ProductDetailsPage";
import ServicesPage from "./pages/ecommerce/ServicesPage";
import AboutPage from "./pages/ecommerce/AboutPage";
import ContactPage from "./pages/ecommerce/ContactPage";

import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";

import ManagementLoginPage from "./pages/management/ManagementLoginPage";

import CartPage from "./pages/checkout/CartPage";
import CheckoutPage from "./pages/checkout/CheckoutPage";
import OrderConfirmationPage from "./pages/checkout/OrderConfirmationPage";

import DashboardPage from "./pages/management/DashboardPage";
import OrdersPage from "./pages/management/OrdersPage";
import POSPage from "./pages/management/POSPage";
import ProductsPage from "./pages/management/ProductsPage";
import InventoryPage from "./pages/management/InventoryPage";
import CustomersPage from "./pages/management/CustomersPage";
import ManagementModulePage from "./pages/management/ManagementModulePage";
import StaffAccountsPage from "./pages/management/StaffAccountsPage";
import ArchivePage from "./pages/management/ArchivePage";

import CustomerModulePage from "./pages/customer/CustomerModulePage";

import CustomerRoute from "./components/auth/CustomerRoute";
import RoleGuard from "./components/management/RoleGuard";

/* =========================================================
   MANAGEMENT MODULES
========================================================= */

const mgmtModules = [
  "payments",
  "stock-movements",
  "service-types",
  "service-requests",
  "work-orders",
  "technicians",
  "schedules",
  "website-content",
  "feedback",
  "contact-messages",
  "facebook-requests",
  "reports",
  "notifications",
  "audit-logs",
];

/* =========================================================
   CUSTOMER MODULES
========================================================= */

const customerModules = [
  "orders",
  "services",
  "payments",
  "notifications",
  "feedback",
  "addresses",
  "profile",
  "change-password",
];

/* =========================================================
   APPLICATION ROUTES
========================================================= */

export default function App() {
  return (
    <Routes>
      {/* =============================================
          PUBLIC ECOMMERCE
      ============================================= */}

      <Route element={<EcommerceLayout />}>
        <Route path="/" element={<HomePage />} />

        <Route path="/shop" element={<ShopPage />} />

        <Route path="/shop/:productId" element={<ProductDetailsPage />} />

        <Route path="/services" element={<ServicesPage />} />

        <Route path="/about" element={<AboutPage />} />

        <Route path="/contact" element={<ContactPage />} />

        <Route path="/cart" element={<CartPage />} />

        <Route element={<CustomerRoute />}>
          <Route path="/checkout" element={<CheckoutPage />} />

          <Route
            path="/order-confirmation/:orderId"
            element={<OrderConfirmationPage />}
          />
        </Route>
      </Route>

      {/* =============================================
          CUSTOMER AUTHENTICATION
      ============================================= */}

      <Route path="/login" element={<LoginPage />} />

      <Route path="/register" element={<RegisterPage />} />

      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* =============================================
          CUSTOMER ACCOUNT
      ============================================= */}

      <Route element={<CustomerRoute />}>
        <Route path="/account" element={<CustomerLayout />}>
          <Route index element={<Navigate to="profile" replace />} />

          {customerModules.map((module) => (
            <Route
              key={module}
              path={module}
              element={<CustomerModulePage module={module} />}
            />
          ))}

          <Route
            path="orders/:orderId"
            element={<CustomerModulePage module="order-details" />}
          />

          <Route
            path="services/:serviceId"
            element={<CustomerModulePage module="service-details" />}
          />
        </Route>
      </Route>

      {/* =============================================
          MANAGEMENT LOGIN
      ============================================= */}

      <Route path="/management/login" element={<ManagementLoginPage />} />

      {/* =============================================
          MANAGEMENT SYSTEM
      ============================================= */}

      <Route path="/management" element={<ManagementLayout />}>
        <Route index element={<DashboardPage />} />

        <Route path="dashboard" element={<DashboardPage />} />

        {/* ARCHIVE
            Access is controlled by ManagementLayout:
            OWNER and MANAGER only.
        */}
        <Route path="archive" element={<ArchivePage />} />

        {/* SALES */}

        <Route path="pos" element={<POSPage />} />

        <Route path="orders" element={<OrdersPage />} />

        {/* CATALOG */}

        <Route path="products" element={<ProductsPage />} />

        <Route path="inventory" element={<InventoryPage />} />

        {/* CUSTOMERS */}

        <Route path="customers" element={<CustomersPage />} />

        {/* OWNER-ONLY STAFF MANAGEMENT */}

        <Route element={<RoleGuard roles={["OWNER"]} />}>
          <Route path="staff" element={<StaffAccountsPage />} />
        </Route>

        {/* OTHER MANAGEMENT MODULES */}

        {mgmtModules.map((module) => (
          <Route
            key={module}
            path={module}
            element={<ManagementModulePage module={module} />}
          />
        ))}

        {/* UNKNOWN MANAGEMENT ROUTES
            Stay inside management instead of
            redirecting to ecommerce.
        */}

        <Route
          path="*"
          element={<Navigate to="/management/dashboard" replace />}
        />
      </Route>

      {/* =============================================
          UNKNOWN PUBLIC ROUTES
      ============================================= */}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
