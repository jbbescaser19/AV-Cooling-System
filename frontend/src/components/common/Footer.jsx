import { Link } from "react-router-dom";
import { Snowflake, Phone, Mail, MapPin } from "lucide-react";

import { businessProfile } from "../../data/businessProfile";

import "../../styles/ecommerce/footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <div className="footer-brand">
            <Snowflake size={21} aria-hidden="true" />
            AV Cooling System
          </div>

          <p>
            Reliable air-conditioning products, installation, cleaning, repair,
            and after-sales support.
          </p>
        </div>

        <div>
          <h4>Contact</h4>

          <p>
            <Phone size={15} aria-hidden="true" />
            {businessProfile.phone}
          </p>

          <p>
            <Mail size={15} aria-hidden="true" />
            {businessProfile.email}
          </p>

          <p>
            <MapPin size={15} aria-hidden="true" />
            {businessProfile.address}
          </p>
        </div>

        <nav aria-label="Footer quick links">
          <h4>Quick Links</h4>

          <Link to="/shop">Our Products</Link>

          <Link to="/services">Services</Link>

          <Link to="/contact">Contact Us</Link>
        </nav>
      </div>

      <div className="container footer-bottom">
        © 2026 AV Cooling System. All rights reserved.
      </div>
    </footer>
  );
}
