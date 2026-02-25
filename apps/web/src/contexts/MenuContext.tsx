// File: apps/web/src/contexts/MenuContext.tsx

"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface MenuContextType {
  isMenuOpen: boolean;
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <MenuContext.Provider
      value={{
        isMenuOpen,
        openMenu: () => setIsMenuOpen(true),
        closeMenu: () => setIsMenuOpen(false),
        toggleMenu: () => setIsMenuOpen((prev) => !prev),
      }}
    >
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error("useMenu must be used within MenuProvider");
  }
  return context;
}
