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
