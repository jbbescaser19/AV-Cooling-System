import connectDB from "../../utils/dbConn.js";
import { catalogAvailabilityModel } from "../../models/public/catalogAvailabilityModel.js";

export async function getPublicCatalogAvailability() {
  const variants =
    await catalogAvailabilityModel(connectDB).listAvailableVariants();
  return {
    variants: variants.map((item) => ({
      productId: item.productId,
      hp: item.hp,
      variantId: Number(item.variantId),
      available: Math.max(0, Number(item.available) || 0),
      price: Number(item.price),
      srp: Number(item.srp),
    })),
    updatedAt: new Date().toISOString(),
  };
}
