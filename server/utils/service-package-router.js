import express from "express";
import { PACKAGE_CODE_PATTERN } from "../models/service-package";
import { HttpError } from "./service-booking";
import { sendPackageImage } from "./package-image-storage";
import { handlePackageError } from "./admin-service-package-router.js";
import { serializePublicPackage } from "./service-package";
import { publicCustomPondPricing } from "./service-catalog";

/**
 * Public package endpoints for the storefront. Only active packages are
 * visible; no login is required because the Shop page is public.
 */
function createServicePackageRouter() {
  const router = express.Router();

  router.get("/", async (request, response) => {
    const { ServicePackage } = request.packageModels;
    try {
      const packages = await ServicePackage.find({ status: "Active" })
        .sort({ sortOrder: 1, name: 1 })
        .lean();
      response.set("Cache-Control", "no-cache");
      return response.status(200).json({
        packages: packages.map(serializePublicPackage),
        customPondPricing: publicCustomPondPricing(),
      });
    } catch (error) {
      return handlePackageError(response, error, "Package list");
    }
  });

  router.get("/:code/image", async (request, response) => {
    const code = String(request.params.code ?? "").toLowerCase();
    const { connection, ServicePackage } = request.packageModels;
    try {
      if (!PACKAGE_CODE_PATTERN.test(code)) throw new HttpError(400, "Invalid package code.");
      const pkg = await ServicePackage.findOne({ code, status: "Active" }).lean();
      if (!pkg?.image?.fileId) throw new HttpError(404, "Photo not found.");
      const version = String(new Date(pkg.image.uploadedAt).getTime());
      // Versioned links never change content, so they can be cached long-term.
      const cacheControl =
        request.query.v === version
          ? "public, max-age=31536000, immutable"
          : "public, max-age=300";
      await sendPackageImage(response, connection, pkg, { cacheControl });
      return undefined;
    } catch (error) {
      if (response.headersSent || response.destroyed) {
        response.destroy();
        return undefined;
      }
      return handlePackageError(response, error, "Package photo");
    }
  });

  router.use((_request, response) => response.status(404).json({ error: "Not found." }));

  return router;
}

export { createServicePackageRouter };
