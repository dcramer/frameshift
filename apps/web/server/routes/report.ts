import { defineHandler } from "nitro/h3";

import { serveReport } from "../../src/server-report";

export default defineHandler((event) => serveReport(event.req));
