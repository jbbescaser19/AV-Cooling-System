import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";

import { Search, ShoppingCart, User, Menu, X, Snowflake } from "lucide-react";

import "../../styles/ecommerce/navbar.css";
import "../../styles/ecommerce/navbar-auth.css";

import api from "../../../api/api.js";

const links = [
  ["Our Expertise", "/#expertise"],
  ["Our Products", "/#products"],
  ["Why Partner With Us", "/#why-us"],
  ["Our Foundation", "/#foundation"],
  ["Client Feedback", "/reviews"],
  ["Contact", "/#contact"],
];

function BrandLogo() {
  const [failed, setFailed] = useState(false);

  return (
    <span className="brand-mark av-image-brand">
      {failed ? (
        <Snowflake size={22} aria-hidden="true" />
      ) : (
        <img
          src="/av-cooling-logo.webp"
          alt=""
          width={44}
          height={44}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export default function PublicNavbar() {
  const [open, setOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(null);

  const location = useLocation();

  const loginState = {
    from: {
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
    },
  };

  useEffect(() => {
    const controller = new AbortController();

    api
      .get("/api/auth/customer/session-status", {
        signal: controller.signal,
      })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setAuthenticated(data?.authenticated === true);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;

        if ([401, 403].includes(error.response?.status)) {
          setAuthenticated(false);
        }
      });

    return () => controller.abort();
  }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return undefined;

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
        <button
          type="button"
          className="mobile-menu-backdrop"
          aria-label="Close navigation"
          onClick={closeMenu}
        />

        <aside
          id="mobile-navigation"
          className="mobile-nav-drawer"
          aria-label="Mobile navigation"
        >
          <div className="mobile-nav-head">
            <div className="mobile-nav-brand">
              <BrandLogo />

              <div>
                <strong>AV Cooling</strong>
                <small>Sales &amp; Service</small>
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

            <Link to="/account/profile" onClick={closeMenu}>
              <User size={18} />
              <span>My Account</span>
            </Link>
          </div>

          {authenticated === false && (
            <div className="mobile-nav-auth" aria-label="Customer sign in">
              <Link to="/login" state={loginState} onClick={closeMenu}>
                Log In
              </Link>

              <Link to="/register" onClick={closeMenu}>
                Sign Up
              </Link>
            </div>
          )}
        </aside>
      </div>,
      document.body,
    );

  return (
    <>
      <header className="public-nav">
        <div className="nav-inner">
          <Link to="/" className="brand" aria-label="AV Cooling home">
            <BrandLogo />

            <span>
              <b>AV Cooling</b>
              <small>Sales &amp; Service</small>
            </span>
          </Link>

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
              to="/account/profile"
              aria-label="Account"
              title="Account"
            >
              <User size={18} />
            </Link>

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

          {authenticated === false && (
            <div className="public-nav-auth" aria-label="Customer sign in">
              <Link to="/login" state={loginState}>
                Log In
              </Link>

              <Link to="/register">Sign Up</Link>
            </div>
          )}
        </div>
      </header>

      {mobileMenu}
    </>
  );
}
