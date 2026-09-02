import { expect, type Locator, test } from "@playwright/test";

import { saveScreenshot } from "./support";

async function expectNaturalSizeOrSmaller(images: Locator) {
  const sizes = await images.evaluateAll((elements: HTMLImageElement[]) =>
    elements.map((image) => ({
      naturalWidth: image.naturalWidth,
      renderedWidth: image.getBoundingClientRect().width,
    })),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.renderedWidth).toBeLessThanOrEqual(size.naturalWidth);
  }
}

test("home page points people to the report and setup guide", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Review screenshot changes in one place.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /sample report/i }),
  ).toHaveAttribute("href", "/sample/");
  await expect(
    page.getByRole("link", { name: /set up frameshift/i }),
  ).toHaveAttribute("href", "/guide/");

  await saveScreenshot(page, "home__desktop.png");
});

test("setup guide explains the complete workflow", async ({ page }) => {
  await page.goto("/guide/");

  await expect(
    page.getByRole("heading", { name: "Set up Frameshift", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Save screenshots to one folder" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Add Frameshift after the tests" }),
  ).toBeVisible();

  await saveScreenshot(page, "guide__desktop.png", { fullPage: true });
});

test("report arrow keys switch screenshots and before-and-after views", async ({
  page,
}) => {
  await page.goto("/sample/");

  const title = page.locator(".review-heading h1");
  const cue = page.locator(".keyboard-view-cue");
  await expect(title).toHaveText("trip planner · desktop");
  await expect(
    page.getByRole("button", { name: "Highlights" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "PR #42" })).toHaveAttribute(
    "href",
    "https://github.com/dcramer/frameshift/pull/42",
  );
  await saveScreenshot(page, "report-highlights__desktop.png");

  await page.keyboard.press("ArrowLeft");
  await expect(cue.getByText("Before", { exact: true })).toBeVisible();
  await saveScreenshot(page, "report-before__desktop.png");

  await page.keyboard.press("ArrowRight");
  await expect(cue.getByText("After", { exact: true })).toBeVisible();
  await saveScreenshot(page, "report-after__desktop.png");

  await page.keyboard.press("Escape");
  await expect(cue).toHaveCount(0);
  await page.keyboard.press("ArrowUp");
  await expect(title).toHaveText("team itinerary · desktop");
  await page.keyboard.press("ArrowDown");
  await expect(title).toHaveText("trip planner · desktop");
});

test("the report sidebar groups related screenshots", async ({ page }) => {
  await page.goto("/sample/");

  const navigation = page.locator(".desktop-screenshot-nav");
  const category = navigation
    .locator(".screenshot-tree-branch > h2")
    .filter({ hasText: /^trip planner$/i });
  const variants = category.locator("..").locator(":scope > button > span");

  await expect(category).toBeVisible();
  await expect(variants).toHaveText(["desktop", "tablet"]);
});

test("the comparison slider keeps control of its arrow keys", async ({
  page,
}) => {
  await page.goto("/sample/");

  await page.getByRole("button", { name: "Slider" }).click();
  const slider = page.getByRole("slider", {
    name: "Move the before-and-after slider",
  });
  await slider.focus();
  await slider.press("ArrowRight");

  await expect(slider).toHaveValue("51");
  await expect(page.locator(".keyboard-view-cue")).toHaveCount(0);
});

test("fit mode never enlarges screenshots", async ({ page }) => {
  await page.setViewportSize({ height: 1000, width: 2000 });
  await page.goto("/sample/");

  await expect(page.locator(".review-heading h1")).toHaveText(
    "trip planner · desktop",
  );
  await expectNaturalSizeOrSmaller(page.locator(".difference-trigger img"));

  await page.getByRole("button", { name: "Side by side" }).click();
  await expectNaturalSizeOrSmaller(page.locator(".comparison-pane img"));

  await page.getByRole("button", { name: "Slider" }).click();
  await expectNaturalSizeOrSmaller(page.locator(".comparison-canvas > img"));

  await page
    .getByRole("button", { name: "team itinerary · desktop, added" })
    .first()
    .click();
  await expectNaturalSizeOrSmaller(page.locator(".single-figure img"));
});

test("the report stays usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/sample/");

  const picker = page.locator(".mobile-screenshot-picker");
  await expect(picker).toBeVisible();
  await picker.locator("summary").click();
  await expect(
    picker.getByRole("button", { name: "team itinerary · desktop, added" }),
  ).toBeVisible();

  await saveScreenshot(page, "report__mobile.png");
});
