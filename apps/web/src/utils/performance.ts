// File: apps/web/src/utils/performance.ts

const getPerformance = (): Performance | undefined => {
  if (typeof globalThis === "undefined") return undefined;
  return typeof globalThis.performance === "undefined"
    ? undefined
    : globalThis.performance;
};

export function measurePerformance(name: string, fn: () => void) {
  const perf = getPerformance();
  if (
    !perf ||
    typeof perf.mark !== "function" ||
    typeof perf.measure !== "function" ||
    typeof perf.getEntriesByName !== "function"
  ) {
    return fn();
  }

  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  const measureName = `${name}-measure`;

  perf.mark(startMark);
  const result = fn();
  perf.mark(endMark);

  try {
    perf.measure(measureName, startMark, endMark);
    const measure = perf.getEntriesByName(measureName)[0];
    if (measure && process.env.NODE_ENV === "development") {
      console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
    }
  } catch (error) {
    console.error("Performance measurement failed:", error);
  }

  return result;
}

export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const perf = getPerformance();
  if (
    !perf ||
    typeof perf.mark !== "function" ||
    typeof perf.measure !== "function" ||
    typeof perf.getEntriesByName !== "function"
  ) {
    return fn();
  }

  const startMark = `${name}-start`;
  const endMark = `${name}-end`;
  const measureName = `${name}-measure`;

  perf.mark(startMark);
  const result = await fn();
  perf.mark(endMark);

  try {
    perf.measure(measureName, startMark, endMark);
    const measure = perf.getEntriesByName(measureName)[0];
    if (measure && process.env.NODE_ENV === "development") {
      console.log(`⚡ ${name}: ${measure.duration.toFixed(2)}ms`);
    }
  } catch (error) {
    console.error("Performance measurement failed:", error);
  }

  return result;
}

export function reportWebVitals() {
  if (typeof window === "undefined") return;

  if ("PerformanceObserver" in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const metricName = entry.name;
          const value = Math.round(
            "duration" in entry
              ? entry.duration
              : (entry as PerformanceEntry & { value?: number }).value ?? 0,
          );

          if (process.env.NODE_ENV === "development") {
            console.log(`📊 ${metricName}: ${value}ms`);
          }
        }
      });

      observer.observe({ entryTypes: ["measure", "navigation", "paint"] });
    } catch (error) {
      console.error("Web Vitals reporting failed:", error);
    }
  }
}

export function clearPerformanceMarks(name?: string) {
  const perf = getPerformance();
  if (
    !perf ||
    typeof perf.clearMarks !== "function" ||
    typeof perf.clearMeasures !== "function"
  ) {
    return;
  }

  if (name) {
    perf.clearMarks(`${name}-start`);
    perf.clearMarks(`${name}-end`);
    perf.clearMeasures(`${name}-measure`);
  } else {
    perf.clearMarks();
    perf.clearMeasures();
  }
}

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export function getMemoryUsage() {
  const perf = getPerformance() as
    | (Performance & { memory?: PerformanceMemory })
    | undefined;
  if (!perf) return null;
  if (!perf.memory) return null;

  return {
    usedJSHeapSize: (perf.memory.usedJSHeapSize / 1048576).toFixed(2),
    totalJSHeapSize: (perf.memory.totalJSHeapSize / 1048576).toFixed(2),
    jsHeapSizeLimit: (perf.memory.jsHeapSizeLimit / 1048576).toFixed(2),
  };
}
