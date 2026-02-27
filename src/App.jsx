import React, { useEffect, useMemo, useReducer, useState } from "react";

/**
 * v1.1.2 + Build time (部署時間)
 */
const VERSION_NAME = "v1.1.2";
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

// ===== 預設休息區名單（依你提供順序）=====
// gender 只用來上色（不顯示文字）
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

// 名字超過 5 個「字元」以 ... 代替（支援中英混合）
function shortName(name, max = 5) {
  const arr = Array.from(String(name || ""));
  if (arr.length <= max) return arr.join("");
  return arr.slice(0, max).join("") + "...";
}

function buildDefaultPlayersAndBench() {
  const players = {};
  const bench = [];

  DEFAULT_ROSTER.forEach((r, i) => {
    const id = `d${String(i + 1).padStart(3, "0")}`;
    players[id] = {
      id,
      name: String(r.name || "").trim(),
      gender: r.gender === "女" ? "女" : "男",
      games: 0,
      totalSeconds: 0,
    };
    bench.push(id);
  });

  return { players, bench };
}

function initialState() {
  const { players, bench } = buildDefaultPlayersAndBench();
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
    },
    config: {
      feeText: "",
      payTo: "",
    },
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
    next.players[id] = {
      id,
      name: String(p?.name ?? ""),
      gender: p?.gender === "女" ? "女" : "男",
      games: typeof p?.games === "number" ? p.games : 0,
      totalSeconds: typeof p?.totalSeconds === "number" ? p.totalSeconds : 0,
    };
  }

  // bench 去除不存在與重複 id（順序之後會由 sort 重新決定）
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
  };

  next.config = {
    feeText: String(next.config?.feeText ?? base.config.feeText),
    payTo: String(next.config?.payTo ?? base.config.payTo),
  };

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

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function genderBg(g) {
  if (g === "男") return "#DCEBFF";
  if (g === "女") return "#FFE0EF";
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

// 人被移走後，如果場地變空，計時要歸零
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

/** ===== 依性別→名稱排序（女先男後，空位最後） ===== */
function genderOrder(g) {
  return g === "女" ? 0 : 1; // 女先
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
  const empties = Array.from({ length: Math.max(0, fixedLen - filled.length) }, () => "");
  return [...filled, ...empties].slice(0, fixedLen);
}

function sortAllBlocks(st) {
  const next = st;

  // bench：整個名單排序
  next.bench = sortIdsFilledFirst(next.bench, next.players, null);

  // queues：每一組 4 格排序（空格最後）
  next.queues = next.queues.map((g) => sortIdsFilledFirst(g, next.players, 4));

  // courts：每一場 4 格排序（空格最後）
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

/** ====== History (Undo/Redo) ====== */
const HISTORY_LIMIT = 20;

function clampStack(arr, limit = HISTORY_LIMIT) {
  if (arr.length <= limit) return arr;
  return arr.slice(arr.length - limit);
}

function historyInit() {
  const present = sortAllBlocks(loadState()); // load + normalize already done in loadState()
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

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, null, historyInit);
  const state = history.present;

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  function applyState(updater) {
    dispatch({ type: "APPLY", updater });
  }

  function undo() {
    dispatch({ type: "UNDO" });
    setSelectedId("");
  }

  function redo() {
    dispatch({ type: "REDO" });
    setSelectedId("");
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
    } catch (e) {
      alert("無法切換全螢幕（可能是 iPad Safari 限制）。");
    }
  }

  // 新增隊員（移到休息區）
  const [name, setName] = useState("");
  const [gender, setGender] = useState("男");

  // 點選模式：先選人，再點目的地格子放置 / 交換
  const [selectedId, setSelectedId] = useState("");

  // 只為了每秒重繪（讓「場地上場時間」會跳秒）
  const [tick, setTick] = useState(nowSec());
  const [pressTimer, setPressTimer] = useState(null);

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

  function addPlayer() {
    const n = name.trim();
    if (!n) return;

    const exists = Object.values(state.players).some((p) => p.name === n);
    if (exists) {
      alert("已有同名隊員，請改名或加註。");
      return;
    }

    const id = uid();
    const p = { id, name: n, gender, games: 0, totalSeconds: 0 };

    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.players[id] = p;
      next.bench.unshift(id);
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
      return next;
    });
  }

  function setFeeText(v) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.config.feeText = v;
      return next;
    });
  }

  function setPayTo(v) {
    applyState((prev) => {
      const next = structuredClone(normalize(prev));
      next.config.payTo = v;
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
        next.bench.unshift(id);
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
        if (replaced) next.bench.unshift(replaced);
        return next;
      }

      if (target.type === "court") {
        const court = next.courts[target.ci];
        const replaced = court.slots[target.si];
        court.slots[target.si] = id;
        if (replaced) next.bench.unshift(replaced);
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
        next.bench.unshift(id);
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
        if (replaced) next.bench.unshift(replaced);
        return next;
      }

      if (target.type === "court") {
        const court = next.courts[target.ci];
        const replaced = court.slots[target.si];
        court.slots[target.si] = id;
        if (replaced) next.bench.unshift(replaced);
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

      for (const pid of hadPlayers) next.bench.unshift(pid);

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

  // 休息區名單（state 內已排序）
  const benchPlayers = useMemo(() => {
    return state.bench.map((id) => state.players[id]).filter(Boolean);
  }, [state.players, state.bench]);

  const totalPeople = useMemo(() => {
    return Object.keys(state.players || {}).length;
  }, [state.players]);

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
    },
  };

  const EmptySlot = () => <span style={ui.ghostDot}>.</span>;

  // GitHub Pages/全域 CSS 可能把控制項文字弄成透明或 font-size=0，這裡強制修正
  const ctl = "ctlTextFix";
  const ctlDanger = "ctlTextFixDanger";
  const ctlPad = "ctlPadFix";

  const feeLine = useMemo(() => {
    const fee = (state.config?.feeText || "").trim();
    const payTo = (state.config?.payTo || "").trim();
    if (!fee && !payTo) return "";
    if (fee && payTo) return `臨打費用$${fee}，繳費給: ${payTo}`;
    if (fee && !payTo) return `臨打費用$${fee}`;
    return `繳費給: ${payTo}`;
  }, [state.config?.feeText, state.config?.payTo]);

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

        /* 固定高度＋內部可捲動：只捲「名單區」 */
        .benchScrollArea{
          max-height: clamp(360px, calc(100vh - 360px), 640px);
          overflow-y: auto;
          padding-right: 6px;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }

        /* 文字顯示修正：避免被全域 reset / !important 蓋掉 */
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
      `}</style>

      <div className="topBar" style={ui.topBar}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={ui.h2}>早安羽球排點系統</h2>
            <span style={ui.badge}>總人數 {totalPeople}</span>
            {feeLine ? <span style={ui.badge}>{feeLine}</span> : null}
          </div>

          <div style={ui.hint}>
            上 4 = 上場｜下 4 = 排隊｜右側 = 休息｜拖曳或點選人→點格子放置｜固定格互換會先確認｜下場自動補位＋推進｜各區塊自動依性別/姓名排序
          </div>

          {/* 費用設定（可輸入） */}
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input
              className={`${ctl} ${ctlPad}`}
              style={{ ...ui.input, padding: "8px 10px", width: 160 }}
              placeholder="臨打費用（數字/文字）"
              value={state.config?.feeText ?? ""}
              onChange={(e) => setFeeText(e.target.value)}
            />
            <input
              className={`${ctl} ${ctlPad}`}
              style={{ ...ui.input, padding: "8px 10px", width: 200 }}
              placeholder="繳費給（姓名/暱稱）"
              value={state.config?.payTo ?? ""}
              onChange={(e) => setPayTo(e.target.value)}
            />
          </div>
        </div>

        {/* ===== Undo / Redo / Fullscreen ===== */}
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
        </div>
      </div>

      {selectedPlayer ? (
        <div className="cardBox" style={{ ...ui.card, padding: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 900 }}>
              已選擇：{selectedPlayer.name}（點目的地格子放置 / 點到有人會交換並跳確認）
            </div>
            <button className={`${ctl} ${ctlPad}`} style={ui.btnSoft} onClick={() => setSelectedId("")}>
              取消選取
            </button>
            <button className={`${ctl} ${ctlPad}`} style={ui.btnSoft} onClick={() => placeSelected({ type: "bench" })}>
              放回休息區
            </button>
          </div>
        </div>
      ) : null}

      <div className="layout">
        {/* Left: courts + queues */}
        <div>
          <div style={ui.sectionTitle}>
            <span>上場區（4 面）</span>
            <button className={`${ctl} ${ctlPad}`} style={ui.btnSoft} onClick={() => toggleSection("courts")}>
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
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                      <input
                        className={`${ctl} ${ctlPad}`}
                        value={court.name}
                        onChange={(e) => setCourtName(ci, e.target.value)}
                        style={{ ...ui.input, fontWeight: 900, flex: 1, minWidth: 140 }}
                      />

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={ui.micro}>
                          {court.startTs ? `上場時間 ${formatHMS(elapsed)}` : "未開始"}
                        </div>
                        <button className={`${ctlDanger} ${ctlPad}`} style={ui.btnDanger} onClick={() => endCourt(ci)} disabled={empty}>
                          下場
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                      {court.slots.map((pid, si) => {
                        const p = pid ? state.players[pid] : null;
                        const bg = p ? genderBg(p.gender) : "rgba(248,250,252,.9)";

                        return (
                          <div
                            key={si}
                            className="slotBox"
                            style={{
                              ...ui.slot,
                              background: bg,
                              outline: pid && pid === selectedId ? "3px solid rgba(34,197,94,.85)" : "none",
                              outlineOffset: 2,
                            }}
                            onDragOver={allowDrop}
                            onDrop={(e) => dropTo(e, { type: "court", ci, si })}
                            onClick={() => onSlotClick({ type: "court", ci, si }, pid)}
                          >
                            {p ? (
                              <div
                                draggable
                                onDragStart={(e) => dragStart(e, pid)}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  pickPlayer(pid);
                                }}
                                style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "nowrap" }}
                              >
                                <span style={ui.nameStyle}>{shortName(p.name, 5)}</span>
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
            <button className={`${ctl} ${ctlPad}`} style={ui.btnSoft} onClick={() => toggleSection("queues")}>
              {state.ui.showQueues ? "收折" : "展開"}
            </button>
          </div>

          {state.ui.showQueues ? (
            <div className="grid4">
              {state.queues.map((group, gi) => (
                <div key={gi} className="cardBox" style={ui.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <div style={{ fontWeight: 900 }}>排隊 {gi + 1}</div>
                    <div style={ui.micro}>{group.filter(Boolean).length}/4</div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                    {group.map((pid, si) => {
                      const p = pid ? state.players[pid] : null;
                      const bg = p ? genderBg(p.gender) : "rgba(248,250,252,.9)";

                      return (
                        <div
                          key={si}
                          className="slotBox"
                          style={{
                            ...ui.slot,
                            background: bg,
                            outline: pid && pid === selectedId ? "3px solid rgba(34,197,94,.85)" : "none",
                            outlineOffset: 2,
                          }}
                          onDragOver={allowDrop}
                          onDrop={(e) => dropTo(e, { type: "queue", gi, si })}
                          onClick={() => onSlotClick({ type: "queue", gi, si }, pid)}
                        >
                          {p ? (
                            <div
                              draggable
                              onDragStart={(e) => dragStart(e, pid)}
                              onClick={(e) => {
                                e.stopPropagation();
                                pickPlayer(pid);
                              }}
                              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "nowrap" }}
                            >
                              <span style={ui.nameStyle}>{shortName(p.name, 5)}</span>
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

        {/* Right: bench */}
        <div className="benchSticky">
          <div style={ui.sectionTitle}>
            <span>休息區</span>
            <button className={`${ctl} ${ctlPad}`} style={ui.btnSoft} onClick={() => toggleSection("bench")}>
              {state.ui.showBench ? "收折" : "展開"}
            </button>
          </div>

          <div className="benchBox" style={ui.benchCard} onDragOver={allowDrop} onDrop={(e) => dropTo(e, { type: "bench" })}>
            {state.ui.showBench ? (
              <>
                {/* 新增區（不捲動，永遠在上方） */}
                <div className="cardBox" style={{ ...ui.card, padding: 10, boxShadow: "none", marginBottom: 10 }}>
                  <div className="formRow" style={ui.formRow}>
                    <input
                      className={`${ctl} ${ctlPad}`}
                      style={{ ...ui.input, minWidth: 160, flex: 1 }}
                      placeholder="新增隊員姓名"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <select className={`${ctl} ${ctlPad}`} style={ui.select} value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="男">男</option>
                      <option value="女">女</option>
                    </select>
                    <button className={`${ctl} ${ctlPad}`} style={ui.btn} onClick={addPlayer}>
                      新增
                    </button>
                  </div>
                </div>

                {/* 名單區：固定高度＋內部可捲動 */}
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
                          outline: p.id && p.id === selectedId ? "3px solid rgba(34,197,94,.85)" : "none",
                          outlineOffset: 2,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "nowrap" }}>
                          <span style={ui.nameStyle}>{shortName(p.name, 5)}</span>
                          <span style={ui.pill}>{p.games}</span>
                        </div>

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
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, ...ui.micro }}>
                    下場流程：本場回休息 → 排隊1補位（不足4也補） → 排隊2/3/4往前推 → 本場重新計時
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
        onMouseDown={() => {
          const timer = setTimeout(async () => {
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
          setPressTimer(timer);
        }}
        onMouseUp={() => pressTimer && clearTimeout(pressTimer)}
        onMouseLeave={() => pressTimer && clearTimeout(pressTimer)}
        onTouchStart={() => {
          const timer = setTimeout(async () => {
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
          setPressTimer(timer);
        }}
        onTouchEnd={() => pressTimer && clearTimeout(pressTimer)}
      >
        {VERSION_NAME} · 更新時間：{VERSION_TIME}
      </div>
    </div>
  );
}