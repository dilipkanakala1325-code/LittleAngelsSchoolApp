import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ---------------------------------------------------------
   Little Angels School Attendance System
   Sections 9A / 9B / 9C / 9E / 9F — 9 periods + lunch, Mon–Sat
--------------------------------------------------------- */

const FONT_LINK_ID = "laas-fonts";
function useFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap";
    document.head.appendChild(link);
  }, []);
}

const STYLE_TAG_ID = "laas-interactions";
function useAppStyles() {
  useEffect(() => {
    if (document.getElementById(STYLE_TAG_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_TAG_ID;
    style.textContent = `
      @keyframes laasFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes laasPop { 0% { transform: scale(0.9); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      .laas-card { transition: box-shadow .2s ease, transform .2s ease; animation: laasFadeUp .35s ease both; }
      .laas-card:hover { box-shadow: 0 10px 24px rgba(21,42,69,0.10); transform: translateY(-2px); }
      .laas-btn { transition: transform .15s ease, filter .15s ease, box-shadow .15s ease; }
      .laas-btn:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 6px 14px rgba(21,42,69,0.16); }
      .laas-btn:active { transform: translateY(0); filter: brightness(0.97); }
      .laas-period:hover { transform: translateY(-2px) scale(1.03); box-shadow: 0 6px 14px rgba(21,42,69,0.14); }
      .laas-period { transition: transform .15s ease, box-shadow .15s ease; }
      .laas-pop { animation: laasPop .25s ease both; }
      .laas-pulse-dot { display:inline-block; width:8px; height:8px; border-radius:999px; background:#E8A33D; margin-right:6px; box-shadow: 0 0 0 rgba(232,163,61,0.5); animation: laasDotPulse 1.6s infinite; }
      @keyframes laasDotPulse { 0% { box-shadow: 0 0 0 0 rgba(232,163,61,0.5); } 70% { box-shadow: 0 0 0 7px rgba(232,163,61,0); } 100% { box-shadow: 0 0 0 0 rgba(232,163,61,0); } }
    `;
    document.head.appendChild(style);
  }, []);
}

function playAlertSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1180].forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.value = 0.001;
      o.connect(g);
      g.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.001, start);
      g.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      o.start(start);
      o.stop(start + 0.22);
    });
    setTimeout(() => ctx.close(), 700);
  } catch (e) {
    /* no audio available */
  }
}

const TEACHERS = [
  { name: "M.S.V. Prasad", subject: "Physics", pin: "1001" },
  { name: "B. Prasad", subject: "Chemistry", pin: "1002" },
  { name: "Padma Priya", subject: "English", pin: "1003" },
  { name: "Vidya Kalpana", subject: "Biology", pin: "1004" },
  { name: "Uma", subject: "Maths 1", pin: "1005" },
  { name: "Aparna", subject: "Maths 2", pin: "1006" },
  { name: "Archana", subject: "Social Studies", pin: "1007" },
  { name: "Sharma", subject: "Telugu", pin: "1008" },
  { name: "Tulsi", subject: "Art", pin: "1009" },
  { name: "Veda", subject: "Computer", pin: "1010" },
];

// Colour + emoji identity per subject, used to make the timetable readable at a glance.
const SUBJECT_STYLE = {
  Physics: { bg: "#EAF1FF", fg: "#2C5CC5", icon: "⚛️" },
  Chemistry: { bg: "#EFF7EC", fg: "#3E8E4F", icon: "🧪" },
  English: { bg: "#FDF0E8", fg: "#C1622A", icon: "📖" },
  Biology: { bg: "#EAF9F2", fg: "#1F9E71", icon: "🌿" },
  "Maths 1": { bg: "#F1EEFB", fg: "#6A4FC2", icon: "📐" },
  "Maths 2": { bg: "#F1EEFB", fg: "#8858D8", icon: "📊" },
  "Social Studies": { bg: "#FDF3DD", fg: "#B4831E", icon: "🌍" },
  Telugu: { bg: "#FDEBF0", fg: "#C13D74", icon: "📝" },
  Art: { bg: "#FCEFF9", fg: "#B6449B", icon: "🎨" },
  Computer: { bg: "#E9F6FA", fg: "#1590A8", icon: "💻" },
};
function subjectStyle(subject) {
  return SUBJECT_STYLE[subject] || { bg: "#EEF1F4", fg: "#3A4250", icon: "📘" };
}

const SECTIONS = ["9A", "9B", "9C", "9E", "9F"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SCHOOL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIOD_COUNT = 9; // 7 periods, lunch, 2 more periods
const LUNCH_AFTER_INDEX = 6; // lunch shown after period 7 (index 6)

function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}
function dayNameFor(dateStr) {
  return DAYS[new Date(dateStr + "T00:00:00").getDay()];
}
function dayIndexFor(dateStr) {
  const dn = dayNameFor(dateStr);
  const i = SCHOOL_DAYS.indexOf(dn);
  return i; // -1 on Sunday
}

// ---------------------------------------------------------------
// Randomized, collision-free master timetable generator.
// Old version used (period*5 + section + day*3) % 10, which only ever
// takes 2 possible values as period changes (since period*5 mod 10 is
// just 0 or 5) — that's why every teacher's day looked like a rigid
// Free / Class / Free / Class repeat. This version deals out a fresh,
// shuffled set of 5 teachers (out of 10) to the 5 sections for every
// single period, seeded off the date so it's random-*looking* but
// still stable if the page reloads on the same day.
// ---------------------------------------------------------------
function seedFromString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffledIndices(n, rng) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
const _timetableCache = new Map();
function getDayTimetable(dateStr) {
  const dayIdx = dayIndexFor(dateStr);
  if (dayIdx < 0) return null;
  if (_timetableCache.has(dateStr)) return _timetableCache.get(dateStr);
  const rng = mulberry32(seedFromString("laas-timetable-" + dateStr));
  // teacherAtSlot[period][sectionIdx] = index into TEACHERS (5 distinct per period)
  const teacherAtSlot = [];
  for (let p = 0; p < PERIOD_COUNT; p++) {
    teacherAtSlot.push(shuffledIndices(TEACHERS.length, rng).slice(0, SECTIONS.length));
  }
  const tt = { teacherAtSlot };
  _timetableCache.set(dateStr, tt);
  return tt;
}
function teacherForSlot(dateStr, periodIdx, section) {
  const tt = getDayTimetable(dateStr);
  if (!tt) return null;
  const sectionIdx = SECTIONS.indexOf(section);
  const idx = tt.teacherAtSlot[periodIdx][sectionIdx];
  return TEACHERS[idx];
}
// Which section (if any) a teacher is teaching at a given period — at most one, by construction.
function sectionForTeacherSlot(dateStr, periodIdx, teacherName) {
  const tt = getDayTimetable(dateStr);
  if (!tt) return null;
  const teacherIdx = TEACHERS.findIndex((t) => t.name === teacherName);
  const slotIdx = tt.teacherAtSlot[periodIdx].indexOf(teacherIdx);
  return slotIdx === -1 ? null : SECTIONS[slotIdx];
}

const FIRST_NAMES = [
  "Aarav", "Bhavana", "Chetan", "Divya", "Eshwar", "Farida", "Gowtham", "Harini",
  "Ishaan", "Jahnavi", "Kiran", "Lasya", "Manoj", "Nikhila", "Omkar", "Priya",
  "Ravi", "Sneha", "Tejas", "Yamini", "Varun", "Zoya", "Anand", "Bindu",
];
const LAST_NAMES = [
  "Reddy", "Rao", "Varma", "Sankar", "Naidu", "Sultana", "Raju", "Prasad",
  "Chowdary", "Devi", "Babu", "Kumar", "Rani", "Sastry", "Krishna", "Lakshmi",
];
function rosterFor(section) {
  const si = SECTIONS.indexOf(section);
  const list = [];
  for (let r = 1; r <= 15; r++) {
    const fn = FIRST_NAMES[(r * 7 + si * 11) % FIRST_NAMES.length];
    const ln = LAST_NAMES[(r * 5 + si * 13) % LAST_NAMES.length];
    list.push({ roll: r, name: `${fn} ${ln}` });
  }
  return list;
}
const STUDENTS_BY_SECTION = Object.fromEntries(SECTIONS.map((s) => [s, rosterFor(s)]));

const emptyDay = () => ({
  periods: {}, // periods[section][period] = { roll: 'P'|'A' }
  absentTeachers: [],
  overrides: {}, // overrides[teacherName][period] = 'free' | 'busy'
  offers: [], // { id, section, period, absentTeacher, subject, candidates:[], declinedBy:[], assignedTo:null }
});

async function loadDay(dateStr) {
  try {
    const res = await window.storage.get("day:" + dateStr, true);
    return res ? JSON.parse(res.value) : emptyDay();
  } catch {
    return emptyDay();
  }
}
async function saveDay(dateStr, data) {
  try {
    await window.storage.set("day:" + dateStr, JSON.stringify(data), true);
  } catch (e) {
    console.error("save failed", e);
  }
}

// Effective status for a teacher at a period, honoring self-reported overrides.
function effectiveStatus(dateStr, periodIdx, teacherName, dayRecord) {
  const override = dayRecord.overrides?.[teacherName]?.[periodIdx];
  if (override) return override; // 'free' | 'busy'
  const section = sectionForTeacherSlot(dateStr, periodIdx, teacherName);
  return section ? "busy" : "free";
}

function freeTeacherCandidates(dateStr, periodIdx, dayRecord, excludeName) {
  const absentSet = new Set(dayRecord.absentTeachers || []);
  return TEACHERS.filter((t) => {
    if (t.name === excludeName) return false;
    if (absentSet.has(t.name)) return false;
    return effectiveStatus(dateStr, periodIdx, t.name, dayRecord) === "free";
  }).map((t) => t.name);
}

function makeOfferId(section, periodIdx) {
  return `${section}-p${periodIdx}`;
}

// Build (or refresh) substitute offers for every period a newly-absent teacher was due to teach.
function generateOffersForAbsence(dateStr, dayRecord, teacherName) {
  const rec = JSON.parse(JSON.stringify(dayRecord));
  rec.offers = rec.offers || [];
  for (let p = 0; p < PERIOD_COUNT; p++) {
    const section = sectionForTeacherSlot(dateStr, p, teacherName);
    if (!section) continue;
    const id = makeOfferId(section, p);
    if (rec.offers.some((o) => o.id === id)) continue; // already exists
    const candidates = freeTeacherCandidates(dateStr, p, rec, teacherName);
    const teacherObj = TEACHERS.find((t) => t.name === teacherName);
    rec.offers.push({
      id,
      section,
      period: p,
      absentTeacher: teacherName,
      subject: teacherObj?.subject || "",
      candidates,
      declinedBy: [],
      assignedTo: null,
    });
  }
  return rec;
}
function removeOffersForTeacher(dayRecord, teacherName) {
  const rec = JSON.parse(JSON.stringify(dayRecord));
  rec.offers = (rec.offers || []).filter((o) => o.absentTeacher !== teacherName);
  return rec;
}

const COLORS = {
  bg: "#F4F6F8",
  card: "#FFFFFF",
  navy: "#1E3A5F",
  navyDeep: "#152A45",
  marigold: "#E8A33D",
  teal: "#2E7D6B",
  brick: "#B85C4A",
  violet: "#6A4FC2",
  ink: "#24272C",
  line: "#DEE3E8",
  muted: "#6B7480",
};

function Pill({ children, tone = "muted" }) {
  const map = {
    muted: { bg: "#E9ECEF", fg: COLORS.muted },
    teal: { bg: "#E4F3EF", fg: COLORS.teal },
    brick: { bg: "#FBEAE6", fg: COLORS.brick },
    marigold: { bg: "#FCF0DC", fg: "#9C6A16" },
    navy: { bg: "#E7ECF2", fg: COLORS.navy },
    violet: { bg: "#F1EEFB", fg: COLORS.violet },
  };
  const c = map[tone];
  return (
    <span
      style={{
        background: c.bg, color: c.fg, fontFamily: "Inter, sans-serif",
        fontWeight: 600, fontSize: 12, padding: "3px 9px", borderRadius: 999, letterSpacing: 0.2,
      }}
    >
      {children}
    </span>
  );
}
function Card({ children, style }) {
  return (
    <div className="laas-card" style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 14, padding: 18, boxShadow: "0 2px 8px rgba(21,42,69,0.05)", ...style }}>
      {children}
    </div>
  );
}
function SectionTitle({ eyebrow, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {eyebrow && (
        <div style={{
          fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fontWeight: 600, letterSpacing: 1.2,
          color: COLORS.muted, textTransform: "uppercase", marginBottom: 4,
        }}>
          {eyebrow}
        </div>
      )}
      <h2 style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 22, color: COLORS.navyDeep, margin: 0 }}>
        {children}
      </h2>
    </div>
  );
}

// Recurring "timetable strip" — periods 1-7, LUNCH, periods 8-9.
function PeriodStrip({ dateStr, section, highlight, dayRecord, onPick, forTeacher }) {
  const dayIdx = dayIndexFor(dateStr);
  if (dayIdx < 0) {
    return <div style={{ fontFamily: "Inter, sans-serif", color: COLORS.muted, fontSize: 14 }}>No periods (Sunday).</div>;
  }
  const blocks = [];
  for (let p = 0; p < PERIOD_COUNT; p++) {
    let label, teacherName, subject, isFreeForTeacher = false;
    if (forTeacher) {
      const sec = sectionForTeacherSlot(dateStr, p, forTeacher);
      const status = effectiveStatus(dateStr, p, forTeacher, dayRecord || emptyDay());
      isFreeForTeacher = status === "free";
      label = isFreeForTeacher ? "Free" : sec;
      subject = isFreeForTeacher ? "" : TEACHERS.find((t) => t.name === forTeacher)?.subject;
    } else {
      const t = teacherForSlot(dateStr, p, section);
      teacherName = t?.name;
      subject = t?.subject;
      label = subject;
    }
    const isAbsentTeacher = teacherName && dayRecord?.absentTeachers?.includes(teacherName);
    const offer = dayRecord?.offers?.find((o) => o.period === p && o.section === section);
    const isHighlight = highlight === p;
    const subj = subjectStyle(subject);
    let bg = subj.bg, fg = subj.fg, border = COLORS.line, icon = subject ? subj.icon : "🟢";
    if (forTeacher) {
      bg = isFreeForTeacher ? "#E4F3EF" : subj.bg;
      fg = isFreeForTeacher ? COLORS.teal : subj.fg;
      icon = isFreeForTeacher ? "🟢" : subj.icon;
    } else if (isAbsentTeacher && offer?.assignedTo) {
      bg = "#E4F3EF"; fg = COLORS.teal; border = COLORS.teal;
    } else if (isAbsentTeacher) {
      bg = "#FBEAE6"; fg = COLORS.brick; border = COLORS.brick;
    }
    if (isHighlight) border = COLORS.marigold;
    blocks.push(
      <button
        key={p}
        className="laas-period"
        onClick={() => onPick && onPick(p)}
        title={forTeacher ? label : `${subject} — ${teacherName}`}
        style={{
          cursor: onPick ? "pointer" : "default", width: 78, padding: "8px 6px", borderRadius: 10,
          border: `1.5px solid ${border}`, background: bg, textAlign: "left",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: fg, fontWeight: 600, opacity: 0.75 }}>
            P{p + 1}
          </span>
          <span style={{ fontSize: 12 }}>{icon}</span>
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: fg, marginTop: 2, lineHeight: 1.2 }}>
          {label || "—"}
        </div>
      </button>
    );
    if (p === LUNCH_AFTER_INDEX) {
      blocks.push(
        <div key="lunch" style={{
          width: 60, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "IBM Plex Mono, monospace", fontSize: 10, color: COLORS.marigold, fontWeight: 700,
          background: "#FCF0DC", borderRadius: 10, letterSpacing: 0.5,
        }}>
          LUNCH
        </div>
      );
    }
  }
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{blocks}</div>;
}

function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(TEACHERS[0].name);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [section, setSection] = useState(SECTIONS[0]);
  const [roll, setRoll] = useState("");

  function tryTeacherLogin() {
    const t = TEACHERS.find((x) => x.name === selectedTeacher);
    if (t && t.pin === pin) onLogin({ role: "teacher", name: t.name, subject: t.subject });
    else setError("PIN doesn't match. Try again.");
  }
  function tryParentLogin() {
    const r = parseInt(roll, 10);
    const s = STUDENTS_BY_SECTION[section]?.find((x) => x.roll === r);
    if (s) onLogin({ role: "parent", roll: r, section, studentName: s.name });
    else setError(`No student with that roll number in ${section}.`);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(180deg, ${COLORS.navyDeep} 0%, ${COLORS.navy} 55%, ${COLORS.bg} 55%)`,
      display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 50, fontFamily: "Inter, sans-serif",
    }}>
      <div style={{ textAlign: "center", marginBottom: 26, padding: "0 24px" }}>
        <div style={{
          fontFamily: "IBM Plex Mono, monospace", fontSize: 12, letterSpacing: 2, color: "#CBD8E6",
          textTransform: "uppercase", marginBottom: 8,
        }}>
          Sections 9A · 9B · 9C · 9E · 9F
        </div>
        <h1 style={{ fontFamily: "Fraunces, serif", fontWeight: 700, fontSize: 30, color: "#fff", margin: 0 }}>
          Little Angels School<br />Attendance System
        </h1>
      </div>

      <Card style={{ width: 340, maxWidth: "90vw" }}>
        {!mode && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              ["teacher", "I'm a Teacher", COLORS.navy],
              ["admin", "I'm Admin / Vice-Principal", COLORS.teal],
              ["parent", "I'm a Parent", COLORS.marigold],
            ].map(([key, label, color]) => (
              <button key={key} onClick={() => { setError(""); setMode(key); }} style={{
                padding: "13px 14px", borderRadius: 10, border: "none", background: color, color: "#fff",
                fontWeight: 600, fontSize: 15, cursor: "pointer",
              }}>
                {label}
              </button>
            ))}
          </div>
        )}

        {mode === "teacher" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>Your name</label>
            <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}` }}>
              {TEACHERS.map((t) => (
                <option key={t.name} value={t.name}>{t.name} — {t.subject}</option>
              ))}
            </select>
            <label style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>PIN</label>
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="4-digit PIN"
              style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
            {error && <div style={{ color: COLORS.brick, fontSize: 13 }}>{error}</div>}
            <button onClick={tryTeacherLogin} style={{
              padding: 12, borderRadius: 8, border: "none", background: COLORS.navy, color: "#fff",
              fontWeight: 600, cursor: "pointer",
            }}>Log in</button>
            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}>← back</button>
            <div style={{ fontSize: 11, color: COLORS.muted }}>Prototype tip: PINs are 1001–1010 in teacher list order.</div>
            <div style={{ fontSize: 11, color: COLORS.muted, background: "#FCF0DC", padding: 8, borderRadius: 8 }}>
              Keep the app open after logging in — that's how you'll hear the substitute alert sound and get asked to accept a free period.
            </div>
          </div>
        )}

        {mode === "admin" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, color: COLORS.muted }}>Admin access — no PIN needed in this prototype.</div>
            <button onClick={() => onLogin({ role: "admin", name: "Admin" })} style={{
              padding: 12, borderRadius: 8, border: "none", background: COLORS.teal, color: "#fff",
              fontWeight: 600, cursor: "pointer",
            }}>Enter Admin Dashboard</button>
            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}>← back</button>
          </div>
        )}

        {mode === "parent" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>Section</label>
            <select value={section} onChange={(e) => setSection(e.target.value)}
              style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}` }}>
              {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <label style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>Child's roll number</label>
            <input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="e.g. 7"
              style={{ padding: 10, borderRadius: 8, border: `1px solid ${COLORS.line}` }} />
            {error && <div style={{ color: COLORS.brick, fontSize: 13 }}>{error}</div>}
            <button onClick={tryParentLogin} style={{
              padding: 12, borderRadius: 8, border: "none", background: COLORS.marigold, color: "#fff",
              fontWeight: 600, cursor: "pointer",
            }}>View attendance</button>
            <button onClick={() => setMode(null)} style={{ background: "none", border: "none", color: COLORS.muted, cursor: "pointer" }}>← back</button>
          </div>
        )}
      </Card>
      <div style={{ color: "#8FA3B8", fontSize: 12, marginTop: 20, fontFamily: "Inter, sans-serif" }}>
        Data is shared across everyone using this app (a demo school-wide store).
      </div>
    </div>
  );
}

function TopBar({ user, onLogout }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "14px 20px", background: COLORS.navyDeep, color: "#fff",
    }}>
      <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 17 }}>Little Angels · Attendance</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontSize: 13, color: "#CBD8E6", fontFamily: "Inter, sans-serif" }}>
          {user.role === "teacher" && `${user.name} · ${user.subject}`}
          {user.role === "admin" && "Admin dashboard"}
          {user.role === "parent" && `Parent · ${user.section} Roll ${user.roll}`}
        </span>
        <button onClick={onLogout} style={{
          background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", borderRadius: 7,
          padding: "6px 10px", fontSize: 12, cursor: "pointer",
        }}>Log out</button>
      </div>
    </div>
  );
}

// Modal shown to a free teacher when offered a substitute slot — with sound.
function OfferModal({ offer, onRespond }) {
  useEffect(() => { playAlertSound(); }, [offer.id]);
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(21,42,69,0.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 50, padding: 20,
    }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 24, width: 360, maxWidth: "92vw", textAlign: "center" }}>
        <div style={{ fontSize: 34, marginBottom: 6 }}>🔔</div>
        <div style={{ fontFamily: "Fraunces, serif", fontWeight: 600, fontSize: 20, color: COLORS.navyDeep, marginBottom: 6 }}>
          Substitute needed
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.ink, marginBottom: 4 }}>
          <strong>Period {offer.period + 1}</strong> · Section {offer.section} · {offer.subject}
        </div>
        <div style={{ fontFamily: "Inter, sans-serif", fontSize: 13, color: COLORS.muted, marginBottom: 18 }}>
          {offer.absentTeacher} is absent today. You're marked free this period — take it?
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => onRespond(false)} style={{
            flex: 1, padding: 12, borderRadius: 9, border: `1.5px solid ${COLORS.line}`, background: "#fff",
            color: COLORS.muted, fontWeight: 600, cursor: "pointer",
          }}>No</button>
          <button onClick={() => onRespond(true)} style={{
            flex: 1, padding: 12, borderRadius: 9, border: "none", background: COLORS.teal, color: "#fff",
            fontWeight: 600, cursor: "pointer",
          }}>Yes, I'll take it</button>
        </div>
      </div>
    </div>
  );
}

function TeacherView({ user }) {
  const [date] = useState(todayStr());
  const [dayRecord, setDayRecord] = useState(null);
  const [activePeriod, setActivePeriod] = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [marks, setMarks] = useState({});
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");
  const seenOfferIds = useRef(new Set());
  const [offerQueue, setOfferQueue] = useState([]);

  const refresh = useCallback(async () => setDayRecord(await loadDay(date)), [date]);
  useEffect(() => { refresh(); }, [refresh]);

  // Poll for substitute offers addressed to this teacher.
  useEffect(() => {
    const id = setInterval(async () => {
      const rec = await loadDay(date);
      setDayRecord((prev) => (JSON.stringify(prev) === JSON.stringify(rec) ? prev : rec));
      const mine = (rec.offers || []).filter(
        (o) =>
          o.candidates.includes(user.name) &&
          !o.declinedBy.includes(user.name) &&
          !o.assignedTo &&
          o.absentTeacher !== user.name
      );
      const fresh = mine.filter((o) => !seenOfferIds.current.has(o.id));
      if (fresh.length > 0) {
        fresh.forEach((o) => seenOfferIds.current.add(o.id));
        setOfferQueue((q) => [...q, ...fresh]);
      }
    }, 4000);
    return () => clearInterval(id);
  }, [date, user.name]);

  const subjects9 = useMemo(() => Array.from({ length: PERIOD_COUNT }, (_, p) => p), []);

  async function respondToOffer(offer, accept) {
    setOfferQueue((q) => q.filter((o) => o.id !== offer.id));
    const latest = await loadDay(date);
    const rec = { ...latest, offers: [...(latest.offers || [])] };
    const idx = rec.offers.findIndex((o) => o.id === offer.id);
    if (idx === -1) return;
    if (rec.offers[idx].assignedTo) {
      setToast("That slot was already taken by someone else.");
      setDayRecord(rec);
      setTimeout(() => setToast(""), 3000);
      return;
    }
    if (accept) {
      rec.offers[idx] = { ...rec.offers[idx], assignedTo: user.name };
      setToast(`You're covering Period ${offer.period + 1} for ${offer.section}.`);
    } else {
      rec.offers[idx] = { ...rec.offers[idx], declinedBy: [...rec.offers[idx].declinedBy, user.name] };
    }
    await saveDay(date, rec);
    setDayRecord(rec);
    setTimeout(() => setToast(""), 3000);
  }

  function openPeriod(p, section) {
    setActivePeriod(p);
    setActiveSection(section);
    const existing = dayRecord?.periods?.[section]?.[p] || {};
    const init = {};
    STUDENTS_BY_SECTION[section].forEach((s) => (init[s.roll] = existing[s.roll] || "P"));
    setMarks(init);
    setSaved(false);
  }

  async function saveAttendance() {
    const rec = { ...dayRecord };
    rec.periods = { ...rec.periods };
    rec.periods[activeSection] = { ...(rec.periods[activeSection] || {}), [activePeriod]: marks };
    await saveDay(date, rec);
    setDayRecord(rec);
    setSaved(true);
  }

  async function toggleAbsentSelf() {
    let rec = { ...dayRecord };
    const set = new Set(rec.absentTeachers || []);
    if (set.has(user.name)) {
      set.delete(user.name);
      rec.absentTeachers = Array.from(set);
      rec = removeOffersForTeacher(rec, user.name);
    } else {
      set.add(user.name);
      rec.absentTeachers = Array.from(set);
      rec = generateOffersForAbsence(date, rec, user.name);
    }
    await saveDay(date, rec);
    setDayRecord(rec);
  }

  async function toggleMyPeriodOverride(p) {
    const current = effectiveStatus(date, p, user.name, dayRecord);
    const next = current === "free" ? "busy" : "free";
    const rec = { ...dayRecord, overrides: { ...dayRecord.overrides } };
    rec.overrides[user.name] = { ...(rec.overrides[user.name] || {}), [p]: next };
    await saveDay(date, rec);
    setDayRecord(rec);
  }

  if (!dayRecord) return <div style={{ padding: 24 }}>Loading…</div>;

  const isAbsentToday = dayRecord.absentTeachers?.includes(user.name);
  const myOfferAssignments = (dayRecord.offers || []).filter((o) => o.assignedTo === user.name);

  return (
    <div style={{ padding: "20px", maxWidth: 680, margin: "0 auto" }}>
      {offerQueue[0] && (
        <OfferModal offer={offerQueue[0]} onRespond={(yes) => respondToOffer(offerQueue[0], yes)} />
      )}
      {toast && (
        <div style={{
          position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: COLORS.navyDeep,
          color: "#fff", padding: "10px 18px", borderRadius: 10, fontFamily: "Inter, sans-serif", fontSize: 13, zIndex: 60,
        }}>{toast}</div>
      )}

      <SectionTitle eyebrow={date}>My timetable & free periods</SectionTitle>
      <Card style={{ marginBottom: 16 }}>
        <PeriodStrip dateStr={date} dayRecord={dayRecord} forTeacher={user.name} highlight={null}
          onPick={(p) => {
            const sec = sectionForTeacherSlot(date, p, user.name);
            if (sec) openPeriod(p, sec);
          }}
        />
        <div style={{ marginTop: 12, fontSize: 13, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
          Tap a teaching period to mark attendance. Use the switch below to correct any period the
          timetable has wrong — the app uses this to know who's really free for substitution.
        </div>
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {subjects9.map((p) => {
            const status = effectiveStatus(date, p, user.name, dayRecord);
            return (
              <button key={p} onClick={() => toggleMyPeriodOverride(p)} style={{
                fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: 600, padding: "5px 8px", borderRadius: 7,
                border: `1px solid ${COLORS.line}`, background: "#F7F8FA", color: COLORS.muted, cursor: "pointer",
              }}>
                P{p + 1}: {status === "free" ? "Free" : "Busy"} ↺
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
            Marking yourself absent today
          </div>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
            Free teachers will get a sound alert and can accept your periods.
          </div>
        </div>
        <button onClick={toggleAbsentSelf} style={{
          padding: "9px 14px", borderRadius: 8, border: "none", fontWeight: 600, cursor: "pointer",
          background: isAbsentToday ? COLORS.brick : "#EEF1F4", color: isAbsentToday ? "#fff" : COLORS.navy,
        }}>
          {isAbsentToday ? "Marked Absent — Undo" : "I'm Absent Today"}
        </button>
      </Card>

      {myOfferAssignments.length > 0 && (
        <Card style={{ marginBottom: 16, borderColor: COLORS.teal }}>
          <SectionTitle eyebrow="Accepted">Substitute periods you're covering</SectionTitle>
          {myOfferAssignments.map((o) => (
            <div key={o.id} style={{ fontFamily: "Inter, sans-serif", fontSize: 14, marginBottom: 4 }}>
              Period {o.period + 1} · {o.section} · {o.subject} (for {o.absentTeacher})
            </div>
          ))}
        </Card>
      )}

      {activePeriod !== null && activeSection && (
        <Card>
          <SectionTitle eyebrow={`Period ${activePeriod + 1} · ${activeSection}`}>Mark attendance</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STUDENTS_BY_SECTION[activeSection].map((s) => (
              <div key={s.roll} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 10px", borderRadius: 8, background: "#F7F8FA",
              }}>
                <span style={{ fontFamily: "Inter, sans-serif", fontSize: 14 }}>
                  <span style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.muted, marginRight: 8 }}>
                    {String(s.roll).padStart(2, "0")}
                  </span>
                  {s.name}
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {["P", "A"].map((v) => (
                    <button key={v} onClick={() => setMarks((m) => ({ ...m, [s.roll]: v }))} style={{
                      width: 34, height: 30, borderRadius: 7, border: "none", fontWeight: 700, cursor: "pointer",
                      background: marks[s.roll] === v ? (v === "P" ? COLORS.teal : COLORS.brick) : "#E4E7EB",
                      color: marks[s.roll] === v ? "#fff" : COLORS.muted,
                    }}>{v}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveAttendance} style={{
            marginTop: 14, width: "100%", padding: 12, borderRadius: 8, border: "none",
            background: COLORS.navy, color: "#fff", fontWeight: 600, cursor: "pointer",
          }}>Save attendance</button>
          {saved && <div style={{ marginTop: 8, color: COLORS.teal, fontSize: 13, fontFamily: "Inter, sans-serif" }}>Saved for Period {activePeriod + 1}.</div>}
        </Card>
      )}
    </div>
  );
}

function AdminView() {
  const [date] = useState(todayStr());
  const [dayRecord, setDayRecord] = useState(null);
  const [section, setSection] = useState(SECTIONS[0]);
  const [allTimeStats, setAllTimeStats] = useState(null);

  const refresh = useCallback(async () => setDayRecord(await loadDay(date)), [date]);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        const listed = await window.storage.list("day:", true);
        const keys = listed?.keys || [];
        let present = 0, total = 0;
        for (const k of keys) {
          const res = await window.storage.get(k, true);
          if (!res) continue;
          const rec = JSON.parse(res.value);
          Object.values(rec.periods || {}).forEach((sectionPeriods) => {
            Object.values(sectionPeriods).forEach((periodMarks) => {
              Object.values(periodMarks).forEach((v) => { total++; if (v === "P") present++; });
            });
          });
        }
        setAllTimeStats({ present, total, days: keys.length });
      } catch { setAllTimeStats({ present: 0, total: 0, days: 0 }); }
    })();
  }, [dayRecord]);

  async function manualAssign(offerId, subName) {
    const rec = { ...dayRecord, offers: [...(dayRecord.offers || [])] };
    const idx = rec.offers.findIndex((o) => o.id === offerId);
    if (idx === -1) return;
    rec.offers[idx] = { ...rec.offers[idx], assignedTo: subName || null };
    await saveDay(date, rec);
    setDayRecord(rec);
  }

  if (!dayRecord) return <div style={{ padding: 24 }}>Loading…</div>;

  const absentTeachers = dayRecord.absentTeachers || [];
  const allGaps = (dayRecord.offers || []).slice().sort((a, b) => a.period - b.period);
  const periodsMarkedCount = Object.values(dayRecord.periods || {}).reduce(
    (sum, sec) => sum + Object.keys(sec).length, 0
  );
  const overallPct = allTimeStats && allTimeStats.total > 0 ? Math.round((allTimeStats.present / allTimeStats.total) * 100) : null;

  return (
    <div style={{ padding: 20, maxWidth: 780, margin: "0 auto" }}>
      <SectionTitle eyebrow={date}>Today's overview — all sections</SectionTitle>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <Card style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>Class-periods marked</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: COLORS.navyDeep }}>{periodsMarkedCount}</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>Absent teachers today</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: COLORS.brick }}>{absentTeachers.length}</div>
        </Card>
        <Card style={{ flex: 1, minWidth: 160 }}>
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>Overall attendance %</div>
          <div style={{ fontFamily: "Fraunces, serif", fontSize: 28, color: COLORS.teal }}>
            {overallPct !== null ? `${overallPct}%` : "—"}
          </div>
        </Card>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <SectionTitle eyebrow="Class timetable">Pick a section</SectionTitle>
        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {SECTIONS.map((s) => (
            <button key={s} onClick={() => setSection(s)} style={{
              padding: "6px 12px", borderRadius: 999, border: `1.5px solid ${s === section ? COLORS.navy : COLORS.line}`,
              background: s === section ? COLORS.navy : "#fff", color: s === section ? "#fff" : COLORS.navy,
              fontWeight: 600, fontFamily: "Inter, sans-serif", fontSize: 13, cursor: "pointer",
            }}>{s}</button>
          ))}
        </div>
        <PeriodStrip dateStr={date} section={section} dayRecord={dayRecord} />
      </Card>

      <Card>
        <SectionTitle eyebrow="Substitute Finder">Live coverage across all sections</SectionTitle>
        {allGaps.length === 0 && (
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14, color: COLORS.muted }}>
            No gaps — no teacher is marked absent today.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {allGaps.map((g) => {
            const stillCandidates = g.candidates.filter((c) => !g.declinedBy.includes(c));
            return (
              <div key={g.id} style={{
                border: `1px solid ${g.assignedTo ? COLORS.teal : COLORS.brick}`, borderRadius: 10, padding: 12,
                background: g.assignedTo ? "#F1FAF7" : "#FDF3F1",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontFamily: "Inter, sans-serif", fontSize: 14 }}>
                    <strong>Period {g.period + 1}</strong> · {g.section} · {g.subject} · absent: {g.absentTeacher}
                  </div>
                  <Pill tone={g.assignedTo ? "teal" : "brick"}>
                    {g.assignedTo ? `Covered by ${g.assignedTo}` : "Needs substitute"}
                  </Pill>
                </div>
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
                    {g.assignedTo ? "Reassign to:" : "Sent alert to free teachers — or assign directly:"}
                  </span>
                  <select value={g.assignedTo || ""} onChange={(e) => manualAssign(g.id, e.target.value)}
                    style={{ padding: "6px 8px", borderRadius: 7, border: `1px solid ${COLORS.line}` }}>
                    <option value="">— none —</option>
                    {g.candidates.map((name) => (
                      <option key={name} value={name}>
                        {name} {g.declinedBy.includes(name) ? "(declined)" : ""}
                      </option>
                    ))}
                  </select>
                  {stillCandidates.length === 0 && !g.assignedTo && (
                    <span style={{ fontSize: 12, color: COLORS.brick }}>Everyone free has declined — pick manually.</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 10, fontSize: 11, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
          Free/busy comes from each teacher's own timetable, adjusted by any self-reported updates they make
          in "My timetable & free periods" — so this reflects real availability, not just the printed schedule.
        </div>
      </Card>
    </div>
  );
}

function ParentView({ user }) {
  const [stats, setStats] = useState(null);
  const [recentDays, setRecentDays] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const listed = await window.storage.list("day:", true);
        const keys = (listed?.keys || []).sort().reverse();
        let present = 0, total = 0;
        const rows = [];
        for (const k of keys) {
          const res = await window.storage.get(k, true);
          if (!res) continue;
          const rec = JSON.parse(res.value);
          const sectionPeriods = rec.periods?.[user.section] || {};
          let dayPresent = 0, dayTotal = 0;
          Object.values(sectionPeriods).forEach((periodMarks) => {
            const v = periodMarks[user.roll];
            if (v) { dayTotal++; total++; if (v === "P") { dayPresent++; present++; } }
          });
          if (dayTotal > 0) rows.push({ date: k.replace("day:", ""), dayPresent, dayTotal });
        }
        setStats({ present, total });
        setRecentDays(rows.slice(0, 10));
      } catch { setStats({ present: 0, total: 0 }); }
    })();
  }, [user.roll, user.section]);

  const pct = stats && stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : null;

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <SectionTitle eyebrow={`${user.section} · Roll ${user.roll}`}>{user.studentName}</SectionTitle>
      <Card style={{ marginBottom: 16, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>Overall attendance</div>
        <div style={{ fontFamily: "Fraunces, serif", fontSize: 44, color: COLORS.navyDeep }}>
          {pct !== null ? `${pct}%` : "No data yet"}
        </div>
        {stats && stats.total > 0 && (
          <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>
            {stats.present} of {stats.total} periods present
          </div>
        )}
      </Card>
      <Card>
        <SectionTitle eyebrow="Recent days">Daily record</SectionTitle>
        {recentDays.length === 0 && (
          <div style={{ fontSize: 13, color: COLORS.muted, fontFamily: "Inter, sans-serif" }}>No attendance recorded yet.</div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recentDays.map((r) => {
            const rowPct = Math.round((r.dayPresent / r.dayTotal) * 100);
            return (
              <div key={r.date} style={{
                display: "flex", justifyContent: "space-between", fontFamily: "Inter, sans-serif", fontSize: 13,
                padding: "7px 10px", background: "#F7F8FA", borderRadius: 7,
              }}>
                <span style={{ fontFamily: "IBM Plex Mono, monospace", color: COLORS.muted }}>{r.date}</span>
                <span>{r.dayPresent}/{r.dayTotal} periods</span>
                <Pill tone={rowPct >= 75 ? "teal" : "brick"}>{rowPct}%</Pill>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

export default function App() {
  useFonts();
  useAppStyles();
  const [user, setUser] = useState(null);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg }}>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <>
          <TopBar user={user} onLogout={() => setUser(null)} />
          {user.role === "teacher" && <TeacherView user={user} />}
          {user.role === "admin" && <AdminView />}
          {user.role === "parent" && <ParentView user={user} />}
        </>
      )}
    </div>
  );
}
