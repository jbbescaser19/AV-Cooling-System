import connectDB from "../../utils/dbConn.js";

import { catalogAvailabilityModel } from "../../models/public/catalogAvailabilityModel.js";

export async function getPublicCatalogAvailability() {
  const rows = await catalogAvailabilityModel(connectDB).listCatalog();

  const products = new Map();
  const variants = [];

  for (const item of rows) {
    if (!products.has(item.productId)) {
      products.set(item.productId, {
        id: item.productId,
        name: item.name,
        brand: item.brand,
        model: item.model,
        category: item.category,
      });
    }

    // Products without variants remain in the catalog.
    if (item.variantId == null) {
      continue;
    }

    variants.push({
      productId: item.productId,
      hp: item.hp,
      variantId: Number(item.variantId),

      available: Math.max(0, Number(item.available) || 0),

      price: Number(item.price),
      srp: Number(item.srp),
    });
  }

  return {
    products: [...products.values()],
    variants,
    updatedAt: new Date().toISOString(),
  };
}
