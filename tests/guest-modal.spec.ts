// File: tests/guest-modal.spec.ts

import { expect, test } from "@playwright/test";

const MOCK_GENRES = Array.from({ length: 120 }, (_, index) => ({
  id: index + 1,
  name: `Genre ${String(index + 1).padStart(3, "0")}`,
}));

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    });
  });

  await page.route("**/api/music/genres**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: MOCK_GENRES }),
    });
  });

  await page.addInitScript(() => {
    window.localStorage.setItem("cookie-consent", "true");
    window.localStorage.removeItem("sb_guest_modal_dismissed");
    window.localStorage.removeItem("sb_guest_mode_enabled");
    window.localStorage.removeItem("hexmusic_preferred_genre_id");
    window.localStorage.removeItem("hexmusic_preferred_genre_name");
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Tune the start page and optionally sign in",
    }),
  ).toBeVisible();
});

test("genre dropdown scrolls with mouse wheel", async ({ page }) => {
  const trigger = page.locator("#guest-preferred-genre");
  const listbox = page.locator("#guest-preferred-genre-listbox");
  const scrollContainer = listbox.locator(".guest-modal-dropdown-scroll");

  await trigger.click();
  await expect(listbox).toBeVisible();

  const initialScrollTop = await scrollContainer.evaluate(
    (element) => element.scrollTop,
  );

  await scrollContainer.hover();
  await page.mouse.wheel(0, 1000);

  await expect
    .poll(async () => {
      return scrollContainer.evaluate((element) => element.scrollTop);
    })
    .toBeGreaterThan(initialScrollTop);
});

test("genre dropdown supports arrow keys and enter selection", async ({
  page,
}) => {
  const trigger = page.locator("#guest-preferred-genre");
  const listbox = page.locator("#guest-preferred-genre-listbox");

  await trigger.click();
  await expect(listbox).toBeVisible();
  await expect(trigger).toHaveAttribute(
    "aria-activedescendant",
    "guest-preferred-genre-option-0",
  );

  await page.keyboard.press("ArrowDown");
  await expect(trigger).toHaveAttribute(
    "aria-activedescendant",
    "guest-preferred-genre-option-1",
  );

  await page.keyboard.press("Enter");
  await expect(listbox).toBeHidden();
  await expect(trigger).toContainText("Genre 001");
});
