import { getPublicCatalogAvailability } from "../../services/public/catalogAvailabilityService.js";

export async function publicCatalogAvailabilityController(_req, res) {
  try {
    const result = await getPublicCatalogAvailability();
    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Public catalog availability:", error);
    return res.status(503).json({
      success: false,
      message: "Product availability is temporarily unavailable.",
    });
  }
}
