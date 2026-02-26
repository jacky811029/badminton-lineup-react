import React, { useEffect, useMemo, useState } from "react";

/**
 * v1.0.0 + Build time (部署時間)
 * - 版本號你之後只要改 VERSION_NAME 即可
 * - VERSION_TIME 會在 build 時固定（GitHub Pages 每次部署會變）
 */
const VERSION_NAME = "v1.0.0";
const VERSION_TIME = new Date().toLocaleString("zh-TW", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const STORAGE_KEY = "badminton_lineup_local_v7";

function emptySlots(groups, slots) {
  return Array.from({ length: groups }, () =>
    Array.from({ length: slots }, () => "")
  );
}

function initialState() {
  return {
    players: {
      // [id]: { id, name, gender: "男"|"女", games: 0, totalSeconds: 0 }
    },
    bench: [], // [id...]
    queues: emptySlots(4, 4), // 排隊1~4，每組 4 格
    courts: Array.from({ length: 4 }, (_, i) => ({
      name: `場地 ${i + 1}`,
      slots: ["", "", "", ""],
      startTs: 0,
    })),
    ui: {
      showCourts: true,
      showQueues: true,
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
  if (g === "男") return "#DCEBFF"; // 粉藍
  if (g === "女") return "#FFE0EF"; // 粉紅
  return "#EEF2F7";
}

function removeEverywhere(next, id) {
  next.bench = next.bench.filter((x) => x !== id);
  next.queues = next.queues.map((g) => g.map((x) => (x === id ? "" : x)));
  next.courts = next.courts.map((c) => ({
    ...c,
    slots: c.slots.map((x) => (x === id ? "" : x)),
  }));
}

function isAllEmpty(arr) {
  return arr.every((x) => !x);
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

export default function App() {
  const [state, setState] = useState(loadState);

  const [name, setName] = useState("");
  const [gender, setGender] = useState("男");

  // 動態上場時間（每秒更新）
  const [tick, setTick] = useState(nowSec());

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const t = setInterval(() => setTick(nowSec()), 1000);
    return () => clearInterval(t);
  }, []);

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

    setState((prev) => {
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

    setState((prev) => {
      const next = structuredClone(normalize(prev));
      removeEverywhere(next, id);
      delete next.players[id];
      return next;
    });
  }

  function setCourtName(ci, value) {
    setState((prev) => {
      const next = structuredClone(normalize(prev));
      next.courts[ci].name = value;
      return next;
    });
  }

  function toggleSection(key) {
    setState((prev) => {
      const next = structuredClone(normalize(prev));
      if (key === "courts") next.ui.showCourts = !next.ui.showCourts;
      if (key === "queues") next.ui.showQueues = !next.ui.showQueues;
      return next;
    });
  }

  // ---------- Drag & Drop ----------
  function allowDrop(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function dragStart(e, id) {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }

  // target: {type:"bench"} | {type:"queue", gi, si} | {type:"court", ci, si}
  function dropTo(e, target) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    setState((prev) => {
      const next = structuredClone(normalize(prev));
      if (!next.players[id]) return prev;

      removeEverywhere(next, id);

      if (target.type === "bench") {
        next.bench.unshift(id);
        return next;
      }

      if (target.type === "queue") {
        const { gi, si } = target;
        const replaced = next.queues[gi][si];
        next.queues[gi][si] = id;
        if (replaced) next.bench.unshift(replaced);
        return next;
      }

      if (target.type === "court") {
        const { ci, si } = target;
        const court = next.courts[ci];
        const replaced = court.slots[si];
        court.slots[si] = id;
        if (replaced) next.bench.unshift(replaced);

        if (court.startTs === 0 && !isAllEmpty(court.slots)) {
          court.startTs = Date.now();
        }
        return next;
      }

      return next;
    });
  }

  // ---------- Running seconds for players currently on court ----------
  const playerRunningSeconds = useMemo(() => {
    const map = {};
    for (let ci = 0; ci < 4; ci++) {
      const court = state.courts[ci];
      if (!court.startTs) continue;
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - court.startTs) / 1000)
      );
      for (const pid of court.slots) {
        if (pid) map[pid] = elapsed;
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courts, tick]);

  // ---------- End court flow ----------
  function endCourt(ci) {
    setState((prev) => {
      const next = structuredClone(normalize(prev));
      const court = next.courts[ci];

      const hadPlayers = court.slots.filter(Boolean);
      if (hadPlayers.length === 0) return prev;

      const elapsed = court.startTs
        ? Math.max(0, Math.floor((Date.now() - court.startTs) / 1000))
        : 0;

      // accumulate
      for (const pid of hadPlayers) {
        const p = next.players[pid];
        if (p) {
          p.games += 1;
          p.totalSeconds += elapsed;
        }
      }

      // move to bench
      for (const pid of hadPlayers) next.bench.unshift(pid);

      // clear court
      court.slots = ["", "", "", ""];
      court.startTs = 0;

      // queue1 -> court (even < 4 is fine)
      const q1 = next.queues[0];
      const incoming = q1.filter(Boolean);
      for (let i = 0; i < 4; i++) {
        court.slots[i] = incoming[i] || "";
      }

      // shift queues forward
      next.queues[0] = next.queues[1];
      next.queues[1] = next.queues[2];
      next.queues[2] = next.queues[3];
      next.queues[3] = ["", "", "", ""];

      // restart time if someone is on court
      court.startTs = isAllEmpty(court.slots) ? 0 : Date.now();

      return next;
    });
  }

  function resetAll() {
    if (!confirm("要全部清空回到初始狀態嗎？（人員名單也會刪除）")) return;
    setState(initialState());
  }

  const benchPlayers = useMemo(() => {
    const ids = new Set(state.bench);
    return Object.values(state.players)
      .filter((p) => ids.has(p.id))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [state.players, state.bench]);

  // ----- Nordic cute styles + responsive (mobile-first) -----
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
    titleRow: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      marginBottom: 8,
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
    },
    name: {
      fontWeight: 900,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
      maxWidth: 120,
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
    benchItem: {
      border: "1px solid rgba(15,23,42,.10)",
      borderRadius: 14,
      padding: "8px 10px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    ghostDot: { opacity: 0, fontSize: 12 },
    version: {
      marginTop: 18,
      fontSize: 12,
      color: "#94A3B8",
      textAlign: "center",
    },
  };

  const EmptySlot = () => <span style={ui.ghostDot}>.</span>;

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
          .resetBtn { width: 100%; }
          .formRow input, .formRow select, .formRow button {
            width: 100%;
            box-sizing: border-box;
          }
          .grid4 { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="topBar" style={ui.topBar}>
        <div style={{ flex: 1 }}>
          <h2 style={ui.h2}>羽球排點板</h2>
          <div style={ui.hint}>
            上 4 = 上場｜下 4 = 排隊｜右側 = 休息｜手動拖曳｜下場自動補位＋推進
          </div>
        </div>
        <button className="resetBtn" style={ui.btn} onClick={resetAll}>
          全部重置
        </button>
      </div>

      {/* 新增（已移除「搜尋休息區」） */}
      <div style={{ ...ui.card, marginBottom: 12 }}>
        <div className="formRow" style={ui.formRow}>
          <input
            style={{ ...ui.input, minWidth: 220 }}
            placeholder="新增隊員姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            style={ui.select}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
          <button style={ui.btn} onClick={addPlayer}>
            新增
          </button>
        </div>
      </div>

      <div className="layout">
        {/* Left: courts + queues */}
        <div>
          <div style={ui.sectionTitle}>
            <span>上場區（4 面）</span>
            <button style={ui.btnSoft} onClick={() => toggleSection("courts")}>
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
                  <div key={ci} style={ui.card}>
                    <div style={ui.titleRow}>
                      <input
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
                          {court.startTs ? `上場時間 ${formatHMS(elapsed)}` : "未開始"}
                        </div>
                        <button
                          style={ui.btnDanger}
                          onClick={() => endCourt(ci)}
                          disabled={empty}
                        >
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
                            style={{ ...ui.slot, background: bg }}
                            onDragOver={allowDrop}
                            onDrop={(e) => dropTo(e, { type: "court", ci, si })}
                          >
                            {p ? (
                              <div
                                draggable
                                onDragStart={(e) => dragStart(e, pid)}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 8,
                                  minWidth: 0,
                                  flexWrap: "wrap",
                                }}
                              >
                                <span style={ui.name}>{p.name}</span>
                                <span style={ui.pill}>{p.gender}</span>
                                <span style={ui.pill}>次數 {p.games}</span>
                                <span style={ui.pill}>
                                  累計{" "}
                                  {formatHMS(p.totalSeconds + (playerRunningSeconds[pid] || 0))}
                                </span>
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
            <button style={ui.btnSoft} onClick={() => toggleSection("queues")}>
              {state.ui.showQueues ? "收折" : "展開"}
            </button>
          </div>

          {state.ui.showQueues ? (
            <div className="grid4">
              {state.queues.map((group, gi) => (
                <div key={gi} style={ui.card}>
                  <div style={ui.titleRow}>
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
                          style={{ ...ui.slot, background: bg }}
                          onDragOver={allowDrop}
                          onDrop={(e) => dropTo(e, { type: "queue", gi, si })}
                        >
                          {p ? (
                            <div
                              draggable
                              onDragStart={(e) => dragStart(e, pid)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 8,
                                minWidth: 0,
                                flexWrap: "wrap",
                              }}
                            >
                              <span style={ui.name}>{p.name}</span>
                              <span style={ui.pill}>{p.gender}</span>
                              <span style={ui.pill}>次數 {p.games}</span>
                              <span style={ui.pill}>
                                累計{" "}
                                {formatHMS(p.totalSeconds + (playerRunningSeconds[pid] || 0))}
                              </span>
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
        <div
          style={ui.benchCard}
          onDragOver={allowDrop}
          onDrop={(e) => dropTo(e, { type: "bench" })}
        >
          <div style={ui.titleRow}>
            <div style={{ fontWeight: 900 }}>休息區</div>
            <div style={ui.micro}>人數：{state.bench.length}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {benchPlayers.map((p) => {
              const running = playerRunningSeconds[p.id] || 0;
              const totalShow = p.totalSeconds + running;

              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => dragStart(e, p.id)}
                  style={{ ...ui.benchItem, background: genderBg(p.gender) }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ ...ui.name, maxWidth: 160 }}>{p.name}</span>
                      <span style={ui.pill}>{p.gender}</span>
                      <span style={ui.pill}>次數 {p.games}</span>
                      <span style={ui.pill}>累計 {formatHMS(totalShow)}</span>
                    </div>
                    {running ? (
                      <div style={ui.micro}>（目前在場：+{formatHMS(running)}）</div>
                    ) : null}
                  </div>

                  <button style={ui.btn} onClick={() => removePlayer(p.id)}>
                    刪
                  </button>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 10, ...ui.micro }}>
            下場流程：本場回休息 → 排隊1補位（不足4也補） → 排隊2/3/4往前推 → 本場重新計時
          </div>
        </div>
      </div>

      <div style={ui.version}>
        {VERSION_NAME} · 更新時間：{VERSION_TIME}
      </div>
    </div>
  );
}