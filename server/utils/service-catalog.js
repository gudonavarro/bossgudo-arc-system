/**
 * Server-side source of truth for service booking prices.
 *
 * These values mirror the package catalog and custom pond pricing that the
 * storefront currently displays (app/legacy/script.js). Booking amounts are
 * always computed from this catalog and never from client-supplied prices.
 * Replace this module with a database-backed catalog when package management
 * is implemented.
 *
 * All monetary values are stored in centavos.
 */
const SERVICE_PACKAGES = Object.freeze([
  Object.freeze({
    id: "pk1",
    name: "Pond Starter Package",
    priceCents: 6_500_00,
    layers: "1 layer",
    dimensions: "2 m × 2 m",
    active: true,
  }),
  Object.freeze({
    id: "pk2",
    name: "Pond Grower Package",
    priceCents: 9_500_00,
    layers: "2 layers",
    dimensions: "2 m × 3 m",
    active: true,
  }),
  Object.freeze({
    id: "pk3",
    name: "Pond Pro Package",
    priceCents: 14_500_00,
    layers: "3 layers",
    dimensions: "3 m × 3 m",
    active: true,
  }),
]);

const CUSTOM_POND_PRICING = Object.freeze({
  name: "Custom Pond Design",
  ratePerSquareMetrePerLayerCents: 450_00,
  filtrationCents: 1_500_00,
  minLayers: 1,
  maxLayers: 3,
  minDimensionMetres: 1,
  maxDimensionMetres: 10,
});

function findActivePackage(packageId) {
  return (
    SERVICE_PACKAGES.find(
      (servicePackage) => servicePackage.id === packageId && servicePackage.active,
    ) ?? null
  );
}

/**
 * Computes the custom pond price from layers, width, and length (metres,
 * up to two decimal places) and the filtration option.
 */
function calculateCustomPondCents({ layers, width, length, filtration }) {
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

export {
  CUSTOM_POND_PRICING,
  SERVICE_PACKAGES,
  calculateCustomPondCents,
  findActivePackage,
};
