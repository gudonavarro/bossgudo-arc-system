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

function validateFaqInput(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Provide FAQ details." };
  }

  const value = {};
  if (!partial || body.question !== undefined) {
    const question =
      typeof body.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 300) {
      return {
        error: "Question is required and must be at most 300 characters.",
      };
    }
    value.question = question;
  }
  if (!partial || body.answer !== undefined) {
    const answer = typeof body.answer === "string" ? body.answer.trim() : "";
    if (!answer || answer.length > 5000) {
      return { error: "Answer is required and must be at most 5000 characters." };
    }
    value.answer = answer;
  }
  if (!partial || body.keywords !== undefined) {
    if (
      !Array.isArray(body.keywords) ||
      body.keywords.length === 0 ||
      body.keywords.length > 30
    ) {
      return { error: "Provide between 1 and 30 keywords." };
    }

    const keywords = [];
    const seenKeywords = new Set();
    for (const rawKeyword of body.keywords) {
      if (typeof rawKeyword !== "string") {
        return { error: "Each keyword must be text." };
      }
      const keyword = rawKeyword.trim();
      if (!keyword || keyword.length > 80) {
        return {
          error: "Each keyword is required and must be at most 80 characters.",
        };
      }
      const normalizedKeyword = keyword.toLowerCase();
      if (!seenKeywords.has(normalizedKeyword)) {
        seenKeywords.add(normalizedKeyword);
        keywords.push(keyword);
      }
    }
    value.keywords = keywords;
  }

  if (body.active !== undefined && typeof body.active !== "boolean") {
    return { error: "Active must be a boolean." };
  }
  if (body.active !== undefined) {
    value.active = body.active;
  }
  if (partial && Object.keys(value).length === 0) {
    return { error: "Provide at least one FAQ field to update." };
  }

  return { value };
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

  router.post("/", async (request, response) => {
    const validation = validateFaqInput(request.body);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    try {
      const faq = await request.faqModel.create({
        ...validation.value,
        createdBy: request.authUser.id,
        updatedBy: request.authUser.id,
      });
      return response.status(201).json({ faq });
    } catch (error) {
      if (getErrorName(error) === "ValidationError") {
        return response.status(400).json({ error: "Invalid FAQ details." });
      }
      console.error("FAQ creation request failed:", getErrorName(error));
      return response.status(503).json({
        error: "FAQ data is temporarily unavailable.",
      });
    }
  });

  router.patch("/:id", async (request, response) => {
    const { id } = request.params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return response.status(400).json({ error: "Invalid FAQ id." });
    }
    const validation = validateFaqInput(request.body, { partial: true });
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }

    try {
      const faq = await request.faqModel.findByIdAndUpdate(
        id,
        {
          $set: {
            ...validation.value,
            updatedBy: request.authUser.id,
          },
        },
        { new: true, runValidators: true },
      ).select(FAQ_FIELDS).lean();
      if (!faq) {
        return response.status(404).json({ error: "FAQ not found." });
      }
      return response.status(200).json({ faq });
    } catch (error) {
      if (getErrorName(error) === "ValidationError") {
        return response.status(400).json({ error: "Invalid FAQ details." });
      }
      console.error("FAQ update request failed:", getErrorName(error));
      return response.status(503).json({
        error: "FAQ data is temporarily unavailable.",
      });
    }
  });

  router.delete("/:id", async (request, response) => {
    const { id } = request.params;
    if (!OBJECT_ID_PATTERN.test(id)) {
      return response.status(400).json({ error: "Invalid FAQ id." });
    }

    try {
      const faq = await request.faqModel.findByIdAndDelete(id).lean();
      if (!faq) {
        return response.status(404).json({ error: "FAQ not found." });
      }
      return response.status(200).json({ message: "FAQ deleted." });
    } catch (error) {
      console.error("FAQ deletion request failed:", getErrorName(error));
      return response.status(503).json({
        error: "FAQ data is temporarily unavailable.",
      });
    }
  });

  router.use((_request, response) => {
    return response.status(404).json({ error: "Not found." });
  });

  return router;
}

export { createFaqRouter, validateFaqInput };
