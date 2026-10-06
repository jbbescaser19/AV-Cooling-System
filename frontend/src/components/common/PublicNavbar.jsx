import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, ShoppingCart, User, Menu, X, Snowflake } from "lucide-react";
import "../../styles/ecommerce/navbar.css";

const links = [
  ["Special Offers", "/#special-offers"],
  ["Our Expertise", "/#expertise"],
  ["Our Products", "/#products"],
  ["Why Partner With Us", "/#why-us"],
  ["Our Foundation", "/#foundation"],
  ["Client Feedback", "/#feedback"],
  ["Contact", "/#contact"],
];

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname, location.hash]);

  return (
    <header className="public-nav">
      <div className="nav-inner">
        <Link to="/" className="brand" aria-label="AV Cooling home">
          <span className="brand-mark"><Snowflake size={20}/></span>
          <span><b>AV Cooling</b><small>Sales & Service</small></span>
        </Link>

        <nav className="desktop-links" aria-label="Homepage navigation">
          {links.map(([title, href]) => <a key={title} href={href}>{title}</a>)}
        </nav>

        <div className="nav-actions">
          <Link className="icon-link search-link" to="/shop" aria-label="Search products" title="Search"><Search size={18}/></Link>
          <Link className="icon-link" to="/cart" aria-label="Cart" title="Cart"><ShoppingCart size={18}/></Link>
          <Link className="icon-link desktop-account" to="/account" aria-label="Account" title="Account"><User size={18}/></Link>
          <button className="menu-btn" type="button" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={20}/> : <Menu size={20}/>}</button>
        </div>
      </div>

      {open && (
        <nav className="mobile-drawer" aria-label="Mobile navigation">
          <div>
            {links.map(([title, href]) => <a key={title} href={href} onClick={() => setOpen(false)}>{title}</a>)}
            <Link to="/shop" onClick={() => setOpen(false)}>Shop</Link>
            <Link to="/cart" onClick={() => setOpen(false)}>Cart</Link>
            <Link to="/account" onClick={() => setOpen(false)}>Account</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
