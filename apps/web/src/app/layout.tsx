// File: apps/web/src/app/layout.tsx

import "@/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import localFont from "next/font/local";
import { Suspense, type ReactNode } from "react";

import { DynamicTitle } from "@/components/DynamicTitle";
import { AuthGate } from "@/components/AuthGate";
import { DesktopShell } from "@/components/DesktopShell";
import { ElectronChromeSync } from "@/components/ElectronChromeSync";
import { ElectronStorageInit } from "@/components/ElectronStorageInit";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import HamburgerMenu from "@/components/HamburgerMenu";
import Header from "@/components/Header";
import { LinuxTitlebar } from "@/components/LinuxTitlebar";
import MobileContentWrapper from "@/components/MobileContentWrapper";
import { MobileFooterWrapper } from "@/components/MobileFooterWrapper";
import MobileHeader from "@/components/MobileHeader";
import PersistentPlayer from "@/components/PersistentPlayer";
import { PlaylistContextMenu } from "@/components/PlaylistContextMenu";
import { SessionProvider } from "@/components/SessionProvider";
import SuppressExtensionErrors from "@/components/SuppressExtensionErrors";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { UIWrapper } from "@/components/UIWrapper";
import CookieConsent from "@/components/CookieConsent";
import { AudioPlayerProvider } from "@starchild/player-react/AudioPlayerContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import { KeyboardShortcutsProvider } from "@/contexts/KeyboardShortcutsProvider";
import { MenuProvider } from "@/contexts/MenuContext";
import { PlaylistContextMenuProvider } from "@/contexts/PlaylistContextMenuContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { TrackContextMenuProvider } from "@/contexts/TrackContextMenuContext";
import { TRPCReactProvider } from "@starchild/api-client/trpc/react";
import { getBaseUrl } from "@/utils/getBaseUrl";
import { RegisterServiceWorker } from "./register-sw";
import emilyLogo from "../../public/emily-the-strange.png";

const appSans = localFont({
  src: [
    {
      path: "./fonts/DejaVuSans-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/DejaVuSans-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  display: "swap",
  variable: "--font-spotify-sans",
});

const baseUrl = getBaseUrl();

// Use static OG image for default metadata
const defaultOgImageUrl = "/og-image.png";

export const metadata: Metadata = {
  title: "Starchild Music",
  description:
    "Modern music streaming and discovery platform with advanced audio features and visual patterns",
  applicationName: "Starchild Music",
  icons: [
    { rel: "icon", url: emilyLogo.src, type: "image/png" },
    { rel: "apple-touch-icon", url: emilyLogo.src, type: "image/png" },
  ],
  manifest: "/manifest.json",
  openGraph: {
    title: "Starchild Music",
    description:
      "Modern music streaming and discovery platform with advanced audio features and visual patterns",
    type: "website",
    url: baseUrl,
    siteName: "Starchild Music",
    images: [
      {
        url: defaultOgImageUrl,
        width: 1200,
        height: 630,
        alt: "Starchild Music - Modern music streaming platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Starchild Music",
    description:
      "Modern music streaming and discovery platform with advanced audio features and visual patterns",
    images: [defaultOgImageUrl],
  },
  other: {
    "format-detection": "telephone=no",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Starchild Music",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" className={appSans.variable} suppressHydrationWarning>
      <head>
        {}
        <link rel="preconnect" href="https://cdn-images.dzcdn.net" />
        <link rel="dns-prefetch" href="https://api.deezer.com" />
      </head>
      <body>
        <LinuxTitlebar />
        <SuppressExtensionErrors />
        <ElectronStorageInit />
        <RegisterServiceWorker />
        <CookieConsent />
        <ErrorBoundary>
          <SessionProvider>
            <TRPCReactProvider>
              <ThemeProvider>
                <AuthModalProvider>
                  <ElectronChromeSync />
                  <ToastProvider>
                    <AudioPlayerProvider>
                      <KeyboardShortcutsProvider>
                        {}
                        <DynamicTitle />
                        <MenuProvider>
                          <TrackContextMenuProvider>
                            <PlaylistContextMenuProvider>
                              <AuthGate>
                                {}
                                <UIWrapper>
                                  {}
                                  <DesktopShell>
                                    <div suppressHydrationWarning>
                                      <Suspense fallback={null}>
                                        <Header />
                                      </Suspense>
                                    </div>
                                    {}
                                    <Suspense fallback={null}>
                                      <MobileHeader />
                                    </Suspense>
                                    {}
                                    <HamburgerMenu />
                                    {}
                                    <MobileContentWrapper>
                                      {}
                                      <div className="pt-16 pb-36 md:pt-0 md:pb-24">
                                        {children}
                                      </div>
                                    </MobileContentWrapper>
                                  </DesktopShell>
                                </UIWrapper>
                                {}
                                <PersistentPlayer />
                                {}
                                <Suspense fallback={null}>
                                  <MobileFooterWrapper />
                                </Suspense>
                                {}
                                <TrackContextMenu />
                                {}
                                <PlaylistContextMenu />
                              </AuthGate>
                            </PlaylistContextMenuProvider>
                          </TrackContextMenuProvider>
                        </MenuProvider>
                      </KeyboardShortcutsProvider>
                    </AudioPlayerProvider>
                  </ToastProvider>
                </AuthModalProvider>
              </ThemeProvider>
            </TRPCReactProvider>
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
