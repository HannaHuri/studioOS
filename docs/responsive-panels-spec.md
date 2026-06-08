# התנהגות רספונסיבית של הפאנלים הצדדיים — מפרט לפיתוח

מסמך זה מתאר את ההתנהגות הרצויה של הצ'אט ושני הפאנלים הצדדיים
(**מסמכים** מימין-לוגית/שמאל-ויזואלית, **היסטוריה** מצד שני) כאשר רוחב החלון משתנה.
הפרוטוטייפ המלא חי ב-`/mishpat` ומדגים את כל המצבים.

---

## 1. העיקרון המנחה

> **הפאנלים הם חלק מה-Layout (עמודות flex) — הם *דוחפים* את הצ'אט, לעולם לא *מרחפים* מעליו.**

הבאג המקורי (הפאנל כיסה את שדה הכתיבה) נבע מכך שהפאנל מוקם ב-`position: absolute/fixed`
מעל אזור הצ'אט. הפתרון: שלושת האזורים הם **שכנים באותו container** של flexbox,
שמתחלקים ברוחב. כשפאנל נפתח/נסגר הוא משנה את הרוחב שלו, והצ'אט (כולל שדה הכתיבה)
מתכווץ/מתרחב אוטומטית. שדה הכתיבה תמיד יושב *בתוך* עמודת הצ'אט ולכן לעולם לא מכוסה.

```
[ בר מסמכים ] [ ─────── צ'אט (גמיש) ─────── ] [ בר היסטוריה ] [ בר אייקונים ]
   40 / 300px         flex: 1; min-width: 0          0 / 300px        55px (קבוע)
```

---

## 2. נקודות מעבר (Breakpoints)

| קבוע | ערך | משמעות |
|------|-----|--------|
| `BOTH_MIN` | **1080px** | רוחב מינימלי שבו מותר ש**שני** הפאנלים יוצגו יחד |
| `CHAT_ONLY` | **760px** | מתחת אליו: מצב **מגירה** — פאנל שנפתח מרחף מעל ההתכתבות (לא נחסם) |

שלושה אזורי התנהגות:

| רוחב חלון | התנהגות | חיווי בדמו |
|-----------|----------|------------|
| **≥ 1080px** | שני הפאנלים יכולים להיות פתוחים יחד; שניהם דוחפים, שדה הכתיבה מצטמצם | 🔵 שני פאנלים אפשריים |
| **760–1080px** | **בלעדי** — מוצג רק פאנל אחד; הצ'אט מצטמצם ונדחף | 🟡 פאנל אחד בכל פעם |
| **< 760px** | ברירת מחדל סגור; פתיחת פאנל = **מגירה** מעל ההתכתבות + רקע מעומעם (ChatGPT-style), אחת בכל פעם | 🔴 מגירה |

> הערכים ניתנים לכיוונון. הם נגזרים מהחישוב:
> `מסמכים(300) + היסטוריה(300) + בר אייקונים(55) + מינ' צ'אט(~360)` ≈ 1015 → מעוגל ל-1080;
> `פאנל אחד(300) + בר אייקונים(55) + מינ' צ'אט(~360)` ≈ 715 → מעוגל ל-760.

---

## 3. בלעדיות — בלי שחזור אוטומטי

- מתחת ל-`BOTH_MIN` (אין מקום לשניהם): **פאנל אחד בכל פעם** — פתיחת אחד סוגרת את השני.
- **אין שחזור אוטומטי:** בר שנסגר (כי נפתח השני, או בגלל הקטנת חלון) **נשאר סגור** כשהחלון גדל שוב. המשתמש פותח מחדש ידנית. *(החלטה של הפיתוח — שחזור אוטומטי הרגיש פחות טוב.)*
- כשמקטינים מתחת ל-`BOTH_MIN` ושניהם פתוחים → אחד נסגר (למשל היסטוריה), והצ'אט מתרחב.
- **לא חוסמים את המשתמש בשום רוחב:** גם מתחת ל-760 אפשר לפתוח בר — הוא פשוט מרחף כ**מגירה** עם רקע מעומעם מעל ההתכתבות (ChatGPT-style), עד שסוגרים.

> שני משתני state פשוטים מספיקים: `isPanelOpen`, `isHistoryOpen`. הבלעדיות נאכפת בזמן הפתיחה
> (אם `vw < BOTH_MIN` — פתיחת אחד סוגרת את השני). אין צורך במודל "כוונה" / `lastOpened` / `computed`.
> מתחת ל-`CHAT_ONLY` הפאנל מרונדר כ-overlay (absolute) עם backdrop במקום עמודה בפריסה.

---

## 4. ה-CSS הקריטי — `min-width: 0`

הבאג הכי נפוץ: עמודת הצ'אט **מסרבת להצטמצם** ושדה הכתיבה גולש מתחת לפאנל.
הסיבה: לפריטי flex יש כברירת מחדל `min-width: auto`, שמונע הצטמצמות מתחת לרוחב התוכן.

**הפתרון:** `min-width: 0` לאורך כל שרשרת ה-flex של הצ'אט (העמודה + המיכלים הפנימיים):

```css
.chat-column { flex: 1 1 0; min-width: 0; }      /* מאפשר הצטמצמות אמיתית */
.chat-inner  { min-width: 0; }                   /* גם למיכלים הפנימיים */
.input-box   { width: 100%; max-width: 768px; }  /* מצטמצם עם העמודה, עד תקרה */
```

בתוך שורת הכלים של הקלט: הכפתורים `flex-shrink: 0`, יש `spacer` עם `flex: 1`,
ופרטי התיק עם `min-width: 0; overflow: hidden; max-width: 55%` — כך השורה מצטמצמת בהדרגה
מבלי לשבור.

---

## 5. רוחב מינימלי לחלון

המשתמש שאל אם אפשר למנוע הקטנה מעבר לגודל מסוים. חשוב להבין:

- **דפדפן רגיל:** אי אפשר לכפות מינימום — לכרום/פיירפוקס יש מינימום *משלהם* (~500px),
  וזה הרצפה הטבעית. שדה הכתיבה פשוט ממשיך להצטמצם עד לשם.
- **אפליקציית דסקטופ (Electron / Tauri):** כן אפשר — דרך `minWidth` של חלון האפליקציה:
  ```js
  new BrowserWindow({ minWidth: 760, minHeight: 600 })
  ```
  כך המשתמש לא יוכל בכלל להגיע למצבים הצרים מדי.

המלצה: אם זו אפליקציית דסקטופ — הגדירו `minWidth` סביב `CHAT_ONLY` (760) ומעלה.

---

## 6. טיפים ליישום ב-Angular

ה-CSS (flexbox + `min-width: 0`) זהה לחלוטין — זה לא תלוי-פריימוורק. לוגיקת המצב:

**א. מעקב אחר רוחב החלון** — עדיף `signal` + `@HostListener` (או `BreakpointObserver` מ-CDK):
```ts
vw = signal(window.innerWidth);
@HostListener('window:resize')
onResize() { this.vw.set(window.innerWidth); }
```

**ב. כוונה כ-state, תצוגה כ-`computed`** (Angular 16+ signals):
```ts
readonly BOTH_MIN = 1080;
readonly CHAT_ONLY = 760;

docsWanted = signal(false);
historyWanted = signal(false);
lastOpened = signal<'docs' | 'history'>('docs');

canBoth  = computed(() => this.vw() >= this.BOTH_MIN);
chatOnly = computed(() => this.vw() <  this.CHAT_ONLY);

showDocs = computed(() => {
  if (this.chatOnly()) return false;
  if (this.canBoth())  return this.docsWanted();
  if (this.docsWanted() && this.historyWanted())
    return this.lastOpened() !== 'history';   // בלעדי: האחרון שנפתח
  return this.docsWanted();
});

showHistory = computed(() => {
  if (this.chatOnly()) return false;
  if (this.canBoth())  return this.historyWanted();
  if (this.docsWanted() && this.historyWanted())
    return this.lastOpened() === 'history';
  return this.historyWanted();
});

toggleDocs()    { this.docsWanted.update(v => !v);    if (this.docsWanted())    this.lastOpened.set('docs'); }
toggleHistory() { this.historyWanted.update(v => !v); if (this.historyWanted()) this.lastOpened.set('history'); }
```

**ג. בתבנית** — flex columns + binding:
```html
<div class="layout-row">
  <aside class="docs-col" [style.width.px]="showDocs() ? 300 : 40" *ngIf="!chatOnly()"> … </aside>
  <main class="chat-column">…</main>
  <aside class="history-col" *ngIf="!chatOnly() && showHistory()"> … </aside>
  <nav class="icon-bar">…</nav>
</div>
```

**ד. דגשים:**
- אל תשתמשו ב-`position: absolute` לפאנלים — flex columns בלבד (או CSS grid).
- `ChangeDetectionStrategy.OnPush` + signals → ביצועים טובים בלי בדיקות מיותרות.
- אם הפאנלים משותפים בין מסכים — החזיקו את ה-state ב-`@Injectable` service.
- מעבר רוחב חלק: `transition: width 0.3s` על העמודות.
- מומלץ להוסיף `debounce`/`requestAnimationFrame` ל-resize אם יש עומס.
- שמרו את הכוונה ב-`localStorage` אם רוצים שתישמר בין סשנים.

---

## 7. תרשים מצבים מהיר

```
רוחב חלון  ─────────────────────────────────────────────────►
        760px            1080px
  ┌────────┬───────────────┬──────────────────────────┐
  │  צ'אט   │  פאנל אחד      │  שני פאנלים אפשריים        │
  │  בלבד   │  (בלעדי)       │  (לפי בחירת המשתמש)        │
  └────────┴───────────────┴──────────────────────────┘
   הכל מוסתר   האחרון שנפתח     שניהם דוחפים, קלט מצטמצם
   (כוונה      נשאר; השני        כל פאנל = 300px
    נשמרת)     מוסתר וישוחזר
```
