import * as z from "zod";

export const VISUAL_DIFF_REPORT_VERSION = 2 as const;
export const VISUAL_DIFF_STATUSES = [
  "added",
  "changed",
  "removed",
  "unchanged",
] as const;

const safePngPathPattern = /^(?!\/)(?!.*\\)(?!.*(?:^|\/)\.\.(?:\/|$)).+\.png$/;

const pngPathSchema = z
  .string()
  .regex(safePngPathPattern, "Expected a safe relative PNG path");
const baselineImagePathSchema = pngPathSchema.startsWith("images/baseline/");
const candidateImagePathSchema = pngPathSchema.startsWith("images/candidate/");
const diffImagePathSchema = pngPathSchema.startsWith("images/diff/");
const dimensionSchema = z.int().positive();

const fileShape = {
  file: pngPathSchema,
  height: dimensionSchema.optional(),
  width: dimensionSchema.optional(),
};

const addedFileSchema = z
  .object({
    ...fileShape,
    image: candidateImagePathSchema,
    images: z.object({ candidate: candidateImagePathSchema }).strict(),
    status: z.literal("added"),
  })
  .strict();

const changedFileSchema = z
  .object({
    ...fileShape,
    image: diffImagePathSchema,
    images: z
      .object({
        baseline: baselineImagePathSchema,
        candidate: candidateImagePathSchema,
        diff: diffImagePathSchema,
      })
      .strict(),
    status: z.literal("changed"),
  })
  .strict();

const removedFileSchema = z
  .object({
    ...fileShape,
    image: baselineImagePathSchema,
    images: z.object({ baseline: baselineImagePathSchema }).strict(),
    status: z.literal("removed"),
  })
  .strict();

const unchangedFileSchema = z
  .object({
    ...fileShape,
    image: candidateImagePathSchema,
    images: z.object({ candidate: candidateImagePathSchema }).strict(),
    status: z.literal("unchanged"),
  })
  .strict();

export const visualDiffFileSchema = z.discriminatedUnion("status", [
  addedFileSchema,
  changedFileSchema,
  removedFileSchema,
  unchangedFileSchema,
]);

const visualDiffSummarySchema = z
  .object({
    added: z.int().nonnegative(),
    changed: z.int().nonnegative(),
    removed: z.int().nonnegative(),
    unchanged: z.int().nonnegative(),
  })
  .strict();

const visualDiffReportV2StructureSchema = z
  .object({
    files: z.array(visualDiffFileSchema),
    summary: visualDiffSummarySchema,
    version: z.literal(VISUAL_DIFF_REPORT_VERSION),
  })
  .strict()
  .meta({
    description: "A Frameshift visual-diff report.",
    title: "Visual diff report v2",
  });

function addInvariantIssues(
  report: z.infer<typeof visualDiffReportV2StructureSchema>,
  context: z.RefinementCtx,
) {
  const summary = { added: 0, changed: 0, removed: 0, unchanged: 0 };
  for (const [index, file] of report.files.entries()) {
    summary[file.status] += 1;
    const primaryImage =
      file.status === "changed"
        ? file.images.diff
        : file.status === "removed"
          ? file.images.baseline
          : file.images.candidate;
    if (file.image !== primaryImage) {
      context.addIssue({
        code: "custom",
        message: "Primary image must match the status-specific review image",
        path: ["files", index, "image"],
      });
    }
  }

  for (const status of VISUAL_DIFF_STATUSES) {
    if (report.summary[status] !== summary[status]) {
      context.addIssue({
        code: "custom",
        message: `Expected ${summary[status]} ${status} files`,
        path: ["summary", status],
      });
    }
  }
}

export const visualDiffReportSchema =
  visualDiffReportV2StructureSchema.superRefine(addInvariantIssues);

export type VisualDiffStatus = (typeof VISUAL_DIFF_STATUSES)[number];
export type VisualDiffFile = z.infer<typeof visualDiffFileSchema>;
export type VisualDiffReport = z.infer<typeof visualDiffReportSchema>;

export function parseVisualDiffReport(value: unknown): VisualDiffReport {
  return visualDiffReportSchema.parse(value);
}

export function safeParseVisualDiffReport(value: unknown) {
  return visualDiffReportSchema.safeParse(value);
}

export function visualDiffReportV2JsonSchema() {
  return {
    $id: "https://raw.githubusercontent.com/dcramer/frameshift/main/schemas/report-v2.schema.json",
    ...z.toJSONSchema(visualDiffReportV2StructureSchema, {
      target: "draft-2020-12",
    }),
  };
}
