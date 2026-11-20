/**
 * Server-side custom pond pricing. Predefined packages and their prices are
 * stored in MongoDB (`service_packages`); custom pond designs are priced from
 * this fixed formula. Booking amounts are always computed on the server and
 * never from client-supplied prices.
 *
 * All monetary values are stored in centavos.
 */
const CUSTOM_POND_PRICING = Object.freeze({
  name: "Custom Pond Design",
  ratePerSquareMetrePerLayerCents: 450 * 100,
  filtrationCents: 1_500 * 100,
  minLayers: 1,
  maxLayers: 3,
  minDimensionMetres: 1,
  maxDimensionMetres: 10,
});

/** Custom pond inputs: metres with up to two decimal places. */
export interface CustomPondDimensions {
  layers: number;
  width: number;
  length: number;
  filtration: boolean;
}

/**
 * Computes the custom pond price from layers, width, and length (metres,
 * up to two decimal places) and the filtration option.
 */
function calculateCustomPondCents({ layers, width, length, filtration }: CustomPondDimensions): number {
  const widthCentimetres = Math.round(width * 100);
  const lengthCentimetres = Math.round(length * 100);
  const areaCents =
    (widthCentimetres *
      lengthCentimetres *
      layers *
      CUSTOM_POND_PRICING.ratePerSquareMetrePerLayerCents) /
    10_000;
  return (
    Math.round(areaCents) +
    (filtration ? CUSTOM_POND_PRICING.filtrationCents : 0)
  );
}

/** Read-only custom pond pricing for display (pesos). */
function publicCustomPondPricing() {
  return {
    name: CUSTOM_POND_PRICING.name,
    ratePerSquareMetrePerLayer: CUSTOM_POND_PRICING.ratePerSquareMetrePerLayerCents / 100,
    filtration: CUSTOM_POND_PRICING.filtrationCents / 100,
    minLayers: CUSTOM_POND_PRICING.minLayers,
    maxLayers: CUSTOM_POND_PRICING.maxLayers,
    minDimensionMetres: CUSTOM_POND_PRICING.minDimensionMetres,
    maxDimensionMetres: CUSTOM_POND_PRICING.maxDimensionMetres,
  };
}

export { CUSTOM_POND_PRICING, calculateCustomPondCents, publicCustomPondPricing };
