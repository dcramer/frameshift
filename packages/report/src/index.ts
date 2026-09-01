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
  .regex(safePngPathPattern, "Expected a safe relative PNG path")
  .meta({ description: "A PNG path relative to report.json." });
const baselineImagePathSchema = pngPathSchema
  .startsWith("images/baseline/")
  .meta({ description: "The screenshot before the change." });
const candidateImagePathSchema = pngPathSchema
  .startsWith("images/candidate/")
  .meta({ description: "The screenshot after the change." });
const diffImagePathSchema = pngPathSchema
  .startsWith("images/diff/")
  .meta({ description: "The image that highlights the changes." });
const dimensionSchema = z
  .int()
  .positive()
  .meta({ description: "The image size in pixels." });

const fileShape = {
  file: pngPathSchema.meta({
    description: "The screenshot path in the compared folders.",
  }),
  height: dimensionSchema
    .meta({ description: "The image height in pixels." })
    .optional(),
  width: dimensionSchema
    .meta({ description: "The image width in pixels." })
    .optional(),
};

function imageSetSchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .object(shape)
    .strict()
    .meta({ description: "The images available for this screenshot." });
}

const addedFileSchema = z
  .object({
    ...fileShape,
    image: candidateImagePathSchema.meta({
      description: "The main image for this screenshot.",
    }),
    images: imageSetSchema({ candidate: candidateImagePathSchema }),
    status: z
      .literal("added")
      .meta({ description: "The screenshot exists only after the change." }),
  })
  .strict();

const changedFileSchema = z
  .object({
    ...fileShape,
    image: diffImagePathSchema.meta({
      description: "The main image for this screenshot.",
    }),
    images: imageSetSchema({
      baseline: baselineImagePathSchema,
      candidate: candidateImagePathSchema,
      diff: diffImagePathSchema,
    }),
    status: z.literal("changed").meta({
      description: "The screenshot differs before and after the change.",
    }),
  })
  .strict();

const removedFileSchema = z
  .object({
    ...fileShape,
    image: baselineImagePathSchema.meta({
      description: "The main image for this screenshot.",
    }),
    images: imageSetSchema({ baseline: baselineImagePathSchema }),
    status: z
      .literal("removed")
      .meta({ description: "The screenshot exists only before the change." }),
  })
  .strict();

const unchangedFileSchema = z
  .object({
    ...fileShape,
    image: candidateImagePathSchema.meta({
      description: "The main image for this screenshot.",
    }),
    images: imageSetSchema({ candidate: candidateImagePathSchema }),
    status: z
      .literal("unchanged")
      .meta({ description: "The screenshot is the same before and after." }),
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
    added: z
      .int()
      .nonnegative()
      .meta({ description: "Number of added screenshots." }),
    changed: z
      .int()
      .nonnegative()
      .meta({ description: "Number of changed screenshots." }),
    removed: z
      .int()
      .nonnegative()
      .meta({ description: "Number of removed screenshots." }),
    unchanged: z
      .int()
      .nonnegative()
      .meta({ description: "Number of unchanged screenshots." }),
  })
  .strict()
  .meta({ description: "Screenshot counts by status." });

const pullRequestMetadataSchema = z
  .object({
    number: z
      .int()
      .positive()
      .optional()
      .meta({ description: "The pull request number." }),
    title: z.string().min(1).meta({ description: "The pull request title." }),
  })
  .strict()
  .meta({ description: "Details about the pull request." });

const reportMetadataSchema = z
  .object({
    pullRequest: pullRequestMetadataSchema.optional(),
  })
  .strict()
  .meta({ description: "Details about the change that created this report." });

const visualDiffReportV2StructureSchema = z
  .object({
    files: z
      .array(visualDiffFileSchema)
      .meta({ description: "Screenshots in this report." }),
    metadata: reportMetadataSchema.optional(),
    summary: visualDiffSummarySchema,
    version: z
      .literal(VISUAL_DIFF_REPORT_VERSION)
      .meta({ description: "The Frameshift report format version." }),
  })
  .strict()
  .meta({
    description: "A Frameshift screenshot report.",
    title: "Frameshift screenshot report, version 2",
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
        message: "The main image does not match the image for this status",
        path: ["files", index, "image"],
      });
    }
  }

  for (const status of VISUAL_DIFF_STATUSES) {
    if (report.summary[status] !== summary[status]) {
      context.addIssue({
        code: "custom",
        message: `Expected ${summary[status]} files marked ${status}`,
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
