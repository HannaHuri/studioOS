# studioOS

סביבת עבודה (דשבורד) מבוססת **Next.js** שמרכזת כמה מודולים. המודול המרכזי בפיתוח כעת
הוא **נט המשפט** — עוזר צ'אט משפטי לשופטים (ממשק עברית RTL בשפת העיצוב של Vibe / monday).

> השם `studioOS` הוא שם גנרי שניתן לפרויקט בעת יצירתו. כל הנתיבים באפליקציה יושבים תחת
> `basePath: "/studioOS"` (ראו `next.config.ts`), ולכן ה-URL-ים בפרודקשן הם בצורה
> `…/studioOS/<route>`.

🔗 **דמו חי:** https://studio-os-silk.vercel.app/studioOS/mishpat

---

## מבנה הפרויקט

```
app/
├─ page.tsx              # דף הבית / דשבורד
├─ shell-layout.tsx      # מעטפת כללית (מוסתרת בנתיבי /mishpat)
├─ globals.css           # סגנונות גלובליים + utilities (docs-scroll, אנימציות)
├─ mishpat/              # ★ נט המשפט — המודול הפעיל
│  ├─ page.tsx           #   מסך הצ'אט הראשי (קלט, פאנלים צדדיים רספונסיביים)
│  ├─ admin/page.tsx     #   ניהול בטא (טבלת משתמשים, עריכה, סטטוסים)
│  └─ lab/page.tsx       #   "מעבדה" — גרסת עבודה לעיצוב פאנל המסמכים
├─ projects/             # מודול פרויקטים
├─ tasks/                # מודול משימות
└─ team/                 # מודול צוות

docs/
└─ responsive-panels-spec.md   # מפרט התנהגות רספונסיבית של הפאנלים (לפיתוח)
```

---

## טכנולוגיות

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui** + **Radix UI**
- **lucide-react** (אייקונים), **recharts** (גרפים), **dnd-kit** (גרירה ושחרור)
- פריסה ב-**Vercel**

---

## הרצה מקומית

```bash
npm install
npm run dev
```

הדף יעלה בכתובת **http://localhost:3001/studioOS** (שימו לב ל-`basePath`; הפורט הוא 3001).

נתיבים שימושיים בפיתוח:
- `/studioOS/mishpat` — מסך הצ'אט
- `/studioOS/mishpat/admin` — ניהול בטא
- `/studioOS/mishpat/lab` — מעבדת עיצוב פאנל המסמכים

```bash
npm run build   # בילד לפרודקשן
npm run start   # הרצת בילד
npm run lint    # בדיקות lint
```

---

## הערות לפיתוח

- **עברית / RTL:** רוב המסכים `dir="rtl"`; משתמשים ב-CSS logical properties
  (`marginInlineStart`, `borderInlineStart` וכו') כדי שיתנהגו נכון ב-RTL.
- **עיצוב:** שפת Vibe (monday) — צבעים, טיפוגרפיה ואייקונים מוגדרים כ-tokens בראש כל קובץ מסך.
- **התנהגות רספונסיבית של הפאנלים:** מתועדת במלואה ב-
  [`docs/responsive-panels-spec.md`](docs/responsive-panels-spec.md) —
  כולל נקודות מעבר, מודל "כוונה מול תצוגה", ה-gotcha של `min-width: 0`, ודוגמאות Angular.
- **`/mishpat/lab`** הוא עותק עבודה בטוח של מסך הצ'אט לניסויי עיצוב — אין לפרסם אותו כפרודקשן.
- כל שינוי נדחף ל-`main` ומתפרסם אוטומטית ב-Vercel.
