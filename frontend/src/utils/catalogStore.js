import { products as seedProducts, brandOrder as seedBrands } from "../data/products";
import { loadMock } from "./prototypeStore";
export const readCatalogProducts = () => loadMock("av_managed_products", seedProducts);
export const readCatalogBrands = (items = readCatalogProducts()) => {
  const found = [...new Set(items.map((item) => item.brand).filter(Boolean))];
  return [...seedBrands.filter((brand) => found.includes(brand)), ...found.filter((brand) => !seedBrands.includes(brand))];
};
