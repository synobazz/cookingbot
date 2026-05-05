import OpenAI from "openai";
import {
  openAIBaseUrl,
  plannerModel as plannerModelEnv,
  remixModel as remixModelEnv,
  requireOpenAIKey,
} from "@/lib/env";

export function getOpenAIClient() {
  return new OpenAI({
    apiKey: requireOpenAIKey(),
    baseURL: openAIBaseUrl(),
  });
}

/**
 * Resolve the model id at call time so env changes (and tests) take effect.
 * Defaults live in `lib/env.ts` and point at real, available OpenAI models.
 */
export function plannerModel(): string {
  return plannerModelEnv();
}

export function remixModel(): string {
  return remixModelEnv();
}
