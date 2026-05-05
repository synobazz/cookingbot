import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { loginToPaprika } from "@/lib/paprika";

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

function isPrivateIp(host: string) {
  const ipv4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!ipv4) return false;
  const [, aRaw, bRaw] = ipv4;
  const a = Number(aRaw);
  const b = Number(bRaw);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
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
  if (!host || host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "::1" || host.startsWith("[")) return false;
  if (isPrivateIp(host)) return false;
  return true;
}

function redirectTarget(currentUrl: string, location: string) {
  try {
    return new URL(location, currentUrl).toString();
  } catch {
    return "";
  }
}

async function fetchImage(url: string, token?: string, redirectsLeft = 3): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      cache: "no-store",
      signal: controller.signal,
      redirect: "manual",
    });

    if ([301, 302, 303, 307, 308].includes(res.status) && redirectsLeft > 0) {
      const nextUrl = redirectTarget(url, res.headers.get("location") || "");
      if (!nextUrl || !isAllowed(nextUrl)) return res;
      return fetchImage(nextUrl, token, redirectsLeft - 1);
    }

    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedBody(res: Response) {
  if (!res.body) return null;

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_IMAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  return Buffer.concat(chunks, total);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ recipeId: string }> }) {
  if (!(await requireAuth())) return new NextResponse(null, { status: 401 });

  const { recipeId } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return new NextResponse(null, { status: 404 });

  const candidates = [recipe.photoUrl, recipe.imageUrl, recipe.photoLarge, recipe.photo]
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

    const body = await readLimitedBody(upstream);
    if (!body) continue;

    return new NextResponse(body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
        "Content-Length": String(body.byteLength),
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}
