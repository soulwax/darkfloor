// File: apps/web/src/components/DesktopSidebar.tsx

"use client";

import { APP_VERSION } from "@/config/version";
import { STORAGE_KEYS } from "@starchild/config/storage";
import { CreatePlaylistModal } from "@/components/CreatePlaylistModal";
import { api } from "@starchild/api-client/trpc/react";
import { appSignOut } from "@/services/authSignOut";
import { localStorage } from "@/services/storage";
import { useAuthModal } from "@/contexts/AuthModalContext";
import emilyLogo from "../../public/emily-the-strange.png";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Library,
  ListMusic,
  LogOut,
  Plus,
  Shield,
  Settings,
  User,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  requiresAuth?: boolean;
  callbackUrl?: string;
};

const COLLAPSED_WIDTH = 76;
const DEFAULT_EXPANDED_WIDTH = 272;
const MIN_EXPANDED_WIDTH = 220;
const MAX_EXPANDED_WIDTH = 420;

const clampSidebarWidth = (value: unknown): number => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numericValue)) return DEFAULT_EXPANDED_WIDTH;
  return Math.max(MIN_EXPANDED_WIDTH, Math.min(MAX_EXPANDED_WIDTH, Math.round(numericValue)));
};

export function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.admin === true;
  const isLinuxElectron =
    typeof window !== "undefined" &&
    window.electron?.isElectron === true &&
    window.electron?.platform === "linux";
  const { openAuthModal } = useAuthModal();

  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getOrDefault<boolean>(
      STORAGE_KEYS.DESKTOP_SIDEBAR_COLLAPSED,
      false,
    );
  });
  const [expandedWidth, setExpandedWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_EXPANDED_WIDTH;
    const storedWidth = localStorage.getOrDefault<number>(
      STORAGE_KEYS.DESKTOP_SIDEBAR_WIDTH,
      DEFAULT_EXPANDED_WIDTH,
    );
    return clampSidebarWidth(storedWidth);
  });
  const [isResizing, setIsResizing] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const resizePointerIdRef = useRef<number | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(DEFAULT_EXPANDED_WIDTH);

  const width = collapsed ? COLLAPSED_WIDTH : expandedWidth;

  // Set sidebar width CSS variable (used by Header positioning)
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--electron-sidebar-width",
      `${width}px`,
    );
  }, [width]);

  // Clean up CSS variable only on unmount
  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty("--electron-sidebar-width");
    };
  }, []);

  useEffect(() => {
    if (collapsed || isResizing) return;
    localStorage.set(STORAGE_KEYS.DESKTOP_SIDEBAR_WIDTH, expandedWidth);
  }, [collapsed, isResizing, expandedWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handlePointerMove = (event: PointerEvent) => {
      if (
        resizePointerIdRef.current !== null &&
        event.pointerId !== resizePointerIdRef.current
      ) {
        return;
      }

      const deltaX = event.clientX - resizeStartXRef.current;
      const nextWidth = clampSidebarWidth(resizeStartWidthRef.current + deltaX);
      setExpandedWidth((previousWidth) =>
        previousWidth === nextWidth ? previousWidth : nextWidth,
      );
    };

    const finishResize = (event?: PointerEvent) => {
      if (
        event &&
        resizePointerIdRef.current !== null &&
        event.pointerId !== resizePointerIdRef.current
      ) {
        return;
      }

      resizePointerIdRef.current = null;
      setIsResizing(false);
    };

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishResize);
    window.addEventListener("pointercancel", finishResize);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishResize);
      window.removeEventListener("pointercancel", finishResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isResizing]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (collapsed || event.button !== 0) return;
    if (!Number.isFinite(event.clientX)) {
      console.warn("[DesktopSidebar] Invalid pointer position while starting resize.");
      return;
    }

    resizePointerIdRef.current = event.pointerId;
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = expandedWidth;
    setIsResizing(true);
    event.preventDefault();
  };

  const { data: userHash } = api.music.getCurrentUserHash.useQuery(undefined, {
    enabled: !!session,
  });

  const profileHref = session
    ? userHash
      ? `/${userHash}`
      : "/settings"
    : "/signin";

  const navItems: NavItem[] = useMemo(() => {
    const items: NavItem[] = [];

    if (!session) {
      items.push({
        href: profileHref,
        label: "Sign In",
        icon: <User className="h-5 w-5" />,
        requiresAuth: true,
        callbackUrl: "/",
      });
    }

    items.push(
      { href: "/", label: "Home", icon: <Home className="h-5 w-5" /> },
      {
        href: "/library",
        label: "Library",
        icon: <Library className="h-5 w-5" />,
        requiresAuth: true,
        callbackUrl: "/library",
      },
      {
        href: "/playlists",
        label: "Playlists",
        icon: <ListMusic className="h-5 w-5" />,
        requiresAuth: true,
        callbackUrl: "/playlists",
      },
    );

    if (session) {
      items.push({
        href: profileHref,
        label: "Profile",
        icon: <User className="h-5 w-5" />,
        requiresAuth: true,
        callbackUrl: "/",
      });
    }

    if (isAdmin) {
      items.push({
        href: "/admin",
        label: "Admin",
        icon: <Shield className="h-5 w-5" />,
      });
    }

    items.push({
      href: "/settings",
      label: "Settings",
      icon: <Settings className="h-5 w-5" />,
      requiresAuth: true,
      callbackUrl: "/settings",
    });

    return items;
  }, [session, profileHref, isAdmin]);

  const playlistsQuery = api.music.getPlaylists.useQuery(undefined, {
    enabled: !!session,
    refetchOnWindowFocus: false,
  });

  return (
    <>
      <aside
        className="electron-sidebar theme-chrome-sidebar relative sticky top-0 z-40 flex h-full shrink-0 border-r max-md:hidden"
        style={{ width }}
      >
        <div
          className={`electron-no-drag absolute top-0 right-0 z-50 h-full w-2 cursor-ew-resize transition-colors ${
            collapsed
              ? "pointer-events-none"
              : isResizing
                ? "bg-[rgba(244,178,102,0.35)]"
                : "hover:bg-[rgba(244,178,102,0.2)]"
          }`}
          onPointerDown={startResize}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          aria-valuemin={MIN_EXPANDED_WIDTH}
          aria-valuemax={MAX_EXPANDED_WIDTH}
          aria-valuenow={expandedWidth}
        />

        {/* Drawer-style toggle button */}
        {/* Offset down by 10% */}
        <button
          className="electron-no-drag absolute top-[9%] -right-3 flex h-11 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(30,30,30,0.95)] text-[var(--color-subtext)] opacity-95 shadow-sm transition-all hover:border-[rgba(244,178,102,0.35)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            localStorage.set(STORAGE_KEYS.DESKTOP_SIDEBAR_COLLAPSED, next);
          }}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        <div className="flex h-full min-h-0 w-full flex-col bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(10,10,10,0.98))]">
          <div className="px-3 pt-4 pb-3">
            <div
              className={`flex items-center ${collapsed ? "justify-center" : "justify-start"} rounded-xl px-2 py-1.5`}
            >
              <Image
                src={emilyLogo}
                alt="Starchild"
                width={36}
                height={36}
                className="h-9 w-9 rounded-xl shadow-lg ring-2 ring-[rgba(244,178,102,0.35)]"
                priority
                unoptimized
              />
              {!collapsed && (
                <div className="ml-4 min-w-0">
                  <div className="header-logo-title accent-gradient truncate text-base font-bold tracking-wide">
                    Starchild
                  </div>
                  <div className="truncate text-[10px] font-medium tracking-[0.16em] text-[var(--color-muted)] uppercase">
                    {session
                      ? `Hi ${
                          session.user?.name ??
                          session.user?.email ??
                          session.user?.userHash ??
                          "there"
                        }`
                      : "Hi there"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!collapsed && (
            <div className="px-4 pb-1 text-[10px] font-semibold tracking-[0.16em] text-[var(--color-muted)] uppercase">
              Menu
            </div>
          )}

          <nav className="px-2 pb-2">
            <div className="space-y-1">
              {navItems.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname?.startsWith(item.href);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={(event) => {
                      if (!session && item.requiresAuth) {
                        event.preventDefault();
                        openAuthModal({
                          callbackUrl: item.callbackUrl ?? item.href,
                        });
                      }
                    }}
                    className={`electron-no-drag group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
                      active
                        ? "bg-[rgba(244,178,102,0.16)] text-[var(--color-text)] shadow-[0_6px_18px_rgba(244,178,102,0.16)]"
                        : "text-[var(--color-subtext)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--color-text)]"
                    }`}
                    title={collapsed ? item.label : undefined}
                  >
                    {!collapsed && (
                      <span
                        className={`absolute top-2 bottom-2 left-0 w-1 rounded-r-full transition-opacity ${
                          active
                            ? "bg-[var(--color-accent)] opacity-100"
                            : "opacity-0 group-hover:bg-white/40 group-hover:opacity-100"
                        }`}
                      />
                    )}
                    <span className="shrink-0">{item.icon}</span>
                    {!collapsed && (
                      <span className="truncate font-medium">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          <div className="mt-2 min-h-0 flex-1 px-2 pb-24">
            {session ? (
              <>
                <div className="flex items-center justify-between px-2">
                  {!collapsed ? (
                    <div className="text-[10px] font-semibold tracking-[0.16em] text-[var(--color-muted)] uppercase">
                      Your Library
                    </div>
                  ) : (
                    <div className="h-3" />
                  )}

                  <button
                    className="electron-no-drag flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.04)] text-[var(--color-subtext)] transition-colors hover:border-[rgba(244,178,102,0.35)] hover:bg-[rgba(244,178,102,0.12)] hover:text-[var(--color-text)]"
                    onClick={() => setCreateModalOpen(true)}
                    aria-label="Create playlist"
                    title={collapsed ? "Create playlist" : undefined}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-2 min-h-0 overflow-y-auto pr-1">
                  {playlistsQuery.isLoading ? (
                    <div className="space-y-1 px-1 py-1">
                      {Array.from({ length: collapsed ? 6 : 4 }).map(
                        (_, index) => (
                          <div
                            key={`playlist-skeleton-${index}`}
                            className={`flex items-center gap-3 rounded-xl ${
                              collapsed
                                ? "justify-center px-2 py-2"
                                : "px-3 py-2.5"
                            }`}
                          >
                            <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-[rgba(255,255,255,0.12)]" />
                            {!collapsed && (
                              <div className="min-w-0 flex-1 space-y-1.5">
                                <div className="h-3 w-2/3 animate-pulse rounded bg-[rgba(255,255,255,0.14)]" />
                                <div className="h-2.5 w-1/3 animate-pulse rounded bg-[rgba(255,255,255,0.1)]" />
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>
                  ) : playlistsQuery.data && playlistsQuery.data.length > 0 ? (
                    <div className="space-y-1">
                      {playlistsQuery.data.slice(0, 50).map((playlist) => {
                        const href = `/playlists/${playlist.id}`;
                        const active = pathname === href;
                        return (
                          <Link
                            key={playlist.id}
                            href={href}
                            className={`electron-no-drag flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all ${
                              active
                                ? "bg-[rgba(255,255,255,0.14)] text-[var(--color-text)]"
                                : "text-[var(--color-subtext)] hover:bg-[rgba(255,255,255,0.08)] hover:text-[var(--color-text)]"
                            }`}
                            title={collapsed ? playlist.name : undefined}
                            aria-label={collapsed ? playlist.name : undefined}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(255,255,255,0.1)] text-xs font-bold text-[var(--color-text)]">
                              {playlist.name?.charAt(0)?.toUpperCase() ?? "P"}
                            </div>
                            {!collapsed && (
                              <div className="min-w-0 flex-1">
                                <div className="truncate">{playlist.name}</div>
                                <div className="truncate text-xs text-[var(--color-muted)]">
                                  {(playlist.trackCount ?? 0).toString()} tracks
                                </div>
                              </div>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-3 py-2 text-sm text-[var(--color-subtext)]">
                      {!collapsed ? (
                        <button
                          className="electron-no-drag inline-flex items-center gap-2 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm text-[var(--color-text)] hover:border-[rgba(244,178,102,0.35)] hover:bg-[rgba(244,178,102,0.1)]"
                          onClick={() => setCreateModalOpen(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Create your first playlist
                        </button>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                  )}
                </div>

                {!collapsed && (
                  <div className="mt-3 px-2">
                    <Link
                      href="/playlists"
                      className="electron-no-drag inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-subtext)] hover:text-[var(--color-text)]"
                    >
                      <ListMusic className="h-4 w-4" />
                      See all playlists
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="px-2">
                {!collapsed ? (
                  <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-4 text-sm text-[var(--color-subtext)]">
                    <div className="text-xs font-semibold tracking-[0.16em] text-[var(--color-muted)] uppercase">
                      Your Library
                    </div>
                    <div className="mt-2 text-[var(--color-muted)]">
                      Your playlists will appear here.
                    </div>
                  </div>
                ) : (
                  <div className="flex h-10 w-full items-center justify-center text-xs text-[var(--color-muted)]">
                    —
                  </div>
                )}
              </div>
            )}
          </div>

          {!collapsed && session && (
            <div className="mt-auto space-y-2 px-3 pb-[calc(env(safe-area-inset-bottom)+var(--electron-sidebar-bottom-padding))]">
              <button
                className="electron-no-drag flex w-full items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--color-accent),var(--color-accent-strong))] px-3 py-2.5 text-sm font-semibold text-[var(--color-on-accent)] shadow-[var(--accent-btn-shadow)] transition hover:scale-[1.01] active:scale-[0.99]"
                onClick={() => setCreateModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New playlist
              </button>
              {session ? (
                <button
                  className="electron-no-drag flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(255,255,255,0.14)] bg-[rgba(255,255,255,0.06)] px-3 py-2 text-sm font-semibold text-[var(--color-subtext)] transition hover:border-[rgba(255,255,255,0.24)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                  onClick={() => void appSignOut({ callbackUrl: "/" })}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : null}
            </div>
          )}
          {collapsed && session ? (
            <div className="mt-auto px-2 pb-[calc(env(safe-area-inset-bottom)+var(--electron-sidebar-bottom-padding))]">
              <button
                className="electron-no-drag flex h-9 w-full items-center justify-center rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.06)] text-[var(--color-subtext)] transition hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
                onClick={() => void appSignOut({ callbackUrl: "/" })}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {!collapsed && (
            <div className="px-3 pb-2 text-center">
              <p className="text-[9px] text-[var(--color-muted)] opacity-30">
                v{APP_VERSION}
              </p>
            </div>
          )}
        </div>
      </aside>

      <CreatePlaylistModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </>
  );
}
