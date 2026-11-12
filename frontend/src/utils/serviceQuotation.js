/** Preview only. The backend calculates the amount charged. */
export function previewServiceQuote(
  code,
  basePrice,
  feet = 10,
  includeDismantling = false,
) {
  if (code === "dismantling") return 2000;
  if (code !== "reinstallation") return Number(basePrice) || 0;
  const copperFeet = Number(feet);
  if (!Number.isInteger(copperFeet) || copperFeet < 1 || copperFeet > 100)
    return null;
  return (
    5000 + Math.max(0, copperFeet - 10) * 450 + (includeDismantling ? 2000 : 0)
  );
}
