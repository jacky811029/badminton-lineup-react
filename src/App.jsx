import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "badminton_lineup_local_v4";

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
    queues: emptySlots(4, 4), // 4 組排隊（順位1~4），每組 4 槽
    courts: Array.from({ length: 4 }, (_, i) => ({
      name: `場地 ${i + 1}`,
      slots: ["", "", "", ""],
      startTs: 0,
    })),
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

  // queues 固定 4x4
  const q = Array.isArray(next.queues) ? next.queues : emptySlots(4, 4);
  next.queues = Array.from({ length: 4 }, (_, gi) => {
    const row = q[gi] || [];
    return Array.from({ length: 4 }, (_, si) => row[si] || "");
  });

  // courts 固定 4 面，每面 slots 4 + name
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

  // players 防呆：補 games/totalSeconds
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

  // bench 去重 + 排除不存在
  const seen = new Set();
  next.bench = next.bench.filter((id) => {
    if (!next.players[id]) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

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
  if (g === "男") return "#DBEAFE"; // 粉藍
  if (g === "女") return "#FCE7F3"; // 粉紅
  return "#F3F4F6";
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
  const [search, setSearch] = useState("");

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

  // 場地命名
  function setCourtName(ci, value) {
    setState((prev) => {
      const next = structuredClone(normalize(prev));
      next.courts[ci].name = value;
      return next;
    });
  }

  // ---------- 拖放 ----------
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

      // 先移除原位置
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

        // 若這面原本未開始且現在有任何人，就開始計時
        if (court.startTs === 0 && !isAllEmpty(court.slots)) {
          court.startTs = Date.now();
        }
        return next;
      }

      return next;
    });
  }

  // ---------- 統計：目前在場上的 runningSeconds（用於顯示累計+目前這一輪） ----------
  const playerRunningSeconds = useMemo(() => {
    const map = {}; // id -> runningSeconds
    for (let ci = 0; ci < 4; ci++) {
      const court = state.courts[ci];
      if (!court.startTs) continue;
      const elapsed = Math.max(0, Math.floor((Date.now() - court.startTs) / 1000));
      for (const pid of court.slots) {
        if (pid) map[pid] = elapsed;
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.courts, tick]);

  // ---------- 下場流程 ----------
  // 1) 本場名單 -> 休息區
  // 2) 排隊1 -> 補進本場（不足 4 人也照補，有幾個補幾個）
  // 3) 排隊2/3/4 往前推（2->1, 3->2, 4->3, 4清空）
  // 4) 重新開始計時（只要補進來有人就開始；補進來 0 人則 startTs=0）
  // 5) 累計：本輪在場的每人 games+1、totalSeconds += elapsed
  function endCourt(ci) {
    setState((prev) => {
      const next = structuredClone(normalize(prev));
      const court = next.courts[ci];

      const hadPlayers = court.slots.filter(Boolean);
      if (hadPlayers.length === 0) return prev;

      const elapsed = court.startTs
        ? Math.max(0, Math.floor((Date.now() - court.startTs) / 1000))
        : 0;

      // 累計本輪
      for (const pid of hadPlayers) {
        const p = next.players[pid];
        if (p) {
          p.games += 1;
          p.totalSeconds += elapsed;
        }
      }

      // 本場人回休息區
      for (const pid of hadPlayers) {
        next.bench.unshift(pid);
      }

      // 清空本場
      court.slots = ["", "", "", ""];
      court.startTs = 0;

      // 排隊1補位（有幾個補幾個）
      const q1 = next.queues[0];
      const incoming = q1.filter(Boolean);
      for (let i = 0; i < 4; i++) {
        court.slots[i] = incoming[i] || "";
      }

      // 排隊往前推
      next.queues[0] = next.queues[1];
      next.queues[1] = next.queues[2];
      next.queues[2] = next.queues[3];
      next.queues[3] = ["", "", "", ""];

      // 重新計時：只要有補進來的人就開始
      if (!isAllEmpty(court.slots)) {
        court.startTs = Date.now();
      } else {
        court.startTs = 0;
      }

      return next;
    });
  }

  function resetAll() {
    if (!confirm("要全部清空回到初始狀態嗎？（人員名單也會刪除）")) return;
    setState(initialState());
  }

  // ---------- UI ----------
  const benchPlayers = useMemo(() => {
    const q = search.trim();
    const ids = new Set(state.bench);
    return Object.values(state.players)
      .filter((p) => ids.has(p.id))
      .filter((p) => (q ? p.name.includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [state.players, state.bench, search]);

  // ---------- Styles ----------
  const pageStyle = {
    padding: 16,
    maxWidth: 1400,
    margin: "0 auto",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans TC", Arial',
    color: "#111827",
  };

  const layout = {
    display: "grid",
    gridTemplateColumns: "1.55fr 0.85fr",
    gap: 12,
    alignItems: "start",
  };

  const leftGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  };

  const card = {
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    background: "white",
    padding: 10,
    boxShadow: "0 1px 2px rgba(0,0,0,.04)",
  };

  const titleRow = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 8,
  };

  const slotGrid = {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 8,
  };

  const slotStyleBase = {
    border: "1px dashed #cbd5e1",
    borderRadius: 12,
    padding: 8,
    minHeight: 44,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  };

  const pill = {
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    background: "white",
    color: "#374151",
    whiteSpace: "nowrap",
  };

  const small = { fontSize: 12, color: "#6b7280" };

  // 空槽不顯示「拖人到這裡」，但仍保留四格
  const EmptySlot = () => <span style={{ ...small, opacity: 0.0 }}>.</span>;

  return (
    <div style={pageStyle}>
      <h2 style={{ margin: "0 0 10px 0" }}>羽球排點板（上場 4 區｜排隊 4 區｜右側休息區）</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={resetAll}>全部重置</button>
        <div style={small}>目前為單機版（localStorage）。</div>
      </div>

      {/* 新增 / 搜尋 */}
      <div style={{ ...card, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            style={{ padding: 8, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 220 }}
            placeholder="新增隊員姓名"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            style={{ padding: 8, borderRadius: 10, border: "1px solid #e5e7eb" }}
            value={gender}
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
          <button onClick={addPlayer}>新增</button>

          <input
            style={{ padding: 8, borderRadius: 10, border: "1px solid #e5e7eb", minWidth: 220 }}
            placeholder="搜尋休息區"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div style={layout}>
        {/* 左側：上場 4 + 排隊 4 */}
        <div>
          {/* 上場區 */}
          <div style={{ marginBottom: 10, fontWeight: 900 }}>上場區（4 面）</div>
          <div style={leftGrid}>
            {state.courts.map((court, ci) => {
              const empty = isAllEmpty(court.slots);
              const elapsed = court.startTs
                ? Math.max(0, Math.floor((Date.now() - court.startTs) / 1000))
                : 0;

              return (
                <div key={ci} style={card}>
                  <div style={titleRow}>
                    <input
                      value={court.name}
                      onChange={(e) => setCourtName(ci, e.target.value)}
                      style={{
                        fontWeight: 900,
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: "6px 8px",
                        width: "100%",
                      }}
                    />
                    <div style={small}>{court.startTs ? `上場時間 ${formatHMS(elapsed)}` : "未開始"}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                    <button onClick={() => endCourt(ci)} disabled={empty}>
                      下場
                    </button>
                  </div>

                  <div style={slotGrid}>
                    {court.slots.map((pid, si) => {
                      const p = pid ? state.players[pid] : null;
                      const bg = p ? genderBg(p.gender) : "#f8fafc";

                      return (
                        <div
                          key={si}
                          style={{ ...slotStyleBase, background: bg }}
                          onDragOver={allowDrop}
                          onDrop={(e) => dropTo(e, { type: "court", ci, si })}
                        >
                          {p ? (
                            <div
                              draggable
                              onDragStart={(e) => dragStart(e, pid)}
                              style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}
                            >
                              <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {p.name}
                              </b>
                              <span style={pill}>{p.gender}</span>
                              <span style={pill}>次數 {p.games}</span>
                              <span style={pill}>
                                累計 {formatHMS(p.totalSeconds + (playerRunningSeconds[pid] || 0))}
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

          {/* 排隊區 */}
          <div style={{ margin: "14px 0 10px 0", fontWeight: 900 }}>排隊區（4 組：順位 1~4）</div>
          <div style={leftGrid}>
            {state.queues.map((group, gi) => (
              <div key={gi} style={card}>
                <div style={titleRow}>
                  <div style={{ fontWeight: 900 }}>排隊 {gi + 1}</div>
                  <div style={small}>{group.filter(Boolean).length}/4</div>
                </div>

                <div style={slotGrid}>
                  {group.map((pid, si) => {
                    const p = pid ? state.players[pid] : null;
                    const bg = p ? genderBg(p.gender) : "#f8fafc";

                    return (
                      <div
                        key={si}
                        style={{ ...slotStyleBase, background: bg }}
                        onDragOver={allowDrop}
                        onDrop={(e) => dropTo(e, { type: "queue", gi, si })}
                      >
                        {p ? (
                          <div
                            draggable
                            onDragStart={(e) => dragStart(e, pid)}
                            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flexWrap: "wrap" }}
                          >
                            <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p.name}
                            </b>
                            <span style={pill}>{p.gender}</span>
                            <span style={pill}>次數 {p.games}</span>
                            <span style={pill}>
                              累計 {formatHMS(p.totalSeconds + (playerRunningSeconds[pid] || 0))}
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
        </div>

        {/* 右側：休息區 */}
        <div style={card} onDragOver={allowDrop} onDrop={(e) => dropTo(e, { type: "bench" })}>
          <div style={titleRow}>
            <div style={{ fontWeight: 900 }}>休息區</div>
            <div style={small}>人數：{state.bench.length}</div>
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
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 10,
                    background: genderBg(p.gender),
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <b style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</b>
                      <span style={pill}>{p.gender}</span>
                      <span style={pill}>次數 {p.games}</span>
                      <span style={pill}>累計 {formatHMS(totalShow)}</span>
                    </div>
                    {running ? <div style={small}>（目前在場：+{formatHMS(running)}）</div> : null}
                  </div>
                  <button onClick={() => removePlayer(p.id)}>刪</button>
                </div>
              );
            })}

            {benchPlayers.length === 0 ? <div style={small}>（把人拖到這裡＝回休息區）</div> : null}
          </div>

          <div style={{ marginTop: 10, ...small }}>
            下場流程：本場人回休息區 → 排隊1補位（不足4也補） → 排隊2/3/4往前推 → 該場重新計時
          </div>
        </div>
      </div>
    </div>
  );
}