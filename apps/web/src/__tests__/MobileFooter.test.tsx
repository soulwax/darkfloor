// File: apps/web/src/__tests__/MobileFooter.test.tsx

import MobileFooter from "@/components/MobileFooter";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationState = vi.hoisted(() => ({
  pathname: "/",
  searchParams: new URLSearchParams(""),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigationState.push }),
  usePathname: () => navigationState.pathname,
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { id: "user-1" } } }),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    music: {
      getCurrentUserHash: {
        useQuery: () => ({ data: "user-hash" }),
      },
    },
  },
}));

vi.mock("@/hooks/useMediaQuery", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/utils/haptics", () => ({
  hapticLight: vi.fn(),
}));

vi.mock("@/utils/spring-animations", () => ({
  springPresets: { gentle: {}, snappy: {} },
}));

vi.mock("framer-motion", async () => {
  const ReactImport = await import("react");
  const motion = new Proxy(
    {},
    {
      get: (_target, tag: string) =>
        ReactImport.forwardRef((props: Record<string, unknown>, ref) => {
          const {
            layoutId,
            whileTap: _whileTap,
            animate: _animate,
            ...rest
          } = props;
          void layoutId;
          void _whileTap;
          void _animate;
          return ReactImport.createElement(tag, { ...rest, ref });
        }),
    },
  );
  return { motion };
});

describe("MobileFooter", () => {
  beforeEach(() => {
    navigationState.pathname = "/";
    navigationState.searchParams = new URLSearchParams("");
    navigationState.push.mockClear();
  });

  it("marks Home active when on home without a search query", () => {
    render(<MobileFooter />);

    const homeButton = screen.getByRole("button", { name: "Home" });
    const searchButton = screen.getByRole("button", { name: "Search" });

    expect(homeButton.className).toContain("text-[var(--color-accent)]");
    expect(searchButton.className).not.toContain("text-[var(--color-accent)]");
  });

  it("marks Search active when a query is present", () => {
    navigationState.searchParams = new URLSearchParams("q=hello");

    render(<MobileFooter />);

    const searchButton = screen.getByRole("button", { name: "Search" });
    expect(searchButton.className).toContain("text-[var(--color-accent)]");
  });

  it("activates Search when tapped without a query", () => {
    render(<MobileFooter />);

    const searchButton = screen.getByRole("button", { name: "Search" });
    fireEvent.click(searchButton);

    expect(navigationState.push).toHaveBeenCalledWith("/", { scroll: false });
    return waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Search" }).className,
      ).toContain("text-[var(--color-accent)]");
    });
  });
});
