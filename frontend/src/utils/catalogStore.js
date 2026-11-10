import {
  products as seedProducts,
  brandOrder as seedBrands,
} from "../data/products";
import { loadMock } from "./prototypeStore";

/**
 * Keep an admin-managed product list (including removed/custom products),
 * but refresh the official prices, capacities and installation information
 * for known catalog IDs. Old localStorage prices must not override these.
 * MySQL remains authoritative for authenticated cart and order pricing.
 */
export function readCatalogProducts() {
  const saved = loadMock("av_managed_products", seedProducts);
  const catalog = Array.isArray(saved) ? saved : seedProducts;
  const approved = new Map(
    seedProducts.map((product) => [product.id, product]),
  );

  return catalog.map((entry) => {
    const current = approved.get(entry?.id);
    if (!current) return entry;
    return {
      ...entry,
      name: current.name,
      brand: current.brand,
      variants: current.variants.map((variant) => ({ ...variant })),
      warranty: [...current.warranty],
      inclusions: [...current.inclusions],
      additionalCharges: [...current.additionalCharges],
      quotationOnly: Boolean(current.quotationOnly),
    };
  });
}

export function readCatalogBrands(items = readCatalogProducts()) {
  const found = [...new Set(items.map((item) => item.brand).filter(Boolean))];
  return [
    ...seedBrands.filter((brand) => found.includes(brand)),
    ...found.filter((brand) => !seedBrands.includes(brand)),
  ];
}
