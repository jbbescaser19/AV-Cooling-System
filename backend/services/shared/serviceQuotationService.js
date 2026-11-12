/** AV Cooling published service rate calculation, PHP. No SQL here.
 * Reinstallation: up to 10 feet included, then 450 PHP per extra full foot.
 * Dismantling: 2,000 PHP, separately when requested.
 * Other services use their active service type's stored base price.
 */
const DISMANTLING_PHP = 2000;
const REINSTALLATION_BASE_PHP = 5000;
const INCLUDED_COPPER_FEET = 10;
const EXCESS_COPPER_PHP_PER_FOOT = 450;

export function quoteService({
  code,
  basePrice,
  copperFeet = 10,
  includeDismantling = false,
}) {
  const currentBase = Number(basePrice);
  if (!Number.isFinite(currentBase) || currentBase < 0) {
    throw Object.assign(new Error("The service base price is invalid."), {
      status: 409,
    });
  }
  if (code !== "reinstallation") {
    if (includeDismantling || Number(copperFeet) !== 10) {
      throw Object.assign(
        new Error(
          "Copper length and additional dismantling apply to reinstallation only.",
        ),
        { status: 400 },
      );
    }
    return {
      total: code === "dismantling" ? DISMANTLING_PHP : currentBase,
      base: code === "dismantling" ? DISMANTLING_PHP : currentBase,
      excessFeet: 0,
      extraCopperFee: 0,
      dismantlingFee: 0,
    };
  }
  const feet = Number(copperFeet);
  if (!Number.isInteger(feet) || feet < 1 || feet > 100) {
    throw Object.assign(
      new Error("Enter the total copper length in whole feet (1–100)."),
      { status: 400 },
    );
  }
  const excessFeet = Math.max(0, feet - INCLUDED_COPPER_FEET);
  const extraCopperFee = excessFeet * EXCESS_COPPER_PHP_PER_FOOT;
  const dismantlingFee = includeDismantling ? DISMANTLING_PHP : 0;
  return {
    total: REINSTALLATION_BASE_PHP + extraCopperFee + dismantlingFee,
    base: REINSTALLATION_BASE_PHP,
    excessFeet,
    extraCopperFee,
    dismantlingFee,
  };
}
