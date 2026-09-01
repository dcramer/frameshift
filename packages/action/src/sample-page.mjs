import fs from "node:fs/promises";
import { createRequire } from "node:module";

import { Resvg } from "@resvg/resvg-js";

const require = createRequire(import.meta.url);
const fontFiles = [
  require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff"),
  require.resolve("@fontsource/inter/files/inter-latin-500-normal.woff"),
  require.resolve("@fontsource/inter/files/inter-latin-600-normal.woff"),
  require.resolve("@fontsource/inter/files/inter-latin-700-normal.woff"),
];

const fonts = Promise.all(fontFiles.map((file) => fs.readFile(file)));

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function text(content, x, y, options = {}) {
  const {
    anchor = "start",
    fill = "#17232a",
    letterSpacing,
    size = 14,
    weight = 400,
  } = options;
  const spacing =
    letterSpacing === undefined ? "" : ` letter-spacing="${letterSpacing}"`;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}"${spacing}>${escapeXml(content)}</text>`;
}

function nav() {
  return `
    <rect width="960" height="72" fill="#fffdf8"/>
    <path d="M0 71.5H960" stroke="#dedbd2"/>
    <g transform="translate(54 21)">
      <rect width="30" height="30" rx="9" fill="#17232a"/>
      <path d="M8 20L15 7l7 13-7-4.2L8 20Z" fill="#f6a23b"/>
      ${text("WAYPOINT", 42, 21, { size: 15, weight: 700, letterSpacing: 1.5 })}
    </g>
    ${text("Product", 374, 43, { size: 13, weight: 500 })}
    ${text("Customers", 447, 43, { size: 13, weight: 500 })}
    ${text("Pricing", 538, 43, { size: 13, weight: 500 })}
    ${text("Sign in", 755, 43, { size: 13, weight: 500 })}
    <rect x="820" y="17" width="94" height="38" rx="19" fill="#17232a"/>
    ${text("Get started", 867, 41, { anchor: "middle", fill: "#fffdf8", size: 12, weight: 600 })}
  `;
}

function announcement() {
  return `
    <rect y="72" width="960" height="44" fill="#f7a23b"/>
    <circle cx="292" cy="94" r="4" fill="#17232a"/>
    ${text("NEW", 307, 98, { size: 11, weight: 700, letterSpacing: 1.2 })}
    ${text("Collaborative itineraries are now live", 351, 99, { size: 12, weight: 600 })}
    ${text("Explore the update →", 615, 99, { size: 12, weight: 600 })}
  `;
}

function productPreview(metric) {
  return `
    <g transform="translate(526 62)">
      <rect width="382" height="370" rx="22" fill="#17232a"/>
      <circle cx="27" cy="25" r="4" fill="#f06e5f"/>
      <circle cx="42" cy="25" r="4" fill="#f7c65e"/>
      <circle cx="57" cy="25" r="4" fill="#75c897"/>
      ${text("WAYPOINT / TRIPS", 82, 29, { fill: "#89969b", letterSpacing: 1.2, size: 9, weight: 600 })}

      <rect x="20" y="50" width="342" height="82" rx="13" fill="#21343d"/>
      ${text("TRIP TO COPENHAGEN", 38, 76, { fill: "#8da1a9", letterSpacing: 1.1, size: 9, weight: 600 })}
      ${text("May 18–22", 38, 105, { fill: "#ffffff", size: 18, weight: 600 })}
      <rect x="274" y="78" width="69" height="27" rx="13.5" fill="#294d41"/>
      <circle cx="289" cy="91.5" r="4" fill="#75d29b"/>
      ${text("Approved", 300, 95, { fill: "#b9e9cb", size: 9, weight: 600 })}

      <rect x="20" y="146" width="226" height="138" rx="13" fill="#f4f0e7"/>
      ${text("OUTBOUND · MAY 18", 38, 171, { fill: "#758087", letterSpacing: 1, size: 8, weight: 700 })}
      <circle cx="59" cy="215" r="17" fill="#17232a"/>
      ${text("SFO", 59, 219, { anchor: "middle", fill: "#ffffff", size: 9, weight: 700 })}
      <path d="M81 215C108 188 148 188 177 215" fill="none" stroke="#f6a23b" stroke-dasharray="4 4" stroke-width="2"/>
      <path d="M132 195l8 5-9 3 1-8Z" fill="#f6a23b"/>
      <circle cx="202" cy="215" r="17" fill="#f6a23b"/>
      ${text("CPH", 202, 219, { anchor: "middle", fill: "#17232a", size: 9, weight: 700 })}
      ${text("11:20", 42, 253, { fill: "#17232a", size: 13, weight: 700 })}
      ${text("07:10 +1", 174, 253, { fill: "#17232a", size: 13, weight: 700 })}
      ${text("10h 50m · direct", 38, 271, { fill: "#758087", size: 9 })}

      <rect x="260" y="146" width="102" height="138" rx="13" fill="#f6a23b"/>
      ${text("AVG. APPROVAL", 277, 172, { fill: "#654017", letterSpacing: 0.8, size: 8, weight: 700 })}
      ${text(metric, 277, 212, { fill: "#17232a", size: 29, weight: 700 })}
      ${text("this month", 277, 232, { fill: "#654017", size: 9, weight: 500 })}
      <path d="M278 260l13-11 11 4 15-17 15 7 13-16" fill="none" stroke="#17232a" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>

      <rect x="20" y="298" width="342" height="52" rx="13" fill="#21343d"/>
      <circle cx="43" cy="324" r="12" fill="#91b7a0"/>
      <path d="M36 328c3-8 12-8 15 0" fill="#d9eadf"/>
      ${text("Mina’s itinerary is ready", 65, 320, { fill: "#ffffff", size: 11, weight: 600 })}
      ${text("Flights, hotel, and policy checks complete", 65, 336, { fill: "#8da1a9", size: 8 })}
    </g>
  `;
}

function features() {
  const items = [
    ["01", "Book in policy", "Give travelers choice without losing control."],
    ["02", "Approve in minutes", "Route every request to the right person."],
    [
      "03",
      "Know where everyone is",
      "See live plans when the unexpected happens.",
    ],
  ];
  return items
    .map(([number, title, copy], index) => {
      const x = 54 + index * 291;
      return `
        <g transform="translate(${x} 505)">
          <path d="M0 .5H252" stroke="#cec9be"/>
          ${text(number, 0, 31, { fill: "#d1732d", letterSpacing: 1, size: 10, weight: 700 })}
          ${text(title, 0, 61, { size: 17, weight: 600 })}
          ${text(copy, 0, 87, { fill: "#68747a", size: 10 })}
        </g>
      `;
    })
    .join("");
}

function pageSvg({
  announcementBar = false,
  headline = ["Plan work trips", "without the", "busywork."],
  metric = "18 min",
  primaryAction = "Start planning",
}) {
  const offset = announcementBar ? 44 : 0;
  const height = 650 + offset;
  const outputHeight = Math.round(height * 0.75);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="${outputHeight}" viewBox="0 0 960 ${height}">
      <rect width="960" height="${height}" fill="#f4f1e9"/>
      ${nav()}
      ${announcementBar ? announcement() : ""}
      <g transform="translate(0 ${offset})">
        ${text("TRAVEL OPERATIONS, REIMAGINED", 54, 143, { fill: "#d1732d", letterSpacing: 1.8, size: 10, weight: 700 })}
        ${text(headline[0], 54, 192, { size: 39, weight: 600 })}
        ${text(headline[1], 54, 236, { size: 39, weight: 600 })}
        ${text(headline[2], 54, 280, { size: 39, weight: 600 })}
        ${text("One calm place to book, approve, and track", 54, 322, { fill: "#667278", size: 14 })}
        ${text("every trip your team takes.", 54, 343, { fill: "#667278", size: 14 })}

        <rect x="54" y="376" width="132" height="44" rx="22" fill="#17232a"/>
        ${text(primaryAction, 120, 403, { anchor: "middle", fill: "#fffdf8", size: 12, weight: 600 })}
        <rect x="198" y="376" width="114" height="44" rx="22" fill="none" stroke="#a8a49b"/>
        ${text("Watch demo", 255, 403, { anchor: "middle", size: 12, weight: 600 })}

        <g transform="translate(54 450)">
          <circle cx="13" cy="13" r="13" fill="#d9a67a"/>
          <circle cx="33" cy="13" r="13" fill="#88a7b5" stroke="#f4f1e9" stroke-width="3"/>
          <circle cx="53" cy="13" r="13" fill="#93b58a" stroke="#f4f1e9" stroke-width="3"/>
          ${text("Trusted by 240+ operations teams", 78, 17, { fill: "#68747a", size: 10, weight: 500 })}
        </g>
        ${productPreview(metric)}
        ${features()}
      </g>
    </svg>
  `;
}

export async function renderSamplePage(options = {}) {
  const renderer = new Resvg(pageSvg(options), {
    font: {
      defaultFontFamily: "Inter",
      fontBuffers: await fonts,
      loadSystemFonts: false,
      sansSerifFamily: "Inter",
    },
  });
  return Buffer.from(renderer.render().asPng());
}
