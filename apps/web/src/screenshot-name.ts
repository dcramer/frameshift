type ScreenshotFile = { file: string };

type ScreenshotStatus = "added" | "changed" | "removed" | "unchanged";

const statusOrder: Record<ScreenshotStatus, number> = {
  changed: 0,
  added: 1,
  removed: 2,
  unchanged: 3,
};

export function displayName(file: string) {
  return file
    .replace(/\.png$/i, "")
    .split("/")
    .flatMap((part) => part.split(/__|\./))
    .filter(Boolean)
    .map((part) => part.replace(/[-_]+/g, " "))
    .join(" · ");
}

export function sidebarScreenshotName(file: string) {
  const path = file.replace(/\.png$/i, "").split("/");
  const basename = path.pop() ?? file;
  const basenameParts = basename.split(/__|\./).filter(Boolean);
  const variant = basenameParts.length > 1 ? basenameParts.pop() : undefined;
  const name = basenameParts.pop() ?? basename;
  const context = [...path, ...basenameParts, ...(variant ? [variant] : [])]
    .map((part) => part.replace(/[-_]+/g, " "))
    .join(" / ");

  return {
    context,
    name: name.replace(/[-_]+/g, " "),
  };
}

function compareScreenshotNames(left: ScreenshotFile, right: ScreenshotFile) {
  return displayName(left.file).localeCompare(
    displayName(right.file),
    undefined,
    { numeric: true, sensitivity: "base" },
  );
}

export function compareScreenshotsForReview<
  T extends ScreenshotFile & { status: ScreenshotStatus },
>(left: T, right: T) {
  return (
    statusOrder[left.status] - statusOrder[right.status] ||
    compareScreenshotNames(left, right)
  );
}
