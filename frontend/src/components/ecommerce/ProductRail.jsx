import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ProductCard from "./ProductCard";
import "../../styles/home/products.css";

export default function ProductRail({ items = [] }) {
  const railRef = useRef(null);
  const hasMultiple = items.length > 1;

  const move = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.82,
      behavior: "smooth",
    });
  };

  if (!items.length) return null;

  return (
    <div className="product-rail-wrap">
      {hasMultiple && (
        <button
          type="button"
          className="rail-arrow left"
          aria-label="Scroll products left"
          onClick={() => move(-1)}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <div className="product-rail" ref={railRef}>
        {items.map((product) => (
          <div className="product-rail-item" key={product.id}>
            <ProductCard product={product} />
          </div>
        ))}
      </div>

      {hasMultiple && (
        <button
          type="button"
          className="rail-arrow right"
          aria-label="Scroll products right"
          onClick={() => move(1)}
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}
