import { services } from "../../data/services";

import ServiceRequestDialog from "../../components/service/ServiceRequestDialog";

import useServiceRequestFlow from "../../hooks/useServiceRequestFlow";

import "../../styles/ecommerce/pages.css";

export default function ServicesPage() {
  {
    /* when component renders pass this argument /#expertise to function useServiceRequestFlow on useServiceRequestFlow*/
  }
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

          <div className="services-list-grid">
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <article className="surface service-list-card" key={service.id}>
                  <Icon size={30} />

                  <h2>{service.name}</h2>

                  <p>{service.desc}</p>
                  {/* go to useServiceRequestFlow do the requestService then pass the whole service object */}
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
      {/* this is for selecting appointment if selectedService has value reder this react component ServiceRequestDialog*/}
      {selectedService && (
        <ServiceRequestDialog
          service={selectedService}
          onClose={closeServiceRequest}
        />
      )}
    </>
  );
}
