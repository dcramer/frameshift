import { describe, expect, test } from "vitest";

import { parseVisualDiffReport } from "./index.js";

const changedFile = {
  file: "home__desktop.png",
  image: "images/diff/home__desktop.png",
  images: {
    baseline: "images/baseline/home__desktop.png",
    candidate: "images/candidate/home__desktop.png",
    diff: "images/diff/home__desktop.png",
  },
  status: "changed",
};

describe("parseVisualDiffReport", () => {
  test("parses a version 1 report and derives its summary", () => {
    expect(
      parseVisualDiffReport({
        files: [changedFile, { file: "search.png", status: "unchanged" }],
        summary: {},
        version: 1,
      }).summary,
    ).toEqual({ added: 0, changed: 1, removed: 0, unchanged: 1 });
  });

  test("accepts the legacy version 1 primary-image shape", () => {
    expect(
      parseVisualDiffReport({
        files: [
          {
            file: "home__desktop.png",
            image: "images/home__desktop.png",
            status: "changed",
          },
        ],
        version: 1,
      }).files[0],
    ).toMatchObject({
      image: "images/home__desktop.png",
      images: undefined,
      status: "changed",
    });
  });

  test("rejects path traversal", () => {
    expect(() =>
      parseVisualDiffReport({
        files: [{ ...changedFile, file: "../secret.png" }],
        version: 1,
      }),
    ).toThrow("Invalid report image path");
  });

  test("rejects images that do not match the status", () => {
    expect(() =>
      parseVisualDiffReport({
        files: [
          {
            file: "new.png",
            image: "images/candidate/new.png",
            images: {
              baseline: "images/baseline/new.png",
              candidate: "images/candidate/new.png",
            },
            status: "added",
          },
        ],
        version: 1,
      }),
    ).toThrow("Invalid visual diff images for added");
  });
});
