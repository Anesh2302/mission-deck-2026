/**
 * GET /api/admin/export
 *
 * Streams a styled .xlsx of every registration. Requires x-admin-key.
 *
 * Three sheets:
 *   - Participants   one row per human; this is what the check-in desk wants.
 *   - Registrations  one row per entry.
 *   - Summary        headline totals.
 *
 * Columns are addressed by 1-based index rather than by header string.
 * `worksheet.getColumn("Some Header")` only resolves when a sheet was built
 * with a `columns` definition carrying that key, and throws "Out of bounds" on
 * sheets populated with plain rows (like Summary). Indices work everywhere.
 */

const ExcelJS = require("exceljs");
const { guardAdmin, isSupabaseConfigured, listRegistrations } = require("../_lib");

const GOLD = "FFF0B74A";
const DARK = "FF09111C";
const ZEBRA = "FFF2F6F9";
const BORDER = "FFC7D3DD";

const EVENT_NAME = "Reverse Hackathon 2026";
const ORGANISER = "The Whitehatians, Department of Cyber Security";
const COLLEGE = "SRM Valliammai Engineering College";
const EVENT_DATE = "Tuesday, 13 October 2026";

const PARTICIPANT_KEYS = [
  "#",
  "Registration ID",
  "Entry format",
  "Participant",
  "Role",
  "Full name",
  "Email",
  "Mobile",
  "Department",
  "Year",
  "Register no.",
  "Gender",
  "Domain",
  "Heard about",
  "Submitted at",
];

const REGISTRATION_KEYS = [
  "#",
  "Registration ID",
  "Entry format",
  "Participant",
  "Headcount",
  "Email",
  "Mobile",
  "Department / year",
  "Register no.",
  "Domain",
  "Heard about",
  "Submitted at",
];

/** 1-based column number for a header name. */
function at(keys, header) {
  const i = keys.indexOf(header);
  if (i === -1) throw new Error(`Unknown column "${header}"`);
  return i + 1;
}

function thinBorder() {
  const side = { style: "hair", color: { argb: BORDER } };
  return { top: side, left: side, bottom: side, right: side };
}

function styleHeader(sheet, columnCount) {
  const header = sheet.getRow(1);
  header.height = 26;
  for (let c = 1; c <= columnCount; c += 1) {
    const cell = header.getCell(c);
    cell.font = { bold: true, size: 11, color: { argb: DARK } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GOLD } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = thinBorder();
  }
  sheet.views = [{ state: "frozen", ySplit: 1 }];
}

function finishSheet(sheet, keys, widths) {
  widths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w;
  });

  if (keys.length > 0) {
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = thinBorder();
      cell.alignment = { vertical: "top", wrapText: true };
      if (rowNumber % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ZEBRA } };
      }
    });
  });
}

function buildWorkbook(regs, totals) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = `${EVENT_NAME} - ${ORGANISER}`;
  workbook.created = new Date();

  /* ---- Participants ---- */
  const people = workbook.addWorksheet("Participants");
  const peopleRows = [];
  let n = 0;

  for (const reg of regs) {
    const crew = [
      { role: "Participant", fullName: reg.leader.fullName, email: reg.leader.email, mobile: reg.leader.phone, department: reg.leader.department, year: reg.leader.year, roll: reg.leader.rollNumber, gender: reg.leader.gender },
    ];

    for (const p of crew) {
      n += 1;
      peopleRows.push({
        "#": n,
        "Registration ID": reg.registrationId,
        "Entry format": "Solo",
        "Participant": reg.teamName,
        "Role": p.role,
        "Full name": p.fullName,
        "Email": p.email,
        "Mobile": p.mobile,
        "Department": p.department,
        "Year": p.year,
        "Register no.": p.roll,
        "Gender": p.gender,
        "Domain": reg.domain,
        "Heard about": reg.heardAbout,
        "Submitted at": reg.submittedAt,
      });
    }
  }

  if (peopleRows.length > 0) {
    people.addRow(PARTICIPANT_KEYS);
    peopleRows.forEach((r) => people.addRow(PARTICIPANT_KEYS.map((k) => r[k])));
  } else {
    people.addRow(["No registrations yet"]);
  }
  styleHeader(people, PARTICIPANT_KEYS.length);
  people.getColumn(at(PARTICIPANT_KEYS, "Submitted at")).numFmt = "dd-mmm-yyyy hh:mm";
  people.getColumn(1).alignment = { horizontal: "center", vertical: "top" };
  finishSheet(people, PARTICIPANT_KEYS, [
    5, 22, 12, 24, 19, 24, 26, 14, 22, 8, 15, 9, 26, 18, 20,
  ]);

  /* ---- Registrations ---- */
  const sheet = workbook.addWorksheet("Registrations");
  const regRows = regs.map((reg, i) => ({
    "#": i + 1,
    "Registration ID": reg.registrationId,
    "Entry format": "Solo",
    "Participant": reg.leader.fullName,
    "Headcount": reg.headcount,
    "Email": reg.leader.email,
    "Mobile": reg.leader.phone,
    "Department / year": `${reg.leader.department} / ${reg.leader.year}`,
    "Register no.": reg.leader.rollNumber,
    "Domain": reg.domain,
    "Heard about": reg.heardAbout,
    "Submitted at": reg.submittedAt,
  }));

  if (regRows.length > 0) {
    sheet.addRow(REGISTRATION_KEYS);
    regRows.forEach((r) => sheet.addRow(REGISTRATION_KEYS.map((k) => r[k])));
  } else {
    sheet.addRow(["No registrations yet"]);
  }
  styleHeader(sheet, REGISTRATION_KEYS.length);
  sheet.getColumn(at(REGISTRATION_KEYS, "Submitted at")).numFmt = "dd-mmm-yyyy hh:mm";
  finishSheet(sheet, REGISTRATION_KEYS, [
    5, 22, 12, 24, 11, 26, 14, 26, 18, 26, 18, 20,
  ]);

  /* ---- Summary ---- */
  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Metric", "Value"]);
  styleHeader(summary, 2);

  const lines = [
    ["Event", EVENT_NAME],
    ["Organiser", ORGANISER],
    ["College", COLLEGE],
    ["Event date", EVENT_DATE],
    ["", ""],
    ["Total registrations", totals.registrations],
    ["Total participants", totals.participants],
    ["", ""],
    ["Generated at", new Date()],
  ];

  const rowOf = new Map();
  for (const [label, value] of lines) {
    const rowNumber = summary.rowCount + 1;
    summary.addRow([label, value]);
    if (label) rowOf.set(label, rowNumber);
  }

  summary.getCell(rowOf.get("Generated at"), 2).numFmt = "dd-mmm-yyyy hh:mm";

  summary.getColumn(1).width = 32;
  summary.getColumn(2).width = 48;
  summary.views = [{ showGridLines: false }];
  summary.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { vertical: "top", wrapText: true };
  });

  return workbook;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Use GET." });
  }

  if (!guardAdmin(req, res)) return;

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: "SUPABASE_URL / SUPABASE_SECRET_KEY is not set on the server." });
  }

  try {
    const all = await listRegistrations();
    const regs = all.map(({ payment, amountDue, passwordHash, emails, ...safe }) => safe);

    const totals = regs.reduce(
      (acc, r) => {
        acc.registrations += 1;
        acc.participants += r.headcount;
        if (r.entryFormat === "duo") acc.duo += 1;
        else acc.solo += 1;
        return acc;
      },
      { registrations: 0, participants: 0, solo: 0, duo: 0 }
    );

    const buffer = await buildWorkbook(regs, totals).xlsx.writeBuffer();

    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Length", String(buffer.length));
    res.setHeader("Content-Disposition", `attachment; filename="reverse-hack-2026-registrations-${stamp}.xlsx"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    return res.status(200).end(Buffer.from(buffer));
  } catch (e) {
    console.error("admin export failed", e);
    return res.status(503).json({ error: "Could not build the spreadsheet." });
  }
};
