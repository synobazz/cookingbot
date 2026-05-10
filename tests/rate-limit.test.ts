import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("erlaubt Requests unterhalb des Limits", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    expect(limiter.isLimited("a")).toBe(false);
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(false);
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("blockt sobald max erreicht ist", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 });
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(true);
  });

  it("zählt unterschiedliche Schlüssel separat", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(true);
    expect(limiter.isLimited("b")).toBe(false);
  });

  it("setzt nach reset() den Counter zurück", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 });
    limiter.recordFailure("a");
    expect(limiter.isLimited("a")).toBe(true);
    limiter.reset("a");
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("verlängert das Window bei jeder neuen Verletzung (sliding window)", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2 });
    limiter.recordFailure("a"); // window endet bei +60s
    vi.advanceTimersByTime(50_000);
    limiter.recordFailure("a"); // window endet jetzt bei +50+60 = +110s
    expect(limiter.isLimited("a")).toBe(true);
    vi.advanceTimersByTime(59_000); // bei +109s
    expect(limiter.isLimited("a")).toBe(true);
    vi.advanceTimersByTime(2_000); // bei +111s
    expect(limiter.isLimited("a")).toBe(false);
  });

  it("verwirft abgelaufene Einträge lazy", () => {
    const limiter = createRateLimiter({ windowMs: 1_000, max: 1 });
    limiter.recordFailure("a");
    expect(limiter.size()).toBe(1);
    vi.advanceTimersByTime(2_000);
    // Lazy purge bei nächstem Zugriff
    expect(limiter.isLimited("a")).toBe(false);
    expect(limiter.size()).toBe(0);
  });
});
