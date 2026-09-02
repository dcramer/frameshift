import { describe, expect, test } from "vitest";

import { screenshotBranches, screenshotName } from "./screenshot-name";

describe("screenshot names", () => {
  test("turns folders and double underscores into a path", () => {
    expect(screenshotName("settings/account_profile__mobile.png")).toEqual({
      full: "settings · account profile · mobile",
      leaf: "mobile",
      parent: "settings / account profile",
      parentKey: "settings\0account_profile",
    });
  });

  test("accepts dots as path separators", () => {
    expect(screenshotName("settings.account_profile__mobile.png")).toEqual({
      full: "settings · account profile · mobile",
      leaf: "mobile",
      parent: "settings / account profile",
      parentKey: "settings\0account_profile",
    });
  });

  test("groups siblings under one compact label", () => {
    expect(
      screenshotBranches([
        { file: "settings/account__desktop.png" },
        { file: "settings/account__mobile.png" },
        { file: "settings/profile__desktop.png" },
      ]),
    ).toEqual([
      {
        items: [
          {
            file: { file: "settings/account__desktop.png" },
            label: "desktop",
          },
          {
            file: { file: "settings/account__mobile.png" },
            label: "mobile",
          },
        ],
        key: "settings\0account",
        label: "settings / account",
      },
      {
        items: [
          {
            file: { file: "settings/profile__desktop.png" },
            label: "settings / profile",
          },
        ],
        key: "settings\0profile",
        label: undefined,
      },
    ]);
  });
});
