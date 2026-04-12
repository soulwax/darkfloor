// File: apps/web/src/__tests__/AuthGate.test.tsx

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate } from "@/components/AuthGate";
import { useGuestModal } from "@/contexts/GuestModalContext";

const navigationState = vi.hoisted(() => ({
  pathname: "/library",
}));

const sessionState = vi.hoisted(() => ({
  data: { user: { id: "user-1" } } as { user: { id: string } } | null,
  status: "authenticated" as
    | "authenticated"
    | "loading"
    | "unauthenticated",
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: sessionState.data,
    status: sessionState.status,
  }),
}));

vi.mock("@/components/GuestModal", () => ({
  GuestModal: ({
    onContinueAsGuest,
  }: {
    onContinueAsGuest?: () => void;
  }) => (
    <div>
      <p>Guest modal open</p>
      <button type="button" onClick={() => onContinueAsGuest?.()}>
        Close guest modal
      </button>
    </div>
  ),
}));

function GuestModalHarness() {
  const { isGuestModalOpen, openGuestModal } = useGuestModal();

  return (
    <div>
      <button type="button" onClick={openGuestModal}>
        Open guest modal
      </button>
      <span>{isGuestModalOpen ? "open" : "closed"}</span>
    </div>
  );
}

describe("AuthGate", () => {
  beforeEach(() => {
    navigationState.pathname = "/library";
    sessionState.data = { user: { id: "user-1" } };
    sessionState.status = "authenticated";
    window.localStorage.clear();
  });

  it("lets logged-in listeners reopen and close the greeter without persisting a dismissal flag", () => {
    render(
      <AuthGate>
        <GuestModalHarness />
      </AuthGate>,
    );

    expect(screen.getByText("closed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open guest modal" }));

    expect(screen.getByText("Guest modal open")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close guest modal" }));

    expect(screen.queryByText("Guest modal open")).not.toBeInTheDocument();
    expect(screen.getByText("closed")).toBeInTheDocument();
    expect(window.localStorage.getItem("sb_guest_modal_dismissed")).toBeNull();
    expect(window.localStorage.getItem("sb_guest_mode_enabled")).toBeNull();
  });

  it("persists dismissal when the root gate auto-opens the greeter for guests", () => {
    navigationState.pathname = "/";
    sessionState.data = null;
    sessionState.status = "unauthenticated";

    render(
      <AuthGate>
        <GuestModalHarness />
      </AuthGate>,
    );

    expect(screen.getByText("Guest modal open")).toBeInTheDocument();
    expect(screen.getByText("open")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close guest modal" }));

    expect(screen.queryByText("Guest modal open")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("sb_guest_modal_dismissed")).toBe(
      "true",
    );
    expect(window.localStorage.getItem("sb_guest_mode_enabled")).toBe("true");
  });
});
