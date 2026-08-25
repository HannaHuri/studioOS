// ── The judge's task list ───────────────────────────────────────────────────
// Two separate concepts live here, and keeping them apart is the whole point:
//
//   kind   — סוג המשימה as נט המשפט files it ("מתן החלטה בבקשה", "עיון בבקשה"…). This is what the current
//            system groups by, and what the judge recognises.
//   matter — what the request is actually ABOUT (דחיית מועד, מינוי מומחה…). This is what determines how the
//            background is composed, and it is invisible in the UI.
//
// A playbook hangs off `matter`, never off `kind`: "מתן החלטה בבקשה" says nothing about what to check, while
// "בקשה לדחיית מועד" says exactly what to check.

import type { CaseDoc } from "./shared";

export const TODAY_ISO = "2026-08-25";

// ── Playbooks — the MODEL layer, deliberately not rendered ──────────────────
// Each entry is the output of a working session with judges: the checks that go into deciding this kind of
// request, and how much each one weighs. This is prompt material — it tells the model what to look for and what
// to lead with. It is NOT a template for the screen: the judge never sees a checklist, and never sees a weight.
// What reaches the screen is a short paragraph mentioning only the checks that actually had something to say
// about THIS request (see `background` on each task).
//
// Adding a task type = adding a playbook here. Nothing in the UI changes.
export type PlaybookCheck = {
  label: string;
  weight?: number;   // relative importance, 0–100. Drives what the model leads with — never displayed.
  note?: string;     // what the check means in practice
};
export type Playbook = { matter: string; source: string; checks: PlaybookCheck[]; actions?: string[] };

export const TASK_PLAYBOOKS: Record<string, Playbook> = {
  defer: {
    matter: "בקשה לדחיית מועד (הגשה או דיון)",
    source: "פגישת אפיון עם שופטים",
    checks: [
      { label: "תוכן הבקשה והנימוק", weight: 40, note: "מה מבוקש ומה הנימוק — עומס, מילואים, תאונה, המתנה למסמך" },
      { label: "הזמן שנותר עד לדיון הבא", weight: 15, note: "האם הדחייה המבוקשת תאלץ את דחיית הדיון עצמו — דבר שמנסים להימנע ממנו" },
      { label: "הקשר ההחלטה האחרונה", weight: 10, note: "ההחלטות האחרונות בתיק, כדי להבין את הסטטוס הנוכחי" },
      { label: "הסכמת הצד שכנגד", weight: 10, note: "בהסכמה, וכשאין דחיית דיון — הבקשה תאושר לרוב" },
      { label: "תלות בגורמים חיצוניים", weight: 7, note: "המתנה למסמכים מרופא, ממומחה או מגורם שלישי" },
      { label: "כתבי הטענות", weight: 5, note: "רק במקרים של חוסר היכרות עם התיק — להיזכר במהות" },
      { label: "מספר ההארכות שכבר ניתנו", weight: 5, note: "האם מדובר בבקשה חוזרת ומוגזמת באותו עניין" },
    ],
    actions: ["העברה לתגובת הצד שכנגד", "מתן החלטה", "קביעה לדיון"],
  },
  expert: {
    matter: "בקשה למינוי מומחה רפואי (פלת״ד)",
    source: "פגישת אפיון עם שופטים",
    checks: [
      { label: "תוכן הבקשה וסוג המומחה", note: "איזה תחום מבוקש (אורתופדיה, נוירולוגיה) ומה הסיבה" },
      { label: "הסכמת הנתבעת", note: "הסכמה למינוי מייתרת את הבדיקה המעמיקה של ראשית ראיה" },
      { label: "ראשית ראיה", note: "בהיעדר הסכמה — האם יש במסמכים הרפואיים תשתית מינימלית לנזק שקשור לתאונה" },
      { label: "השוואה לטענות הנתבעת", note: "האם הממצאים הרפואיים עונים לנימוקי ההתנגדות" },
      { label: "איתור מומחה מתאים", note: "מומחה שלא טיפל בתובע ואינו מאותו מוסד רפואי — מניעת ניגוד עניינים" },
    ],
    actions: ["העברה לתגובת הנתבעת", "מינוי מומחה", "דחיית הבקשה"],
  },
};

// ── Tasks ───────────────────────────────────────────────────────────────────
export type TaskUrgency = "critical" | "high" | "normal" | "low";
export type TaskKind =
  | "מתן החלטה בבקשה" | "עיון בבקשה" | "מתן פסק דין"
  | "עיון בפסק דין שניתן בערעור" | "פניות מזכירות" | "קציבת הוצאות";

export interface JudgeTask {
  id: string;
  kind: TaskKind;
  matter?: keyof typeof TASK_PLAYBOOKS; // which playbook composed the background (model-side only)
  subject: string;        // the request itself — this is the clickable label that opens the document
  caseNumber: string;
  caseName: string;
  caseId?: string;        // set when the case is one of the two fully-modelled cases (c1 / c2)
  docId: string;          // the leading document — the one the judge needs in front of them
  openedIso: string;      // when the task landed
  dueIso?: string;        // תאריך יעד
  hearingIso?: string;    // the next hearing in the case, when one is scheduled
  submitter: string;
  estimate: number;       // minutes — lets a judge batch "all the short ones" in one sitting
  urgency: TaskUrgency;
  background: string;     // the short paragraph the judge reads — only what mattered in THIS request
  recommendation?: string; // collapsed by default; present only where there is something to recommend
  threadDocs: number;     // documents in the request's thread (motion → response → reply)
  notes?: string;
  handler?: string;
}

// "לטיפול מיידי" rather than "חריגה": a task can be the most pressing thing on the desk without any deadline having
// been missed yet, and labelling those five tasks "חריגה" would state something untrue about the judge's docket.
export const URGENCY_LABEL: Record<TaskUrgency, string> = {
  critical: "לטיפול מיידי", high: "דחוף", normal: "רגיל", low: "נמוך",
};
export const URGENCY_ORDER: TaskUrgency[] = ["critical", "high", "normal", "low"];

export const TASKS: JudgeTask[] = [
  {
    id: "t1", kind: "מתן החלטה בבקשה", matter: "defer",
    subject: "בקשה לדחיית מועד הגשת תצהירי עדות ראשית",
    caseNumber: "43677-05-26", caseName: "עבד רבה נ׳ קרן משמרת ביטוח בע״מ",
    docId: "x1", openedIso: "2026-08-18", dueIso: "2026-08-28", hearingIso: "2026-09-09",
    submitter: "נתבע", estimate: 15, urgency: "critical", threadDocs: 3,
    background: "הנתבע מבקש דחייה של 30 יום להגשת תצהירי עדות ראשית בשל שירות מילואים פעיל, בצירוף אישור. הדיון קבוע ל-9.9, בעוד 12 יום — דחייה כמבוקש תחייב את דחייתו. זו ההארכה השלישית לאותו צד באותו עניין. התובע טרם הגיב, והמועד להגיב חלף ב-26.8.",
    recommendation: "דחייה חלקית של 14 יום שומרת על מועד הדיון ונותנת מענה לנימוק המילואים. אם נדרשים 30 יום מלאים — יש להיערך לדחיית הדיון עצמו.",
    notes: "הערת מזכירות: אישור המילואים סרוק חלקית",
  },
  {
    id: "t2", kind: "מתן החלטה בבקשה", matter: "expert",
    subject: "בקשה למינוי מומחה רפואי בתחום האורתופדיה",
    caseNumber: "22904-04-26", caseName: "אלמליח נ׳ מגדל חברה לביטוח בע״מ",
    docId: "x2", openedIso: "2026-08-11", dueIso: "2026-08-27",
    submitter: "תובע", estimate: 30, urgency: "critical", threadDocs: 4,
    background: "התובע מבקש מינוי מומחה אורתופד. הנתבעת מתנגדת בטענה שאין ראשית ראיה לנזק אורתופדי. בתיק שני מסמכים רפואיים מיום התאונה המתעדים תלונות על כאבי גב תחתון.",
    recommendation: "המסמכים מיום התאונה מקיימים את הרף של ראשית ראיה. יש לוודא שהמומחה שייבחר אינו משתייך למרכז הרפואי שבו טופל התובע.",
  },
  {
    id: "t3", kind: "מתן החלטה בבקשה", matter: "defer",
    subject: "בקשה לדחיית מועד הגשת תצהירים בהסכמה",
    caseNumber: "37667-11-25", caseName: "גמיש נ׳ זיידמן ואח׳",
    docId: "x3", openedIso: "2026-08-21", dueIso: "2026-09-04",
    submitter: "תובע", estimate: 5, urgency: "normal", threadDocs: 2,
    background: "הצדדים מסכימים לדחייה של 14 יום להגשת תצהירים. אין דיון קרוב.",
  },
  {
    id: "t4", kind: "מתן החלטה בבקשה", matter: "defer",
    subject: "בקשה לדחיית מועד דיון בשל היעדרות מומחה",
    caseNumber: "12345-67-89", caseName: "יעקב אברמוב נ׳ המרכז הרפואי קדם בע״מ", caseId: "c1",
    docId: "d1", openedIso: "2026-08-14", dueIso: "2026-08-31", hearingIso: "2026-09-21",
    submitter: "נתבע", estimate: 20, urgency: "high", threadDocs: 3,
    background: "הנתבע מבקש לדחות את הדיון בשל שהות מומחה מטעמו בחו״ל, ומציע מועד חלופי ביולי. התובע התנגד בתגובה מיום 3.6 בטענה שהמומחה אינו עד הכרחי בשלב זה. זו בקשת הדחייה הראשונה בתיק.",
    recommendation: "ניתן לקבוע דיון במועד החלופי בכפוף להתחייבות הנתבע שלא לבקש דחייה נוספת מאותו טעם.",
  },
  {
    id: "t5", kind: "עיון בבקשה",
    subject: "בקשה לגילוי מסמכים ספציפי",
    caseNumber: "12345-67-89", caseName: "יעקב אברמוב נ׳ המרכז הרפואי קדם בע״מ", caseId: "c1",
    docId: "d14", openedIso: "2026-08-20", dueIso: "2026-09-03",
    submitter: "תובע", estimate: 25, urgency: "high", threadDocs: 3,
    background: "התובע מבקש גילוי של יומני חדר הניתוח ליום האירוע. הנתבע טוען לחיסיון רפואי של מטופלים אחרים. בקשה דומה בתיק נדחתה ב-30.7 בהיקף רחב יותר.",
    recommendation: "ניתן להורות על גילוי מוגבל ליום ולשעות הרלוונטיים בלבד, לאחר השחרת פרטי מטופלים אחרים.",
  },
  {
    id: "t6", kind: "מתן פסק דין",
    subject: "מתן פסק דין — תביעת נזיקין",
    caseNumber: "59150-09-25", caseName: "גטס נ׳ שטרן פרטיס לין בע״מ",
    docId: "x6", openedIso: "2026-07-02", dueIso: "2026-08-20",
    submitter: "בית המשפט", estimate: 180, urgency: "critical", threadDocs: 9,
    background: "הסיכומים מטעם שני הצדדים הוגשו ב-1.7. עברו 54 יום מהגשת הסיכומים האחרונים, והמועד למתן פסק הדין חלף ב-20.8. התיק כולל חוות דעת רפואית מטעם כל צד ופרוטוקול של ארבע ישיבות הוכחות.",
    handler: "עוזרת משפטית — נועה ג׳",
  },
  {
    id: "t7", kind: "מתן פסק דין",
    subject: "מתן פסק דין — תביעה חוזית",
    caseNumber: "88231-12-25", caseName: "דוידוב נ׳ בזק בינלאומי בע״מ",
    docId: "x7", openedIso: "2026-08-04", dueIso: "2026-09-18",
    submitter: "בית המשפט", estimate: 180, urgency: "normal", threadDocs: 7,
    background: "הסיכומים הוגשו ב-3.8. המחלוקת ממוקדת בפרשנות סעיף השיפוי בהסכם ההתקשרות; אין מחלוקת עובדתית של ממש.",
  },
  {
    id: "t8", kind: "מתן החלטה בבקשה",
    subject: "בקשה לסעד זמני — צו מניעה",
    caseNumber: "59198-67-89", caseName: "אורן פרידמן נ׳ שיכון הצפון חברה לבנייה בע״מ", caseId: "c2",
    docId: "e2", openedIso: "2026-08-24", dueIso: "2026-08-26",
    submitter: "תובע", estimate: 45, urgency: "critical", threadDocs: 2,
    background: "התובע מבקש צו מניעה זמני שיעצור את עבודות היציקה בקומה ד׳ עד להכרעה בתביעה. הבקשה הוגשה במעמד צד אחד ובדחיפות. עבודות היציקה מתוכננות ל-27.8 לפי הנספח לבקשה.",
    recommendation: "ניתן לקבוע דיון דחוף במעמד הצדדים לפני 27.8, ולהורות בינתיים על עיכוב היציקה בלבד.",
  },
  {
    id: "t9", kind: "עיון בבקשה", matter: "defer",
    subject: "בקשה להארכת מועד להגשת כתב הגנה",
    caseNumber: "61120-02-26", caseName: "כהן נ׳ עיריית חיפה",
    docId: "x9", openedIso: "2026-08-19", dueIso: "2026-09-02",
    submitter: "נתבע", estimate: 10, urgency: "normal", threadDocs: 2,
    background: "העירייה מבקשת הארכה של 20 יום להגשת כתב הגנה בשל החלפת מייצג. זו ההארכה השנייה; ההארכה הראשונה ניתנה ב-14.7. התובע לא הגיב.",
  },
  {
    id: "t10", kind: "מתן החלטה בבקשה", matter: "expert",
    subject: "בקשה למינוי מומחה רפואי בתחום הנוירולוגיה",
    caseNumber: "15873-06-26", caseName: "נחמיאס נ׳ הפניקס חברה לביטוח בע״מ",
    docId: "x10", openedIso: "2026-08-13", dueIso: "2026-09-01",
    submitter: "תובע", estimate: 15, urgency: "normal", threadDocs: 3,
    background: "התובעת מבקשת מינוי מומחה נוירולוג. הנתבעת הודיעה שאינה מתנגדת למינוי.",
    recommendation: "בהסכמת הנתבעת אין צורך בבדיקת ראשית ראיה. נותר לבחור מומחה שאינו מקופת החולים המטפלת.",
  },
  {
    id: "t11", kind: "פניות מזכירות",
    subject: "בקשת עיון בתיק מטעם צד שלישי",
    caseNumber: "40317-01-26", caseName: "ברודלין נ׳ סמנוביץ׳",
    docId: "x11", openedIso: "2026-08-22", dueIso: "2026-09-05",
    submitter: "צד ג׳", estimate: 10, urgency: "low", threadDocs: 1,
    background: "עיתונאי מבקש עיון בכתבי הטענות בתיק. אין בתיק צו איסור פרסום. הצדדים לא נשאלו עדיין את עמדתם.",
    handler: "מזכירות",
  },
  {
    id: "t12", kind: "עיון בפסק דין שניתן בערעור",
    subject: "פסק דין בערעור — החזרת התיק לדיון",
    caseNumber: "37667-11-25", caseName: "גמיש נ׳ זיידמן ואח׳",
    docId: "x12", openedIso: "2026-08-10", dueIso: "2026-09-07",
    submitter: "בית משפט מחוזי", estimate: 45, urgency: "high", threadDocs: 4,
    background: "ערעור על פסק הדין התקבל חלקית, והתיק הוחזר לדיון בשאלת שיעור הנזק בלבד. קביעות בית המשפט בשאלת האחריות נותרו על כנן.",
    recommendation: "יש לזמן את הצדדים לקדם משפט קצר לצורך קביעת מתווה הראיות בשאלת הנזק.",
  },
  {
    id: "t13", kind: "קציבת הוצאות",
    subject: "קציבת הוצאות בגין דחיית מועד",
    caseNumber: "43677-05-26", caseName: "עבד רבה נ׳ קרן משמרת ביטוח בע״מ",
    docId: "x13", openedIso: "2026-08-23", dueIso: "2026-09-10",
    submitter: "בית המשפט", estimate: 5, urgency: "low", threadDocs: 2,
    background: "בהחלטה מיום 22.8 נדחה מועד הדיון לבקשת הנתבע, וההוצאות הושארו לקציבה. הדחייה גרמה לביטול ישיבה שנקבעה לשלוש שעות.",
  },
  {
    id: "t14", kind: "מתן החלטה בבקשה",
    subject: "בקשה לתיקון כתב תביעה",
    caseNumber: "78868-03-26", caseName: "פישלר נ׳ האוניברסיטה העברית ואח׳",
    docId: "x14", openedIso: "2026-08-06", dueIso: "2026-08-24", hearingIso: "2026-10-12",
    submitter: "תובע", estimate: 30, urgency: "critical", threadDocs: 4,
    background: "התובע מבקש לתקן את כתב התביעה ולהוסיף נתבעת שלישית. הנתבעות מתנגדות בטענה להתיישנות עילה כלפי הנתבעת הנוספת. המועד להחלטה חלף ב-24.8. הדיון הקבוע ב-12.10 אינו בסכנה.",
  },
  {
    id: "t15", kind: "עיון בבקשה",
    subject: "בקשה לזימון עד נוסף",
    caseNumber: "12345-67-89", caseName: "יעקב אברמוב נ׳ המרכז הרפואי קדם בע״מ", caseId: "c1",
    docId: "d24", openedIso: "2026-08-17", dueIso: "2026-09-06", hearingIso: "2026-09-21",
    submitter: "נתבע", estimate: 15, urgency: "high", threadDocs: 2,
    background: "הנתבע מבקש לזמן את אחות חדר הניתוח כעדה נוספת. התובע טרם הגיב; המועד להגיב חלף ב-24.8. הדיון קבוע ל-21.9, כך שזימון מחייב החלטה בימים הקרובים.",
  },
  {
    id: "t16", kind: "מתן החלטה בבקשה",
    subject: "בקשה לחיוב בהוצאות בגין דחיית הדיון",
    caseNumber: "12345-67-89", caseName: "יעקב אברמוב נ׳ המרכז הרפואי קדם בע״מ", caseId: "c1",
    docId: "d25", openedIso: "2026-08-12", dueIso: "2026-09-08",
    submitter: "תובע", estimate: 10, urgency: "normal", threadDocs: 2,
    background: "התובע מבקש לחייב את הנתבע בהוצאות בגין דחיית הדיון לבקשתו. הנתבע השיב שהדחייה נבעה מנסיבות שאינן בשליטתו וכי התובע לא נשא בהוצאות ממשיות.",
  },
  {
    id: "t17", kind: "עיון בבקשה", matter: "defer",
    subject: "בקשה לדחיית מועד הגשת סיכומים",
    caseNumber: "88231-12-25", caseName: "דוידוב נ׳ בזק בינלאומי בע״מ",
    docId: "x17", openedIso: "2026-08-15", dueIso: "2026-08-30",
    submitter: "נתבע", estimate: 10, urgency: "normal", threadDocs: 2,
    background: "הנתבעת מבקשת דחייה של 21 יום להגשת סיכומים בשל עומס. אין דיון קבוע. זו ההארכה הראשונה בתיק, והתובע הודיע שאינו מתנגד.",
  },
  {
    id: "t18", kind: "פניות מזכירות",
    subject: "בקשה לתיקון טעות סופר בהחלטה",
    caseNumber: "59150-09-25", caseName: "גטס נ׳ שטרן פרטיס לין בע״מ",
    docId: "x18", openedIso: "2026-08-24", dueIso: "2026-09-08",
    submitter: "מזכירות", estimate: 5, urgency: "low", threadDocs: 1,
    background: "בהחלטה מיום 19.8 נרשם מספר תיק שגוי בכותרת. מבוקש תיקון טעות סופר.",
    handler: "מזכירות",
  },
  {
    id: "t19", kind: "מתן החלטה בבקשה",
    subject: "בקשה לעיכוב ביצוע פסק דין",
    caseNumber: "61120-02-26", caseName: "כהן נ׳ עיריית חיפה",
    docId: "x19", openedIso: "2026-08-23", dueIso: "2026-08-27",
    submitter: "נתבע", estimate: 30, urgency: "high", threadDocs: 2,
    background: "העירייה מבקשת עיכוב ביצוע עד להכרעה בערעור שהוגש ב-20.8. התובע מתנגד וטוען שמדובר בסכום כסף בלבד הניתן להשבה.",
    recommendation: "בסעד כספי מול רשות ציבורית, החשש להשבה נמוך — ניתן להסתפק בעיכוב חלקי או בהפקדת ערובה.",
  },
  {
    id: "t20", kind: "עיון בבקשה", matter: "expert",
    subject: "בקשה למינוי מומחה נוסף בתחום השיקום",
    caseNumber: "22904-04-26", caseName: "אלמליח נ׳ מגדל חברה לביטוח בע״מ",
    docId: "x20", openedIso: "2026-08-20", dueIso: "2026-09-09",
    submitter: "תובע", estimate: 20, urgency: "normal", threadDocs: 3,
    background: "התובע מבקש מינוי מומחה שיקום בנוסף למומחה האורתופד המבוקש. הנתבעת מתנגדת וטוענת שהבקשה מוקדמת כל עוד לא הוגשה חוות דעת אורתופדית.",
  },
  {
    id: "t21", kind: "מתן החלטה בבקשה",
    subject: "בקשה למחיקת סעיפים מכתב ההגנה",
    caseNumber: "78868-03-26", caseName: "פישלר נ׳ האוניברסיטה העברית ואח׳",
    docId: "x21", openedIso: "2026-08-18", dueIso: "2026-09-05", hearingIso: "2026-10-12",
    submitter: "תובע", estimate: 25, urgency: "normal", threadDocs: 3,
    background: "התובע מבקש למחוק ארבעה סעיפים מכתב ההגנה בטענה להרחבת חזית. הנתבעות השיבו שהסעיפים מפרטים טענה שנטענה כבר בכתב ההגנה המקורי.",
  },
  {
    id: "t22", kind: "עיון בבקשה",
    subject: "בקשה להוספת ראיה — הקלטה",
    caseNumber: "40317-01-26", caseName: "ברודלין נ׳ סמנוביץ׳",
    docId: "x22", openedIso: "2026-08-21", dueIso: "2026-09-11",
    submitter: "נתבע", estimate: 20, urgency: "normal", threadDocs: 2,
    background: "הנתבע מבקש להוסיף הקלטת שיחה בין הצדדים כראיה בשלב זה של ההליך. התובע טרם הגיב; המועד להגיב הוא 1.9.",
  },
  {
    id: "t23", kind: "קציבת הוצאות",
    subject: "קציבת הוצאות בפסק דין",
    caseNumber: "37667-11-25", caseName: "גמיש נ׳ זיידמן ואח׳",
    docId: "x23", openedIso: "2026-08-09", dueIso: "2026-09-02",
    submitter: "בית המשפט", estimate: 15, urgency: "normal", threadDocs: 3,
    background: "בפסק הדין מיום 8.8 נקבע שההוצאות ייקצבו בנפרד. שני הצדדים הגישו פירוט הוצאות; הפער ביניהם עומד על כ-40 אלף ש״ח.",
  },
  {
    id: "t24", kind: "עיון בפסק דין שניתן בערעור",
    subject: "פסק דין בערעור — דחיית הערעור",
    caseNumber: "59150-09-25", caseName: "גטס נ׳ שטרן פרטיס לין בע״מ",
    docId: "x24", openedIso: "2026-08-07", dueIso: "2026-09-04",
    submitter: "בית משפט מחוזי", estimate: 10, urgency: "low", threadDocs: 2,
    background: "הערעור נדחה במלואו ופסק הדין נותר על כנו. לא נדרשת פעולה נוספת בתיק מלבד סגירתו.",
  },
];

// Documents for the cases that exist only in the tasks screen. The two fully-modelled cases (c1 / c2) reference
// their real documents by id, so opening those tasks opens the actual PDF the rest of the prototype uses.
const mk = (
  id: string, name: string, type: string, submitter: string, date: string, iso: string, words: string, summary: string,
  extra: Partial<CaseDoc> = {},
): CaseDoc => ({
  id, name, type, submitter, date, iso, words, summary,
  bucket: "month", related: [], checked: false, ...extra,
});

export const TASK_DOCS: CaseDoc[] = [
  mk("x1", "בקשה לדחיית מועד הגשת תצהירים", "בקשות והוראות", "נתבע", "18.08.26", "2026-08-18", "820",
     "הנתבע מבקש דחייה של 30 יום להגשת תצהירי עדות ראשית בשל שירות מילואים פעיל.",
     { time: "11:20", attachments: ["אישור שירות מילואים מיום 12.8"] }),
  mk("x2", "בקשה למינוי מומחה רפואי — אורתופדיה", "בקשות והוראות", "תובע", "11.08.26", "2026-08-11", "1.4K",
     "בקשה למינוי מומחה אורתופד מטעם בית המשפט, בצירוף מסמכים רפואיים מיום התאונה.",
     { attachments: ["דו״ח חדר מיון 4.4.26", "סיכום ביקור אורתופד 18.4.26"] }),
  mk("x3", "בקשה מוסכמת לדחיית מועד הגשת תצהירים", "בקשות והוראות", "תובע", "21.08.26", "2026-08-21", "410",
     "בקשה בהסכמת שני הצדדים לדחייה של 14 יום להגשת תצהירים."),
  mk("x6", "סיכומים מטעם התובע", "כתבי טענות", "תובע", "01.07.26", "2026-07-01", "14.2K",
     "סיכומי התובע בתביעת נזיקין, לרבות התייחסות לחוות הדעת הרפואיות ולפרוטוקול ההוכחות.", { key: true }),
  mk("x7", "סיכומים מטעם הנתבעת", "כתבי טענות", "נתבע", "03.08.26", "2026-08-03", "9.8K",
     "סיכומי הנתבעת בשאלת פרשנות סעיף השיפוי בהסכם ההתקשרות."),
  mk("x9", "בקשה להארכת מועד להגשת כתב הגנה", "בקשות והוראות", "נתבע", "19.08.26", "2026-08-19", "560",
     "בקשת העירייה להארכה של 20 יום להגשת כתב הגנה בשל החלפת מייצג."),
  mk("x10", "בקשה למינוי מומחה רפואי — נוירולוגיה", "בקשות והוראות", "תובע", "13.08.26", "2026-08-13", "1.1K",
     "בקשה למינוי מומחה נוירולוג; הנתבעת הודיעה שאינה מתנגדת."),
  mk("x11", "בקשת עיון בתיק מטעם צד שלישי", "בקשות והוראות", "צד ג׳", "22.08.26", "2026-08-22", "380",
     "בקשת עיתונאי לעיין בכתבי הטענות בתיק."),
  mk("x12", "פסק דין בערעור", "פסקי דין", "בית משפט מחוזי", "10.08.26", "2026-08-10", "6.3K",
     "הערעור התקבל חלקית; התיק הוחזר לדיון בשאלת שיעור הנזק בלבד.", { key: true }),
  mk("x13", "החלטה בדבר דחיית מועד הדיון", "החלטות בתיק", "בית המשפט", "22.08.26", "2026-08-22", "620",
     "מועד הדיון נדחה לבקשת הנתבע; ההוצאות הושארו לקציבה."),
  mk("x14", "בקשה לתיקון כתב תביעה", "בקשות והוראות", "תובע", "06.08.26", "2026-08-06", "2.2K",
     "בקשה לתיקון כתב התביעה ולהוספת נתבעת שלישית."),
  mk("x17", "בקשה לדחיית מועד הגשת סיכומים", "בקשות והוראות", "נתבע", "15.08.26", "2026-08-15", "470",
     "בקשת הנתבעת לדחייה של 21 יום להגשת סיכומים בשל עומס."),
  mk("x18", "פניית מזכירות — תיקון טעות סופר", "בקשות והוראות", "מזכירות", "24.08.26", "2026-08-24", "180",
     "בקשה לתיקון מספר תיק שגוי בכותרת ההחלטה מיום 19.8."),
  mk("x19", "בקשה לעיכוב ביצוע פסק דין", "בקשות והוראות", "נתבע", "23.08.26", "2026-08-23", "1.9K",
     "בקשת העירייה לעיכוב ביצוע עד להכרעה בערעור שהוגש ב-20.8."),
  mk("x20", "בקשה למינוי מומחה שיקום", "בקשות והוראות", "תובע", "20.08.26", "2026-08-20", "900",
     "בקשה למינוי מומחה שיקום בנוסף למומחה האורתופד המבוקש."),
  mk("x21", "בקשה למחיקת סעיפים מכתב ההגנה", "בקשות והוראות", "תובע", "18.08.26", "2026-08-18", "1.6K",
     "בקשה למחיקת ארבעה סעיפים מכתב ההגנה בטענה להרחבת חזית."),
  mk("x22", "בקשה להוספת ראיה — הקלטת שיחה", "בקשות והוראות", "נתבע", "21.08.26", "2026-08-21", "740",
     "בקשה להוספת הקלטת שיחה בין הצדדים כראיה בשלב זה של ההליך.",
     { attachments: ["תמליל ההקלטה"] }),
  mk("x23", "פירוט הוצאות מטעם הצדדים", "בקשות והוראות", "שני הצדדים", "09.08.26", "2026-08-09", "1.2K",
     "פירוטי הוצאות שהוגשו לאחר פסק הדין; הפער בין הצדדים כ-40 אלף ש״ח."),
  mk("x24", "פסק דין בערעור — דחיית הערעור", "פסקי דין", "בית משפט מחוזי", "07.08.26", "2026-08-07", "3.4K",
     "הערעור נדחה במלואו ופסק הדין נותר על כנו."),
];

// ── Derived helpers ─────────────────────────────────────────────────────────
const dayMs = 24 * 60 * 60 * 1000;
export const daysFrom = (iso: string, from = TODAY_ISO) =>
  Math.round((Date.parse(from) - Date.parse(iso)) / dayMs);
export const daysUntil = (iso: string, from = TODAY_ISO) => -daysFrom(iso, from);
/** dd.mm.yy — the format the court system uses in dense lists. */
export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
};
export const fmtEstimate = (min: number) =>
  min < 60 ? `${min} דק׳` : min % 60 === 0 ? `${min / 60} ש׳` : `${(min / 60).toFixed(1)} ש׳`;
/** Hebrew counts one, two and many differently — "1 ימים" reads as a bug to anyone looking at the screen. */
export const fmtDays = (n: number) => (n === 1 ? "יום" : n === 2 ? "יומיים" : `${n} ימים`);
