import type { RouteComparison, RouteResult } from "./types";

export function compareRoutes(
  baseline: RouteResult,
  active: RouteResult,
): RouteComparison | null {
  if (baseline.status !== "ok" || active.status !== "ok") return null;
  return {
    addedMinutes: active.totalMinutes - baseline.totalMinutes,
    transferDelta: active.transferCount - baseline.transferCount,
    stopDelta: active.stopCount - baseline.stopCount,
    routeChanged:
      baseline.steps.map((step) => step.directionId).join("|") !==
      active.steps.map((step) => step.directionId).join("|"),
  };
}
