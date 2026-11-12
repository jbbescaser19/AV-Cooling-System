/** Official AV Cooling per-trip delivery prices (PHP).
 * Pure business logic: no SQL or HTTP. Server recomputes all charges.
 * A customer must select one supported municipality; unknown areas require a quote.
 */
export const DELIVERY_AREAS = Object.freeze({
  CALAMBA_LAGUNA: {
    city: "Calamba",
    province: "Laguna",
    fee: 0,
    aliases: ["calamba"],
  },
  CABUYAO_LAGUNA: {
    city: "Cabuyao",
    province: "Laguna",
    fee: 0,
    aliases: ["cabuyao"],
  },
  SANTA_ROSA_LAGUNA: {
    city: "Santa Rosa",
    province: "Laguna",
    fee: 0,
    aliases: ["santa rosa", "sta rosa"],
  },
  BINAN_LAGUNA: {
    city: "Biñan",
    province: "Laguna",
    fee: 0,
    aliases: ["binan"],
  },
  SAN_PEDRO_LAGUNA: {
    city: "San Pedro",
    province: "Laguna",
    fee: 0,
    aliases: ["san pedro"],
  },
  LOS_BANOS_LAGUNA: {
    city: "Los Baños",
    province: "Laguna",
    fee: 0,
    aliases: ["los banos"],
  },
  BAY_LAGUNA: { city: "Bay", province: "Laguna", fee: 0, aliases: ["bay"] },
  CALAUAN_LAGUNA: {
    city: "Calauan",
    province: "Laguna",
    fee: 0,
    aliases: ["calauan"],
  },
  VICTORIA_LAGUNA: {
    city: "Victoria",
    province: "Laguna",
    fee: 0,
    aliases: ["victoria"],
  },
  SANTO_TOMAS_BATANGAS: {
    city: "Santo Tomas",
    province: "Batangas",
    fee: 0,
    aliases: ["santo tomas", "sto tomas"],
  },
  SAN_PABLO_LAGUNA: {
    city: "San Pablo",
    province: "Laguna",
    fee: 800,
    aliases: ["san pablo"],
  },
  SANTA_CRUZ_LAGUNA: {
    city: "Santa Cruz",
    province: "Laguna",
    fee: 800,
    aliases: ["santa cruz", "sta cruz"],
  },
  PAGSANJAN_LAGUNA: {
    city: "Pagsanjan",
    province: "Laguna",
    fee: 1000,
    aliases: ["pagsanjan"],
  },
  SINILOAN_LAGUNA: {
    city: "Siniloan",
    province: "Laguna",
    fee: 1000,
    aliases: ["siniloan"],
  },
  MAJAYJAY_LAGUNA: {
    city: "Majayjay",
    province: "Laguna",
    fee: 1000,
    aliases: ["majayjay"],
  },
});

function normalized(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getDeliveryFee(areaCode, address) {
  const area = DELIVERY_AREAS[areaCode];
  if (!area) {
    throw Object.assign(
      new Error(
        "This location needs a custom delivery quotation. Contact AV Cooling before ordering.",
      ),
      { status: 422 },
    );
  }
  const full = ` ${normalized(address)} `;
  const cityMatches = area.aliases.some((alias) => full.includes(` ${alias} `));
  const provinceMatches = full.includes(` ${normalized(area.province)} `);
  if (!cityMatches || !provinceMatches) {
    throw Object.assign(
      new Error(
        `Include ${area.city}, ${area.province} in the delivery address so the selected rate can be verified.`,
      ),
      { status: 422 },
    );
  }
  return area.fee;
}

/** Determine a published zone from a complete staff-entered address.
 * No matching or multiple matching zones => require a manual quotation.
 */
export function quoteDeliveryFromAddress(address) {
  const full = ` ${normalized(address)} `;
  const matches = Object.entries(DELIVERY_AREAS).filter(
    ([, area]) =>
      full.includes(` ${normalized(area.province)} `) &&
      area.aliases.some((alias) => full.includes(` ${alias} `)),
  );
  if (matches.length !== 1) {
    throw Object.assign(
      new Error(
        "Delivery destination is outside the published rate zones or is unclear. Obtain a Manager-approved quotation before converting the Facebook order.",
      ),
      { status: 422 },
    );
  }
  return { areaCode: matches[0][0], fee: matches[0][1].fee };
}
