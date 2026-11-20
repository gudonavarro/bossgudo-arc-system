import type { Model } from "mongoose";
import { fromCents } from "./money";
import type { ServicePackage } from "../models/service-package";

export interface InitialServicePackage {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly priceCents: number;
  readonly layers: string;
  readonly dimensions: string;
  readonly inclusions: readonly string[];
  readonly featured: boolean;
  readonly sortOrder: number;
}

/** The parts of the ServicePackage model the seed uses. */
type SeedablePackageModel = Pick<Model<ServicePackage>, "exists"> &
  (new (fields: Partial<ServicePackage>) => { save(): Promise<unknown> });

/**
 * The three packages the farm offered before the catalog moved to MongoDB.
 * Prices come from the former server catalog; descriptions, inclusions
 * (the former single "freebie") and the featured flag come from the former
 * storefront catalog. They are also the record of what bookings made before
 * the move were priced from (see the booking snapshot migration).
 */
const INITIAL_SERVICE_PACKAGES: readonly InitialServicePackage[] = Object.freeze([
  Object.freeze({
    code: "pk1",
    name: "Pond Starter Package",
    description: "A compact starter pond setup for new growers.",
    priceCents: 6_500 * 100,
    layers: "1 layer",
    dimensions: "2 m × 2 m",
    inclusions: Object.freeze(["Free starter water-test kit"]),
    featured: false,
    sortOrder: 0,
  }),
  Object.freeze({
    code: "pk2",
    name: "Pond Grower Package",
    description: "A larger pond setup for customers ready to expand.",
    priceCents: 9_500 * 100,
    layers: "2 layers",
    dimensions: "2 m × 3 m",
    inclusions: Object.freeze(["Free 500 g starter crayfish feed"]),
    featured: true,
    sortOrder: 1,
  }),
  Object.freeze({
    code: "pk3",
    name: "Pond Pro Package",
    description: "A larger three-layer setup for more advanced use.",
    priceCents: 14_500 * 100,
    layers: "3 layers",
    dimensions: "3 m × 3 m",
    inclusions: Object.freeze(["Free 10 juvenile crayfish"]),
    featured: false,
    sortOrder: 2,
  }),
]);

/**
 * Inserts any of the initial packages that do not exist yet. Existing
 * packages (matched by code) are never modified, so the seed can be re-run
 * safely after the owner has edited the catalog.
 */
async function seedServicePackages(
  ServicePackage: SeedablePackageModel,
): Promise<{ inserted: number; total: number }> {
  let inserted = 0;
  // Packages are seeded one at a time on purpose: the first unexpected
  // failure stops the seed, which Promise.all would not do.
  for (const definition of INITIAL_SERVICE_PACKAGES) {
    const exists = await ServicePackage.exists({ code: definition.code }); // NOSONAR: sequential by design
    if (exists) continue;
    const document = new ServicePackage({
      code: definition.code,
      name: definition.name,
      description: definition.description,
      category: "Pond Package",
      price: fromCents(definition.priceCents),
      layers: definition.layers,
      dimensions: definition.dimensions,
      inclusions: [...definition.inclusions],
      featured: definition.featured,
      sortOrder: definition.sortOrder,
      status: "Active",
      image: null,
    });
    try {
      await document.save(); // NOSONAR: sequential by design
      inserted += 1;
    } catch (error) {
      // A concurrent seed run inserted it first; keep that record.
      if ((error as { code?: unknown } | null)?.code !== 11000) throw error;
    }
  }
  return { inserted, total: INITIAL_SERVICE_PACKAGES.length };
}

export { INITIAL_SERVICE_PACKAGES, seedServicePackages };
