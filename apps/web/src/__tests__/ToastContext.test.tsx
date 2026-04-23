// File: apps/web/src/__tests__/ToastContext.test.tsx

import { ToastProvider } from "@/contexts/ToastContext";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("ToastProvider", () => {
  it("anchors the toast stack above the mobile player at the bottom of the viewport", () => {
    const { container } = render(
      <ToastProvider>
        <div>child</div>
      </ToastProvider>,
    );

    const toastStack = container.querySelector(".safe-bottom");
    expect(toastStack).toBeInTheDocument();
    expect(toastStack).toHaveClass("bottom-0");
    expect(toastStack).toHaveClass("z-[260]");
  });
});
