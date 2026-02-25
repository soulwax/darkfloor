// File: apps/web/src/__tests__/Toast.test.tsx

import { render, screen } from "@testing-library/react";
import Toast from "@starchild/ui/Toast";
import { describe, expect, it } from "vitest";

describe("Toast", () => {
  it("renders a warning toast with the warning style", () => {
    render(<Toast message="Heads up" type="warning" duration={1000} />);

    expect(screen.getByText("Heads up")).toBeInTheDocument();
    const container = screen.getByText("Heads up").closest("div");
    expect(container).toHaveClass("bg-amber-500");
  });
});
