// File: apps/web/src/contexts/GuestModalContext.tsx

"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface GuestModalContextValue {
  isGuestModalOpen: boolean;
  openGuestModal: () => void;
}

const GuestModalContext = createContext<GuestModalContextValue | undefined>(
  undefined,
);

interface GuestModalProviderProps {
  value: GuestModalContextValue;
  children: ReactNode;
}

export function GuestModalProvider({ value, children }: GuestModalProviderProps) {
  return (
    <GuestModalContext.Provider value={value}>
      {children}
    </GuestModalContext.Provider>
  );
}

export function useGuestModal(): GuestModalContextValue {
  const context = useContext(GuestModalContext);
  if (!context) {
    throw new Error("useGuestModal must be used within GuestModalProvider");
  }
  return context;
}
