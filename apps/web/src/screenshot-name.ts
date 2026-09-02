type ScreenshotFile = { file: string };

export type ScreenshotBranch<T extends ScreenshotFile> = {
  items: { file: T; label: string }[];
  key: string;
  label?: string;
};

export function screenshotName(file: string) {
  const rawParts = file
    .replace(/\.png$/i, "")
    .split("/")
    .flatMap((part) => part.split(/__|\./))
    .filter(Boolean);
  const parts = rawParts.map((part) => part.replace(/[-_]+/g, " "));
  const leaf = parts.at(-1) ?? file;

  return {
    full: parts.join(" · "),
    leaf,
    parent: parts.slice(0, -1).join(" / "),
    parentKey: rawParts.slice(0, -1).join("\0"),
  };
}

export function displayName(file: string) {
  return screenshotName(file).full;
}

export function compareScreenshotNames(
  left: ScreenshotFile,
  right: ScreenshotFile,
) {
  return displayName(left.file).localeCompare(
    displayName(right.file),
    undefined,
    { numeric: true, sensitivity: "base" },
  );
}

export function screenshotBranches<T extends ScreenshotFile>(
  files: readonly T[],
): ScreenshotBranch<T>[] {
  const branches = new Map<
    string,
    { files: T[]; label: string; key: string }
  >();

  for (const file of files) {
    const name = screenshotName(file.file);
    const key = name.parentKey;
    const branch = branches.get(key) ?? {
      files: [],
      key,
      label: name.parent,
    };
    branch.files.push(file);
    branches.set(key, branch);
  }

  return [...branches.values()].map((branch) => {
    const grouped = Boolean(branch.label);
    return {
      items: branch.files.map((file) => {
        const name = screenshotName(file.file);
        return { file, label: grouped ? name.leaf : name.full };
      }),
      key: branch.key,
      label: grouped ? branch.label : undefined,
    };
  });
}
