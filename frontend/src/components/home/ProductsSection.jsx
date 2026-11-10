import { useEffect, useMemo, useState } from "react";
import ProductRail from "../ecommerce/ProductRail";
import { readCatalogBrands } from "../../utils/catalogStore";
import useStorefrontCatalog from "../../hooks/useStorefrontCatalog";
import "../../styles/home/products.css";
export default function ProductsSection() {
  const { products: catalog, status } = useStorefrontCatalog();

  const brands = useMemo(() => readCatalogBrands(catalog), [catalog]);

  const [active, setActive] = useState(() => brands[0] || "");

  const go = (brand) => {
    setActive(brand);
    document
      .getElementById(`brand-${brand.replaceAll(" ", "-")}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section className="section products-section" id="products">
      <div className="container">
        <div className="section-head">
          <div className="eyebrow">Our Products</div>
          <h2 className="section-title">
            Compare trusted cooling options without crowding the screen.
          </h2>
          <p className="section-copy">
            Each device gets an intentional catalog layout: spacious cards on
            desktop, balanced rails on iPad/tablet, and touch-friendly swipe
            cards on phones.
          </p>
        </div>
        {status === "error" && (
          <p role="alert">
            Availability is temporarily unavailable. Please try again later.
          </p>
        )}
        <div className="brand-tabs">
          {brands.map((b) => (
            <button
              key={b}
              className={active === b ? "active" : ""}
              onClick={() => go(b)}
            >
              {b === "Carrier Floor Mounted" ? "Floor Mounted" : b}
            </button>
          ))}
        </div>
        {brands.map((b) => {
          const group = catalog.filter((p) => p.brand === b);
          return (
            <section
              className="brand-section"
              id={`brand-${b.replaceAll(" ", "-")}`}
              key={b}
            >
              <div className="brand-heading">
                <div>
                  <h3>{b === "Carrier Floor Mounted" ? "Floor Mounted" : b}</h3>
                  <p>{group[0]?.tagline}</p>
                </div>
                <span>{group.length} series</span>
              </div>
              <ProductRail items={group} />
            </section>
          );
        })}
      </div>
    </section>
  );
}
