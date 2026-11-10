import { getCustomer } from "../../utils/authMock";
import ProfilePage from "./ProfilePage";
import OrdersPage from "./OrdersPage";
import ServicesPage from "./ServicesPage";
import PaymentsPage from "./PaymentsPage";
import NotificationsPage from "./NotificationsPage";
import FeedbackPage from "./FeedbackPage";
import AddressesPage from "./AddressesPage";
import ChangePasswordPage from "./ChangePasswordPage";
import CustomerRecordDetailPage from "./CustomerRecordDetailPage";

export default function CustomerModulePage({ module }) {
  const customer = getCustomer() || { name: "Customer", email: "" };
  switch (module) {
    case "orders":
      return <OrdersPage />;
    case "order-details":
      return <CustomerRecordDetailPage kind="ORDER" />;
    case "services":
      return <ServicesPage />;
    case "service-details":
      return <CustomerRecordDetailPage kind="SERVICE" />;
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
