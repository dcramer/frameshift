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

  const selectedScreenshot = page.locator(".desktop-screenshot-nav a.selected");
  const cue = page.locator(".keyboard-view-cue");
  await expect(selectedScreenshot).toHaveAccessibleName(
    "trip planner · desktop, changed",
  );
  await expect(
    page.getByRole("button", { name: "Highlights" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("link", {
      name: "PR #42 Make group trips easier to plan",
    }),
  ).toHaveAttribute("href", "https://github.com/dcramer/frameshift/pull/42");
  await expect(
    page.getByRole("link", { name: "dcramer/frameshift on GitHub" }),
  ).toHaveAttribute("href", "https://github.com/dcramer/frameshift");
  await saveScreenshot(page, "report-highlights__desktop.png");

  await page.keyboard.press("ArrowLeft");
  await expect(cue.getByText("Before", { exact: true })).toBeVisible();
  await saveScreenshot(page, "report-before__desktop.png");

  await page.keyboard.press("ArrowRight");
  await expect(cue.getByText("After", { exact: true })).toBeVisible();
  await saveScreenshot(page, "report-after__desktop.png");

  await page.keyboard.press("Escape");
  await expect(cue).toHaveCount(0);
  await page.keyboard.press("ArrowDown");
  await expect(selectedScreenshot).toHaveAccessibleName(
    "trip planner · tablet, changed",
  );
  await page.keyboard.press("ArrowDown");
  await expect(selectedScreenshot).toHaveAccessibleName(
    "team itinerary · desktop, added",
  );
});

test("the report sidebar groups screenshots by review priority", async ({
  page,
}) => {
  await page.goto("/sample/");

  const navigation = page.locator(".desktop-screenshot-nav");
  await expect(navigation.getByRole("heading", { level: 2 })).toHaveText([
    "Changed",
    "Added",
    "Removed",
    "Unchanged",
  ]);
  await expect(
    navigation
      .locator("[data-screenshot]")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-screenshot")),
      ),
  ).resolves.toEqual([
    "trip-planner__desktop.png",
    "trip-planner__tablet.png",
    "team-itinerary__desktop.png",
    "approvals-queue__desktop.png",
    "account__desktop.png",
  ]);

  const added = navigation.getByRole("link", {
    name: "team itinerary · desktop, added",
  });
  await expect(added.locator(".screenshot-row-name")).toHaveText(
    "team itinerary",
  );
  await expect(added.locator(".screenshot-row-context")).toHaveText("desktop");

  const removed = navigation.getByRole("link", {
    name: "approvals queue · desktop, removed",
  });
  await expect(removed.locator(".screenshot-row-name")).toHaveText(
    "approvals queue",
  );
});

test("sidebar focus follows the same order as arrow navigation", async ({
  page,
}) => {
  await page.goto("/sample/");

  const selected = page.locator(
    ".desktop-screenshot-nav [data-screenshot].selected",
  );
  await selected.focus();
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAccessibleName("trip planner · tablet, changed");
  await expect(selected).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(selected).toHaveAccessibleName(
    "team itinerary · desktop, added",
  );
  await expect(selected).toBeFocused();
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

test("comparison views never enlarge screenshots", async ({ page }) => {
  await page.setViewportSize({ height: 1000, width: 2000 });
  await page.goto("/sample/");

  await expect(
    page.locator(".desktop-screenshot-nav a.selected"),
  ).toHaveAccessibleName("trip planner · desktop, changed");
  await expectNaturalSizeOrSmaller(page.locator(".difference-trigger img"));

  await page.getByRole("button", { name: "Side by side" }).click();
  await expectNaturalSizeOrSmaller(page.locator(".comparison-pane img"));

  await page.getByRole("button", { name: "Slider" }).click();
  await expectNaturalSizeOrSmaller(page.locator(".comparison-canvas > img"));

  await page
    .getByRole("link", { name: "team itinerary · desktop, added" })
    .first()
    .click();
  await expectNaturalSizeOrSmaller(page.locator(".single-figure img"));
});

test("the full-screen preview maximizes screenshots and allows overflow", async ({
  page,
}) => {
  await page.goto("/sample/");

  await page
    .getByRole("button", { name: "Open highlighted changes full screen" })
    .click();

  const canvas = page.getByRole("region", { name: "Highlights image" });
  const image = canvas.getByRole("img");
  const dimensions = await image.evaluate((element: HTMLImageElement) => ({
    naturalWidth: element.naturalWidth,
    renderedWidth: element.getBoundingClientRect().width,
  }));

  expect(dimensions.renderedWidth).toBeGreaterThan(dimensions.naturalWidth);
  await expect(page.getByRole("button", { name: "Maximize" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(
    await canvas.evaluate(
      (element) =>
        element.scrollWidth > element.clientWidth ||
        element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
});

test("the report stays usable on a phone-sized screen", async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto("/sample/");

  const picker = page.locator(".mobile-screenshot-picker");
  await expect(
    page.getByRole("link", { name: "Frameshift home" }),
  ).toBeVisible();
  await expect(picker).toBeVisible();
  await picker.locator(":scope > summary").click();
  await expect(
    picker.getByRole("link", { name: "team itinerary · desktop, added" }),
  ).toBeVisible();

  await saveScreenshot(page, "report__mobile.png");
});
