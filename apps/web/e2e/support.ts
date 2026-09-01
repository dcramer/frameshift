import type { Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const screenshotDirectory = fileURLToPath(
  new URL("../../../test-output/screenshots/", import.meta.url),
);

async function waitForStablePage(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map(async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            image.addEventListener("error", () => resolve(), { once: true });
            image.addEventListener("load", () => resolve(), { once: true });
          });
        }
        if (image.complete && image.naturalWidth > 0) {
          await image.decode();
        }
      }),
    );
  });
}

export async function saveScreenshot(
  page: Page,
  file: string,
  options: { fullPage?: boolean } = {},
) {
  await waitForStablePage(page);
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    fullPage: options.fullPage,
    path: path.join(screenshotDirectory, file),
  });
}
