import { getCustomer } from "../../utils/authMock";

import ProfilePage from "./ProfilePage";
import OrdersPage from "./OrdersPage";
import ServicesPage from "./ServicesPage";
import PaymentsPage from "./PaymentsPage";
import NotificationsPage from "./NotificationsPage";
import FeedbackPage from "./FeedbackPage";
import AddressesPage from "./AddressesPage";
import ChangePasswordPage from "./ChangePasswordPage";

export default function CustomerModulePage({ module }) {
  const customer = getCustomer() || {
    name: "Demo Customer",
    email: "customer@example.com",
  };

  switch (module) {
    case "orders":
    case "order-details":
      return <OrdersPage />;

    case "services":
    case "service-details":
      return <ServicesPage />;

    case "payments":
      return <PaymentsPage />;

    case "notifications":
      return <NotificationsPage />;

    case "feedback":
      return <FeedbackPage />;

    case "addresses":
      return <AddressesPage />;

    case "change-password":
      return <ChangePasswordPage />;

    case "profile":
    default:
      return <ProfilePage customer={customer} />;
  }
}
