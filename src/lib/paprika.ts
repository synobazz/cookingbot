import { gzipSync } from "node:zlib";
import { createHash, randomUUID } from "node:crypto";
import { paprikaApiBase, paprikaCredentials } from "@/lib/env";

function apiBase() {
  return paprikaApiBase();
}

type PaprikaListEntry = { uid: string; hash?: string };

export type PaprikaRecipe = {
  uid: string;
  hash?: string;
  name: string;
  description?: string;
  ingredients?: string;
  directions?: string;
  notes?: string;
  servings?: string;
  prep_time?: string;
  cook_time?: string;
  total_time?: string;
  difficulty?: string;
  rating?: number;
  categories?: string[];
  source?: string;
  source_url?: string;
  image_url?: string;
  photo?: string | null;
  photo_large?: string | null;
  photo_hash?: string | null;
  photo_url?: string | null;
  in_trash?: boolean;
  on_favorites?: boolean;
  created?: string;
};

async function parsePaprikaResponse<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`Paprika API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || "Paprika API error");
  return json.result as T;
}

/**
 * Cache the bearer token in-process. Tokens are typically valid for hours;
 * we deliberately use a conservative TTL so a stale token still triggers a
 * single 401 → re-login round-trip via the image proxy.
 */
const TOKEN_TTL_MS = 30 * 60 * 1000;
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function loginToPaprika(forceFresh = false) {
  if (!forceFresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }
  const { email, password } = paprikaCredentials();
  const basic = Buffer.from(`${email}:${password}`).toString("base64");
  const body = new URLSearchParams({ email, password });
  const res = await fetch(`${apiBase()}/v1/account/login/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const result = await parsePaprikaResponse<{ token: string }>(res);
  cachedToken = { token: result.token, expiresAt: Date.now() + TOKEN_TTL_MS };
  return result.token;
}

export function clearPaprikaTokenCache() {
  cachedToken = null;
}

async function paprikaGet<T>(path: string, token: string) {
  const res = await fetch(`${apiBase()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parsePaprikaResponse<T>(res);
}

export async function listRecipeHashes(token: string) {
  return paprikaGet<PaprikaListEntry[]>("/v2/sync/recipes/", token);
}

export async function getRecipe(token: string, uid: string) {
  return paprikaGet<PaprikaRecipe>(`/v2/sync/recipe/${uid}/`, token);
}

/**
 * Deterministic hash that walks every nested object to ensure key-order
 * independence — earlier the second argument to JSON.stringify was abused as
 * a key allow-list, which made the hash unstable for nested objects.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

function recipeHash(recipe: Record<string, unknown>) {
  const { hash: _hash, ...withoutHash } = recipe;
  return createHash("sha256").update(stableStringify(withoutHash)).digest("hex");
}

export async function createRecipeInPaprika(input: { name: string; ingredients: string; directions: string; notes?: string; source?: string; categories?: string[] }) {
  const token = await loginToPaprika();
  const uid = randomUUID().toUpperCase();
  const recipe: Record<string, unknown> = {
    uid,
    name: input.name,
    description: "",
    ingredients: input.ingredients,
    directions: input.directions,
    notes: input.notes || "",
    servings: "",
    prep_time: "",
    cook_time: "",
    total_time: "",
    difficulty: "",
    rating: 0,
    categories: input.categories || ["Cookingbot", "Remix"],
    source: input.source || "Cookingbot Remix",
    source_url: "",
    image_url: "",
    photo: null,
    photo_large: null,
    photo_hash: null,
    photo_url: null,
    in_trash: false,
    on_favorites: true,
    created: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
  recipe.hash = recipeHash(recipe);

  const form = new FormData();
  form.append("data", new Blob([gzipJson(recipe)], { type: "application/gzip" }), "recipe.json.gz");
  const res = await fetch(`${apiBase()}/v2/sync/recipe/${uid}/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  await parsePaprikaResponse<unknown>(res);
  return { uid, hash: String(recipe.hash) };
}

/**
 * Generic limited-concurrency map. Avoids pulling in a dependency.
 */
async function pMap<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export type SyncProgress = { listed: number; fetched: number; skipped: number; failed: number };

/**
 * Pull recipes from Paprika and apply `onRecipe` per recipe.
 *
 * `existingHashes` is a `paprikaUid → hash` map of what we already have in
 * the local DB. Entries whose remote hash matches the local one are skipped
 * entirely — that's the fast path that turns a 1000-recipe sync from minutes
 * into seconds.
 */
export async function syncRecipesFromPaprika(
  onRecipe: (recipe: PaprikaRecipe) => Promise<void>,
  options: { existingHashes?: Map<string, string | null>; concurrency?: number } = {},
): Promise<SyncProgress> {
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 5, 10));
  const existing = options.existingHashes ?? new Map<string, string | null>();
  const token = await loginToPaprika();
  const list = await listRecipeHashes(token);

  const toFetch = list.filter((entry) => {
    const local = existing.get(entry.uid);
    if (local === undefined) return true; // unknown locally
    if (!entry.hash || !local) return true; // unknown hash on either side
    return local !== entry.hash;
  });

  let fetched = 0;
  let failed = 0;
  await pMap(toFetch, concurrency, async (entry) => {
    try {
      const recipe = await getRecipe(token, entry.uid);
      await onRecipe(recipe);
      fetched += 1;
    } catch (error) {
      failed += 1;
      console.error("paprika sync: recipe failed", entry.uid, error instanceof Error ? error.message : "unknown");
    }
  });

  return {
    listed: list.length,
    fetched,
    skipped: list.length - toFetch.length,
    failed,
  };
}

export function gzipJson(value: unknown) {
  return gzipSync(Buffer.from(JSON.stringify(value), "utf8"));
}
