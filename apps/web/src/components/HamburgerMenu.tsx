// File: apps/web/src/components/HamburgerMenu.tsx

"use client";

import { APP_VERSION } from "@/config/version";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useMenu } from "@/contexts/MenuContext";
import { appSignOut } from "@/services/authSignOut";
import { api } from "@starchild/api-client/trpc/react";
import { hapticLight, hapticMedium } from "@/utils/haptics";
import { springPresets } from "@/utils/spring-animations";
import emilyLogo from "../../public/emily-the-strange.png";
import { AnimatePresence, motion } from "framer-motion";
import {
    ChevronRight,
    FileText,
    Home,
    Info,
    Library,
    ListMusic,
    LogOut,
    Settings,
    Shield,
    User,
} from "lucide-react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  action?: () => void;
  requiresAuth?: boolean;
  dividerAfter?: boolean;
}

export default function HamburgerMenu() {
  const { isMenuOpen, closeMenu } = useMenu();
  const { openAuthModal } = useAuthModal();
  const { data: session } = useSession();
  const { data: userHash } = api.music.getCurrentUserHash.useQuery(
    undefined,
    { enabled: !!session },
  );

  const handleSignOut = () => {
    hapticMedium();
    closeMenu();
    void appSignOut({ callbackUrl: "/" });
  };

  const menuItems: MenuItem[] = [
    {
      id: "home",
      label: "Home",
      icon: <Home className="h-5 w-5" />,
      path: "/",
    },
    {
      id: "library",
      label: "Library",
      icon: <Library className="h-5 w-5" />,
      path: "/library",
      requiresAuth: true,
    },
    {
      id: "playlists",
      label: "Playlists",
      icon: <ListMusic className="h-5 w-5" />,
      path: "/playlists",
      requiresAuth: true,
      dividerAfter: true,
    },
    {
      id: "profile",
      label: session ? "Profile" : "Sign In",
      icon: <User className="h-5 w-5" />,
      path:
        session && userHash
          ? `/${userHash}`
          : session
            ? "#" // Placeholder while userHash loads - preventDefault() handles navigation
            : "/",
      requiresAuth: true,
      dividerAfter: !session,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="h-5 w-5" />,
      path: "/settings",
      requiresAuth: true,
    },
    {
      id: "about",
      label: "About",
      icon: <Info className="h-5 w-5" />,
      path: "/about",
    },
    {
      id: "license",
      label: "License",
      icon: <FileText className="h-5 w-5" />,
      path: "/license",
      dividerAfter: true,
    },
  ];

  if (session?.user?.admin) {
    menuItems.push({
      id: "admin",
      label: "Admin",
      icon: <Shield className="h-5 w-5" />,
      path: "/admin",
      requiresAuth: true,
    });
  }

  if (session) {
    menuItems.push({
      id: "signout",
      label: "Sign Out",
      icon: <LogOut className="h-5 w-5" />,
      action: handleSignOut,
    });
  }

  const visibleItems = menuItems;

  return (
    <AnimatePresence>
      {isMenuOpen && (
        <>
          {}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="theme-chrome-backdrop fixed inset-0 z-[60] backdrop-blur-sm"
            onClick={() => {
              hapticLight();
              closeMenu();
            }}
          />

          {}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={springPresets.gentle}
            className="theme-chrome-drawer safe-left safe-top safe-bottom
                       fixed bottom-0 left-0 top-0 z-[61]
                       w-[280px] max-w-[80vw]
                       overflow-y-auto
                       border-r
                       shadow-2xl
                       backdrop-blur-xl"
          >
            {}
            <div className="border-b border-[var(--color-border)] p-6">
              <div className="flex items-center gap-3">
                <Image
                  src={emilyLogo}
                  alt="Starchild Music"
                  width={40}
                  height={40}
                  className="rounded-xl ring-2 ring-[rgba(244,178,102,0.3)]"
                  priority
                  unoptimized
                />
                <div>
                  <h2 className="text-lg font-bold text-[var(--color-text)]">
                    Starchild Music
                  </h2>
                  {session && (
                    <p className="text-xs text-[var(--color-subtext)]">
                      {session.user?.name}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {}
            <nav className="p-4">
              {visibleItems.map((item, index) => (
                <div key={item.id}>
                  {item.path ? (
                    <Link
                      href={item.path}
                      onClick={(e) => {
                        // Prevent navigation if profile link is clicked but userHash isn't loaded yet
                        if (item.id === "profile" && session && !userHash) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }

                        if (item.requiresAuth && !session) {
                          e.preventDefault();
                          e.stopPropagation();
                          hapticLight();
                          closeMenu();
                          openAuthModal({
                            callbackUrl: item.path ?? "/",
                          });
                          return;
                        }

                        hapticLight();
                        closeMenu();
                      }}
                      className={item.id === "profile" && session && !userHash ? "pointer-events-none opacity-50" : ""}
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          ...springPresets.smooth,
                          delay: index * 0.05,
                        }}
                        whileTap={{ scale: 0.98 }}
                        className="mb-1 flex items-center justify-between
                                   rounded-xl px-4 py-3
                                   text-[var(--color-text)]
                                   transition-colors
                                   hover:bg-[var(--color-surface-hover)]"
                      >
                        <div className="flex items-center gap-3">
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-[var(--color-muted)]" />
                      </motion.div>
                    </Link>
                  ) : (
                    <motion.button
                      onClick={item.action}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        ...springPresets.smooth,
                        delay: index * 0.05,
                      }}
                      whileTap={{ scale: 0.98 }}
                      className="mb-1 flex w-full items-center justify-between
                                 rounded-xl px-4 py-3
                                 text-[var(--color-text)]
                                 transition-colors
                                 hover:bg-[var(--color-danger)]/10"
                    >
                      <div className="flex items-center gap-3">
                        {item.icon}
                        <span className="font-medium">{item.label}</span>
                      </div>
                    </motion.button>
                  )}

                  {item.dividerAfter && (
                    <div className="my-2 h-px bg-[var(--color-border)]" />
                  )}
                </div>
              ))}
            </nav>

            {}
            <div className="border-t border-[var(--color-border)] p-6">
              <p className="text-center text-xs text-[var(--color-muted)]">
                Starchild Music v{APP_VERSION}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
