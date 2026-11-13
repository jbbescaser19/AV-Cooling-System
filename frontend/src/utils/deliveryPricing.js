/** Display-only rates. Backend recalculates the final fee on every checkout. */
export const DELIVERY_AREAS = [
  ["CALAMBA_LAGUNA", "Calamba, Laguna", 0],
  ["CABUYAO_LAGUNA", "Cabuyao, Laguna", 0],
  ["SANTA_ROSA_LAGUNA", "Santa Rosa, Laguna", 0],
  ["BINAN_LAGUNA", "Biñan, Laguna", 0],
  ["SAN_PEDRO_LAGUNA", "San Pedro, Laguna", 0],
  ["LOS_BANOS_LAGUNA", "Los Baños, Laguna", 0],
  ["BAY_LAGUNA", "Bay, Laguna", 0],
  ["CALAUAN_LAGUNA", "Calauan, Laguna", 0],
  ["VICTORIA_LAGUNA", "Victoria, Laguna", 0],
  ["SANTO_TOMAS_BATANGAS", "Santo Tomas, Batangas", 0],
  ["SAN_PABLO_LAGUNA", "San Pablo, Laguna", 800],
  ["SANTA_CRUZ_LAGUNA", "Santa Cruz, Laguna", 800],
  ["PAGSANJAN_LAGUNA", "Pagsanjan, Laguna", 1000],
  ["SINILOAN_LAGUNA", "Siniloan, Laguna", 1000],
  ["MAJAYJAY_LAGUNA", "Majayjay, Laguna", 1000],
];

export function displayedDeliveryFee(code) {
  const area = DELIVERY_AREAS.find((item) => item[0] === code);
  return area ? area[2] : null;
}

function normalizedPlace(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function containsPlace(address, place) {
  return ` ${normalizedPlace(address)} `.includes(
    ` ${normalizedPlace(place)} `,
  );
}

// Use the destination the customer typed, plus the chosen delivery zone.
// The backend still validates the zone and calculates the true price.
export function completeDeliveryAddress(address, areaCode) {
  const input = String(address || "").trim();
  const area = DELIVERY_AREAS.find(([code]) => code === areaCode);
  if (!input || !area) return input;
  const [city, province] = area[1].split(", ");
  const hasCity = containsPlace(input, city);
  const hasProvince = containsPlace(input, province);
  if (hasCity && hasProvince) return input;
  if (hasCity) return `${input}, ${province}`;
  if (hasProvince) return `${input}, ${city}`;
  return `${input}, ${city}, ${province}`;
}

// Do not silently append Calamba over an address explicitly stating another area.
export function deliveryAddressConflict(address, areaCode) {
  const area = DELIVERY_AREAS.find(([code]) => code === areaCode);
  if (!String(address || "").trim() || !area) return "";
  const [chosenCity, chosenProvince] = area[1].split(", ");
  const provinces = [
    ...new Set(DELIVERY_AREAS.map((item) => item[1].split(", ")[1])),
  ];
  const wrongProvince = provinces.find(
    (place) => place !== chosenProvince && containsPlace(address, place),
  );
  if (wrongProvince) {
    return `Your address mentions ${wrongProvince}, but you selected ${area[1]}. Choose the correct delivery area.`;
  }
  const other = DELIVERY_AREAS.find(([code, label]) => {
    if (code === areaCode) return false;
    const [city, province] = label.split(", ");
    return (
      containsPlace(address, city) &&
      containsPlace(address, province) &&
      (city !== chosenCity || province !== chosenProvince)
    );
  });
  return other
    ? `Your address mentions ${other[1]}, but you selected ${area[1]}. Choose the correct delivery area.`
    : "";
}
