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
import ReviewsPage from "./pages/ecommerce/ReviewsPage";

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
import InstallationHistoryPage from "./pages/management/InstallationHistoryPage";
import BookingCalendarPage from "./pages/management/BookingCalendarPage";
import PaymentsPage from "./pages/management/PaymentsPage";
import ManagementOperationsPage from "./pages/management/ManagementOperationsPage";
import ManagementWorkspacePage from "./pages/management/ManagementWorkspacePage";
import TechnicianAssignedJobsPanel from "./components/management/TechnicianAssignedJobsPanel";
import ArchivePage from "./pages/management/ArchivePage";

import CustomerModulePage from "./pages/customer/CustomerModulePage";
import CustomerCapacityCalculatorPage from "./pages/customer/CustomerCapacityCalculatorPage";
import ManagementCapacityCalculatorPage from "./pages/management/ManagementCapacityCalculatorPage";

import CustomerRoute from "./components/auth/CustomerRoute";
import RoleGuard from "./components/management/RoleGuard";

const mgmtModules = [
  "stock-movements",
  "service-types",
  "technicians",
  "feedback",
  "facebook-requests",
  "reports",
  "notifications",
  "audit-logs",
];

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

export default function App() {
  return (
    <Routes>
      {/* ECOMMERCE ROUTES */}

      <Route element={<EcommerceLayout />}>
        <Route path="/" element={<HomePage />} />

        <Route path="/shop" element={<ShopPage />} />

        <Route path="/shop/:productId" element={<ProductDetailsPage />} />

        <Route path="/services" element={<ServicesPage />} />

        <Route path="/about" element={<AboutPage />} />

        <Route path="/contact" element={<ContactPage />} />

        <Route path="/reviews" element={<ReviewsPage />} />

        <Route path="/cart" element={<CartPage />} />

        <Route element={<CustomerRoute />}>
          <Route path="/checkout" element={<CheckoutPage />} />

          <Route
            path="/order-confirmation/:orderId"
            element={<OrderConfirmationPage />}
          />
        </Route>
      </Route>

      {/* CUSTOMER AUTHENTICATION */}

      <Route path="/login" element={<LoginPage />} />

      <Route path="/register" element={<RegisterPage />} />

      <Route path="/forgot-password" element={<ForgotPasswordPage />} />

      {/* CUSTOMER ACCOUNT */}

      <Route element={<CustomerRoute />}>
        <Route path="/account" element={<CustomerLayout />}>
          <Route index element={<Navigate to="profile" replace />} />

          <Route
            path="capacity-calculator"
            element={<CustomerCapacityCalculatorPage />}
          />

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

      {/* MANAGEMENT AUTHENTICATION */}

      <Route path="/management/login" element={<ManagementLoginPage />} />

      {/* MANAGEMENT ROUTES */}

      <Route path="/management" element={<ManagementLayout />}>
        <Route index element={<DashboardPage />} />

        <Route path="dashboard" element={<DashboardPage />} />

        {/* SEPARATE CAPACITY CALCULATOR PAGE */}

        <Route
          path="capacity-calculator"
          element={<ManagementCapacityCalculatorPage />}
        />

        <Route path="archive" element={<ArchivePage />} />

        <Route path="pos" element={<POSPage />} />

        <Route path="booking-calendar" element={<BookingCalendarPage />} />

        <Route
          path="schedules"
          element={
            <>
              <TechnicianAssignedJobsPanel />

              <ManagementWorkspacePage module="schedules" />
            </>
          }
        />

        <Route path="orders" element={<OrdersPage />} />

        <Route
          path="installation-history"
          element={<InstallationHistoryPage />}
        />

        <Route path="payments" element={<PaymentsPage />} />

        {["categories", "products", "variants", "inventory", "customers"].map(
          (module) => (
            <Route
              key={module}
              path={module}
              element={<ManagementWorkspacePage module={module} />}
            />
          ),
        )}

        <Route
          path="service-requests"
          element={<ManagementOperationsPage kind="SERVICE" />}
        />

        <Route element={<RoleGuard roles={["OWNER"]} />}>
          <Route
            path="staff"
            element={<ManagementWorkspacePage module="staff" />}
          />
        </Route>

        {mgmtModules.map((module) => (
          <Route
            key={module}
            path={module}
            element={<ManagementWorkspacePage module={module} />}
          />
        ))}

        {/* Redirect only unknown Management paths */}

        <Route
          path="*"
          element={<Navigate to="/management/dashboard" replace />}
        />
      </Route>

      {/* Public fallback */}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
