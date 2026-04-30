import { gzipSync } from "node:zlib";

const API_BASE = process.env.PAPRIKA_API_BASE || "https://www.paprikaapp.com/api";

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

export async function loginToPaprika() {
  const email = process.env.PAPRIKA_EMAIL;
  const password = process.env.PAPRIKA_PASSWORD;
  if (!email || !password) throw new Error("PAPRIKA_EMAIL and PAPRIKA_PASSWORD must be configured");

  const basic = Buffer.from(`${email}:${password}`).toString("base64");
  const body = new URLSearchParams({ email, password });
  const res = await fetch(`${API_BASE}/v1/account/login/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });
  const result = await parsePaprikaResponse<{ token: string }>(res);
  return result.token;
}

async function paprikaGet<T>(path: string, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
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

export async function syncRecipesFromPaprika(onRecipe: (recipe: PaprikaRecipe) => Promise<void>) {
  const token = await loginToPaprika();
  const list = await listRecipeHashes(token);
  let fetched = 0;
  for (const entry of list) {
    const recipe = await getRecipe(token, entry.uid);
    await onRecipe(recipe);
    fetched += 1;
  }
  return { listed: list.length, fetched };
}

export function gzipJson(value: unknown) {
  return gzipSync(Buffer.from(JSON.stringify(value), "utf8"));
}
