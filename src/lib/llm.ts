import OpenAI from "openai";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
}

export const plannerModel = process.env.OPENAI_PLANNER_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini";
export const remixModel = process.env.OPENAI_REMIX_MODEL || process.env.OPENAI_MODEL || "gpt-5.5";
