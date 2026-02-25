// File: apps/web/src/components/MobileFooter.tsx

"use client";

import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "@starchild/api-client/trpc/react";
import { hapticLight } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { motion } from "framer-motion";
import { Home, Library, Plus, Search, User } from "lucide-react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface MobileFooterProps {
  onCreatePlaylist?: () => void;
}

export default function MobileFooter({ onCreatePlaylist }: MobileFooterProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { openAuthModal } = useAuthModal();
  const { data: userHash } = api.music.getCurrentUserHash.useQuery(undefined, {
    enabled: !!session,
  });
  const [activeTab, setActiveTab] = useState<string>("home");

  if (!isMobile) return null;

  const isActive = (path: string, tabName?: string) => {
    if (tabName === "search") {
      const searchQuery = searchParams.get("q");
      if (searchQuery) return true;
      return (
        activeTab === "search" &&
        (pathname === "/" || pathname.startsWith("/?"))
      );
    }
    if (path === "/") {
      const searchQuery = searchParams.get("q");
      return (
        (pathname === "/" || pathname.startsWith("/?")) &&
        !searchQuery &&
        activeTab !== "search"
      );
    }
    if (path === "profile" && userHash) {
      return pathname === `/${userHash}`;
    }
    return pathname.startsWith(path);
  };

  const handleNavigation = (path: string, tabName: string) => {
    hapticLight();
    setActiveTab(tabName);
    router.push(path, { scroll: false });
  };

  const handleCreatePlaylist = () => {
    hapticLight();
    if (!session) {
      openAuthModal({ callbackUrl: "/playlists" });
      return;
    }
    onCreatePlaylist?.();
  };

  const handleProfileNavigation = () => {
    hapticLight();
    if (!session) {
      openAuthModal({ callbackUrl: "/" });
      return;
    }
    if (!userHash) {
      return;
    }
    setActiveTab("profile");
    router.push(`/${userHash}`, { scroll: false });
  };

  const handleSearchNavigation = () => {
    hapticLight();
    const currentQuery = searchParams.get("q");
    if (pathname === "/" && currentQuery) {
      return;
    }
    setActiveTab("search");
    router.push("/", { scroll: false });
  };

  const tabs = [
    {
      name: "home",
      label: "Home",
      icon: Home,
      path: "/",
      requiresAuth: false,
    },
    {
      name: "search",
      label: "Search",
      icon: Search,
      path: "/",
      requiresAuth: false,
      onClick: handleSearchNavigation,
    },
    {
      name: "library",
      label: "Library",
      icon: Library,
      path: "/library",
      requiresAuth: true,
    },
    {
      name: "profile",
      label: "Profile",
      icon: User,
      path: userHash ? `/${userHash}` : null,
      requiresAuth: true,
      onClick: handleProfileNavigation,
    },
    {
      name: "create",
      label: "Create",
      icon: Plus,
      path: null,
      requiresAuth: true,
      onClick: handleCreatePlaylist,
    },
  ];

  return (
    <motion.footer
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      transition={springPresets.gentle}
      className="theme-chrome-bar safe-bottom fixed right-0 bottom-0 left-0 z-50 border-t backdrop-blur-2xl"
    >
      <div className="grid grid-cols-5 gap-0.5 px-1.5 py-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active =
            tab.name === "profile"
              ? isActive("profile")
              : tab.name === "search"
                ? isActive(tab.path ?? "", "search")
                : tab.path
                  ? isActive(tab.path, tab.name)
                  : false;
          const isDisabled = tab.name === "profile" && !!session && !userHash;

          return (
            <motion.button
              key={tab.name}
              onClick={() => {
                if (!tab.onClick && tab.requiresAuth && !session) {
                  hapticLight();
                  openAuthModal({ callbackUrl: tab.path ?? "/" });
                  return;
                }
                if (tab.onClick) {
                  tab.onClick();
                } else if (tab.path) {
                  handleNavigation(tab.path, tab.name);
                }
              }}
              disabled={isDisabled}
              whileTap={{ scale: 0.92 }}
              transition={springPresets.snappy}
              className={`relative flex flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-2.5 transition-all ${
                tab.name === "create"
                  ? "text-[var(--color-text)]"
                  : active
                    ? "text-[var(--color-text)]"
                    : isDisabled
                      ? "text-[var(--color-muted)] opacity-45"
                      : "text-[var(--color-subtext)]"
              } ${!isDisabled && tab.name !== "create" ? "active:bg-white/8" : ""}`}
              aria-label={tab.label}
              type="button"
            >
              {tab.name === "create" ? (
                <div
                  className={`mb-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] text-[var(--color-on-accent)] shadow-[0_8px_18px_rgba(244,178,102,0.34)] transition-all ${
                    isDisabled ? "opacity-45" : "opacity-100"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2.8} />
                </div>
              ) : (
                <Icon
                  className={`h-5 w-5 transition-transform ${active ? "scale-105" : "scale-100"}`}
                  strokeWidth={active ? 2.5 : 2}
                />
              )}
              <span
                className={`text-[10px] leading-tight font-medium ${
                  active || tab.name === "create" ? "font-semibold" : ""
                }`}
              >
                {tab.label}
              </span>
              {active && tab.name !== "create" && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 h-0.5 w-9 rounded-full bg-[var(--color-accent)]"
                  transition={springPresets.snappy}
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.footer>
  );
}
