/** AV Cooling's photographed worksheet, expressed in kJ per hour.
 * This is a simplified educational heat-load estimate, NOT an HVAC design certification.
 * HP names are catalog labels, not a mechanical horsepower conversion.
 */
const KJ_PER_BTU = 1.05505585262;
export const WORKSHEET_CAPACITIES = Object.freeze([
  { label: "1.0 HP", hp: 1, kJhr: 9495 },
  { label: "1.5 HP", hp: 1.5, kJhr: 12660 },
  { label: "2.0 HP", hp: 2, kJhr: 18990 },
  { label: "2.5 HP", hp: 2.5, kJhr: 25320 },
  { label: "3.0 HP", hp: 3, kJhr: 28485 },
  { label: "3 TR", hp: null, kJhr: 37980 },
  { label: "4 TR", hp: null, kJhr: 50640 },
  { label: "5 TR", hp: null, kJhr: 63300 },
]);

export const MAX_PLANNING_UNITS = 12;
export const MIN_RECOMMENDED_HP = 0;

function parseHp(value) {
  if (typeof value === "number") return value;
  const match = String(value ?? "")
    .trim()
    .match(/^(\d+(?:\.\d+)?)\s*(?:HP)?$/i);
  return match ? Number(match[1]) : NaN;
}

/** Do NOT invent ratings for 0.8, 3.5, 4 or 5 HP. If the API later exposes
 * model-rated cooling capacity, it can be used instead of these worksheet values.
 */
export function approximateBTUForHP(hp) {
  const match = WORKSHEET_CAPACITIES.find((row) => row.hp === Number(hp));
  return match ? Math.round(match.kJhr / KJ_PER_BTU) : null;
}

export function catalogHPOptionsFromVariants(variants) {
  if (!Array.isArray(variants)) return [];
  const grouped = new Map();
  for (const variant of variants) {
    if (!variant || variant.status === "INACTIVE") continue;
    const hp = parseHp(variant.hp ?? variant.horsepower);
    if (!Number.isFinite(hp) || hp <= 0 || hp > 20) continue;
    const key = Math.round(hp * 100) / 100;
    const ratedBTU = Number(
      variant.coolingCapacityBTU || variant.ratedBTU || 0,
    );
    const nominalBTU = ratedBTU > 0 ? ratedBTU : approximateBTUForHP(key);
    const previous = grouped.get(key) || {
      hp: key,
      label: `${key} HP`,
      nominalBTU: nominalBTU || null,
      availableQuantity: 0,
      variantCount: 0,
    };
    previous.variantCount += 1;
    previous.availableQuantity += Math.max(
      0,
      Math.floor(Number(variant.available) || 0),
    );
    if (
      nominalBTU &&
      (!previous.nominalBTU || nominalBTU > previous.nominalBTU)
    ) {
      previous.nominalBTU = nominalBTU;
    }
    grouped.set(key, previous);
  }
  return [...grouped.values()].sort((a, b) => a.hp - b.hp);
}

function number(value, min, max, integer = false) {
  const n = Number(value);
  return Number.isFinite(n) &&
    n >= min &&
    n <= max &&
    (!integer || Number.isInteger(n))
    ? n
    : null;
}

export function estimateHeatLoad({
  area,
  usage = "RESIDENTIAL",
  occupants = 0,
  glassPanels = 0,
  sunExposures = 0,
  computers = 0,
  tvs = 0,
  lightingUnits = 0,
  refrigerators = 0,
  kitchenUnits = 0,
  otherHeatKJHR = 0,
  ceilingFeet = 8,
}) {
  const values = {
    area: number(area, 1, 1000),
    occupants: number(occupants, 0, 200, true),
    glassPanels: number(glassPanels, 0, 200, true),
    sunExposures: number(sunExposures, 0, 200, true),
    computers: number(computers, 0, 200, true),
    tvs: number(tvs, 0, 200, true),
    lightingUnits: number(lightingUnits, 0, 1000, true),
    refrigerators: number(refrigerators, 0, 100, true),
    kitchenUnits: number(kitchenUnits, 0, 50, true),
    otherHeatKJHR: number(otherHeatKJHR, 0, 1e6),
    ceilingFeet: number(ceilingFeet, 6, 30),
  };
  if (
    Object.values(values).some((n) => n === null) ||
    !["RESIDENTIAL", "COMMERCIAL"].includes(usage)
  )
    return null;
  const factors = [
    ["Room area", values.area, usage === "RESIDENTIAL" ? 600 : 800],
    ["Occupants", values.occupants, 600],
    ["Window / wall glass (4 × 4 ft)", values.glassPanels, 600],
    ["Sunlight exposures", values.sunExposures, 50],
    ["Computer sets", values.computers, 600],
    ["TV / Plasma / LCD", values.tvs, 360],
    ["Lighting units", values.lightingUnits, 36],
    ["Refrigerators", values.refrigerators, 360],
    ["Working kitchens", values.kitchenUnits, 1000],
    ["Other heat sources", values.otherHeatKJHR, 1],
  ];
  const breakdown = factors.map(([label, count, rate]) => ({
    label,
    count,
    rate,
    load: count * rate,
  }));
  const subtotalKJHR = breakdown.reduce((sum, row) => sum + row.load, 0);
  const heightPercent = values.ceilingFeet > 10 ? 10 : 0;
  const heightAdjustmentKJHR = heightPercent ? subtotalKJHR * 0.1 : 0;
  const totalKJHR = Math.ceil(subtotalKJHR + heightAdjustmentKJHR);
  const totalBTU = Math.ceil(totalKJHR / KJ_PER_BTU);
  return {
    totalKJHR,
    totalBTU,
    subtotalKJHR,
    heightPercent,
    heightAdjustmentKJHR,
    breakdown,
    approxKW: totalKJHR / 3600,
  };
}

function labelFor(units) {
  return units.map((item) => `${item.quantity} × ${item.label}`).join(" + ");
}

/** Catalog HP options are the ONLY candidates. Unknown rated capacities stay
 * visible in the offered list but cannot be automatically recommended.
 */
export function recommendAirconSize(totalBTU, catalogOptions = []) {
  const demand = Number(totalBTU);
  if (!Number.isFinite(demand) || demand <= 0 || !Array.isArray(catalogOptions))
    return null;
  const all = catalogOptions.filter(
    (item) => Number.isFinite(Number(item.hp)) && Number(item.hp) > 0,
  );
  const options = all
    .filter((item) => Number(item.nominalBTU) > 0)
    .map((item) => ({ ...item, nominalBTU: Number(item.nominalBTU) }))
    .sort((a, b) => b.nominalBTU - a.nominalBTU);
  if (!options.length) return null;
  const smallestCount = Math.ceil(demand / options[0].nominalBTU);
  if (smallestCount > MAX_PLANNING_UNITS) return null;
  const found = [];
  function search(index, left, total, units) {
    if (index === options.length) {
      if (left === 0 && total >= demand) {
        const count = units.reduce((sum, x) => sum + x.quantity, 0);
        const shortage = units.reduce(
          (sum, x) =>
            sum + Math.max(0, x.quantity - (Number(x.availableQuantity) || 0)),
          0,
        );
        found.push({
          units,
          label: labelFor(units),
          unitCount: count,
          nominalBTU: total,
          excessBTU: total - demand,
          stockShortage: shortage,
          allInStock: shortage === 0,
          isMultiUnit: count > 1,
        });
      }
      return;
    }
    if (total + left * options[index].nominalBTU < demand) return;
    for (let q = left; q >= 0; q--) {
      search(
        index + 1,
        left - q,
        total + q * options[index].nominalBTU,
        q > 0 ? [...units, { ...options[index], quantity: q }] : units,
      );
    }
  }
  for (
    let count = smallestCount;
    count <= Math.min(MAX_PLANNING_UNITS, smallestCount + 1);
    count++
  ) {
    search(0, count, 0, []);
  }
  found.sort(
    (a, b) =>
      a.unitCount - b.unitCount ||
      a.excessBTU - b.excessBTU ||
      a.stockShortage - b.stockShortage,
  );
  if (!found.length) return null;
  return {
    ...found[0],
    minCatalogHP: Math.min(...all.map((item) => Number(item.hp))),
    maxCatalogHP: Math.max(...all.map((item) => Number(item.hp))),
    alternatives: found.slice(1, 3),
  };
}
