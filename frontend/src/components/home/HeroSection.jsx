import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Clock3, MapPin, Star } from "lucide-react";

import heroPerson from "../../assets/av-cooling-hero-person.png";
import "../../styles/home/hero.css";

export default function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="hero-badge">
            <ShieldCheck size={16} />
            Trusted cooling sales &amp; service
          </span>

          <h1>Comfort engineered for homes and businesses</h1>

          <p>
            Shop reliable air-conditioning systems or request professional
            installation, cleaning, maintenance, and repair with one local
            cooling partner.
          </p>

          <div className="hero-cta">
            <Link className="btn btn-primary" to="/shop">
              Shop Air Conditioners
              <ArrowRight size={17} />
            </Link>

            <Link className="btn btn-secondary" to="/services">
              View Services
            </Link>
          </div>

          <div className="hero-trust">
            <div>
              <Clock3 />

              <span>
                <b>Fast scheduling</b>
                <small>Organized service requests</small>
              </span>
            </div>

            <div>
              <MapPin />

              <span>
                <b>Local support</b>
                <small>Calamba &amp; nearby areas</small>
              </span>
            </div>

            <div>
              <Star />

              <span>
                <b>After-sales care</b>
                <small>Support beyond purchase</small>
              </span>
            </div>
          </div>
        </div>

        {/* Decorative image only; it does not alter the existing actions. */}
        <div className="hero-figure" aria-hidden="true">
          <div className="hero-figure-glow" />
          <img
            className="hero-figure-image"
            src={heroPerson}
            alt=""
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
