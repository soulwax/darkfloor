"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Disc3,
  Home,
  Info,
  ListMusic,
  RefreshCw,
  Settings,
  Shield,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { springPresets } from "@/utils/spring-animations";

interface MenuPosition {
  x: number;
  y: number;
}

interface NavigationItem {
  href?: string;
  icon: typeof Home;
  key: string;
  label: string;
  onSelect?: () => void;
}

export function GlobalNavigationContextMenu() {
  const t = useTranslations("globalContextMenu");
  const tc = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const items = useMemo<NavigationItem[]>(
    () => [
      { href: "/", icon: Home, key: "home", label: tc("home") },
      { href: "/library", icon: Disc3, key: "library", label: tc("library") },
      {
        href: "/playlists",
        icon: ListMusic,
        key: "playlists",
        label: tc("playlists"),
      },
      {
        href: "/spotify",
        icon: Disc3,
        key: "spotify",
        label: tc("spotify"),
      },
      {
        href: "/settings",
        icon: Settings,
        key: "settings",
        label: tc("settings"),
      },
      { href: "/about", icon: Info, key: "about", label: tc("about") },
      { href: "/license", icon: BookOpen, key: "license", label: tc("license") },
      { href: "/admin", icon: Shield, key: "admin", label: tc("admin") },
      {
        icon: RefreshCw,
        key: "refresh",
        label: tc("refresh"),
        onSelect: () => window.location.reload(),
      },
    ],
    [tc],
  );

  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      if (event.defaultPrevented || event.shiftKey) {
        return;
      }

      event.preventDefault();
      setPosition({ x: event.clientX, y: event.clientY });
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, []);

  useEffect(() => {
    if (!position) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setPosition(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPosition(null);
      }
    };

    const handleScrollOrResize = () => {
      setPosition(null);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [position]);

  useEffect(() => {
    if (!menuRef.current || !position) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    let { x, y } = position;

    if (x + rect.width > viewport.width) {
      x = viewport.width - rect.width - 16;
    }
    if (x < 16) x = 16;

    if (y + rect.height > viewport.height) {
      y = viewport.height - rect.height - 16;
    }
    if (y < 16) y = 16;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }, [position]);

  const handleSelect = (item: NavigationItem) => {
    setPosition(null);

    if (item.onSelect) {
      item.onSelect();
      return;
    }

    if (item.href) {
      router.push(item.href);
    }
  };

  return (
    <AnimatePresence>
      {position ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={springPresets.gentle}
            className="theme-chrome-backdrop fixed inset-0 z-[102]"
            onClick={() => setPosition(null)}
          />

          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.94, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -10 }}
            transition={springPresets.snappy}
            className="theme-panel fixed z-[103] w-[min(22rem,calc(100vw-32px))] rounded-2xl border p-2 shadow-xl backdrop-blur-xl"
            style={{ left: position.x, top: position.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-2 pt-1">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">
                  {t("title")}
                </p>
                <p className="text-[11px] text-[var(--color-subtext)]">
                  {t("hint")}
                </p>
              </div>
              <p className="text-[10px] text-right text-[var(--color-subtext)]">
                {t("nativeHint")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1">
              {items.map((item) => {
                const isActive = item.href ? pathname === item.href : false;
                const Icon = item.icon;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className={`group flex min-h-14 items-center gap-3 rounded-xl px-3 py-3 text-left transition-all ${
                      isActive
                        ? "bg-[rgba(244,178,102,0.18)]"
                        : "hover:bg-[rgba(244,178,102,0.12)]"
                    }`}
                    aria-current={isActive ? "page" : undefined}
                  >
                    <span
                      className={`rounded-lg p-2 transition-colors ${
                        isActive
                          ? "bg-[rgba(244,178,102,0.16)] text-[var(--color-accent)]"
                          : "bg-white/5 text-[var(--color-subtext)] group-hover:text-[var(--color-accent)]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-[var(--color-text)]">
                        {item.label}
                      </span>
                      <span className="text-[11px] text-[var(--color-subtext)]">
                        {isActive ? t("currentPage") : t("goTo")}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
