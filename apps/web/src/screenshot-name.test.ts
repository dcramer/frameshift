import { describe, expect, test } from "vitest";

import {
  compareScreenshotsForReview,
  displayName,
  sidebarScreenshotName,
} from "./screenshot-name";

describe("screenshot names", () => {
  test("turns folders and double underscores into a path", () => {
    expect(displayName("settings/account_profile__mobile.png")).toBe(
      "settings · account profile · mobile",
    );
  });

  test("accepts dots as path separators", () => {
    expect(displayName("settings.account_profile__mobile.png")).toBe(
      "settings · account profile · mobile",
    );
  });

  test("splits the sidebar label from its path and variant", () => {
    expect(
      sidebarScreenshotName("flows/settings/account_profile__mobile.png"),
    ).toEqual({
      context: "flows / settings / mobile",
      name: "account profile",
    });
    expect(sidebarScreenshotName("account.png")).toEqual({
      context: "",
      name: "account",
    });
  });

  test("sorts screenshots by review priority and then name", () => {
    const files = [
      { file: "account.png", status: "unchanged" as const },
      { file: "checkout.png", status: "removed" as const },
      { file: "billing.png", status: "changed" as const },
      { file: "account.png", status: "changed" as const },
      { file: "profile.png", status: "added" as const },
    ];

    expect(files.toSorted(compareScreenshotsForReview)).toEqual([
      { file: "account.png", status: "changed" },
      { file: "billing.png", status: "changed" },
      { file: "profile.png", status: "added" },
      { file: "checkout.png", status: "removed" },
      { file: "account.png", status: "unchanged" },
    ]);
  });
});
