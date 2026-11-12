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

/** Complete a staff-entered address using its selected published delivery zone. */
export function completeDeliveryAddress(address, areaCode) {
  const typed = String(address || "").trim();
  const area = DELIVERY_AREAS.find(([code]) => code === areaCode);
  if (!typed || !area) return typed;
  const [city, province] = area[1].split(", ");
  const hasCity = includesPlace(typed, city);
  const hasProvince = includesPlace(typed, province);
  if (hasCity && hasProvince) return typed;
  if (hasCity) return `${typed}, ${province}`;
  if (hasProvince) return `${typed}, ${city}`;
  return `${typed}, ${city}, ${province}`;
}

function normalizePlace(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function includesPlace(address, place) {
  return ` ${normalizePlace(address)} `.includes(` ${normalizePlace(place)} `);
}

/** Do not auto-append a selected area over a conflicting explicit address. */
export function deliveryAddressConflict(address, areaCode) {
  const area = DELIVERY_AREAS.find(([code]) => code === areaCode);
  if (!String(address || "").trim() || !area) return "";
  const [, selectedLabel] = area;
  const [selectedCity, selectedProvince] = selectedLabel.split(", ");
  const provinces = [
    ...new Set(DELIVERY_AREAS.map((item) => item[1].split(", ")[1])),
  ];
  const wrongProvince = provinces.find(
    (province) =>
      province !== selectedProvince && includesPlace(address, province),
  );
  if (wrongProvince) {
    return `Your address mentions ${wrongProvince}, but you selected ${selectedLabel}. Choose the correct delivery area.`;
  }
  const otherArea = DELIVERY_AREAS.find(([code, label]) => {
    if (code === areaCode) return false;
    const [city, province] = label.split(", ");
    return (
      includesPlace(address, city) &&
      includesPlace(address, province) &&
      (city !== selectedCity || province !== selectedProvince)
    );
  });
  return otherArea
    ? `Your address mentions ${otherArea[1]}, but you selected ${selectedLabel}. Choose the correct delivery area.`
    : "";
}
