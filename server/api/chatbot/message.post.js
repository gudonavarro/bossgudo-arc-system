import { createError, defineEventHandler, readBody } from "h3";
import { getFaqModel } from "../../models/faq.js";
import { connectMongoose } from "../../utils/mongoose";
import { getChatbotResponse } from "../../utils/chatbot.service.js";

const MAX_MESSAGE_LENGTH = 1000;

export function validateChatbotMessage(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provide a message.",
    });
  }

  const { message } = body;
  if (typeof message !== "string" || !message.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: "Provide a non-empty message.",
    });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw createError({
      statusCode: 400,
      statusMessage: "Message must be at most 1000 characters.",
    });
  }

  return message.trim();
}

export function createChatbotMessageHandler({
  readRequestBody = readBody,
  connect = connectMongoose,
  getModel = getFaqModel,
  getRuntimeConfig = (event) => useRuntimeConfig(event),
} = {}) {
  return defineEventHandler(async (event) => {
    const message = validateChatbotMessage(await readRequestBody(event));
    let activeFaqs;
    try {
      const connection = await connect(getRuntimeConfig(event));
      activeFaqs = await getModel(connection)
        .find({ active: true })
        .select("question keywords answer")
        .lean();
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "UnknownError";
      console.error("Chatbot FAQ lookup failed:", errorName);
      throw createError({
        statusCode: 503,
        statusMessage: "Chatbot is temporarily unavailable.",
      });
    }

    return {
      success: true,
      ...getChatbotResponse(message, activeFaqs),
    };
  });
}

export default createChatbotMessageHandler();
