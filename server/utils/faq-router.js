import express from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createAuthenticationMiddleware } = require("./authenticate.js");
const FAQ_FIELDS =
  "question keywords answer active createdBy updatedBy createdAt updatedAt";
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

function getErrorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

function createFaqRouter() {
  const router = express.Router();
  const authenticateAdmin = createAuthenticationMiddleware({
    requiredRole: "admin",
  });

  router.use(authenticateAdmin);
  router.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (request, response) => {
    try {
      const faqs = await request.faqModel
        .find({})
        .select(FAQ_FIELDS)
        .sort({ createdAt: -1, _id: 1 })
        .lean();
      return response.status(200).json({ faqs });
    } catch (error) {
      console.error("FAQ list request failed:", getErrorName(error));
      return response.status(503).json({
        error: "FAQ data is temporarily unavailable.",
      });
    }
  });

  router.get("/:id", async (request, response) => {
    const { id } = request.params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return response.status(400).json({ error: "Invalid FAQ id." });
    }

    try {
      const faq = await request.faqModel
        .findById(id)
        .select(FAQ_FIELDS)
        .lean();
      if (!faq) {
        return response.status(404).json({ error: "FAQ not found." });
      }
      return response.status(200).json({ faq });
    } catch (error) {
      console.error("FAQ lookup request failed:", getErrorName(error));
      return response.status(503).json({
        error: "FAQ data is temporarily unavailable.",
      });
    }
  });

  return router;
}

export { createFaqRouter };
