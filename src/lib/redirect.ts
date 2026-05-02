import { NextRequest } from "next/server";

export function appUrl(req: NextRequest, path: string) {
  const base = process.env.APP_BASE_URL || req.url;
  return new URL(path, base);
}
