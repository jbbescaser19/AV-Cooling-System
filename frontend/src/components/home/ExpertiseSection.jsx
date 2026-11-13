import { services } from "../../data/services";
import ServiceRequestDialog from "../service/ServiceRequestDialog";
import useServiceRequestFlow from "../../hooks/useServiceRequestFlow";
import "../../styles/home/expertise.css";

export default function ExpertiseSection() {
  const { selectedService, requestService, closeServiceRequest } =
    useServiceRequestFlow("/#expertise");

  return (
    <>
      <section className="section expertise-section" id="expertise">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Our Expertise</div>
            <h2 className="section-title">
              Service built around reliable cooling.
            </h2>
            <p className="section-copy">
              From installation to troubleshooting, each service is presented
              clearly so customers can choose the right next step.
            </p>
          </div>

          <div className="expertise-scroll-hint" aria-hidden="true">
            <span>Explore our six services</span>
            <span>Swipe for more →</span>
          </div>

          <div
            className="service-grid"
            role="region"
            aria-label="Air conditioning services"
            tabIndex={0}
          >
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article className="service-card" key={service.id}>
                  <div className="service-icon">
                    <Icon aria-hidden="true" />
                  </div>

                  <h3>{service.name}</h3>
                  <p>{service.desc}</p>

                  <div className="tag-row">
                    {service.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>

                  <div className="service-actions">
                    <button
                      type="button"
                      className="btn btn-dark service-request-button"
                      onClick={() => requestService(service)}
                    >
                      Request Service
                    </button>
                  </div>
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
