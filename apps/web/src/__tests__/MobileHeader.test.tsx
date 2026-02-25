// File: apps/web/src/__tests__/MobileHeader.test.tsx

import React from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MobileHeader from "@/components/MobileHeader";

type NavigationState = {
  pathname: string;
  searchParams: URLSearchParams;
  push: (path?: string) => void;
};

let pushCalls: Array<string | undefined> = [];
const navigationState: NavigationState = {
  pathname: "/",
  searchParams: new URLSearchParams("q=radiohead"),
  push: (path?: string) => {
    pushCalls.push(path);
  },
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: navigationState.push }),
  usePathname: () => navigationState.pathname,
  useSearchParams: () => ({
    get: (key: string) => navigationState.searchParams.get(key),
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null }),
}));

vi.mock("@/contexts/MenuContext", () => ({
  useMenu: () => ({ openMenu: vi.fn() }),
}));

vi.mock("@starchild/api-client/trpc/react", () => ({
  api: {
    music: {
      getRecentSearches: {
        useQuery: () => ({ data: [] }),
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

let latestSearchBarProps: {
  onChange: (value: string) => void;
  onClear?: () => void;
} | null = null;

vi.mock("@/components/MobileSearchBar", () => ({
  __esModule: true,
  default: (props: { onChange: (value: string) => void; onClear?: () => void }) => {
    latestSearchBarProps = props;
    return <div data-testid="mobile-search-bar" />;
  },
}));

vi.mock("framer-motion", async () => {
  const ReactImport = await import("react");
  type MotionMockProps = React.ComponentPropsWithoutRef<"div"> & {
    layoutId?: string;
    whileTap?: unknown;
    transition?: unknown;
    initial?: unknown;
    animate?: unknown;
  };

  const motion = new Proxy(
    {},
    {
      get: (_target, tag) =>
        (() => {
          const elementTag = typeof tag === "string" ? tag : "div";
          const MotionComponent = ReactImport.forwardRef<
            HTMLElement,
            MotionMockProps & React.HTMLAttributes<HTMLElement>
          >((props, ref) => {
            const {
              layoutId,
              whileTap,
              transition,
              initial,
              animate,
              ...rest
            } = props;
            void layoutId;
            void whileTap;
            void transition;
            void initial;
            void animate;
            return ReactImport.createElement(elementTag, { ...rest, ref });
          });
          MotionComponent.displayName = `motion.${String(tag)}`;
          return MotionComponent;
        })(),
    },
  );
  return { motion };
});

describe("MobileHeader", () => {
  beforeEach(() => {
    navigationState.searchParams = new URLSearchParams("q=radiohead");
    pushCalls = [];
  });

  it("does not clear the query when URL already has a search param", () => {
    render(<MobileHeader />);

    expect(pushCalls).not.toContain("/");
  });

  it("navigates back to home when a non-empty query is cleared", async () => {
    render(<MobileHeader />);

    expect(latestSearchBarProps).not.toBeNull();
    await act(async () => {
      latestSearchBarProps?.onChange("");
      latestSearchBarProps?.onClear?.();
    });

    await Promise.resolve();
    expect(pushCalls).toContain("/");
  });
});
