// File: apps/web/src/app/license/page.tsx

import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function generateMetadata() {
  const t = await getTranslations("license");
  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export const dynamic = "force-dynamic";

export default async function LicensePage() {
  const t = await getTranslations("license");
  const tc = await getTranslations("common");
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-[var(--color-subtext)] transition-colors hover:text-[var(--color-text)]"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            {tc("backToHome")}
          </Link>
          <h1 className="mb-2 text-4xl font-bold text-[var(--color-text)]">
            {t("title")}
          </h1>
          <p className="text-gray-400">
            {t("subtitle")}
          </p>
        </div>

        {}
        <div className="mb-8 rounded-2xl border border-indigo-500/30 bg-indigo-900/20 p-6 backdrop-blur-sm">
          <h2 className="mb-4 text-xl font-semibold text-[var(--color-text)]">
            {t("summary")}
          </h2>
          <div className="space-y-3 text-sm text-gray-300">
            <div className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>
                <strong>{t("freeToUseLabel")}</strong> {t("freeToUse")}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>
                <strong>{t("modifyLabel")}</strong> {t("modify")}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-green-400">✓</span>
              <span>
                <strong>{t("distributeLabel")}</strong> {t("distribute")}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-yellow-400">⚠</span>
              <span>
                <strong>{t("copyleftLabel")}</strong> {t("copyleft")}
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-red-400">✗</span>
              <span>
                <strong>{t("noWarrantyLabel")}</strong> {t("noWarranty")}
              </span>
            </div>
          </div>
        </div>

        {}
        <div className="mb-8 rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          <p className="mb-2 font-mono text-sm text-gray-300">
            {t("copyrightNotice")}
          </p>
          <p className="text-sm text-gray-400">
            {t("freeProgram")}
          </p>
        </div>

        {}
        <div className="rounded-lg border border-gray-800 bg-gray-900/30 p-8">
          <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
            {t("gplTitle")}
          </h2>
          <div className="prose prose-invert max-w-none">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-gray-300">
              {`                    GNU GENERAL PUBLIC LICENSE
                       Version 3, 29 June 2007

 Copyright (C) 2007 Free Software Foundation, Inc. <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The GNU General Public License is a free, copyleft license for
software and other kinds of works.

  The licenses for most software and other practical works are designed
to take away your freedom to share and change the works.  By contrast,
the GNU General Public License is intended to guarantee your freedom to
share and change all versions of a program--to make sure it remains free
software for all its users.  We, the Free Software Foundation, use the
GNU General Public License for most of our software; it applies also to
any other work released this way by its authors.  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
them if you wish), that you receive source code or can get it if you
want it, that you can change the software or use pieces of it in new
free programs, and that you know you can do these things.

  To protect your rights, we need to prevent others from denying you
these rights or asking you to surrender the rights.  Therefore, you have
certain responsibilities if you distribute copies of the software, or if
you modify it: responsibilities to respect the freedom of others.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must pass on to the recipients the same
freedoms that you received.  You must make sure that they, too, receive
or can get the source code.  And you must show them these terms so they
know their rights.

  Developers that use the GNU GPL protect your rights with two steps:
(1) assert copyright on the software, and (2) offer you this License
giving you legal permission to copy, distribute and/or modify it.

  For the developers' and authors' protection, the GPL clearly explains
that there is no warranty for this free software.  For both users' and
authors' sake, the GPL requires that modified versions be marked as
changed, so that their problems will not be attributed erroneously to
authors of previous versions.

  Some devices are designed to deny users access to install or run
modified versions of the software inside them, although the manufacturer
can do so.  This is fundamentally incompatible with the aim of
protecting users' freedom to change the software.  The systematic
pattern of such abuse occurs in the area of products for individuals to
use, which is precisely where it is most unacceptable.  Therefore, we
have designed this version of the GPL to prohibit the practice for those
products.  If such problems arise substantially in other domains, we
stand ready to extend this provision to those domains in future versions
of the GPL, as needed to protect the freedom of users.

  Finally, every program is threatened constantly by software patents.
States should not allow patents to restrict development and use of
software on general-purpose computers, but in those that do, we wish to
avoid the special danger that patents applied to a free program could
make it effectively proprietary.  To prevent this, the GPL assures that
patents cannot be used to render the program non-free.

  The precise terms and conditions for copying, distribution and
modification follow.

                       TERMS AND CONDITIONS

  [Full GPL v3 text continues...]

  For the complete license text, see: https://www.gnu.org/licenses/gpl-3.0.html`}
            </pre>
          </div>
        </div>

        {}
        <div className="mt-8 rounded-lg border border-gray-800 bg-gray-900/30 p-6">
          <h3 className="mb-4 text-lg font-semibold text-[var(--color-text)]">{t("learnMore")}</h3>
          <div className="space-y-3">
            <a
              href="https://www.gnu.org/licenses/gpl-3.0.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-400 transition-colors hover:text-indigo-300"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              {t("readFullLicense")}
            </a>
            <a
              href="https://www.gnu.org/licenses/gpl-faq.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-400 transition-colors hover:text-indigo-300"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {t("gplFaq")}
            </a>
            <a
              href="https://github.com/soulwax/starchild-music-frontend"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-indigo-400 transition-colors hover:text-indigo-300"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              {t("viewSourceCode")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
