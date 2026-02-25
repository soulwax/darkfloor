// File: apps/web/src/test/setup.ts

import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

process.env.API_V2_URL = "http://localhost:3222";
process.env.SONGBIRD_API_URL = "http://localhost:3222";
process.env.SONGBIRD_API_HEALTH_URI = "/api/health";
process.env.NEXT_PUBLIC_V2_API_URL = "http://localhost:3222";

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => {
      const keys = Object.keys(store);
      return keys[index] ?? null;
    },
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

class ResizeObserverMock {
  observe() { /* noop */ }
  unobserve() { /* noop */ }
  disconnect() { /* noop */ }
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  value: ResizeObserverMock,
});

class AudioContextMock {
  state = "running";
  destination = {};
  createMediaElementSource = vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createBiquadFilter = vi.fn(() => ({
    frequency: { value: 0 },
    Q: { value: 1 },
    gain: { value: 0 },
    type: "peaking",
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  createAnalyser = vi.fn(() => ({
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: vi.fn(),
    getByteTimeDomainData: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  }));
  resume = vi.fn(() => Promise.resolve());
  close = vi.fn(() => Promise.resolve());
}

Object.defineProperty(window, "AudioContext", {
  writable: true,
  value: AudioContextMock,
});

Object.defineProperty(window, "webkitAudioContext", {
  writable: true,
  value: AudioContextMock,
});

const createMockAudioElement = () => {
  const element = document.createElement("audio");

  element.play = vi.fn(() => Promise.resolve());
  element.pause = vi.fn();
  element.load = vi.fn();

  Object.defineProperty(element, "paused", { value: true, writable: true, configurable: true });
  Object.defineProperty(element, "currentTime", { value: 0, writable: true, configurable: true });
  Object.defineProperty(element, "duration", { value: 0, writable: true, configurable: true });
  Object.defineProperty(element, "readyState", { value: 4, writable: true, configurable: true });
  Object.defineProperty(element, "playbackRate", { value: 1, writable: true, configurable: true });
  Object.defineProperty(element, "defaultPlaybackRate", { value: 1, writable: true, configurable: true });
  Object.defineProperty(element, "preservesPitch", { value: true, writable: true, configurable: true });
  Object.defineProperty(element, "volume", { value: 0.7, writable: true, configurable: true });
  Object.defineProperty(element, "muted", { value: false, writable: true, configurable: true });
  Object.defineProperty(element, "src", { value: "", writable: true, configurable: true });

  return element;
};

global.Audio = vi.fn(createMockAudioElement) as unknown as typeof Audio;

if (typeof AbortSignal !== "undefined" && !AbortSignal.timeout) {
  (AbortSignal as typeof AbortSignal & { timeout: (ms: number) => AbortSignal }).timeout = (ms: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}

const originalFetch = global.fetch;

global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

  if (url.includes("cdn.jsdelivr.net") || url.includes("twemoji")) {
    return Promise.resolve(
      new Response("<svg></svg>", {
        status: 200,
        headers: { "Content-Type": "image/svg+xml" },
      })
    );
  }

  if (url.includes(".woff") || url.includes(".woff2") || url.includes(".ttf") || url.includes("fonts")) {
    return Promise.resolve(
      new Response(new ArrayBuffer(0), {
        status: 200,
        headers: { "Content-Type": "font/woff2" },
      })
    );
  }

  if (url.includes("api.starchildmusic.com") || url.includes("api.deezer.com")) {
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: 12345,
          title: "Test Track",
          artist: { id: 1, name: "Test Artist" },
          album: { id: 1, title: "Test Album", cover_medium: "https://example.com/cover.jpg" },
          duration: 180,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
  }

  if (url.includes("/api/") || url.includes("localhost") || url.includes("127.0.0.1")) {
    return Promise.resolve(
      new Response(JSON.stringify({ error: "Mocked API call" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  }

  if (originalFetch) {
    return originalFetch(input, init);
  }

  return Promise.reject(new Error("Network request blocked in tests"));
}) as typeof fetch;
