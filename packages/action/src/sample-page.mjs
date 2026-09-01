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

function itineraryPageSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="488" viewBox="0 0 960 650">
      <rect width="960" height="650" fill="#eef0eb"/>
      <rect width="190" height="650" fill="#17232a"/>
      <g transform="translate(26 24)">
        <rect width="30" height="30" rx="9" fill="#f6a23b"/>
        <path d="M8 20L15 7l7 13-7-4.2L8 20Z" fill="#17232a"/>
        ${text("WAYPOINT", 42, 21, { fill: "#ffffff", letterSpacing: 1.3, size: 14, weight: 700 })}
      </g>
      ${text("WORKSPACE", 26, 92, { fill: "#70828a", letterSpacing: 1.5, size: 9, weight: 700 })}
      ${text("Overview", 52, 128, { fill: "#a9b4b8", size: 12, weight: 500 })}
      <circle cx="31" cy="124" r="4" fill="#53656d"/>
      <rect x="14" y="145" width="162" height="42" rx="10" fill="#273941"/>
      <path d="M27 167h9m-4.5-4.5v9" stroke="#f6a23b" stroke-linecap="round" stroke-width="2"/>
      ${text("Trips", 52, 171, { fill: "#ffffff", size: 12, weight: 600 })}
      ${text("Travelers", 52, 215, { fill: "#a9b4b8", size: 12, weight: 500 })}
      <circle cx="31" cy="211" r="5" fill="none" stroke="#53656d"/>
      ${text("Policies", 52, 255, { fill: "#a9b4b8", size: 12, weight: 500 })}
      <rect x="27" y="247" width="9" height="10" rx="2" fill="none" stroke="#53656d"/>
      <path d="M14 578h162" stroke="#33464e"/>
      <circle cx="37" cy="610" r="15" fill="#91b7a0"/>
      ${text("Mina Patel", 62, 607, { fill: "#ffffff", size: 11, weight: 600 })}
      ${text("Travel operations", 62, 623, { fill: "#70828a", size: 8 })}

      <rect x="190" width="770" height="70" fill="#fffdf8"/>
      <path d="M190 69.5H960" stroke="#d9ddd7"/>
      <rect x="220" y="18" width="226" height="34" rx="17" fill="#f0f1ed"/>
      <circle cx="239" cy="35" r="6" fill="none" stroke="#899499"/>
      <path d="M243 39l5 5" stroke="#899499" stroke-linecap="round"/>
      ${text("Search trips and travelers", 258, 39, { fill: "#899499", size: 10 })}
      <circle cx="895" cy="35" r="16" fill="#d9a67a"/>
      ${text("MP", 895, 39, { anchor: "middle", fill: "#ffffff", size: 9, weight: 700 })}

      ${text("TRIPS / COPENHAGEN", 230, 111, { fill: "#d1732d", letterSpacing: 1.4, size: 9, weight: 700 })}
      ${text("Copenhagen offsite", 230, 148, { size: 28, weight: 600 })}
      ${text("May 18–22 · 8 travelers", 230, 171, { fill: "#6f7b80", size: 11 })}
      <rect x="805" y="119" width="111" height="38" rx="19" fill="#17232a"/>
      ${text("Share itinerary", 860, 143, { anchor: "middle", fill: "#ffffff", size: 10, weight: 600 })}

      <rect x="230" y="198" width="474" height="411" rx="16" fill="#fffdf8" stroke="#d9ddd7"/>
      ${text("ITINERARY", 253, 230, { fill: "#778388", letterSpacing: 1.3, size: 9, weight: 700 })}
      <rect x="253" y="247" width="52" height="31" rx="15.5" fill="#17232a"/>
      ${text("SUN 18", 279, 267, { anchor: "middle", fill: "#ffffff", size: 8, weight: 700 })}
      ${text("MON 19", 334, 267, { anchor: "middle", fill: "#788489", size: 8, weight: 600 })}
      ${text("TUE 20", 391, 267, { anchor: "middle", fill: "#788489", size: 8, weight: 600 })}
      ${text("WED 21", 451, 267, { anchor: "middle", fill: "#788489", size: 8, weight: 600 })}
      ${text("THU 22", 513, 267, { anchor: "middle", fill: "#788489", size: 8, weight: 600 })}
      <path d="M278 303v269" stroke="#d8ddd8" stroke-width="2"/>
      <circle cx="278" cy="327" r="7" fill="#f6a23b"/>
      ${text("11:20", 253, 331, { anchor: "end", fill: "#68747a", size: 9, weight: 600 })}
      <rect x="301" y="300" width="373" height="78" rx="12" fill="#f3efe6"/>
      ${text("Flight to Copenhagen", 321, 326, { size: 13, weight: 600 })}
      ${text("SFO  →  CPH · SK 936 · 10h 50m", 321, 348, { fill: "#6d797e", size: 10 })}
      <rect x="592" y="320" width="62" height="23" rx="11.5" fill="#dcece1"/>
      ${text("Booked", 623, 335, { anchor: "middle", fill: "#3f7256", size: 8, weight: 600 })}
      <circle cx="278" cy="421" r="7" fill="#85a9b7"/>
      ${text("08:00", 253, 425, { anchor: "end", fill: "#68747a", size: 9, weight: 600 })}
      <rect x="301" y="394" width="373" height="78" rx="12" fill="#eef3f3"/>
      ${text("Check in · Hotel Ottilia", 321, 420, { size: 13, weight: 600 })}
      ${text("Bryggernes Plads 7 · 4 nights", 321, 442, { fill: "#6d797e", size: 10 })}
      <circle cx="278" cy="515" r="7" fill="#91b78e"/>
      ${text("19:30", 253, 519, { anchor: "end", fill: "#68747a", size: 9, weight: 600 })}
      <rect x="301" y="488" width="373" height="78" rx="12" fill="#edf2e9"/>
      ${text("Team dinner · Høst", 321, 514, { size: 13, weight: 600 })}
      ${text("Private room · 8 guests", 321, 536, { fill: "#6d797e", size: 10 })}

      <rect x="724" y="198" width="192" height="194" rx="16" fill="#17232a"/>
      ${text("TRIP HEALTH", 746, 228, { fill: "#809198", letterSpacing: 1.2, size: 9, weight: 700 })}
      ${text("Everything", 746, 269, { fill: "#ffffff", size: 20, weight: 600 })}
      ${text("is on track", 746, 294, { fill: "#ffffff", size: 20, weight: 600 })}
      <circle cx="750" cy="331" r="5" fill="#75d29b"/>
      ${text("8 travelers confirmed", 764, 335, { fill: "#a9b6bb", size: 9 })}
      <circle cx="750" cy="354" r="5" fill="#75d29b"/>
      ${text("Within policy", 764, 358, { fill: "#a9b6bb", size: 9 })}

      <rect x="724" y="410" width="192" height="199" rx="16" fill="#fffdf8" stroke="#d9ddd7"/>
      ${text("TRAVELERS", 746, 440, { fill: "#778388", letterSpacing: 1.2, size: 9, weight: 700 })}
      <circle cx="755" cy="477" r="15" fill="#d9a67a"/>
      <circle cx="781" cy="477" r="15" fill="#88a7b5" stroke="#fffdf8" stroke-width="3"/>
      <circle cx="807" cy="477" r="15" fill="#93b58a" stroke="#fffdf8" stroke-width="3"/>
      <circle cx="833" cy="477" r="15" fill="#b99bb2" stroke="#fffdf8" stroke-width="3"/>
      <circle cx="859" cy="477" r="15" fill="#e4bd72" stroke="#fffdf8" stroke-width="3"/>
      ${text("+3", 886, 481, { anchor: "middle", fill: "#657176", size: 10, weight: 600 })}
      <path d="M746 512h148" stroke="#e2e3de"/>
      ${text("Next deadline", 746, 543, { fill: "#7b868a", size: 9 })}
      ${text("Passport details", 746, 568, { size: 12, weight: 600 })}
      ${text("Due tomorrow", 746, 587, { fill: "#d1732d", size: 9, weight: 600 })}
    </svg>
  `;
}

function approvalsPageSvg() {
  const rows = [
    ["AD", "Alex Dunn", "New York → London", "$2,184", "Needs review"],
    ["SR", "Sam Rivera", "Austin → Toronto", "$1,240", "Pending"],
    ["MK", "Maya Kim", "Seattle → Berlin", "$3,905", "Out of policy"],
    ["JT", "Jordan Taylor", "Boston → Chicago", "$684", "Pending"],
  ];
  const tableRows = rows
    .map(([initials, name, route, amount, status], index) => {
      const y = 340 + index * 63;
      const alert = status === "Out of policy";
      return `
        <path d="M235 ${y + 34}H914" stroke="#d9dee4"/>
        <circle cx="262" cy="${y}" r="16" fill="${index % 2 ? "#7998aa" : "#a88979"}"/>
        ${text(initials, 262, y + 4, { anchor: "middle", fill: "#ffffff", size: 9, weight: 700 })}
        ${text(name, 288, y + 4, { fill: "#27343d", size: 11, weight: 600 })}
        ${text(route, 420, y + 4, { fill: "#52616a", size: 10 })}
        ${text(amount, 627, y + 4, { fill: "#27343d", size: 11, weight: 600 })}
        <rect x="718" y="${y - 14}" width="103" height="27" rx="3" fill="${alert ? "#f8dfdc" : "#e9edf1"}"/>
        ${text(status, 769.5, y + 3, { anchor: "middle", fill: alert ? "#a4453d" : "#596871", size: 8, weight: 600 })}
        ${text("Review →", 865, y + 4, { fill: "#315f87", size: 9, weight: 600 })}
      `;
    })
    .join("");
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="720" height="488" viewBox="0 0 960 650">
      <rect width="960" height="650" fill="#f1f3f5"/>
      <rect width="960" height="58" fill="#24435d"/>
      <rect x="22" y="14" width="29" height="29" rx="3" fill="#ffffff"/>
      <path d="M30 34l7-13 7 13-7-4-7 4Z" fill="#e58a3a"/>
      ${text("Waypoint Admin", 65, 37, { fill: "#ffffff", size: 15, weight: 600 })}
      ${text("Help", 846, 35, { fill: "#c6d2db", size: 10 })}
      <circle cx="913" cy="29" r="15" fill="#7795a9"/>
      ${text("MP", 913, 33, { anchor: "middle", fill: "#ffffff", size: 8, weight: 700 })}

      <rect y="58" width="190" height="592" fill="#e3e8ec"/>
      ${text("ADMIN", 23, 92, { fill: "#7d8b95", letterSpacing: 1.3, size: 9, weight: 700 })}
      ${text("Dashboard", 48, 132, { fill: "#52616b", size: 11, weight: 500 })}
      <rect x="12" y="151" width="166" height="40" rx="3" fill="#ffffff"/>
      <rect x="12" y="151" width="4" height="40" fill="#e58a3a"/>
      ${text("Approvals", 48, 176, { fill: "#24435d", size: 11, weight: 600 })}
      <circle cx="31" cy="171" r="7" fill="none" stroke="#e58a3a" stroke-width="2"/>
      <path d="M27 171l3 3 5-6" fill="none" stroke="#e58a3a" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"/>
      ${text("Travel policy", 48, 217, { fill: "#52616b", size: 11, weight: 500 })}
      ${text("People", 48, 257, { fill: "#52616b", size: 11, weight: 500 })}
      ${text("Billing", 48, 297, { fill: "#52616b", size: 11, weight: 500 })}
      <path d="M22 326h145" stroke="#ccd3d9"/>
      ${text("COMPANY", 23, 359, { fill: "#7d8b95", letterSpacing: 1.3, size: 9, weight: 700 })}
      ${text("Acme, Inc.", 48, 397, { fill: "#52616b", size: 11, weight: 500 })}

      ${text("Travel approvals", 230, 111, { fill: "#27343d", size: 25, weight: 600 })}
      ${text("Review trips that need an administrator decision.", 230, 136, { fill: "#71808a", size: 10 })}
      <rect x="807" y="91" width="107" height="36" rx="3" fill="#315f87"/>
      ${text("Export CSV", 860.5, 114, { anchor: "middle", fill: "#ffffff", size: 10, weight: 600 })}

      <rect x="230" y="166" width="211" height="88" rx="4" fill="#ffffff" stroke="#d9dee4"/>
      ${text("WAITING", 250, 193, { fill: "#7c8992", letterSpacing: 1, size: 8, weight: 700 })}
      ${text("12", 250, 230, { fill: "#27343d", size: 27, weight: 600 })}
      ${text("4 due today", 294, 229, { fill: "#b25e2e", size: 9, weight: 600 })}
      <rect x="454" y="166" width="211" height="88" rx="4" fill="#ffffff" stroke="#d9dee4"/>
      ${text("OUT OF POLICY", 474, 193, { fill: "#7c8992", letterSpacing: 1, size: 8, weight: 700 })}
      ${text("3", 474, 230, { fill: "#a4453d", size: 27, weight: 600 })}
      ${text("$2,480 over", 507, 229, { fill: "#71808a", size: 9 })}
      <rect x="678" y="166" width="236" height="88" rx="4" fill="#ffffff" stroke="#d9dee4"/>
      ${text("AVERAGE RESPONSE", 698, 193, { fill: "#7c8992", letterSpacing: 1, size: 8, weight: 700 })}
      ${text("1.8 days", 698, 230, { fill: "#27343d", size: 25, weight: 600 })}

      <rect x="230" y="276" width="684" height="334" rx="4" fill="#ffffff" stroke="#d9dee4"/>
      ${text("REQUESTER", 253, 309, { fill: "#7c8992", letterSpacing: 0.8, size: 8, weight: 700 })}
      ${text("TRIP", 420, 309, { fill: "#7c8992", letterSpacing: 0.8, size: 8, weight: 700 })}
      ${text("AMOUNT", 627, 309, { fill: "#7c8992", letterSpacing: 0.8, size: 8, weight: 700 })}
      ${text("STATUS", 718, 309, { fill: "#7c8992", letterSpacing: 0.8, size: 8, weight: 700 })}
      <path d="M235 324H914" stroke="#cfd6dc"/>
      ${tableRows}
    </svg>
  `;
}

async function renderSvg(svg) {
  const renderer = new Resvg(svg, {
    font: {
      defaultFontFamily: "Inter",
      fontBuffers: await fonts,
      loadSystemFonts: false,
      sansSerifFamily: "Inter",
    },
  });
  return Buffer.from(renderer.render().asPng());
}

export function renderSamplePage(options = {}) {
  return renderSvg(pageSvg(options));
}

export function renderItineraryPage() {
  return renderSvg(itineraryPageSvg());
}

export function renderApprovalsPage() {
  return renderSvg(approvalsPageSvg());
}
