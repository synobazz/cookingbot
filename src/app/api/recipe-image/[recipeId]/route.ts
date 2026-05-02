import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { loginToPaprika } from "@/lib/paprika";

function normalizeImageUrl(value?: string | null) {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `https://www.paprikaapp.com${raw}`;
  return "";
}

async function fetchImage(url: string, token?: string) {
  return fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
  });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ recipeId: string }> }) {
  if (!(await requireAuth())) return new NextResponse(null, { status: 401 });

  const { recipeId } = await params;
  const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
  if (!recipe) return new NextResponse(null, { status: 404 });

  const candidates = [recipe.photoUrl, recipe.imageUrl].map(normalizeImageUrl).filter(Boolean);
  if (!candidates.length) return new NextResponse(null, { status: 404 });

  for (const url of candidates) {
    let upstream = await fetchImage(url);
    if ((upstream.status === 401 || upstream.status === 403) && url.includes("paprikaapp.com")) {
      try {
        upstream = await fetchImage(url, await loginToPaprika());
      } catch {
        // Fall through to the next candidate/404 below.
      }
    }
    if (!upstream.ok) continue;
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) continue;
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}
