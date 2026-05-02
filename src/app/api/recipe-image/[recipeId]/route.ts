import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { loginToPaprika } from "@/lib/paprika";

/** Hosts we are willing to proxy images from. Strict allowlist to prevent SSRF. */
const ALLOWED_IMAGE_HOSTS = [
  "paprikaapp.com",
  "www.paprikaapp.com",
  "static.paprikaapp.com",
  "paprika-sync.s3.amazonaws.com",
  "s3.amazonaws.com",
];

const FETCH_TIMEOUT_MS = 10_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MiB

function normalizeImageUrl(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `https://www.paprikaapp.com${raw}`;
  return "";
}

function isAllowed(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

async function fetchImage(url: string, token?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ recipeId: string }> }) {
  if (!(await requireAuth())) return new NextResponse(null, { status: 401 });

  const { recipeId } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return new NextResponse(null, { status: 404 });

  const candidates = [recipe.photoUrl, recipe.imageUrl]
    .map(normalizeImageUrl)
    .filter(Boolean)
    .filter(isAllowed);
  if (!candidates.length) return new NextResponse(null, { status: 404 });

  for (const url of candidates) {
    let upstream: Response;
    try {
      upstream = await fetchImage(url);
      if ((upstream.status === 401 || upstream.status === 403) && url.includes("paprikaapp.com")) {
        try {
          upstream = await fetchImage(url, await loginToPaprika());
        } catch {
          // Fall through to the next candidate / 404 below.
        }
      }
    } catch {
      continue;
    }
    if (!upstream.ok || !upstream.body) continue;
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) continue;

    const declaredLength = Number(upstream.headers.get("content-length") || 0);
    if (declaredLength > MAX_IMAGE_BYTES) continue;

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        ...(declaredLength ? { "Content-Length": String(declaredLength) } : {}),
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}
