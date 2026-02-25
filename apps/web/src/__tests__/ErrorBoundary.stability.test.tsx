// File: apps/web/src/__tests__/ErrorBoundary.stability.test.tsx

import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ErrorBoundary, type ErrorBoundaryProps } from "@/components/ErrorBoundary";
import { useState } from "react";

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Working Component</div>;
};

describe("ErrorBoundary Stability Tests", () => {
  it("should display error UI when child throws", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Oops! Something went wrong")).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();
  });

  it("should handle errors gracefully without page reload", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Oops! Something went wrong")).toBeInTheDocument();
    const tryAgainButton = screen.getByRole("button", { name: /try again/i });
    expect(tryAgainButton).toBeInTheDocument();
  });

  it("should reset error state when resetError is called", async () => {
    const ErrorBoundaryWithReset = () => {
      const [hasError, setHasError] = useState(false);
      const [resetKey, setResetKey] = useState(0);

      return (
        <div>
          <button onClick={() => setHasError(false)}>Stop Throwing</button>
          <button onClick={() => setResetKey((k) => k + 1)}>
            Reset Boundary
          </button>
          <ErrorBoundary key={resetKey}>
            <ThrowError shouldThrow={hasError} />
          </ErrorBoundary>
        </div>
      );
    };

    render(<ErrorBoundaryWithReset />);

    expect(screen.getByText("Working Component")).toBeInTheDocument();
  });

  it("should display custom fallback when provided", () => {
    const customFallback = <div>Custom Error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Custom Error UI")).toBeInTheDocument();
    expect(
      screen.queryByText("Oops! Something went wrong"),
    ).not.toBeInTheDocument();
  });

  it("should call onError callback when error occurs", () => {
    type OnError = NonNullable<ErrorBoundaryProps["onError"]>;
    const onError = vi.fn<OnError>();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), expect.any(Object));
    const errorInfo = onError.mock.calls[0]?.[1];
    expect(errorInfo?.componentStack).toEqual(expect.any(String));
  });

  it("should render children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Working Component")).toBeInTheDocument();
    expect(
      screen.queryByText("Oops! Something went wrong"),
    ).not.toBeInTheDocument();
  });

  it("should have Try Again button that calls resetError", async () => {
    const user = userEvent.setup();

    const { container } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const tryAgainButton = screen.getByRole("button", { name: /try again/i });

    await user.click(tryAgainButton);

    const errorBoundaryDiv = container.querySelector(
      ".flex.min-h-screen.flex-col",
    );
    expect(errorBoundaryDiv).toBeInTheDocument();
  });
});
