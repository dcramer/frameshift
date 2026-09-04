import { parseVisualDiffReport } from "@frameshift/report";
import { StrictMode, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";

import { App, ReportPage } from "./App";
import { readReportView } from "./report-view";
import { pageSource } from "./scan-source";
import "./styles.css";

const root = document.getElementById("root")!;
const reportData = document.getElementById(
  "frameshift-report-data",
)?.textContent;

function strict(element: ReactNode) {
  return <StrictMode>{element}</StrictMode>;
}

if (reportData) {
  const params = new URLSearchParams(window.location.search);
  const source = pageSource(window.location.pathname, params);
  if (source?.kind !== "github") {
    throw new Error("This report URL is invalid.");
  }
  const report = parseVisualDiffReport(JSON.parse(reportData));
  hydrateRoot(
    root,
    strict(
      <ReportPage
        initialSearch={window.location.search}
        initialView={readReportView(params)}
        report={report}
        source={source}
      />,
    ),
  );
} else {
  createRoot(root).render(strict(<App />));
}
