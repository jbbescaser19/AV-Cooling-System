import { Wrench } from "lucide-react";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";
import { seedServices } from "../../data/customerAccountMockData";
import { loadMock } from "../../utils/prototypeStore";

export default function ServicesPage() {
  const items = [...loadMock("av_customer_services", []), ...seedServices];

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={Wrench}
        title="Service Bookings"
        copy="View service requests, preferred schedules, and job status."
      />

      <div className="customer-record-list">
        {items.map((service) => (
          <article className="surface customer-record" key={service.id}>
            <div>
              <strong>{service.service}</strong>

              <span>
                {service.id} · {service.schedule}
              </span>

              <small>{service.address}</small>
            </div>

            <CustomerStatusBadge>{service.status}</CustomerStatusBadge>
          </article>
        ))}
      </div>
    </div>
  );
}
