const statuses = ["added", "changed", "removed", "unchanged"] as const;

export type VisualDiffStatus = (typeof statuses)[number];

export type VisualDiffFile = {
  file: string;
  height?: number;
  image?: string;
  images?: Partial<Record<"baseline" | "candidate" | "diff", string>>;
  status: VisualDiffStatus;
  width?: number;
};

export type VisualDiffReport = {
  files: VisualDiffFile[];
  summary: Record<VisualDiffStatus, number>;
  version: 1;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validatePngPath(value: unknown, prefix = ""): asserts value is string {
  if (
    typeof value !== "string" ||
    value.startsWith("/") ||
    value.includes("\\") ||
    value.split("/").includes("..") ||
    !value.endsWith(".png") ||
    (prefix !== "" && !value.startsWith(prefix))
  ) {
    throw new Error(`Invalid report image path: ${String(value)}`);
  }
}

function parseFile(value: unknown): VisualDiffFile {
  if (!isRecord(value)) throw new Error("Invalid visual diff file");

  validatePngPath(value.file);
  if (!statuses.includes(value.status as VisualDiffStatus)) {
    throw new Error(`Invalid visual diff status: ${String(value.status)}`);
  }

  const status = value.status as VisualDiffStatus;
  const expectedKeys = {
    added: ["candidate"],
    changed: ["baseline", "candidate", "diff"],
    removed: ["baseline"],
    unchanged: [],
  }[status];
  const images = isRecord(value.images) ? value.images : undefined;
  const actualKeys = images ? Object.keys(images).toSorted() : [];

  if (status === "unchanged") {
    if (value.image !== undefined || value.images !== undefined) {
      throw new Error("Unchanged files cannot publish review images");
    }
  } else {
    validatePngPath(value.image, "images/");
    if (images) {
      if (
        actualKeys.length !== expectedKeys.length ||
        actualKeys.some((key, index) => key !== expectedKeys.toSorted()[index])
      ) {
        throw new Error(`Invalid visual diff images for ${status}`);
      }
      for (const key of expectedKeys) {
        validatePngPath(images[key], `images/${key}/`);
      }
      const primaryKey = status === "changed" ? "diff" : expectedKeys[0];
      if (value.image !== images[primaryKey]) {
        throw new Error(`Invalid primary image for ${status}`);
      }
    }
  }

  for (const dimension of ["height", "width"] as const) {
    const candidate = value[dimension];
    if (
      candidate !== undefined &&
      (!Number.isInteger(candidate) || Number(candidate) <= 0)
    ) {
      throw new Error(`Invalid image ${dimension}`);
    }
  }

  return {
    file: value.file,
    height: value.height as number | undefined,
    image: value.image as string | undefined,
    images: images as VisualDiffFile["images"],
    status,
    width: value.width as number | undefined,
  };
}

export function parseVisualDiffReport(value: unknown): VisualDiffReport {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.files)) {
    throw new Error("Invalid visual diff report");
  }

  const files = value.files.map(parseFile);
  const summary = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const file of files) summary[file.status] += 1;

  return { files, summary, version: 1 };
}
