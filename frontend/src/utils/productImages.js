/**
 * Product photos already bundled with AV Cooling System.
 * Matching by catalog ID ensures that each series shows its own unit,
 * even when the catalog is loaded from localStorage.
 */
import mideaCelest from "../assets/aircons/midea/midea.png";
import daikinAmihan from "../assets/aircons/daikin/amihan.png";
import daikinDSmart from "../assets/aircons/daikin/dSmart.png";
import daikinQueen from "../assets/aircons/daikin/dsmartQueen.png";
import daikinKing from "../assets/aircons/daikin/dsmartKing.png";
import carrierNexus from "../assets/aircons/carrier/nexus.png";
import carrierOptima from "../assets/aircons/carrier/optima.png";
import carrierAura from "../assets/aircons/carrier/aura.png";
import carrierFloorMounted from "../assets/aircons/carrier/mounted.png";
import hisenseHiSmart from "../assets/aircons/hisense/hisense.png";
import matrixInverter from "../assets/aircons/matrix/matrix.png";

const catalogPhotos = {
  "midea-celest-pro": mideaCelest,
  "daikin-amihan": daikinAmihan,
  "daikin-d-smart": daikinDSmart,
  "daikin-d-smart-queen": daikinQueen,
  "daikin-d-smart-king": daikinKing,
  "carrier-nexus": carrierNexus,
  "carrier-optima": carrierOptima,
  "carrier-aura": carrierAura,
  "floor-mounted-commercial": carrierFloorMounted,
  "hisense-hi-smart": hisenseHiSmart,
  "matrix-inverter": matrixInverter,
};

export function getProductImage(product) {
  if (!product) return null;

  // Respect any photo added later through management product editing.
  const customPhoto = product.imageUrl || product.image;
  if (typeof customPhoto === "string" && customPhoto.trim()) {
    return customPhoto.trim();
  }

  // No mismatched generic brand photos for newly added product models.
  return catalogPhotos[product.id] || null;
}
