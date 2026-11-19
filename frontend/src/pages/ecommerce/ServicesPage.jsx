import RecordCategoryFilters, {
  field,
  useRecordFilters,
} from "../../components/common/RecordCategoryFilters.jsx";
import ServiceRequestDialog from "../../components/service/ServiceRequestDialog";
import useServiceRequestFlow from "../../hooks/useServiceRequestFlow";
import "../../styles/ecommerce/pages.css";
import "../../styles/ecommerce/services.css";

export default function ServicesPage() {
  const {
    services,
    status,
    selectedService,
    requestService,
    closeServiceRequest,
  } = useServiceRequestFlow("/services");

  const categories = useRecordFilters(services, [
    field("name", "Service types"),
  ]);
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
            <span>Explore our available services</span>
            <span>Swipe for more →</span>
          </div>

          {status === "loading" && <p role="status">Loading services…</p>}
          {status === "error" && (
            <p role="alert">
              Unable to verify available services. Trying again automatically.
            </p>
          )}
          {status === "ready" && !services.length && (
            <p>No services available at the moment.</p>
          )}

          <RecordCategoryFilters filters={categories} />
          {status === "ready" &&
            services.length > 0 &&
            !categories.filtered.length && <p>No matching services.</p>}
          <div
            className="services-list-grid"
            role="region"
            aria-label="Available air conditioning services"
            tabIndex={0}
          >
            {categories.filtered.map((service) => {
              const Icon = service.icon;

              return (
                <article className="surface service-list-card" key={service.id}>
                  <Icon size={30} aria-hidden="true" />
                  <h2>{service.name}</h2>
                  <p>{service.desc}</p>
                  <button
                    className="btn btn-dark"
                    type="button"
                    disabled={status !== "ready" || !service.bookable}
                    onClick={() => requestService(service)}
                  >
                    {service.bookable
                      ? "Request Service"
                      : "Booking unavailable"}
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
