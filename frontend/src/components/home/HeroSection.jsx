import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck, Clock3, MapPin, Star } from "lucide-react";
import "../../styles/home/hero.css";
export default function HeroSection() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="hero-badge">
            <ShieldCheck size={16} />
            Trusted cooling sales & service
          </span>
          <h1>Comfort engineered for homes and businesses.</h1>
          <p>
            Shop reliable air-conditioning systems or book professional
            installation, cleaning, maintenance, and repair with one local
            cooling partner.
          </p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/shop">
              Shop Air Conditioners <ArrowRight size={17} />
            </Link>
            <Link className="btn btn-secondary" to="/services">
              Book a Service
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
                <small>Calamba & nearby areas</small>
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
      </div>
    </section>
  );
}
