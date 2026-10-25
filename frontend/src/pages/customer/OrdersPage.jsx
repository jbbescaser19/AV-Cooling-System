import { useState } from "react";
import { Package } from "lucide-react";

import CustomerDialog from "../../components/customer/CustomerDialog";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import { seedOrders } from "../../data/customerAccountMockData";
import { formatCustomerMoney } from "../../utils/customerAccountUtils";
import { loadMock } from "../../utils/prototypeStore";

export default function OrdersPage() {
  const [selected, setSelected] = useState(null);
  const items = [...loadMock("av_customer_orders", []), ...seedOrders];

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={Package}
        title="Orders"
        copy="Track current and previous AV Cooling orders."
      />

      <div className="customer-record-list">
        {items.map((order) => (
          <button
            type="button"
            className="surface customer-record customer-record-button"
            key={order.id}
            onClick={() => setSelected(order)}
          >
            <div>
              <strong>{order.id}</strong>
              <span>
                {order.date} · {order.type}
              </span>
            </div>

            <div>
              <b>
                {typeof order.total === "number"
                  ? formatCustomerMoney(order.total)
                  : order.total}
              </b>

              <CustomerStatusBadge>{order.status}</CustomerStatusBadge>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <CustomerDialog title={selected.id} onClose={() => setSelected(null)}>
          <div className="customer-detail-grid">
            <div>
              <span>Status</span>
              <strong>{selected.status}</strong>
            </div>

            <div>
              <span>Fulfillment</span>
              <strong>{selected.type}</strong>
            </div>

            <div>
              <span>Payment</span>
              <strong>{selected.payment || "—"}</strong>
            </div>

            <div>
              <span>Total</span>
              <strong>
                {typeof selected.total === "number"
                  ? formatCustomerMoney(selected.total)
                  : selected.total}
              </strong>
            </div>
          </div>

          {selected.items?.map((item, index) => (
            <div className="customer-line-item" key={item.id || index}>
              <span>
                {item.qty} × {item.name} {item.hp}
              </span>

              <strong>{formatCustomerMoney(item.price * item.qty)}</strong>
            </div>
          ))}
        </CustomerDialog>
      )}
    </div>
  );
}
