import { CreditCard } from "lucide-react";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import { seedPayments } from "../../data/customerAccountMockData";
import { formatCustomerMoney } from "../../utils/customerAccountUtils";
import { loadMock } from "../../utils/prototypeStore";

export default function PaymentsPage() {
  const items = loadMock("av_customer_payments", seedPayments);

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={CreditCard}
        title="Payments"
        copy="Payment history and verification status."
      />

      <div className="customer-record-list">
        {items.map((payment) => (
          <article className="surface customer-record" key={payment.id}>
            <div>
              <strong>{formatCustomerMoney(payment.amount)}</strong>

              <span>
                {payment.id} · {payment.order} · {payment.method}
              </span>
            </div>

            <CustomerStatusBadge>{payment.status}</CustomerStatusBadge>
          </article>
        ))}
      </div>
    </div>
  );
}
