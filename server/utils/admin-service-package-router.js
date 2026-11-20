import express from "express";
import { createRequire } from "node:module";
import { PACKAGE_CODE_PATTERN, PACKAGE_STATUSES } from "../models/service-package";
import {
  HttpError,
  escapeRegExp,
  getErrorName,
  isDuplicateKeyError,
  withTransaction,
} from "./service-booking";
import {
  generatePackageCode,
  serializeAdminPackage,
  validatePackageInput,
} from "./service-package";
import { publicCustomPondPricing } from "./service-catalog";
import {
  MAX_PACKAGE_IMAGE_BYTES,
  PACKAGE_IMAGE_TYPES,
  deletePackageImageIfUnreferenced,
  sendPackageImage,
  storePackageImage,
  validatePackageImage,
} from "./package-image-storage";

const require = createRequire(import.meta.url);
const path = require("node:path");
const serverUtilsPath = (fileName) =>
  path.resolve(process.cwd(), "server", "utils", fileName);
const { createAuthenticationMiddleware } = require(
  serverUtilsPath("authenticate.js"),
);

const STAFF_FIELDS = "firstName lastName";
const MAX_SEARCH_LENGTH = 100;
const UNAVAILABLE = "The package catalog is temporarily unavailable.";

/** Maps package failures to safe responses in the project's error format. */
function handlePackageError(response, error, context) {
  if (error instanceof HttpError) {
    return response.status(error.status).json({ error: error.message });
  }
  if (isDuplicateKeyError(error, "code")) {
    // Two packages with the same name were saved at once and got the same code.
    return response.status(409).json({
      error: "Another package was saved at the same time. Please try again.",
    });
  }
  const errorName = getErrorName(error);
  if (errorName === "ValidationError") {
    const first = Object.values(error.errors ?? {})[0];
    return response.status(400).json({ error: first?.message || "Invalid package details." });
  }
  if (errorName === "VersionError") {
    return response.status(409).json({
      error: "This package was changed by another request. Refresh and try again.",
    });
  }
  console.error(`${context} request failed:`, errorName);
  return response.status(503).json({ error: UNAVAILABLE });
}

function codeFrom(request) {
  const code = String(request.params.code ?? "").toLowerCase();
  if (!PACKAGE_CODE_PATTERN.test(code)) throw new HttpError(400, "Invalid package code.");
  return code;
}

async function findPackageOrThrow(ServicePackage, code, session = null) {
  const pkg = await ServicePackage.findOne({ code }).session(session);
  if (!pkg) throw new HttpError(404, "Package not found.");
  return pkg;
}

/** Responds with a saved package, showing who created and last changed it. */
async function sendPackage(response, status, pkg) {
  await pkg.populate([
    { path: "createdBy", select: STAFF_FIELDS },
    { path: "updatedBy", select: STAFF_FIELDS },
  ]);
  return response.status(status).json({ package: serializeAdminPackage(pkg) });
}

function populateStaff(query) {
  return query.populate("createdBy", STAFF_FIELDS).populate("updatedBy", STAFF_FIELDS);
}

async function nextSortOrder(ServicePackage) {
  const last = await ServicePackage.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
  return last ? last.sortOrder + 1 : 0;
}

/**
 * Names a duplicate "X (Copy)", "X (Copy 2)", ... so it is easy to spot in
 * the list. Names may repeat, so this is a convenience, not a rule.
 */
async function copyName(ServicePackage, name) {
  const withSuffix = (suffix) => `${name.slice(0, 70 - suffix.length)}${suffix}`;
  for (let n = 1; n < 100; n += 1) {
    const candidate = withSuffix(n === 1 ? " (Copy)" : ` (Copy ${n})`);
    if (!(await ServicePackage.exists({ name: candidate }))) return candidate;
  }
  return withSuffix(" (Copy)");
}

function createAdminServicePackageRouter() {
  const router = express.Router();
  const authenticateAdmin = createAuthenticationMiddleware({ requiredRole: "admin" });

  router.use(authenticateAdmin);
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (request, response) => {
    const filter = {};
    const { status, search } = request.query;
    if (status !== undefined) {
      if (!PACKAGE_STATUSES.includes(status)) {
        return response.status(400).json({ error: "Status must be Active or Inactive." });
      }
      filter.status = status;
    }
    if (search !== undefined) {
      if (typeof search !== "string" || search.trim().length > MAX_SEARCH_LENGTH) {
        return response.status(400).json({ error: `Search must be at most ${MAX_SEARCH_LENGTH} characters.` });
      }
      if (search.trim()) {
        const pattern = new RegExp(escapeRegExp(search.trim()), "i");
        filter.$or = [{ name: pattern }, { description: pattern }, { inclusions: pattern }, { code: pattern }];
      }
    }
    const { ServicePackage } = request.packageModels;
    try {
      const packages = await populateStaff(
        ServicePackage.find(filter).sort({ sortOrder: 1, name: 1 }),
      ).lean();
      return response.status(200).json({
        packages: packages.map(serializeAdminPackage),
        customPondPricing: publicCustomPondPricing(),
      });
    } catch (error) {
      return handlePackageError(response, error, "Admin package list");
    }
  });

  router.get("/:code", async (request, response) => {
    const { ServicePackage } = request.packageModels;
    try {
      const pkg = await populateStaff(ServicePackage.findOne({ code: codeFrom(request) })).lean();
      if (!pkg) throw new HttpError(404, "Package not found.");
      return response.status(200).json({ package: serializeAdminPackage(pkg) });
    } catch (error) {
      return handlePackageError(response, error, "Admin package lookup");
    }
  });

  router.post("/", async (request, response) => {
    const validation = validatePackageInput(request.body);
    if (validation.error) return response.status(400).json({ error: validation.error });
    const { ServicePackage } = request.packageModels;
    const adminId = request.authUser.id;
    try {
      const pkg = new ServicePackage({
        ...validation.value,
        code: await generatePackageCode(ServicePackage, validation.value.name),
        category: "Pond Package",
        sortOrder: await nextSortOrder(ServicePackage),
        image: null,
        createdBy: adminId,
        updatedBy: adminId,
      });
      await pkg.save();
      return sendPackage(response, 201, pkg);
    } catch (error) {
      return handlePackageError(response, error, "Package creation");
    }
  });

  router.patch("/:code", async (request, response) => {
    const validation = validatePackageInput(request.body, { partial: true });
    if (validation.error) return response.status(400).json({ error: validation.error });
    const { ServicePackage } = request.packageModels;
    try {
      const pkg = await findPackageOrThrow(ServicePackage, codeFrom(request));
      pkg.set(validation.value);
      pkg.updatedBy = request.authUser.id;
      // Saving (not updateOne) runs the name normalization and reserved-name
      // checks, and optimistic concurrency rejects stale edits.
      await pkg.save();
      return sendPackage(response, 200, pkg);
    } catch (error) {
      return handlePackageError(response, error, "Package update");
    }
  });

  router.patch("/:code/status", async (request, response) => {
    const { status } = request.body ?? {};
    if (!PACKAGE_STATUSES.includes(status)) {
      return response.status(400).json({ error: "Status must be Active or Inactive." });
    }
    const { ServicePackage } = request.packageModels;
    try {
      const pkg = await findPackageOrThrow(ServicePackage, codeFrom(request));
      pkg.status = status;
      pkg.updatedBy = request.authUser.id;
      await pkg.save();
      return sendPackage(response, 200, pkg);
    } catch (error) {
      return handlePackageError(response, error, "Package status update");
    }
  });

  router.post("/:code/duplicate", async (request, response) => {
    const { ServicePackage } = request.packageModels;
    const adminId = request.authUser.id;
    try {
      const source = await findPackageOrThrow(ServicePackage, codeFrom(request));
      const name = await copyName(ServicePackage, source.name);
      // The copy shares the photo reference; files are only deleted once no
      // package references them.
      const copy = new ServicePackage({
        code: await generatePackageCode(ServicePackage, name),
        name,
        description: source.description,
        category: source.category,
        price: source.price,
        layers: source.layers,
        dimensions: source.dimensions,
        inclusions: [...source.inclusions],
        featured: false,
        sortOrder: await nextSortOrder(ServicePackage),
        status: "Inactive",
        image: source.image ? source.image.toObject() : null,
        createdBy: adminId,
        updatedBy: adminId,
      });
      await copy.save();
      return sendPackage(response, 201, copy);
    } catch (error) {
      return handlePackageError(response, error, "Package duplication");
    }
  });

  router.patch("/:code/order", async (request, response) => {
    const { direction } = request.body ?? {};
    if (!["up", "down"].includes(direction)) {
      return response.status(400).json({ error: "Direction must be up or down." });
    }
    const { connection, ServicePackage } = request.packageModels;
    try {
      const code = codeFrom(request);
      const moved = await withTransaction(connection, async (session) => {
        const pkg = await findPackageOrThrow(ServicePackage, code, session);
        const neighbour = await ServicePackage.findOne({
          _id: { $ne: pkg._id },
          sortOrder: direction === "up" ? { $lte: pkg.sortOrder } : { $gte: pkg.sortOrder },
        })
          .sort(direction === "up" ? { sortOrder: -1, name: -1 } : { sortOrder: 1, name: 1 })
          .session(session);
        if (!neighbour) {
          throw new HttpError(409, `This package is already ${direction === "up" ? "first" : "last"}.`);
        }
        let [mine, theirs] = [neighbour.sortOrder, pkg.sortOrder];
        if (mine === theirs) {
          // Equal orders (legacy data): separate them in the requested direction.
          mine = direction === "up" ? Math.max(0, theirs - 1) : theirs + 1;
        }
        pkg.sortOrder = mine;
        neighbour.sortOrder = theirs;
        pkg.updatedBy = request.authUser.id;
        await pkg.save({ session });
        await neighbour.save({ session });
        return pkg;
      });
      return sendPackage(response, 200, moved);
    } catch (error) {
      return handlePackageError(response, error, "Package reorder");
    }
  });

  router.put(
    "/:code/image",
    express.raw({ type: PACKAGE_IMAGE_TYPES, limit: MAX_PACKAGE_IMAGE_BYTES }),
    async (request, response) => {
      const contentType = String(request.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!PACKAGE_IMAGE_TYPES.includes(contentType)) {
        return response.status(415).json({ error: "Upload the photo as a JPG, PNG or WEBP image." });
      }
      const invalid = validatePackageImage(request.body, contentType);
      if (invalid) return response.status(400).json({ error: invalid });

      const { connection, ServicePackage } = request.packageModels;
      let newFileId = null;
      try {
        const pkg = await findPackageOrThrow(ServicePackage, codeFrom(request));
        const previousFileId = pkg.image?.fileId ?? null;
        newFileId = await storePackageImage(connection, request.body, { contentType, code: pkg.code });
        pkg.image = { fileId: newFileId, contentType, size: request.body.length, uploadedAt: new Date() };
        pkg.updatedBy = request.authUser.id;
        await pkg.save();
        newFileId = null; // now referenced by the package
        await deletePackageImageIfUnreferenced(connection, ServicePackage, previousFileId);
        return sendPackage(response, 200, pkg);
      } catch (error) {
        if (newFileId) {
          await deletePackageImageIfUnreferenced(connection, ServicePackage, newFileId).catch(() => {});
        }
        return handlePackageError(response, error, "Package photo upload");
      }
    },
  );

  router.delete("/:code/image", async (request, response) => {
    const { connection, ServicePackage } = request.packageModels;
    try {
      const pkg = await findPackageOrThrow(ServicePackage, codeFrom(request));
      const previousFileId = pkg.image?.fileId ?? null;
      if (previousFileId) {
        pkg.image = null;
        pkg.updatedBy = request.authUser.id;
        await pkg.save();
        await deletePackageImageIfUnreferenced(connection, ServicePackage, previousFileId);
      }
      return sendPackage(response, 200, pkg);
    } catch (error) {
      return handlePackageError(response, error, "Package photo removal");
    }
  });

  router.get("/:code/image", async (request, response) => {
    const { connection, ServicePackage } = request.packageModels;
    try {
      const pkg = await ServicePackage.findOne({ code: codeFrom(request) }).lean();
      if (!pkg?.image?.fileId) throw new HttpError(404, "Photo not found.");
      await sendPackageImage(response, connection, pkg, { cacheControl: "no-store" });
      return undefined;
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return undefined;
      }
      return handlePackageError(response, error, "Package photo download");
    }
  });

  router.use((_request, response) => response.status(404).json({ error: "Not found." }));

  // Body parser failures on the photo upload route.
  router.use((error, _request, response, _next) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({ error: "Photos must be 5 MB or smaller." });
    }
    if (error?.status === 400) {
      return response.status(400).json({ error: "The upload could not be read." });
    }
    return handlePackageError(response, error, "Package catalog");
  });

  return router;
}

export { createAdminServicePackageRouter, handlePackageError };
