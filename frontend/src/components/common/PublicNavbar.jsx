import { useEffect, useState } from "react";

import { createPortal } from "react-dom";

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

  /* Close menu after navigating */
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  /* Lock body + ESC support */
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeMenu = () => {
    setOpen(false);
  };

  const mobileMenu =
    open &&
    createPortal(
      <div className="mobile-menu-layer">
        {/* DARK BACKDROP */}
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close navigation"
          onClick={closeMenu}
        />

        {/* ACTUAL DRAWER */}
        <aside className="mobile-nav-drawer" aria-label="Mobile navigation">
          <div className="mobile-nav-head">
            <div className="mobile-nav-brand">
              <span className="brand-mark">
                <Snowflake size={19} />
              </span>

              <div>
                <strong>AV Cooling</strong>

                <small>Sales & Service</small>
              </div>
            </div>

            <button
              type="button"
              className="mobile-nav-close"
              aria-label="Close menu"
              onClick={closeMenu}
            >
              <X size={20} />
            </button>
          </div>

          <nav className="mobile-nav-links">
            {links.map(([title, href]) => (
              <a key={title} href={href} onClick={closeMenu}>
                {title}
              </a>
            ))}
          </nav>

          <div className="mobile-nav-shortcuts">
            <Link to="/shop" onClick={closeMenu}>
              <Search size={18} />

              <span>Shop Products</span>
            </Link>

            <Link to="/cart" onClick={closeMenu}>
              <ShoppingCart size={18} />

              <span>Shopping Cart</span>
            </Link>

            <Link to="/account" onClick={closeMenu}>
              <User size={18} />

              <span>My Account</span>
            </Link>
          </div>
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <header className="public-nav">
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label="AV Cooling home">
            <span className="brand-mark">
              <Snowflake size={20} />
            </span>

            <span>
              <b>AV Cooling</b>

              <small>Sales & Service</small>
            </span>
          </Link>

          {/* DESKTOP NAV ONLY */}
          <nav className="desktop-links" aria-label="Homepage navigation">
            {links.map(([title, href]) => (
              <a key={title} href={href}>
                {title}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <Link
              className="icon-link search-link"
              to="/shop"
              aria-label="Search products"
              title="Search"
            >
              <Search size={18} />
            </Link>

            <Link
              className="icon-link"
              to="/cart"
              aria-label="Cart"
              title="Cart"
            >
              <ShoppingCart size={18} />
            </Link>

            <Link
              className="icon-link desktop-account"
              to="/account"
              aria-label="Account"
              title="Account"
            >
              <User size={18} />
            </Link>

            {/* MOBILE BURGER */}
            <button
              className="menu-btn"
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-navigation"
              onClick={() => setOpen(true)}
            >
              <Menu size={20} />
            </button>
          </div>
        </div>
      </header>

      {mobileMenu}
    </>
  );
}
