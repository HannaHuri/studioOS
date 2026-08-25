// Design tokens + the document shape, shared between the chat/documents screen (page.tsx) and the tasks screen
// (tasks-view.tsx). They live here rather than in page.tsx so the tasks table can open a real document without
// importing the page (which would be circular).

export const c = {
  primary: "#0073ea",
  takhelet: "#0ea5e9", // strong, bright sky-blue accent (distinct from the corporate primary blue)
  primaryLight: "#cce5ff",
  badgeBg: "#d4e7ff",
  headerBg: "#ecedf5",
  darkBlue: "#00376d",
  text: "#323338",
  textGray: "#707070",
  textLight: "#8596af",
  iconGray: "#676879",
  border: "#c5c7d0",
  inputBorder: "#dcdfec",
  panelBg: "#ecedf5",
  hoverBg: "#f5f6f8",
} as const;

export const dk = {
  bg: "#13172b", surface: "#1c2235", input: "#1e2538",
  text: "#c8d6e5", textMuted: "#6b7da3", header: "#181c30",
  border: "#2a3150", blue: "#90b8e0",
} as const;

export type DocBucket = "today" | "week" | "month" | "older";

export interface CaseDoc {
  id: string;
  name: string;
  type: string;          // doc type — chip + filter
  submitter: string;     // צד מגיש
  submitterName?: string; // specific party name (shown on hover; useful when a side has several)
  date: string;          // display date
  time?: string;         // display time (matters when several docs are filed the same day)
  iso: string;           // ISO date (for range filtering)
  bucket: DocBucket;
  words: string;         // word count
  summary: string;       // תקציר
  related: string[];     // related document names
  attachments?: string[]; // files attached to this document (exhibits, certificates, etc.)
  checked: boolean;      // selected for chat
  used?: boolean;        // referenced by the chat's answer
  missing?: boolean;     // document has no text / not processed (0 words)
  key?: boolean;         // central/pivotal document
  keyReason?: string;    // why it's central — shown in tooltip (transparency)
  isNew?: boolean;       // new since the judge's last visit
  nameOriginal?: string;    // the system's own name, kept the first time the user renames the display name
  summaryOriginal?: string; // the system's own summary, kept the first time the user rewrites it
  caseId?: string;       // which case this document belongs to
  caseLabel?: string;    // case line printed on the mock page (tasks screen documents span ten cases, not one)
  file?: string;         // path to a real PDF under /public — shown instead of the mock pages when present
  processId?: number;    // groups documents that belong to the same thread/topic (motion → response → decision)
  processIds?: number[]; // a document that belongs to several processes (appears in each thread/folder); overrides processId
}
