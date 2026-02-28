import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";

/**
 * v1.2.1 + Build time (部署時間)
 * ✅ 補強：
 * 1) 已收費：打勾→不打勾 需確認
 * 2) 歷史清單：DELETE / UPDATE（編輯）
 * 3) 人員收費表格：標頭 sticky 固定
 * 4) 人員收費 / 用球紀錄 / 歷史清單：可收折
 * 5) 小計/總計：千分位
 * 6) 日期可點擊修改（人員收費/用球紀錄同步）
 * 7) 分類費用：textbox 前保留分類名稱
 * 8) 歷史清單：顯示各分類金額 + 各分類人數
 */
const VERSION_NAME = "v1.2.1";
const VERSION_TIME = new Date().toLocaleString("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const STORAGE_KEY = "badminton_lineup_local_v8";

// ===== 預設休息區名單（未指定分類則預設：臨打）=====
const DEFAULT_ROSTER = [
  { name: "菜脯", gender: "男" },
  { name: "冠皓", gender: "男" },
  { name: "竣立", gender: "男" },
  { name: "阿承", gender: "男" },
  { name: "靜儀", gender: "女" },
  { name: "阿宏", gender: "男" },
  { name: "小禪", gender: "女" },
  { name: "嘉玲", gender: "女" },
  { name: "小瑋", gender: "男" },
  { name: "子唐", gender: "女" },
  { name: "喬納森", gender: "男" },
  { name: "小樹", gender: "女" },
  { name: "大衛", gender: "男" },
  { name: "Henry", gender: "男" },
  { name: "Jacky", gender: "男" },
  { name: "俊佑", gender: "男" },
  { name: "柏鈞", gender: "男" },
  { name: "修車", gender: "男" },
  { name: "阿原", gender: "男" },
  { name: "小逄", gender: "女" },
  { name: "Kira", gender: "女" },
  { name: "欣汝", gender: "女" },
  { name: "阿采", gender: "男" },
  { name: "緯緯", gender: "男" },
  { name: "阿得", gender: "男" },
  { name: "宗霖", gender: "男" },
  { name: "如俞", gender: "女" },
  { name: "呈呈", gender: "女" },
  { name: "W", gender: "男" },
];

async function sha256Hex(s) {
  const enc = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function emptySlots(groups, slots) {
  return Array.from({ length: groups }, () =>
    Array.from({ length: slots }, () => "")
  );
}

// ✅ 最多 7 個字元，其餘用 …（支援中英混合）
function shortName(name, max = 7) {
  const arr = Array.from(String(name || ""));
  if (arr.length <= max) return arr.join("");
  return arr.slice(0, max).join("") + "…";
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function genderBg(g) {
  if (g === "男") return "#DCEBFF"; // 粉藍底
  if (g === "女") return "#FFE0EF"; // 粉紅底
  return "#EEF2F7";
}

function isAllEmpty(arr) {
  return arr.every((x) => !x);
}

function ensureCourtTimer(court) {
  if (court.startTs === 0 && !isAllEmpty(court.slots))
    court.startTs = Date.now();
  if (court.startTs !== 0 && isAllEmpty(court.slots)) court.startTs = 0;
}

function removeEverywhere(next, id) {
  next.bench = next.bench.filter((x) => x !== id);
  next.queues = next.queues.map((g) => g.map((x) => (x === id ? "" : x)));

  next.courts = next.courts.map((c) => {
    const slots = c.slots.map((x) => (x === id ? "" : x));
    return {
      ...c,
      slots,
      startTs: isAllEmpty(slots) ? 0 : c.startTs,
    };
  });
}

// ✅ 防止重複塞回休息區（修正下場後短暫重複顯示）
function benchPushFront(next, pid) {
  if (!pid) return;
  next.bench = next.bench.filter((x) => x !== pid);
  next.bench.unshift(pid);
}

function locatePlayer(st, id) {
  if (!id) return null;

  if (st.bench.includes(id)) return { type: "bench" };

  for (let gi = 0; gi < 4; gi++) {
    for (let si = 0; si < 4; si++) {
      if (st.queues?.[gi]?.[si] === id) return { type: "queue", gi, si };
    }
  }

  for (let ci = 0; ci < 4; ci++) {
    for (let si = 0; si < 4; si++) {
      if (st.courts?.[ci]?.slots?.[si] === id)
        return { type: "court", ci, si };
    }
  }

  return null;
}

function sameFixedSlot(a, b) {
  if (!a || !b) return false;
  if (a.type !== b.type) return false;
  if (a.type === "queue") return a.gi === b.gi && a.si === b.si;
  if (a.type === "court") return a.ci === b.ci && a.si === b.si;
  return false;
}

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function formatDateYMD(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${dd}`;
}

function isValidYMD(s) {
  const t = String(s || "").trim();
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(t)) return false;
  const [yy, mm, dd] = t.split("/").map((x) => Number(x));
  if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd))
    return false;
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  return true;
}

function fmtMoney(n) {
  const v = Number(n);
  const safe = Number.isFinite(v) ? v : 0;
  return new Intl.NumberFormat("zh-TW").format(safe);
}

/** ===== 依性別→名稱排序（女先男後，空位最後） ===== */
function genderOrder(g) {
  return g === "女" ? 0 : 1;
}
function comparePlayers(a, b) {
  const ga = genderOrder(a?.gender);
  const gb = genderOrder(b?.gender);
  if (ga !== gb) return ga - gb;
  const na = String(a?.name ?? "");
  const nb = String(b?.name ?? "");
  return na.localeCompare(nb, "zh-TW", { numeric: true, sensitivity: "base" });
}
function sortIdsFilledFirst(ids, players, fixedLen = null) {
  const filled = ids.filter(Boolean).filter((id) => players[id]);
  filled.sort((x, y) => comparePlayers(players[x], players[y]));
  if (fixedLen == null) return filled;
  const empties = Array.from(
    { length: Math.max(0, fixedLen - filled.length) },
    () => ""
  );
  return [...filled, ...empties].slice(0, fixedLen);
}
function sortAllBlocks(st) {
  const next = st;
  next.bench = sortIdsFilledFirst(next.bench, next.players, null);
  next.queues = next.queues.map((g) => sortIdsFilledFirst(g, next.players, 4));
  next.courts = next.courts.map((c) => {
    const slots = sortIdsFilledFirst(c.slots, next.players, 4);
    return {
      ...c,
      slots,
      startTs: isAllEmpty(slots) ? 0 : c.startTs,
    };
  });
  return next;
}

/** ===== 分類處理 ===== */
function normalizeCategoryText(c) {
  const s = String(c || "").trim();
  if (s === "季繳") return "季繳";
  if (s === "臨打") return "臨打";
  if (s === "季繳請假") return "季繳請假";
  return "臨打";
}
function categoryOrder(c) {
  const v = normalizeCategoryText(c);
  if (v === "季繳") return 0;
  if (v === "季繳請假") return 1;
  return 2; // 臨打
}

/** ====== History (Undo/Redo) ====== */
const HISTORY_LIMIT = 20;
function clampStack(arr, limit = HISTORY_LIMIT) {
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}
function historyInit() {
  const present = sortAllBlocks(loadState());
  return { past: [], present, future: [] };
}
function historyReducer(h, action) {
  switch (action.type) {
    case "APPLY": {
      const prev = h.present;
      const nextRaw = action.updater ? action.updater(prev) : prev;
      if (!nextRaw || nextRaw === prev) return h;
      const next = sortAllBlocks(normalize(nextRaw));
      return {
        past: clampStack([...h.past, prev], HISTORY_LIMIT),
        present: next,
        future: [],
      };
    }
    case "UNDO": {
      if (!h.past.length) return h;
      const previous = h.past[h.past.length - 1];
      const newPast = h.past.slice(0, -1);
      const newFuture = clampStack([h.present, ...h.future], HISTORY_LIMIT);
      return { past: newPast, present: previous, future: newFuture };
    }
    case "REDO": {
      if (!h.future.length) return h;
      const nextPresent = h.future[0];
      const newFuture = h.future.slice(1);
      const newPast = clampStack([...h.past, h.present], HISTORY_LIMIT);
      return { past: newPast, present: nextPresent, future: newFuture };
    }
    case "RESET_HARD": {
      return { past: [], present: initialState(), future: [] };
    }
    default:
      return h;
  }
}

/** ===== 名單匯入/匯出 =====
 * 格式：
 * 名字/性別/分類
 * 或
 * 名字/性別/季繳請假/替補名字/替補性別
 */
function normalizeGenderText(g) {
  const s = String(g || "").trim();
  if (s === "女") return "女";
  if (s === "男") return "男";
  const low = s.toLowerCase();
  if (low === "f" || low === "female") return "女";
  if (low === "m" || low === "male") return "男";
  return "男";
}
function parseRosterText(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const rows = [];
  for (const line of lines) {
    const parts = line.split(/[\/／]/).map((x) => x.trim());
    const name = parts[0] || "";
    if (!name) continue;

    const gender = normalizeGenderText(parts[1] || "男");
    const category = normalizeCategoryText(parts[2] || "臨打");

    let subName = "";
    let subGender = "";

    if (category === "季繳請假") {
      subName = String(parts[3] || "").trim();
      subGender = subName ? normalizeGenderText(parts[4] || "男") : "";
    }

    rows.push({ name, gender, category, subName, subGender });
  }
  return rows;
}

function rosterToText(playersMap) {
  const arr = Object.values(playersMap || {});
  arr.sort((a, b) => {
    const ca = categoryOrder(a?.category);
    const cb = categoryOrder(b?.category);
    if (ca !== cb) return ca - cb;

    const ga = genderOrder(a?.origGender ?? a?.gender);
    const gb = genderOrder(b?.origGender ?? b?.gender);
    if (ga !== gb) return ga - gb;

    const na = String(a?.origName ?? a?.name ?? "");
    const nb = String(b?.origName ?? b?.name ?? "");
    return na.localeCompare(nb, "zh-TW", { numeric: true, sensitivity: "base" });
  });

  return arr
    .map((p) => {
      const category = normalizeCategoryText(p.category);
      const origName = String(p.origName ?? p.name ?? "").trim();
      const origGender = normalizeGenderText(p.origGender ?? p.gender ?? "男");

      if (category === "季繳請假") {
        const subName = String(p.subName || "").trim();
        const subGender = subName
          ? normalizeGenderText(p.subGender || "男")
          : "";
        if (subName && subGender) {
          return `${origName}/${origGender}/${category}/${subName}/${subGender}`;
        }
      }
      return `${origName}/${origGender}/${category}`;
    })
    .join("\n");
}

function buildPlayersFromRosterRows(rows) {
  const players = {};
  const bench = [];
  const payments = {}; // 已收費預設：季繳=true，其它=false

  const nameCount = new Map();

  rows.forEach((r, idx) => {
    const category = normalizeCategoryText(r.category);
    const origNameRaw = String(r.name || "").trim();
    const origGenderRaw = normalizeGenderText(r.gender || "男");

    if (!origNameRaw) return;

    // ✅ 若為季繳請假：顯示名單用替補名字/性別取代（但仍保留原始欄位給收費表）
    const effectiveNameBase =
      category === "季繳請假" && String(r.subName || "").trim()
        ? String(r.subName || "").trim()
        : origNameRaw;

    const effectiveGender =
      category === "季繳請假" && String(r.subName || "").trim()
        ? normalizeGenderText(r.subGender || "男")
        : origGenderRaw;

    // 同名處理（以「顯示名」為準）
    const c = (nameCount.get(effectiveNameBase) || 0) + 1;
    nameCount.set(effectiveNameBase, c);
    const effectiveName = c === 1 ? effectiveNameBase : `${effectiveNameBase}(${c})`;

    const id = `i${String(idx + 1).padStart(3, "0")}_${uid()}`;

    const subName = category === "季繳請假" ? String(r.subName || "").trim() : "";
    const subGender =
      category === "季繳請假" && subName
        ? normalizeGenderText(r.subGender || "男")
        : "";

    players[id] = {
      id,
      // 顯示用（休息區/上場/排隊）
      name: effectiveName,
      gender: effectiveGender,

      // 收費/匯出用（保留原始欄位）
      category,
      origName: origNameRaw,
      origGender: origGenderRaw,
      subName,
      subGender,

      games: 0,
      totalSeconds: 0,
    };

    payments[id] = category === "季繳";
    bench.push(id);
  });

  return { players, bench, payments };
}

/** ===== 初始 State ===== */
function buildDefaultPlayersAndBench() {
  const players = {};
  const bench = [];
  const payments = {};

  DEFAULT_ROSTER.forEach((r, i) => {
    const id = `d${String(i + 1).padStart(3, "0")}`;
    const name = String(r.name || "").trim();
    const gender = r.gender === "女" ? "女" : "男";
    const category = "臨打"; // 預設

    players[id] = {
      id,
      name,
      gender,

      category,
      origName: name,
      origGender: gender,
      subName: "",
      subGender: "",

      games: 0,
      totalSeconds: 0,
    };

    payments[id] = category === "季繳";
    bench.push(id);
  });

  return { players, bench, payments };
}

function initialState() {
  const { players, bench, payments } = buildDefaultPlayersAndBench();
  return {
    players,
    bench,
    queues: emptySlots(4, 4),
    courts: Array.from({ length: 4 }, (_, i) => ({
      name: `場地 ${i + 1}`,
      slots: ["", "", "", ""],
      startTs: 0,
    })),
    ui: {
      showCourts: true,
      showQueues: true,
      showBench: true,
      showDelete: false,
    },
    config: {
      // 舊：頂部顯示用
      feeText: "",
      payTo: "",

      // 收費表各分類費用
      feeSeason: "", // 季繳
      feeCasual: "", // 臨打
      feeLeave: "", // 季繳請假
    },

    payments,

    ball: {
      buckets: "",
      balls: "",
      amount: "",
    },

    // ✅ 歷史（日期 + 小計/總計 + 用球）
    // counts: { season, casual, leave }
    dailyHistory: [],
  };
}

function safeParse(raw, fallback) {
  try {
    const v = JSON.parse(raw);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function normalize(st) {
  const base = initialState();
  const next = { ...base, ...(st || {}) };

  next.players = next.players || {};
  next.bench = Array.isArray(next.bench) ? next.bench : [];

  const q = Array.isArray(next.queues) ? next.queues : emptySlots(4, 4);
  next.queues = Array.from({ length: 4 }, (_, gi) => {
    const row = q[gi] || [];
    return Array.from({ length: 4 }, (_, si) => row[si] || "");
  });

  const c = Array.isArray(next.courts) ? next.courts : base.courts;
  next.courts = Array.from({ length: 4 }, (_, ci) => {
    const court = c[ci] || base.courts[ci];
    const slots = Array.isArray(court?.slots) ? court.slots : ["", "", "", ""];
    return {
      name: String(court?.name || `場地 ${ci + 1}`),
      slots: Array.from({ length: 4 }, (_, si) => slots[si] || ""),
      startTs: typeof court?.startTs === "number" ? court.startTs : 0,
    };
  });

  for (const id of Object.keys(next.players)) {
    const p = next.players[id];
    const category = normalizeCategoryText(p?.category ?? "臨打");

    const origName = String(p?.origName ?? p?.name ?? "");
    const origGender = normalizeGenderText(p?.origGender ?? p?.gender ?? "男");

    const subName = category === "季繳請假" ? String(p?.subName ?? "") : "";
    const subGender =
      category === "季繳請假" && String(subName || "").trim()
        ? normalizeGenderText(p?.subGender ?? "男")
        : "";

    const effectiveName =
      category === "季繳請假" && String(subName || "").trim()
        ? String(p?.name ?? subName ?? "")
        : String(p?.name ?? origName ?? "");

    const effectiveGender =
      category === "季繳請假" && String(subName || "").trim()
        ? normalizeGenderText(p?.gender ?? subGender ?? "男")
        : normalizeGenderText(p?.gender ?? origGender ?? "男");

    next.players[id] = {
      id,
      name: String(effectiveName ?? ""),
      gender: effectiveGender === "女" ? "女" : "男",

      category,
      origName,
      origGender: origGender === "女" ? "女" : "男",
      subName,
      subGender,

      games: typeof p?.games === "number" ? p.games : 0,
      totalSeconds: typeof p?.totalSeconds === "number" ? p.totalSeconds : 0,
    };
  }

  const seen = new Set();
  next.bench = next.bench.filter((id) => {
    if (!next.players[id]) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  next.ui = {
    showCourts:
      typeof next.ui?.showCourts === "boolean"
        ? next.ui.showCourts
        : base.ui.showCourts,
    showQueues:
      typeof next.ui?.showQueues === "boolean"
        ? next.ui.showQueues
        : base.ui.showQueues,
    showBench:
      typeof next.ui?.showBench === "boolean"
        ? next.ui.showBench
        : base.ui.showBench,
    showDelete:
      typeof next.ui?.showDelete === "boolean"
        ? next.ui.showDelete
        : base.ui.showDelete,
  };

  next.config = {
    feeText: String(next.config?.feeText ?? base.config.feeText),
    payTo: String(next.config?.payTo ?? base.config.payTo),
    feeSeason: String(next.config?.feeSeason ?? base.config.feeSeason),
    feeCasual: String(next.config?.feeCasual ?? base.config.feeCasual),
    feeLeave: String(next.config?.feeLeave ?? base.config.feeLeave),
  };

  const pay = next.payments && typeof next.payments === "object" ? next.payments : {};
  next.payments = {};
  for (const id of Object.keys(next.players)) {
    const v = pay[id];
    if (typeof v === "boolean") next.payments[id] = v;
    else next.payments[id] = normalizeCategoryText(next.players[id]?.category) === "季繳";
  }

  next.ball = {
    buckets: String(next.ball?.buckets ?? base.ball.buckets),
    balls: String(next.ball?.balls ?? base.ball.balls),
    amount: String(next.ball?.amount ?? base.ball.amount),
  };

  next.dailyHistory = Array.isArray(next.dailyHistory) ? next.dailyHistory : [];
  next.dailyHistory = next.dailyHistory
    .map((x) => ({
      date: String(x?.date || ""),
      totalPeople: typeof x?.totalPeople === "number" ? x.totalPeople : 0,
      counts: {
        season: typeof x?.counts?.season === "number" ? x.counts.season : 0,
        casual: typeof x?.counts?.casual === "number" ? x.counts.casual : 0,
        leave: typeof x?.counts?.leave === "number" ? x.counts.leave : 0,
      },
      subtotal: {
        season: typeof x?.subtotal?.season === "number" ? x.subtotal.season : 0,
        casual: typeof x?.subtotal?.casual === "number" ? x.subtotal.casual : 0,
        leave: typeof x?.subtotal?.leave === "number" ? x.subtotal.leave : 0,
        total: typeof x?.subtotal?.total === "number" ? x.subtotal.total : 0,
        collected:
          typeof x?.subtotal?.collected === "number" ? x.subtotal.collected : 0,
      },
      ball: {
        buckets: String(x?.ball?.buckets ?? ""),
        balls: String(x?.ball?.balls ?? ""),
        amount: String(x?.ball?.amount ?? ""),
      },
    }))
    .filter((x) => x.date);

  return next;
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState();
  return normalize(safeParse(raw, initialState()));
}

function saveState(st) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(st));
}

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, null, historyInit);
  const state = history.present;

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  function applyState(updater) {
    dispatch({ type: "APPLY", updater });
  }

  // ===== Fullscreen =====
  const [isFullscreen, setIsFullscreen] = useState(
    typeof document !== "undefined" && !!document.fullscreenElement
  );
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  async function toggleFullscreen() {
    try {
      const el = document.documentElement;
      if (!el.requestFullscreen && !document.exitFullscreen) {
        alert("此瀏覽器不支援全螢幕模式。");
        return;
      }
      if (!document.fullscreenElement) {
        if (!el.requestFullscreen) {
          alert("此瀏覽器不支援全螢幕模式。");
          return;
        }
        await el.requestFullscreen();
      } else {
        if (!document.exitFullscreen) {
          alert("此瀏覽器不支援離開全螢幕。");
          return;
        }
        await document.exitFullscreen();
      }
    } catch {
      alert("無法切換全螢幕（可能是 iPad Safari 限制）。");
    }
  }

  // ===== 基本 UI state =====
  const [name, setName] = useState("");
  const [gender, setGender] = useState("男");
  const [selectedId, setSelectedId] = useState("");
  const [tick, setTick] = useState(nowSec());

  // ===== 長按（重置 / 費用設定）=====
  const resetPressTimerRef = useRef(null);
  const feePressTimerRef = useRef(null);

  const ADMIN_HASH =
    "f16fac8d88fb50f484b1559cb5f087e5501c4f9c1ccc9f71e123547b18e7b536";

  function resetAllHard() {
    dispatch({ type: "RESET_HARD" });
    setSelectedId("");
  }

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const t = setInterval(() => setTick(nowSec()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (selectedId && !state.players[selectedId]) setSelectedId("");
  }, [selectedId, state.players]);

  // ===== 名單匯入/匯出 modal =====
  const [rosterOpen, setRosterOpen] = useState(false);
  const [rosterText, setRosterText] = useState("");

  function openRosterModal() {
    setRosterOpen(true);
    setRosterText(rosterToText(state.players));
  }
  function doExportRoster() {
    setRosterText(rosterToText(state.players));
  }
  function doImportRoster() {
    const rows = parseRosterText(rosterText);
    if (!rows.length) {
      alert(
        "沒有可匯入的資料（格式：名字/性別/分類，或 名字/性別/季繳請假/替補名字/替補性別）。"
      );
      return;
    }

    const ok = confirm(
      `確定要匯入名單嗎？\n將會覆蓋目前名單並重置上場/排隊（共 ${rows.length} 人）。`
    );
    if (!ok) return;

    applyState((prev) => {
      const base = structuredClone(normalize(prev));
      const { players, bench, payments } = buildPlayersFromRosterRows(rows);

      base.players = players;
      base.bench = bench;
      base.payments = payments;

      base.queues = emptySlots(4, 4);
      base.courts = base.courts.map((c, i) => ({
        name: c?.name || `場地 ${i + 1}`,
        slots: ["", "", "", ""],
        startTs: 0,
      }));

      return base;
    });

    setSelectedId("");
    alert("匯入完成（已重置上場/排隊）。");
  }

  // ===== 收費 Modal =====
  const [chargeOpen, setChargeOpen] = useState(false);
  const today = useMemo(() => formatDateYMD(new Date()), [tick]);
  const [chargeDate, setChargeDate] = useState(today);

  const [chargeFold, setChargeFold] = useState({
    people: true,
    ball: true,
    history: true,
  });

  // 歷史編輯狀態（單筆）
  const [histEditKey, setHistEditKey] = useState("");
  const [histDraft, setHistDraft] = useState(null);

  useEffect(() => {
    if (chargeOpen) {
      setChargeDate(formatDateYMD(new Date())); // 預設今天
      setChargeFold({ people: true, ball: true, history: true });
      setHistEditKey("");
      setHistDraft(null);
    }
  }, [chargeOpen]);

  function openChargeModal() {
    setChargeOpen(true);
  }

  function promptChangeDate() {
    const v = prompt("請輸入日期（YYYY/MM/DD）", chargeDate);
    if (v === null) return;
    const s = String(v).trim();
    if (!isValidYMD(s)) {
      alert("日期格式錯誤，請使用 YYYY/MM/DD（例如：2026/02/28）");
      return;
    }
    setChargeDate(s);
  }

  // ===== 費用設定：長按 3 秒（舊：頂部顯示用）=====
  function startFeePress() {
    if (feePressTimerRef.current) clearTimeout(feePressTimerRef.current);
    feePressTimerRef.current = setTimeout(() => {
      const fee = prompt("請輸入臨打費用（例如：150）", state.config?.feeText || "");
      if (fee === null) return;
      const payTo = prompt("請輸入繳費給（例如：阿宏）", state.config?.payTo || "");
      if (payTo === null) return;

      applyState((prev) => {
        const next = structuredClone(normalize(prev));
        next.config.feeText = String(fee);
        next.config.payTo = String(payTo);
        return next;
      });
    }, 3000);
  }
  function cancelFeePress() {
    if (feePressTimerRef.current) {
      clearTimeout(feePressTimerRef.current);
      feePressTimerRef.current = null;
    }
  }

  // ===== 人員操作 =====
  function addPlayer() {
    const n = name.trim();
    if (!n) return;

    const exists = Object.values(state.players).some((p) => p.name === n);
    if (exists) {
      alert("已有同名隊員，請改名或加註。");
      return;
    }

    const id = uid();
    const p = {
      id,
      name: n,
      gender,
      category: "臨打",
      origName: n,
      origGender: gender,
      subName: "",
      subGender: "",
      games: 0,
      totalSeconds: 0,
    };

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.players[id] = p;
      next.payments[id] = false; // 臨打預設未收費
      benchPushFront(next, id);
      return next;
    });

    setName("");
  }

  function removePlayer(id) {
    const p = state.players[id];
    if (!p) return;
    if (!confirm(`確定刪除「${p.name}」？`)) return;

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      removeEverywhere(next, id);
      delete next.players[id];
      if (next.payments) delete next.payments[id];
      return next;
    });

    if (selectedId === id) setSelectedId("");
  }

  function setCourtName(ci, value) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.courts[ci].name = value;
      return next;
    });
  }

  function toggleSection(key) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      if (key === "courts") next.ui.showCourts = !next.ui.showCourts;
      if (key === "queues") next.ui.showQueues = !next.ui.showQueues;
      if (key === "bench") next.ui.showBench = !next.ui.showBench;
      if (key === "delete") next.ui.showDelete = !next.ui.showDelete;
      return next;
    });
  }

  // ===== 點選/交換 helpers =====
  const selectedPlayer = selectedId ? state.players[selectedId] : null;

  function pickPlayer(id) {
    if (!id) return;
    setSelectedId((prev) => (prev === id ? "" : id));
  }

  function getTargetPid(st, target) {
    if (target.type === "queue") return st.queues[target.gi][target.si];
    if (target.type === "court") return st.courts[target.ci].slots[target.si];
    return "";
  }

  function shouldSwap(st, moverId, target) {
    const from = locatePlayer(st, moverId);
    const targetPid = getTargetPid(st, target);

    const canSwap =
      targetPid &&
      targetPid !== moverId &&
      from &&
      (from.type === "queue" || from.type === "court") &&
      (target.type === "queue" || target.type === "court") &&
      !sameFixedSlot(from, target);

    return { canSwap: !!canSwap, from, targetPid };
  }

  function confirmSwapUI(moverId, targetPid) {
    const a = state.players[moverId]?.name || "（未知）";
    const b = state.players[targetPid]?.name || "（未知）";
    return confirm(`要交換「${a}」與「${b}」的位置嗎？`);
  }

  function placeSelected(target, id = selectedId) {
    if (!id) return;

    if (target.type === "queue" || target.type === "court") {
      const { canSwap, from, targetPid } = shouldSwap(state, id, target);

      if (
        targetPid === id &&
        from &&
        (from.type === "queue" || from.type === "court") &&
        sameFixedSlot(from, target)
      ) {
        return;
      }

      if (canSwap) {
        const ok = confirmSwapUI(id, targetPid);
        if (!ok) return;
      }
    }

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      if (!next.players[id]) return prev;

      const from = locatePlayer(next, id);

      if (target.type === "bench") {
        removeEverywhere(next, id);
        benchPushFront(next, id);
        return next;
      }

      const targetPid = getTargetPid(next, target);

      if (
        targetPid === id &&
        from &&
        (from.type === "queue" || from.type === "court") &&
        (target.type === "queue" || target.type === "court") &&
        sameFixedSlot(from, target)
      ) {
        return prev;
      }

      const canSwap =
        targetPid &&
        targetPid !== id &&
        from &&
        (from.type === "queue" || from.type === "court") &&
        (target.type === "queue" || target.type === "court") &&
        !sameFixedSlot(from, target);

      if (canSwap) {
        removeEverywhere(next, id);
        removeEverywhere(next, targetPid);

        if (target.type === "queue") next.queues[target.gi][target.si] = id;
        if (target.type === "court") {
          const c = next.courts[target.ci];
          c.slots[target.si] = id;
          ensureCourtTimer(c);
        }

        if (from.type === "queue") next.queues[from.gi][from.si] = targetPid;
        if (from.type === "court") {
          const c = next.courts[from.ci];
          c.slots[from.si] = targetPid;
          ensureCourtTimer(c);
        }

        return next;
      }

      removeEverywhere(next, id);

      if (target.type === "queue") {
        const replaced = next.queues[target.gi][target.si];
        next.queues[target.gi][target.si] = id;
        if (replaced) benchPushFront(next, replaced);
        return next;
      }

      if (target.type === "court") {
        const court = next.courts[target.ci];
        const replaced = court.slots[target.si];
        court.slots[target.si] = id;
        if (replaced) benchPushFront(next, replaced);
        ensureCourtTimer(court);
        return next;
      }

      return next;
    });

    setSelectedId("");
  }

  function onSlotClick(target, pid) {
    if (selectedId) {
      placeSelected(target);
      return;
    }
    if (pid) pickPlayer(pid);
  }

  // ===== Drag & Drop =====
  function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function dragStart(e, id) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  function dropTo(e, target) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    if (target.type === "queue" || target.type === "court") {
      const { canSwap, targetPid } = shouldSwap(state, id, target);
      if (canSwap) {
        const ok = confirmSwapUI(id, targetPid);
        if (!ok) return;
      }
    }

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      if (!next.players[id]) return prev;

      const from = locatePlayer(next, id);

      if (target.type === "bench") {
        removeEverywhere(next, id);
        benchPushFront(next, id);
        return next;
      }

      const targetPid = getTargetPid(next, target);

      if (
        targetPid === id &&
        from &&
        (from.type === "queue" || from.type === "court") &&
        (target.type === "queue" || target.type === "court") &&
        sameFixedSlot(from, target)
      ) {
        return prev;
      }

      const canSwap =
        targetPid &&
        targetPid !== id &&
        from &&
        (from.type === "queue" || from.type === "court") &&
        (target.type === "queue" || target.type === "court") &&
        !sameFixedSlot(from, target);

      if (canSwap) {
        removeEverywhere(next, id);
        removeEverywhere(next, targetPid);

        if (target.type === "queue") next.queues[target.gi][target.si] = id;
        if (target.type === "court") {
          const c = next.courts[target.ci];
          c.slots[target.si] = id;
          ensureCourtTimer(c);
        }

        if (from.type === "queue") next.queues[from.gi][from.si] = targetPid;
        if (from.type === "court") {
          const c = next.courts[from.ci];
          c.slots[from.si] = targetPid;
          ensureCourtTimer(c);
        }

        return next;
      }

      removeEverywhere(next, id);

      if (target.type === "queue") {
        const replaced = next.queues[target.gi][target.si];
        next.queues[target.gi][target.si] = id;
        if (replaced) benchPushFront(next, replaced);
        return next;
      }

      if (target.type === "court") {
        const court = next.courts[target.ci];
        const replaced = court.slots[target.si];
        court.slots[target.si] = id;
        if (replaced) benchPushFront(next, replaced);
        ensureCourtTimer(court);
        return next;
      }

      return next;
    });

    setSelectedId("");
  }

  function endCourt(ci) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      const court = next.courts[ci];

      const hadPlayers = court.slots.filter(Boolean);
      if (hadPlayers.length === 0) return prev;

      const elapsed = court.startTs
        ? Math.max(0, Math.floor((Date.now() - court.startTs) / 1000))
        : 0;

      for (const pid of hadPlayers) {
        const p = next.players[pid];
        if (p) {
          p.games += 1;
          p.totalSeconds += elapsed;
        }
      }

      for (const pid of hadPlayers) benchPushFront(next, pid);

      court.slots = ["", "", "", ""];
      court.startTs = 0;

      const q1 = next.queues[0];
      const incoming = q1.filter(Boolean);
      for (let i = 0; i < 4; i++) {
        court.slots[i] = incoming[i] || "";
      }

      next.queues[0] = next.queues[1];
      next.queues[1] = next.queues[2];
      next.queues[2] = next.queues[3];
      next.queues[3] = ["", "", "", ""];

      court.startTs = isAllEmpty(court.slots) ? 0 : Date.now();

      return next;
    });

    setSelectedId("");
  }

  // ===== 顯示資料 =====
  const benchPlayers = useMemo(() => {
    const seen = new Set();
    return state.bench
      .filter((id) => state.players[id])
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))
      .map((id) => state.players[id]);
  }, [state.players, state.bench]);

  const totalPeople = useMemo(() => {
    return Object.keys(state.players || {}).length;
  }, [state.players]);

  const feeLine = useMemo(() => {
    const fee = (state.config?.feeText || "").trim();
    const payTo = (state.config?.payTo || "").trim();
    if (!fee && !payTo) return "";
    if (fee && payTo) return `臨打費用$${fee}，繳費給: ${payTo}`;
    if (fee && !payTo) return `臨打費用$${fee}`;
    return `繳費給: ${payTo}`;
  }, [state.config?.feeText, state.config?.payTo]);

  // ===== 收費表資料 =====
  function parseMoney(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  function parseIntSafe(v) {
    const s = String(v ?? "").trim();
    if (!s) return 0;
    const n = Number(s);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }

  function feeByCategory(cat) {
    const c = normalizeCategoryText(cat);
    if (c === "季繳") return parseMoney(state.config.feeSeason);
    if (c === "季繳請假") return parseMoney(state.config.feeLeave);
    return parseMoney(state.config.feeCasual);
  }

  const chargeRows = useMemo(() => {
    const arr = Object.values(state.players || {});
    arr.sort((a, b) => {
      const ca = categoryOrder(a?.category);
      const cb = categoryOrder(b?.category);
      if (ca !== cb) return ca - cb;

      const ga = genderOrder(a?.origGender ?? a?.gender);
      const gb = genderOrder(b?.origGender ?? b?.gender);
      if (ga !== gb) return ga - gb;

      const na = String(a?.origName ?? a?.name ?? "");
      const nb = String(b?.origName ?? b?.name ?? "");
      return na.localeCompare(nb, "zh-TW", { numeric: true, sensitivity: "base" });
    });
    return arr;
  }, [state.players]);

  const chargeStats = useMemo(() => {
    let seasonAmt = 0,
      casualAmt = 0,
      leaveAmt = 0,
      collected = 0;
    let seasonCount = 0,
      casualCount = 0,
      leaveCount = 0;

    for (const p of chargeRows) {
      const cat = normalizeCategoryText(p.category);
      const fee = feeByCategory(cat);

      if (cat === "季繳") {
        seasonAmt += fee;
        seasonCount += 1;
      } else if (cat === "季繳請假") {
        leaveAmt += fee;
        leaveCount += 1;
      } else {
        casualAmt += fee;
        casualCount += 1;
      }

      const paid = !!state.payments?.[p.id];
      if (paid) collected += fee;
    }

    const total = seasonAmt + casualAmt + leaveAmt;

    return {
      counts: { season: seasonCount, casual: casualCount, leave: leaveCount },
      subtotal: {
        season: seasonAmt,
        casual: casualAmt,
        leave: leaveAmt,
        total,
        collected,
      },
    };
  }, [
    chargeRows,
    state.payments,
    state.config.feeSeason,
    state.config.feeCasual,
    state.config.feeLeave,
  ]);

  // ✅ 已收費勾選：true→false 要確認
  function togglePaid(pid) {
    const was = !!state.payments?.[pid];
    if (was) {
      const ok = confirm("要取消「已收費」嗎？（避免誤按）");
      if (!ok) return;
    }
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.payments[pid] = !was;
      return next;
    });
  }

  function setCategoryFee(key, v) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      if (key === "season") next.config.feeSeason = String(v);
      if (key === "casual") next.config.feeCasual = String(v);
      if (key === "leave") next.config.feeLeave = String(v);
      return next;
    });
  }

  function setBallField(key, v) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.ball[key] = String(v);
      return next;
    });
  }

  function saveDateToHistory() {
    const date = String(chargeDate || "").trim();
    if (!isValidYMD(date)) {
      alert("日期格式錯誤，請先設定正確日期（YYYY/MM/DD）。");
      return;
    }

    applyState((prev) => {
      const next = structuredClone(normalize(prev));

      // 依當前 players/payments/費用計算（與畫面一致）
      const rows = Object.values(next.players || {});
      // 排序不用在保存時做，因為我們只存合計/人數
      let seasonAmt = 0,
        casualAmt = 0,
        leaveAmt = 0,
        collected = 0;
      let seasonCount = 0,
        casualCount = 0,
        leaveCount = 0;

      const feeSeason = parseMoney(next.config.feeSeason);
      const feeCasual = parseMoney(next.config.feeCasual);
      const feeLeave = parseMoney(next.config.feeLeave);

      for (const p of rows) {
        const cat = normalizeCategoryText(p.category);
        const fee =
          cat === "季繳" ? feeSeason : cat === "季繳請假" ? feeLeave : feeCasual;

        if (cat === "季繳") {
          seasonAmt += fee;
          seasonCount += 1;
        } else if (cat === "季繳請假") {
          leaveAmt += fee;
          leaveCount += 1;
        } else {
          casualAmt += fee;
          casualCount += 1;
        }

        if (next.payments?.[p.id]) collected += fee;
      }

      const total = seasonAmt + casualAmt + leaveAmt;

      const record = {
        date,
        totalPeople: rows.length,
        counts: { season: seasonCount, casual: casualCount, leave: leaveCount },
        subtotal: {
          season: seasonAmt,
          casual: casualAmt,
          leave: leaveAmt,
          total,
          collected,
        },
        ball: {
          buckets: String(next.ball?.buckets ?? ""),
          balls: String(next.ball?.balls ?? ""),
          amount: String(next.ball?.amount ?? ""),
        },
      };

      const idx = next.dailyHistory.findIndex((x) => x.date === date);
      if (idx >= 0) next.dailyHistory[idx] = record;
      else next.dailyHistory.push(record);

      next.dailyHistory.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      return next;
    });

    alert("已保存到歷史清單（同日期會覆蓋更新）。");
  }

  function deleteHistory(date) {
    const ok = confirm(`確定刪除歷史紀錄 ${date} 嗎？`);
    if (!ok) return;

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.dailyHistory = (next.dailyHistory || []).filter((x) => x.date !== date);
      return next;
    });

    if (histEditKey === date) {
      setHistEditKey("");
      setHistDraft(null);
    }
  }

  function startEditHistory(item) {
    setHistEditKey(item.date);
    setHistDraft({
      date: item.date,
      totalPeople: String(item.totalPeople ?? 0),
      seasonCount: String(item.counts?.season ?? 0),
      casualCount: String(item.counts?.casual ?? 0),
      leaveCount: String(item.counts?.leave ?? 0),
      seasonAmt: String(item.subtotal?.season ?? 0),
      casualAmt: String(item.subtotal?.casual ?? 0),
      leaveAmt: String(item.subtotal?.leave ?? 0),
      totalAmt: String(item.subtotal?.total ?? 0),
      collectedAmt: String(item.subtotal?.collected ?? 0),
      buckets: String(item.ball?.buckets ?? ""),
      balls: String(item.ball?.balls ?? ""),
      ballAmt: String(item.ball?.amount ?? ""),
    });
  }

  function cancelEditHistory() {
    setHistEditKey("");
    setHistDraft(null);
  }

  function saveEditHistory() {
    if (!histDraft) return;

    const newDate = String(histDraft.date || "").trim();
    if (!isValidYMD(newDate)) {
      alert("日期格式錯誤，請使用 YYYY/MM/DD。");
      return;
    }

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      const list = Array.isArray(next.dailyHistory) ? next.dailyHistory : [];

      const oldDate = histEditKey;
      const oldIdx = list.findIndex((x) => x.date === oldDate);
      if (oldIdx < 0) return prev;

      // 若改了日期且撞到其它日期：詢問是否覆蓋
      const existingIdx =
        newDate !== oldDate ? list.findIndex((x) => x.date === newDate) : -1;
      if (existingIdx >= 0) {
        const ok = confirm(
          `日期 ${newDate} 已存在歷史紀錄，要覆蓋它嗎？`
        );
        if (!ok) return prev;
      }

      const record = {
        date: newDate,
        totalPeople: parseIntSafe(histDraft.totalPeople),
        counts: {
          season: parseIntSafe(histDraft.seasonCount),
          casual: parseIntSafe(histDraft.casualCount),
          leave: parseIntSafe(histDraft.leaveCount),
        },
        subtotal: {
          season: parseMoney(histDraft.seasonAmt),
          casual: parseMoney(histDraft.casualAmt),
          leave: parseMoney(histDraft.leaveAmt),
          total: parseMoney(histDraft.totalAmt),
          collected: parseMoney(histDraft.collectedAmt),
        },
        ball: {
          buckets: String(histDraft.buckets ?? ""),
          balls: String(histDraft.balls ?? ""),
          amount: String(histDraft.ballAmt ?? ""),
        },
      };

      // 先刪舊的
      let nextList = list.filter((x) => x.date !== oldDate);

      // 若覆蓋其它日期：也刪掉那筆
      if (existingIdx >= 0) {
        nextList = nextList.filter((x) => x.date !== newDate);
      }

      nextList.push(record);
      nextList.sort((a, b) => String(b.date).localeCompare(String(a.date)));
      next.dailyHistory = nextList;

      return next;
    });

    alert("歷史紀錄已更新。");
    cancelEditHistory();
  }

  // ===== Styles =====
  const ui = {
    page: {
      padding: 14,
      maxWidth: 1480,
      margin: "0 auto",
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", Arial',
      color: "#0F172A",
      background:
        "radial-gradient(1000px 500px at 10% 0%, rgba(219,234,254,.7), transparent 60%), radial-gradient(900px 480px at 90% 10%, rgba(252,231,243,.7), transparent 55%), linear-gradient(#F8FAFC, #F8FAFC)",
      minHeight: "100vh",
    },
    topBar: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
      marginBottom: 10,
    },
    h2: { margin: "0 0 6px 0", fontWeight: 900, letterSpacing: 0.2 },
    hint: { fontSize: 12, color: "#64748B", lineHeight: 1.3 },
    card: {
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 18,
      background: "rgba(255,255,255,.82)",
      backdropFilter: "blur(6px)",
      padding: 10,
      boxShadow: "0 10px 25px rgba(15,23,42,.05)",
    },
    benchCard: {
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 18,
      background: "rgba(255,255,255,.82)",
      backdropFilter: "blur(6px)",
      padding: 10,
      boxShadow: "0 10px 25px rgba(15,23,42,.05)",
    },
    benchItem: {
      border: "1px solid rgba(15,23,42,.08)",
      borderRadius: 14,
      padding: "8px 10px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      boxShadow: "0 6px 14px rgba(15,23,42,.04)",
      cursor: "pointer",
      userSelect: "none",
    },
    formRow: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
    },
    input: {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.12)",
      background: "rgba(255,255,255,.92)",
      outline: "none",
    },
    select: {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.12)",
      background: "rgba(255,255,255,.92)",
      outline: "none",
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.12)",
      background: "white",
      cursor: "pointer",
      fontWeight: 800,
      boxShadow: "0 6px 14px rgba(15,23,42,.06)",
    },
    btnSoft: {
      padding: "8px 10px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.10)",
      background: "rgba(255,255,255,.88)",
      cursor: "pointer",
      fontWeight: 900,
      boxShadow: "0 6px 14px rgba(15,23,42,.05)",
    },
    btnDanger: {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(244,63,94,.25)",
      background: "rgba(255,241,242,.92)",
      cursor: "pointer",
      fontWeight: 900,
      color: "#BE123C",
      boxShadow: "0 6px 14px rgba(244,63,94,.08)",
    },
    sectionTitle: {
      margin: "10px 0 8px 0",
      fontWeight: 900,
      color: "#0F172A",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
    },
    micro: { fontSize: 12, color: "#64748B" },
    list2: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      alignItems: "stretch",
    },
    slot: {
      border: "1px dashed rgba(15,23,42,.18)",
      borderRadius: 14,
      padding: "6px 8px",
      minHeight: 34,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      cursor: "pointer",
      userSelect: "none",
    },
    nameStyle: {
      fontWeight: 900,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 220,
    },
    pill: {
      border: "1px solid rgba(15,23,42,.12)",
      borderRadius: 999,
      padding: "1px 8px",
      fontSize: 12,
      background: "rgba(255,255,255,.88)",
      color: "#334155",
      whiteSpace: "nowrap",
    },
    version: {
      marginTop: 18,
      fontSize: 12,
      color: "#94A3B8",
      textAlign: "center",
    },
    ghostDot: { opacity: 0, fontSize: 12 },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      border: "1px solid rgba(15,23,42,.12)",
      borderRadius: 999,
      padding: "4px 10px",
      background: "rgba(255,255,255,.88)",
      fontSize: 12,
      color: "#334155",
      whiteSpace: "nowrap",
      fontWeight: 900,
      userSelect: "none",
    },
    modalMask: {
      position: "fixed",
      inset: 0,
      background: "rgba(15,23,42,.35)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 14,
      zIndex: 9999,
    },
    modal: {
      width: "min(1180px, 100%)",
      borderRadius: 18,
      background: "rgba(255,255,255,.95)",
      border: "1px solid rgba(15,23,42,.12)",
      boxShadow: "0 18px 50px rgba(15,23,42,.22)",
      padding: 12,
      maxHeight: "calc(100vh - 28px)",
      overflow: "auto",
    },
    textarea: {
      width: "100%",
      minHeight: 320,
      resize: "vertical",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.12)",
      padding: 12,
      outline: "none",
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 13,
      lineHeight: 1.4,
      background: "rgba(248,250,252,.95)",
      boxSizing: "border-box",
    },
    table: {
      width: "100%",
      borderCollapse: "separate",
      borderSpacing: 0,
      fontSize: 13,
      overflow: "hidden",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.10)",
      background: "rgba(255,255,255,.90)",
    },
    th: {
      textAlign: "left",
      padding: "8px 10px",
      borderBottom: "1px solid rgba(15,23,42,.10)",
      background: "rgba(248,250,252,.98)",
      position: "sticky",
      top: 0,
      zIndex: 2,
      whiteSpace: "nowrap",
      fontWeight: 900,
    },
    td: {
      padding: "8px 10px",
      borderBottom: "1px solid rgba(15,23,42,.08)",
      verticalAlign: "top",
      whiteSpace: "nowrap",
    },
    hr: { border: 0, height: 1, background: "rgba(15,23,42,.08)", margin: "12px 0" },
  };

  const EmptySlot = () => <span style={ui.ghostDot}>.</span>;

  const selectedRing = {
    border: "2px solid rgba(34,197,94,.95)",
    boxShadow:
      "0 0 0 3px rgba(34,197,94,.35), 0 10px 25px rgba(34,197,94,.18)",
  };

  const ctl = "ctlTextFix";
  const ctlDanger = "ctlTextFixDanger";
  const ctlPad = "ctlPadFix";

  // ===== Undo/Redo =====
  function undo() {
    dispatch({ type: "UNDO" });
    setSelectedId("");
  }
  function redo() {
    dispatch({ type: "REDO" });
    setSelectedId("");
  }

  // ===== 重置：長按版本號 3 秒 =====
  function startResetPress() {
    if (resetPressTimerRef.current) clearTimeout(resetPressTimerRef.current);
    resetPressTimerRef.current = setTimeout(async () => {
      const input = prompt("請輸入管理密碼");
      if (input === null) return;
      const hash = await sha256Hex(input);
      if (hash === ADMIN_HASH) {
        resetAllHard();
        alert("系統已重置");
      } else {
        alert("密碼錯誤");
      }
    }, 3000);
  }
  function cancelResetPress() {
    if (resetPressTimerRef.current) {
      clearTimeout(resetPressTimerRef.current);
      resetPressTimerRef.current = null;
    }
  }

  return (
    <div style={ui.page}>
      <style>{`
        .layout {
          display: grid;
          grid-template-columns: 1.55fr 0.85fr;
          gap: 12px;
          align-items: start;
        }
        .grid4 {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 10px;
        }
        @media (max-width: 1024px) {
          .layout { grid-template-columns: 1fr; }
          .grid4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 560px) {
          .topBar { flex-direction: column; align-items: stretch; gap: 10px; }
          .formRow input, .formRow select, .formRow button {
            width: 100%;
            box-sizing: border-box;
          }
          .grid4 { grid-template-columns: 1fr; }
          .benchList2 { grid-template-columns: 1fr !important; }
        }

        /* iPad Air 橫向（1024~1366）右側休息區 sticky + 緊湊化 */
        @media (min-width: 1024px) and (max-width: 1366px) and (orientation: landscape) {
          .layout { grid-template-columns: 1.75fr 0.75fr !important; gap: 10px !important; }
          .grid4 { gap: 8px !important; }
          .benchSticky { position: sticky; top: 10px; }
          .cardBox { padding: 8px !important; border-radius: 16px !important; }
          .benchBox { padding: 8px !important; border-radius: 16px !important; }
          .slotBox { min-height: 30px !important; padding: 5px 7px !important; }
          .benchItemBox { padding: 7px 9px !important; }
          .ctlPadFix { padding: 8px 10px !important; }
          .ctlTextFix { font-size: 13px !important; }
          .ctlTextFixDanger { font-size: 13px !important; }
        }

        .benchScrollArea{
          max-height: clamp(360px, calc(100vh - 360px), 640px);
          overflow-y: auto;
          padding-right: 6px;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        .ctlTextFix{
          color: #0F172A !important;
          -webkit-text-fill-color: #0F172A !important;
          font-size: 14px !important;
          line-height: 1.2 !important;
        }
        .ctlTextFixDanger{
          color: #BE123C !important;
          -webkit-text-fill-color: #BE123C !important;
          font-size: 14px !important;
          line-height: 1.2 !important;
        }
        .ctlTextFix::placeholder{
          color: rgba(100,116,139,.9) !important;
          -webkit-text-fill-color: rgba(100,116,139,.9) !important;
          opacity: 1 !important;
        }

        .selectedToast {
          position: fixed;
          top: 68px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9998;
          pointer-events: none;
        }
        .selectedToastInner {
          pointer-events: auto;
          width: min(560px, calc(100vw - 28px));
        }
        .toastGoose {
          background: rgba(254, 249, 213, 0.96) !important;
          border: 1px solid rgba(245, 158, 11, 0.28) !important;
        }
        @media (max-width: 560px) {
          .selectedToast { top: 92px; }
          .selectedToastInner { width: calc(100vw - 20px); }
        }
      `}</style>

      {/* ===== 名單匯入/匯出 Modal ===== */}
      {rosterOpen ? (
        <div
          style={ui.modalMask}
          onClick={() => setRosterOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 900 }}>
                名單匯入/匯出（每行一筆）
              </div>
              <button
                className={`${ctl} ${ctlPad}`}
                style={ui.btnSoft}
                onClick={() => setRosterOpen(false)}
              >
                關閉
              </button>
            </div>

            <div style={{ ...ui.micro, marginBottom: 8 }}>
              格式：
              <br />
              1) 名字/性別/分類(季繳或臨打或季繳請假)
              <br />
              2) 若分類=季繳請假：名字/性別/季繳請假/替補名字/替補性別
              <br />
              <br />
              範例：
              <br />
              周杰倫/男/季繳
              <br />
              林俊傑/男/季繳請假/田馥甄/女
              <br />
              王心凌/女/臨打
            </div>

            <textarea
              className={`${ctl}`}
              style={ui.textarea}
              value={rosterText}
              onChange={(e) => setRosterText(e.target.value)}
              placeholder={
                "周杰倫/男/季繳\n蔡依林/女/季繳\n林俊傑/男/季繳請假/田馥甄/女\n王心凌/女/臨打"
              }
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                marginTop: 10,
                justifyContent: "flex-end",
              }}
            >
              <button
                className={`${ctl} ${ctlPad}`}
                style={ui.btnSoft}
                onClick={doExportRoster}
              >
                匯出（更新文字框）
              </button>
              <button
                className={`${ctlDanger} ${ctlPad}`}
                style={ui.btnDanger}
                onClick={doImportRoster}
              >
                匯入（覆蓋名單並重置）
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ===== 收費 Modal ===== */}
      {chargeOpen ? (
        <div
          style={ui.modalMask}
          onClick={() => setChargeOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div style={ui.modal} onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              <div style={{ fontWeight: 900 }}>收費清單</div>
              <button
                className={`${ctl} ${ctlPad}`}
                style={ui.btnSoft}
                onClick={() => setChargeOpen(false)}
              >
                關閉
              </button>
            </div>

            {/* ✅ 共用日期（點擊可修改、同步） */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span
                style={{ ...ui.badge, cursor: "pointer" }}
                title="點一下修改日期（會同步人員收費/用球紀錄）"
                onClick={promptChangeDate}
              >
                日期 {chargeDate}（點一下修改）
              </span>
              <span style={ui.badge}>總人數 {chargeRows.length}</span>
              <div style={{ flex: 1 }} />
              <button
                className={`${ctl} ${ctlPad}`}
                style={ui.btnSoft}
                onClick={saveDateToHistory}
                title="保存到歷史（同日期會覆蓋）"
              >
                保存到歷史
              </button>
            </div>

            {/* 2-1 人員收費（可收折） */}
            <div style={{ ...ui.card, padding: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: chargeFold.people ? 8 : 0,
                }}
              >
                <div style={{ fontWeight: 900 }}>人員收費</div>
                <button
                  className={`${ctl} ${ctlPad}`}
                  style={ui.btnSoft}
                  onClick={() =>
                    setChargeFold((p) => ({ ...p, people: !p.people }))
                  }
                >
                  {chargeFold.people ? "收折" : "展開"}
                </button>
              </div>

              {chargeFold.people ? (
                <>
                  {/* 分類費用設定：名前綴固定顯示 */}
                  <div
                    className="formRow"
                    style={{ ...ui.formRow, marginBottom: 10 }}
                  >
                    <span style={ui.micro}>分類費用設定：</span>

                    <span style={ui.badge}>季繳</span>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, width: 120 }}
                      inputMode="numeric"
                      placeholder="金額"
                      value={state.config.feeSeason}
                      onChange={(e) => setCategoryFee("season", e.target.value)}
                    />

                    <span style={ui.badge}>臨打</span>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, width: 120 }}
                      inputMode="numeric"
                      placeholder="金額"
                      value={state.config.feeCasual}
                      onChange={(e) => setCategoryFee("casual", e.target.value)}
                    />

                    <span style={ui.badge}>季繳請假</span>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, width: 120 }}
                      inputMode="numeric"
                      placeholder="金額"
                      value={state.config.feeLeave}
                      onChange={(e) => setCategoryFee("leave", e.target.value)}
                    />
                  </div>

                  {/* 表格：header sticky */}
                  <div style={{ overflowX: "auto" }}>
                    <table style={ui.table}>
                      <thead>
                        <tr>
                          <th style={ui.th}>Seq</th>
                          <th style={ui.th}>分類</th>
                          <th style={ui.th}>名字</th>
                          <th style={ui.th}>性別</th>
                          <th style={ui.th}>季繳替補</th>
                          <th style={ui.th}>替補性別</th>
                          <th style={ui.th}>費用</th>
                          <th style={ui.th}>已收費</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chargeRows.map((p, idx) => {
                          const cat = normalizeCategoryText(p.category);
                          const fee = feeByCategory(cat);
                          const paid = !!state.payments?.[p.id];

                          return (
                            <tr key={p.id}>
                              <td style={ui.td}>{idx + 1}</td>
                              <td style={ui.td}>{cat}</td>
                              <td style={ui.td}>
                                {String(p.origName ?? p.name ?? "")}
                              </td>
                              <td style={ui.td}>
                                {String(p.origGender ?? p.gender ?? "")}
                              </td>
                              <td style={ui.td}>{String(p.subName ?? "")}</td>
                              <td style={ui.td}>{String(p.subGender ?? "")}</td>
                              <td style={ui.td}>{fmtMoney(fee)}</td>
                              <td style={ui.td}>
                                <input
                                  type="checkbox"
                                  checked={paid}
                                  onChange={() => togglePaid(p.id)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* 小計/總計：千分位 + 人數 */}
                  <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
                    <div style={ui.micro}>
                      小計（依分類）：
                      季繳 {chargeStats.counts.season}人 / {fmtMoney(chargeStats.subtotal.season)}｜
                      臨打 {chargeStats.counts.casual}人 / {fmtMoney(chargeStats.subtotal.casual)}｜
                      季繳請假 {chargeStats.counts.leave}人 / {fmtMoney(chargeStats.subtotal.leave)}
                    </div>
                    <div style={ui.micro}>
                      總計（全部）{fmtMoney(chargeStats.subtotal.total)}｜
                      已收費合計（勾選者）{fmtMoney(chargeStats.subtotal.collected)}
                    </div>
                  </div>
                </>
              ) : (
                <div style={ui.micro}>（已收折）</div>
              )}
            </div>

            <div style={ui.hr} />

            {/* 2-2 用球紀錄（可收折） */}
            <div style={{ ...ui.card, padding: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: chargeFold.ball ? 8 : 0,
                }}
              >
                <div style={{ fontWeight: 900 }}>用球紀錄</div>
                <button
                  className={`${ctl} ${ctlPad}`}
                  style={ui.btnSoft}
                  onClick={() => setChargeFold((p) => ({ ...p, ball: !p.ball }))}
                >
                  {chargeFold.ball ? "收折" : "展開"}
                </button>
              </div>

              {chargeFold.ball ? (
                <>
                  <div className="formRow" style={ui.formRow}>
                    <span style={ui.micro}>用球數：</span>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, width: 90 }}
                      inputMode="numeric"
                      placeholder="X桶"
                      value={state.ball?.buckets ?? ""}
                      onChange={(e) => setBallField("buckets", e.target.value)}
                    />
                    <span style={ui.micro}>桶</span>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, width: 90 }}
                      inputMode="numeric"
                      placeholder="Y顆"
                      value={state.ball?.balls ?? ""}
                      onChange={(e) => setBallField("balls", e.target.value)}
                    />
                    <span style={ui.micro}>顆</span>

                    <div style={{ width: 16 }} />

                    <span style={ui.micro}>金額：</span>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, width: 120 }}
                      inputMode="numeric"
                      placeholder="Z元"
                      value={state.ball?.amount ?? ""}
                      onChange={(e) => setBallField("amount", e.target.value)}
                    />
                    <span style={ui.micro}>元</span>
                  </div>

                  <div style={{ marginTop: 8, ...ui.micro }}>
                    顯示：{String(state.ball?.buckets || 0)}桶{String(state.ball?.balls || 0)}顆｜
                    {String(state.ball?.amount || 0)}元
                  </div>
                </>
              ) : (
                <div style={ui.micro}>（已收折）</div>
              )}
            </div>

            <div style={ui.hr} />

            {/* 2-3 歷史清單（可收折 + DELETE/UPDATE） */}
            <div style={{ ...ui.card, padding: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexWrap: "wrap",
                  marginBottom: chargeFold.history ? 8 : 0,
                }}
              >
                <div style={{ fontWeight: 900 }}>歷史清單</div>
                <button
                  className={`${ctl} ${ctlPad}`}
                  style={ui.btnSoft}
                  onClick={() =>
                    setChargeFold((p) => ({ ...p, history: !p.history }))
                  }
                >
                  {chargeFold.history ? "收折" : "展開"}
                </button>
              </div>

              {chargeFold.history ? (
                state.dailyHistory?.length ? (
                  <div style={{ display: "grid", gap: 8 }}>
                    {state.dailyHistory.map((h) => {
                      const isEditing = histEditKey === h.date && !!histDraft;

                      return (
                        <div
                          key={h.date}
                          style={{ ...ui.card, padding: 10, boxShadow: "none" }}
                        >
                          {!isEditing ? (
                            <>
                              <div
                                style={{
                                  display: "flex",
                                  gap: 8,
                                  flexWrap: "wrap",
                                  alignItems: "center",
                                }}
                              >
                                <span style={ui.badge}>{h.date}</span>
                                <span style={ui.badge}>人數 {h.totalPeople}</span>

                                <span style={ui.badge}>
                                  季繳 {h.counts?.season ?? 0}人 / {fmtMoney(h.subtotal?.season ?? 0)}
                                </span>
                                <span style={ui.badge}>
                                  臨打 {h.counts?.casual ?? 0}人 / {fmtMoney(h.subtotal?.casual ?? 0)}
                                </span>
                                <span style={ui.badge}>
                                  季繳請假 {h.counts?.leave ?? 0}人 / {fmtMoney(h.subtotal?.leave ?? 0)}
                                </span>

                                <span style={ui.badge}>總計 {fmtMoney(h.subtotal?.total ?? 0)}</span>
                                <span style={ui.badge}>已收費 {fmtMoney(h.subtotal?.collected ?? 0)}</span>

                                <div style={{ flex: 1 }} />

                                <button
                                  className={`${ctl} ${ctlPad}`}
                                  style={ui.btnSoft}
                                  onClick={() => startEditHistory(h)}
                                >
                                  更新
                                </button>
                                <button
                                  className={`${ctlDanger} ${ctlPad}`}
                                  style={ui.btnDanger}
                                  onClick={() => deleteHistory(h.date)}
                                >
                                  刪除
                                </button>
                              </div>

                              <div style={{ marginTop: 6, ...ui.micro }}>
                                用球：{String(h.ball?.buckets || 0)}桶{String(h.ball?.balls || 0)}顆｜
                                金額 {String(h.ball?.amount || 0)} 元
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                                編輯：{histEditKey}
                              </div>

                              <div
                                className="formRow"
                                style={{ ...ui.formRow, marginBottom: 8 }}
                              >
                                <span style={ui.badge}>日期</span>
                                <input
                                  className={`${ctl} ${ctlPad}`}
                                  style={{ ...ui.input, width: 140 }}
                                  value={histDraft.date}
                                  onChange={(e) =>
                                    setHistDraft((p) => ({ ...p, date: e.target.value }))
                                  }
                                  placeholder="YYYY/MM/DD"
                                />

                                <span style={ui.badge}>總人數</span>
                                <input
                                  className={`${ctl} ${ctlPad}`}
                                  style={{ ...ui.input, width: 90 }}
                                  inputMode="numeric"
                                  value={histDraft.totalPeople}
                                  onChange={(e) =>
                                    setHistDraft((p) => ({ ...p, totalPeople: e.target.value }))
                                  }
                                />

                                <div style={{ flex: 1 }} />

                                <button
                                  className={`${ctl} ${ctlPad}`}
                                  style={ui.btnSoft}
                                  onClick={saveEditHistory}
                                >
                                  儲存
                                </button>
                                <button
                                  className={`${ctl} ${ctlPad}`}
                                  style={ui.btnSoft}
                                  onClick={cancelEditHistory}
                                >
                                  取消
                                </button>
                              </div>

                              <div style={{ display: "grid", gap: 8 }}>
                                <div className="formRow" style={ui.formRow}>
                                  <span style={ui.badge}>季繳 人數</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 90 }}
                                    inputMode="numeric"
                                    value={histDraft.seasonCount}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, seasonCount: e.target.value }))
                                    }
                                  />
                                  <span style={ui.badge}>季繳 金額</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 120 }}
                                    inputMode="numeric"
                                    value={histDraft.seasonAmt}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, seasonAmt: e.target.value }))
                                    }
                                  />

                                  <span style={ui.badge}>臨打 人數</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 90 }}
                                    inputMode="numeric"
                                    value={histDraft.casualCount}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, casualCount: e.target.value }))
                                    }
                                  />
                                  <span style={ui.badge}>臨打 金額</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 120 }}
                                    inputMode="numeric"
                                    value={histDraft.casualAmt}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, casualAmt: e.target.value }))
                                    }
                                  />
                                </div>

                                <div className="formRow" style={ui.formRow}>
                                  <span style={ui.badge}>季繳請假 人數</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 90 }}
                                    inputMode="numeric"
                                    value={histDraft.leaveCount}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, leaveCount: e.target.value }))
                                    }
                                  />
                                  <span style={ui.badge}>季繳請假 金額</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 120 }}
                                    inputMode="numeric"
                                    value={histDraft.leaveAmt}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, leaveAmt: e.target.value }))
                                    }
                                  />

                                  <span style={ui.badge}>總計</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 120 }}
                                    inputMode="numeric"
                                    value={histDraft.totalAmt}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, totalAmt: e.target.value }))
                                    }
                                  />

                                  <span style={ui.badge}>已收費合計</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 120 }}
                                    inputMode="numeric"
                                    value={histDraft.collectedAmt}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, collectedAmt: e.target.value }))
                                    }
                                  />
                                </div>

                                <div className="formRow" style={ui.formRow}>
                                  <span style={ui.badge}>用球</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 90 }}
                                    inputMode="numeric"
                                    placeholder="桶"
                                    value={histDraft.buckets}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, buckets: e.target.value }))
                                    }
                                  />
                                  <span style={ui.micro}>桶</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 90 }}
                                    inputMode="numeric"
                                    placeholder="顆"
                                    value={histDraft.balls}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, balls: e.target.value }))
                                    }
                                  />
                                  <span style={ui.micro}>顆</span>

                                  <span style={ui.badge}>用球金額</span>
                                  <input
                                    className={`${ctl} ${ctlPad}`}
                                    style={{ ...ui.input, width: 120 }}
                                    inputMode="numeric"
                                    placeholder="元"
                                    value={histDraft.ballAmt}
                                    onChange={(e) =>
                                      setHistDraft((p) => ({ ...p, ballAmt: e.target.value }))
                                    }
                                  />
                                </div>

                                <div style={ui.micro}>
                                  顯示預覽：季繳 {parseIntSafe(histDraft.seasonCount)}人 / {fmtMoney(parseMoney(histDraft.seasonAmt))}｜
                                  臨打 {parseIntSafe(histDraft.casualCount)}人 / {fmtMoney(parseMoney(histDraft.casualAmt))}｜
                                  季繳請假 {parseIntSafe(histDraft.leaveCount)}人 / {fmtMoney(parseMoney(histDraft.leaveAmt))}｜
                                  總計 {fmtMoney(parseMoney(histDraft.totalAmt))}｜
                                  已收費 {fmtMoney(parseMoney(histDraft.collectedAmt))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={ui.micro}>（目前沒有歷史紀錄）</div>
                )
              ) : (
                <div style={ui.micro}>（已收折）</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ✅ 置中小 Toast：已選擇（不影響版面） */}
      {selectedPlayer ? (
        <div className="selectedToast">
          <div className="selectedToastInner">
            <div className="toastGoose" style={{ ...ui.card, padding: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  textAlign: "center",
                }}
              >
                <div style={{ fontWeight: 900, minWidth: 120 }}>
                  已選擇：{selectedPlayer.name}
                </div>

                <button
                  className={`${ctl} ${ctlPad}`}
                  style={ui.btnSoft}
                  onClick={() => setSelectedId("")}
                >
                  取消
                </button>

                <button
                  className={`${ctl} ${ctlPad}`}
                  style={ui.btnSoft}
                  onClick={() => placeSelected({ type: "bench" })}
                >
                  放回
                </button>
              </div>

              <div style={{ ...ui.micro, marginTop: 6, textAlign: "center" }}>
                點目的地格子放置；點到有人會交換並跳確認
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="topBar" style={ui.topBar}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <h2 style={ui.h2}>早安羽球排點系統</h2>
            <span style={ui.badge}>總人數 {totalPeople}</span>

            <span
              style={{
                ...ui.badge,
                cursor: "pointer",
                borderColor: "rgba(244,63,94,.25)",
              }}
              title="長按 3 秒設定臨打費用/繳費（僅顯示在頂部）"
              onMouseDown={startFeePress}
              onMouseUp={cancelFeePress}
              onMouseLeave={cancelFeePress}
              onTouchStart={startFeePress}
              onTouchEnd={cancelFeePress}
              onTouchCancel={cancelFeePress}
            >
              {feeLine ? feeLine : "臨打費用/繳費（長按3秒設定）"}
            </span>
          </div>

          <div style={ui.hint}>
            上 4 = 上場｜下 4 = 排隊｜右側 = 休息｜拖曳或
            <span style={{ color: "#EF4444", fontWeight: 900 }}>點選</span>人 →
            點格子放置（建議用點選）｜
            固定格互換會先確認｜下場自動補位＋推進｜各區塊自動依性別/姓名排序
          </div>
        </div>

        {/* ===== Controls ===== */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className={`${ctl} ${ctlPad}`}
            style={{
              ...ui.btnSoft,
              opacity: canUndo ? 1 : 0.45,
              cursor: canUndo ? "pointer" : "not-allowed",
            }}
            disabled={!canUndo}
            onClick={undo}
            title="上一步（Undo）"
          >
            上一步
          </button>

          <button
            className={`${ctl} ${ctlPad}`}
            style={{
              ...ui.btnSoft,
              opacity: canRedo ? 1 : 0.45,
              cursor: canRedo ? "pointer" : "not-allowed",
            }}
            disabled={!canRedo}
            onClick={redo}
            title="下一步（Redo）"
          >
            下一步
          </button>

          <button
            className={`${ctl} ${ctlPad}`}
            style={ui.btnSoft}
            onClick={toggleFullscreen}
            title="全螢幕"
          >
            {isFullscreen ? "離開全螢幕" : "全螢幕"}
          </button>

          <button
            className={`${ctl} ${ctlPad}`}
            style={ui.btnSoft}
            onClick={openRosterModal}
            title="名單匯入/匯出"
          >
            名單
          </button>

          <button
            className={`${ctl} ${ctlPad}`}
            style={ui.btnSoft}
            onClick={openChargeModal}
            title="收費清單 / 用球紀錄 / 歷史"
          >
            收費
          </button>
        </div>
      </div>

      <div className="layout">
        {/* Left */}
        <div>
          <div style={ui.sectionTitle}>
            <span>上場區（4 面）</span>
            <button
              className={`${ctl} ${ctlPad}`}
              style={ui.btnSoft}
              onClick={() => toggleSection("courts")}
            >
              {state.ui.showCourts ? "收折" : "展開"}
            </button>
          </div>

          {state.ui.showCourts ? (
            <div className="grid4">
              {state.courts.map((court, ci) => {
                const empty = isAllEmpty(court.slots);
                const elapsed = court.startTs
                  ? Math.max(0, Math.floor((Date.now() - court.startTs) / 1000))
                  : 0;

                return (
                  <div key={ci} className="cardBox" style={ui.card}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <input
                        className={`${ctl} ${ctlPad}`}
                        value={court.name}
                        onChange={(e) => setCourtName(ci, e.target.value)}
                        style={{
                          ...ui.input,
                          fontWeight: 900,
                          flex: 1,
                          minWidth: 140,
                        }}
                      />

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={ui.micro}>
                          {court.startTs
                            ? `上場時間 ${formatHMS(elapsed)}`
                            : "未開始"}
                        </div>
                        <button
                          className={`${ctlDanger} ${ctlPad}`}
                          style={ui.btnDanger}
                          onClick={() => endCourt(ci)}
                          disabled={empty}
                        >
                          下場
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr",
                        gap: 8,
                      }}
                    >
                      {court.slots.map((pid, si) => {
                        const p = pid ? state.players[pid] : null;
                        const bg = p
                          ? genderBg(p.gender)
                          : "rgba(248,250,252,.9)";

                        return (
                          <div
                            key={si}
                            className="slotBox"
                            style={{
                              ...ui.slot,
                              background: bg,
                              ...(pid && pid === selectedId ? selectedRing : null),
                            }}
                            onDragOver={allowDrop}
                            onDrop={(e) => dropTo(e, { type: "court", ci, si })}
                            onClick={() =>
                              onSlotClick({ type: "court", ci, si }, pid)
                            }
                          >
                            {p ? (
                              <div
                                draggable
                                onDragStart={(e) => dragStart(e, pid)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pickPlayer(pid);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                  flexWrap: "nowrap",
                                }}
                              >
                                <span style={ui.nameStyle}>
                                  {shortName(p.name, 7)}
                                </span>
                                <span style={ui.pill}>{p.games}</span>
                              </div>
                            ) : (
                              <EmptySlot />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div style={{ ...ui.sectionTitle, marginTop: 14 }}>
            <span>排隊區（4 組：順位 1~4）</span>
            <button
              className={`${ctl} ${ctlPad}`}
              style={ui.btnSoft}
              onClick={() => toggleSection("queues")}
            >
              {state.ui.showQueues ? "收折" : "展開"}
            </button>
          </div>

          {state.ui.showQueues ? (
            <div className="grid4">
              {state.queues.map((group, gi) => (
                <div key={gi} className="cardBox" style={ui.card}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>排隊 {gi + 1}</div>
                    <div style={ui.micro}>{group.filter(Boolean).length}/4</div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr",
                      gap: 8,
                    }}
                  >
                    {group.map((pid, si) => {
                      const p = pid ? state.players[pid] : null;
                      const bg = p
                        ? genderBg(p.gender)
                        : "rgba(248,250,252,.9)";

                      return (
                        <div
                          key={si}
                          className="slotBox"
                          style={{
                            ...ui.slot,
                            background: bg,
                            ...(pid && pid === selectedId ? selectedRing : null),
                          }}
                          onDragOver={allowDrop}
                          onDrop={(e) => dropTo(e, { type: "queue", gi, si })}
                          onClick={() =>
                            onSlotClick({ type: "queue", gi, si }, pid)
                          }
                        >
                          {p ? (
                            <div
                              draggable
                              onDragStart={(e) => dragStart(e, pid)}
                              onClick={(e) => {
                                e.stopPropagation();
                                pickPlayer(pid);
                              }}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 0,
                                flexWrap: "nowrap",
                              }}
                            >
                              <span style={ui.nameStyle}>
                                {shortName(p.name, 7)}
                              </span>
                              <span style={ui.pill}>{p.games}</span>
                            </div>
                          ) : (
                            <EmptySlot />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Right */}
        <div className="benchSticky">
          <div style={ui.sectionTitle}>
            <span>休息區</span>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                className={`${state.ui.showDelete ? ctlDanger : ctl} ${ctlPad}`}
                style={state.ui.showDelete ? ui.btnDanger : ui.btnSoft}
                onClick={() => toggleSection("delete")}
                title="開啟後才會顯示每個人右側的刪除按鈕"
              >
                刪除：{state.ui.showDelete ? "開" : "關"}
              </button>

              <button
                className={`${ctl} ${ctlPad}`}
                style={ui.btnSoft}
                onClick={() => toggleSection("bench")}
              >
                {state.ui.showBench ? "收折" : "展開"}
              </button>
            </div>
          </div>

          <div
            className="benchBox"
            style={ui.benchCard}
            onDragOver={allowDrop}
            onDrop={(e) => dropTo(e, { type: "bench" })}
          >
            {state.ui.showBench ? (
              <>
                <div
                  className="cardBox"
                  style={{
                    ...ui.card,
                    padding: 10,
                    boxShadow: "none",
                    marginBottom: 10,
                  }}
                >
                  <div className="formRow" style={ui.formRow}>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, minWidth: 160, flex: 1 }}
                      placeholder="新增隊員姓名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <select
                      className={`${ctl} ${ctlPad}`}
                      style={ui.select}
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                    >
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                    <button
                      className={`${ctl} ${ctlPad}`}
                      style={ui.btn}
                      onClick={addPlayer}
                    >
                      新增
                    </button>
                  </div>
                  <div style={{ marginTop: 8, ...ui.micro }}>
                    新增隊員預設分類＝臨打（需要分類/請假替補請用「名單匯入/匯出」）
                  </div>
                </div>

                <div className="benchScrollArea">
                  <div className="benchList2" style={ui.list2}>
                    {benchPlayers.map((p) => (
                      <div
                        key={p.id}
                        className="benchItemBox"
                        draggable
                        onDragStart={(e) => dragStart(e, p.id)}
                        onClick={() => pickPlayer(p.id)}
                        style={{
                          ...ui.benchItem,
                          background: genderBg(p.gender),
                          ...(p.id && p.id === selectedId ? selectedRing : null),
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 0,
                            flexWrap: "nowrap",
                          }}
                        >
                          <span style={ui.nameStyle}>
                            {shortName(p.name, 7)}
                          </span>
                          <span style={ui.pill}>{p.games}</span>
                        </div>

                        {state.ui.showDelete ? (
                          <button
                            className={`${ctl} ${ctlPad}`}
                            style={ui.btn}
                            onClick={(e) => {
                              e.stopPropagation();
                              removePlayer(p.id);
                            }}
                          >
                            刪
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, ...ui.micro }}>
                    下場流程：本場回休息 → 排隊1補位（不足4也補） → 排隊2/3/4往前推 →
                    本場重新計時
                  </div>
                </div>
              </>
            ) : (
              <div style={ui.micro}>（已收折）</div>
            )}
          </div>
        </div>
      </div>

      <div
        style={{ ...ui.version, cursor: "pointer", userSelect: "none" }}
        onMouseDown={startResetPress}
        onMouseUp={cancelResetPress}
        onMouseLeave={cancelResetPress}
        onTouchStart={startResetPress}
        onTouchEnd={cancelResetPress}
        onTouchCancel={cancelResetPress}
      >
        {VERSION_NAME} · 更新時間：{VERSION_TIME}
      </div>
    </div>
  );
}