import { services } from "../../data/services";
import ServiceRequestDialog from "../../components/service/ServiceRequestDialog";
import useServiceRequestFlow from "../../hooks/useServiceRequestFlow";
import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/services.css";

export default function ServicesPage() {
  const { selectedService, requestService, closeServiceRequest } =
    useServiceRequestFlow("/services");

  return (
    <>
      <section className="page-shell">
        <div className="container">
          <div className="page-intro">
            <div>
              <div className="eyebrow">Services</div>
              <h1 className="page-title">Professional aircon service</h1>
              <p className="section-copy">
                Installation, maintenance, repair, troubleshooting, and urgent
                service with a clear request and scheduling process.
              </p>
            </div>
          </div>

          <div className="services-scroll-hint" aria-hidden="true">
            <span>Browse all six services</span>
            <span>Swipe for more →</span>
          </div>

          <div
            className="services-list-grid"
            role="region"
            aria-label="Available air conditioning services"
            tabIndex={0}
          >
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article className="surface service-list-card" key={service.id}>
                  <Icon size={30} aria-hidden="true" />
                  <h2>{service.name}</h2>
                  <p>{service.desc}</p>
                  <button
                    className="btn btn-dark"
                    type="button"
                    onClick={() => requestService(service)}
                  >
                    Request Service
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {selectedService && (
        <ServiceRequestDialog
          service={selectedService}
          onClose={closeServiceRequest}
        />
      )}
    </>
  );
}
