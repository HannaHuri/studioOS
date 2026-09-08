// Builds the demo proofreading .docx files for the studioOS prototype.
// Four variants of the same draft: the original, language-only (tracked changes),
// content-only (comments), and both. No npm deps — the OOXML and the ZIP are written here.
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// ── minimal ZIP writer ─────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function zip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const raw = Buffer.from(content, "utf8");
    const comp = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);      // deflate
    local.writeUInt16LE(0, 10);     // time
    local.writeUInt16LE(0x5921, 12); // date (2024-09-01-ish); any valid value
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, comp);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x5921, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(comp.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(0, 30); // extra + comment len
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);
    offset += local.length + nameBuf.length + comp.length;
  }
  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, cdBuf, eocd]);
}

// ── the draft ──────────────────────────────────────────────────────────────
// A token is a plain string, {ins}, {del}, or {anchor, comment}.
const AUTHOR = "נט המשפט";
const DATE = "2026-09-08T09:00:00Z";

const DOC = [
  { style: "title", tokens: ["סיכומים מטעם התובע"] },
  { style: "sub", tokens: ['בית המשפט המחוזי בתל אביב — יפו  |  ת"א 12345-67-89'] },
  { style: "sub", tokens: ['יעקב אברמוב נ׳ המרכז הרפואי קדם בע"מ'] },
  { style: "h", tokens: ["א. רקע עובדתי"] },
  {
    tokens: [
      "1. התובע, יליד 1962, פנה למרכז הרפואי קדם ",
      { anchor: "ביום 12.6.2023", comment: 'בתצהיר עדות ראשית של התובע (סעיף 4) מצוין כי הפנייה למיון הייתה ביום 5.7.2023. יש להתאים את התאריך או להסביר את הפער.' },
      " בשל כאבים עזים בבטן התחתונה. לאחר בדיקה ",
      { del: "שיטחית" }, { ins: "שטחית" },
      " הופנה לניתוח, אשר בוצע למחרת היום.",
    ],
  },
  {
    tokens: [
      "2. במהלך הניתוח ",
      { del: "ארעה" }, { ins: "אירעה" },
      " ",
      { anchor: "התרשלות אשר גרמה לנזק בלתי הפיך", comment: "ההתרשלות מנוסחת כאן כעובדה מוכחת, בעוד שזו טענה השנויה במחלוקת בין הצדדים. מומלץ לנסח ׳לטענת התובע׳ כדי שלא ייטען שהסיכומים חורגים מכתב התביעה." },
      ", ועד היום ",
      { del: "התובע סובל" }, { ins: "סובל התובע" },
      " מכאבים כרוניים ואינו יכול לחזור לעבודתו הקודמת.",
    ],
  },
  { style: "h", tokens: ["ב. הראיות"] },
  {
    tokens: [
      "3. ",
      { anchor: "חוות הדעת של פרופ׳ רון שגב מטעם התובע לא נסתרה", comment: 'בתיק מצויה חוות דעת מומחה מטעם בית המשפט מיום 3.9.2023, הקובעת קשר סיבתי חלקי בלבד. הקביעה שחוות הדעת מטעם התובע לא נסתרה מתעלמת ממנה.' },
      ", ולא הוצגה מטעם הנתבעת כל חוות דעת נוגדת.",
    ],
  },
  {
    tokens: [
      "4. הנזק הכספי שנגרם לתובע מסתכם בסך של ",
      { anchor: ' 1,250,000 ש"ח', comment: 'בכתב התביעה המתוקן הסכום הנתבע הוא 1,450,000 ש"ח. יש ליישב את הפער בין הסכומים או להסביר את ההפחתה.' },
      ", כמפורט בחוות הדעת האקטוארית שצורפה לכתב התביעה המתוקן.",
    ],
  },
  { style: "h", tokens: ["ג. הסעד המבוקש"] },
  {
    tokens: [
      "5. לאור כל האמור לעיל, מתבקש בית המשפט הנכבד לקבל את ",
      { del: "את " },
      "התביעה במלואה ולחייב את הנתבעת בהוצאות משפט ובשכר טרחת עורך דין.",
    ],
  },
];

// ── XML helpers ────────────────────────────────────────────────────────────
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const RPR = '<w:rPr><w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:rtl/></w:rPr>';
const run = (text, tag = "w:t") => `<w:r>${RPR}<${tag} xml:space="preserve">${esc(text)}</${tag}></w:r>`;

function paragraph(p, variant, state) {
  const withIns = variant === "lang" || variant === "both";
  const withComments = variant === "content" || variant === "both";
  let body = "";
  for (const tok of p.tokens) {
    if (typeof tok === "string") { body += run(tok); continue; }
    if (tok.ins) {
      // language fix: an insertion exists only where tracked changes are on
      if (withIns) body += `<w:ins w:id="${state.rev++}" w:author="${esc(AUTHOR)}" w:date="${DATE}">${run(tok.ins)}</w:ins>`;
      continue;
    }
    if (tok.del) {
      // with tracked changes the old wording is struck through; without them it simply stays
      body += withIns
        ? `<w:del w:id="${state.rev++}" w:author="${esc(AUTHOR)}" w:date="${DATE}">${run(tok.del, "w:delText")}</w:del>`
        : run(tok.del);
      continue;
    }
    if (tok.anchor) {
      if (!withComments) { body += run(tok.anchor); continue; }
      const id = state.comments.length;
      state.comments.push(tok.comment);
      body += `<w:commentRangeStart w:id="${id}"/>${run(tok.anchor)}<w:commentRangeEnd w:id="${id}"/>` +
        `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`;
    }
  }
  const align = p.style === "title" || p.style === "sub" ? "center" : "both";
  const before = p.style === "h" ? 240 : 0;
  const bold = p.style === "title" || p.style === "h";
  const size = p.style === "title" ? 32 : p.style === "sub" ? 22 : 24;
  const pPr = `<w:pPr><w:bidi/><w:jc w:val="${align}"/><w:spacing w:before="${before}" w:after="160" w:line="360" w:lineRule="auto"/>` +
    `<w:rPr><w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rtl/></w:rPr></w:pPr>`;
  // titles and headings carry their own run properties
  if (p.style) {
    body = p.tokens.map((t) => typeof t === "string" ? t : (t.anchor || t.ins || t.del)).join("");
    body = `<w:r><w:rPr><w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rtl/></w:rPr><w:t xml:space="preserve">${esc(body)}</w:t></w:r>`;
  }
  return `<w:p>${pPr}${body}</w:p>`;
}

function buildDocx(variant) {
  const state = { rev: 100, comments: [] };
  const paras = DOC.map((p) => paragraph(p, variant, state)).join("");
  const sectPr = '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/><w:bidi/></w:sectPr>';
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paras}${sectPr}</w:body></w:document>`;

  const hasComments = state.comments.length > 0;
  const comments = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${state.comments
    .map((body, i) => `<w:comment w:id="${i}" w:author="${esc(AUTHOR)}" w:initials="נמ" w:date="${DATE}"><w:p><w:pPr><w:bidi/><w:jc w:val="right"/></w:pPr>${run(body)}</w:p></w:comment>`)
    .join("")}</w:comments>`;

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="David" w:hAnsi="David" w:cs="David"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="character" w:styleId="CommentReference"><w:name w:val="annotation reference"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="CommentText"><w:name w:val="annotation text"/><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style>
</w:styles>`;

  const settings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:defaultTabStop w:val="720"/><w:themeFontLang w:val="en-US" w:bidi="he-IL"/></w:settings>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>${
    hasComments ? '\n<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>' : ""
  }
</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

  const docRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>${
    hasComments ? '\n<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>' : ""
  }
</Relationships>`;

  const entries = [
    ["[Content_Types].xml", contentTypes],
    ["_rels/.rels", rootRels],
    ["word/document.xml", document],
    ["word/_rels/document.xml.rels", docRels],
    ["word/styles.xml", styles],
    ["word/settings.xml", settings],
  ];
  if (hasComments) entries.push(["word/comments.xml", comments]);
  return zip(entries);
}

const outDir = process.argv[2] || ".";
fs.mkdirSync(outDir, { recursive: true });
for (const v of ["original", "lang", "content", "both"]) {
  const file = path.join(outDir, `draft-${v}.docx`);
  fs.writeFileSync(file, buildDocx(v));
  console.log("wrote", file, fs.statSync(file).size, "bytes");
}
