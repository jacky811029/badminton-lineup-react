import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "badminton_lineup_v3";

function emptySlots(groups, slots) {
  return Array.from({ length: groups }, () =>
    Array.from({ length: slots }, () => "")
  );
}

function initialState() {
  return {
    players: {},
    bench: [],
    queue: emptySlots(4, 4), // 4 組順位，每組 4 槽
    courts: emptySlots(4, 4), // 4 面場地，每面 4 人
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState();
  try {
    const st = JSON.parse(raw);
    // 簡單防呆：缺欄位就補上
    return {
      ...initialState(),
      ...st,
      queue: st?.queue?.length === 4 ? st.queue : emptySlots(4, 4),
      courts: st?.courts?.length === 4 ? st.courts : emptySlots(4, 4),
      bench: Array.isArray(st?.bench) ? st.bench : [],
      players: st?.players || {},
    };
  } catch {
    return initialState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function removeEverywhere(next, id) {
  next.bench = next.bench.filter((x) => x !== id);
  next.queue = next.queue.map((g) => g.map((x) => (x === id ? "" : x)));
  next.courts = next.courts.map((g) => g.map((x) => (x === id ? "" : x)));
}

function isCourtEmpty(court) {
  return court.every((x) => !x);
}

export default function App() {
  const [state, setState] = useState(loadState);

  const [name, setName] = useState("");
  const [level, setLevel] = useState("B");
  const [gender, setGender] = useState("男");
  const [search, setSearch] = useState("");

  useEffect(() => {
    saveState(state);
  }, [state]);

  function addPlayer() {
    const n = name.trim();
    if (!n) return;

    const sameName = Object.values(state.players).some((p) => p.name === n);
    if (sameName) {
      alert("已有同名隊員，請改名或加註。");
      return;
    }

    const id = uid();
    const newPlayer = {
      id,
      name: n,
      level,
      gender,
      games: 0,
      absent: false,
      lastOffTs: 0,
    };

    setState((prev) => ({
      ...prev,
      players: { ...prev.players, [id]: newPlayer },
      bench: [id, ...prev.bench],
    }));

    setName("");
  }

  function removePlayer(id) {
    const p = state.players[id];
    if (!p) return;
    if (!confirm(`確定刪除「${p.name}」？`)) return;

    setState((prev) => {
      const next = structuredClone(prev);
      removeEverywhere(next, id);
      delete next.players[id];
      return next;
    });
  }

  function moveToBench(id) {
    setState((prev) => {
      const next = structuredClone(prev);
      removeEverywhere(next, id);
      next.bench.unshift(id);
      return next;
    });
  }

  function placeIntoQueue(id, gi, si) {
    setState((prev) => {
      const next = structuredClone(prev);

      // 先從任何地方移除（避免同一人同時出現）
      removeEverywhere(next, id);

      // 目標槽位如果有人，擠回 bench
      const replaced = next.queue[gi][si];
      next.queue[gi][si] = id;
      if (replaced) next.bench.unshift(replaced);

      return next;
    });
  }

  function clearQueueSlot(gi, si) {
    setState((prev) => {
      const next = structuredClone(prev);
      const id = next.queue[gi][si];
      next.queue[gi][si] = "";
      if (id) next.bench.unshift(id);
      return next;
    });
  }

  function clearGroup(gi) {
    setState((prev) => {
      const next = structuredClone(prev);
      for (let si = 0; si < 4; si++) {
        const id = next.queue[gi][si];
        next.queue[gi][si] = "";
        if (id) next.bench.unshift(id);
      }
      return next;
    });
  }

  function shiftUp() {
    // 2→1、3→2、4→3、4 清空
    setState((prev) => {
      const next = structuredClone(prev);
      next.queue[0] = next.queue[1];
      next.queue[1] = next.queue[2];
      next.queue[2] = next.queue[3];
      next.queue[3] = ["", "", "", ""];
      return next;
    });
  }

  function startCourt(ci) {
    setState((prev) => {
      const next = structuredClone(prev);

      if (!isCourtEmpty(next.courts[ci])) {
        alert("該場地不是空的，請先下場或清空。");
        return prev;
      }

      const group = next.queue[0];
      if (group.filter(Boolean).length < 4) {
        alert("順位 1 人數不足（需要 4 人）");
        return prev;
      }

      next.courts[ci] = [...group];
      next.queue[0] = ["", "", "", ""];
      return next;
    });
  }

  function endCourt(ci) {
    // 下場：場上 4 人回 bench + 今日次數+1 + 記 lastOffTs
    setState((prev) => {
      const next = structuredClone(prev);
      const ids = next.courts[ci].filter(Boolean);

      if (ids.length === 0) return prev;

      const ts = Date.now();
      for (const id of ids) {
        const p = next.players[id];
        if (p) {
          p.games += 1;
          p.lastOffTs = ts;
        }
        next.bench.unshift(id);
      }

      next.courts[ci] = ["", "", "", ""];
      return next;
    });
  }

  function resetAll() {
    if (!confirm("要全部清空回到初始狀態嗎？（人員名單也會刪除）")) return;
    setState(initialState());
  }

  function resetTodayCounts() {
    if (!confirm("要把所有人的『今日上場次數』清零嗎？（人員名單與排點狀態保留）")) return;
    setState((prev) => {
      const next = structuredClone(prev);
      for (const id of Object.keys(next.players)) {
        next.players[id].games = 0;
      }
      return next;
    });
  }

  const benchPlayers = useMemo(() => {
    const ids = new Set(state.bench);
    const q = search.trim();
    return Object.values(state.players)
      .filter((p) => ids.has(p.id))
      .filter((p) => (q ? p.name.includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));
  }, [state.players, state.bench, search]);

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>羽球排點工具（4 面場｜順位固定 4 組｜手動排順位/上下場）</h2>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={resetTodayCounts}>清今日次數</button>
        <button onClick={resetAll}>全部重置</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        {/* 新增 / 搜尋 */}
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "#fff" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              style={{ padding: 8, minWidth: 200 }}
              placeholder="新增隊員姓名"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <select style={{ padding: 8 }} value={level} onChange={(e) => setLevel(e.target.value)}>
              <option>A</option>
              <option>B</option>
              <option>C</option>
              <option>D</option>
            </select>
            <select style={{ padding: 8 }} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option>男</option>
              <option>女</option>
              <option>不公開</option>
            </select>
            <button onClick={addPlayer}>新增</button>

            <input
              style={{ padding: 8, minWidth: 200 }}
              placeholder="搜尋（休息區）"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* 主要區塊 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
          }}
        >
          {/* 休息區 */}
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>休息區（可拖曳到順位/場地）</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {benchPlayers.map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                  style={{
                    padding: 10,
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    background: "#fafafa",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div>
                    <b>{p.name}</b>（{p.level}/{p.gender}） · 今日 {p.games}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => removePlayer(p.id)}>刪</button>
                  </div>
                </div>
              ))}
              {benchPlayers.length === 0 ? <div style={{ color: "#777" }}>（目前休息區沒有隊員）</div> : null}
            </div>
          </div>

          {/* 順位 */}
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>順位（固定 4 組 × 4 槽）</h3>
              <button onClick={shiftUp}>整組上移（2→1、3→2、4→3）</button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 10 }}>
              {state.queue.map((group, gi) => (
                <div key={gi} style={{ padding: 10, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <b>順位 {gi + 1}</b>
                    <button onClick={() => clearGroup(gi)}>清空本組</button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                    {group.map((pid, si) => (
                      <div
                        key={si}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const id = e.dataTransfer.getData("text/plain");
                          if (id) placeIntoQueue(id, gi, si);
                        }}
                        style={{
                          minHeight: 52,
                          padding: 10,
                          border: "1px dashed #aaa",
                          borderRadius: 10,
                          background: "#fafafa",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {pid ? (
                          <>
                            <div>
                              {state.players[pid]?.name}（{state.players[pid]?.level}/{state.players[pid]?.gender}）
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => moveToBench(pid)}>退回</button>
                              <button onClick={() => clearQueueSlot(gi, si)}>清</button>
                            </div>
                          </>
                        ) : (
                          <span style={{ color: "#777" }}>[拖人到這裡]</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 場地 */}
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 12, background: "#fff" }}>
            <h3 style={{ marginTop: 0 }}>場地（4 面）</h3>

            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
              {state.courts.map((court, ci) => {
                const empty = isCourtEmpty(court);
                const q1Full = state.queue[0].filter(Boolean).length === 4;

                return (
                  <div key={ci} style={{ padding: 10, border: "1px solid #eee", borderRadius: 12, background: "#fff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <b>場地 {ci + 1}</b>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => startCourt(ci)} disabled={!empty || !q1Full}>
                          上場（從順位 1）
                        </button>
                        <button onClick={() => endCourt(ci)} disabled={empty}>
                          下場
                        </button>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                      {court.map((pid, si) => (
                        <div
                          key={si}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            const id = e.dataTransfer.getData("text/plain");
                            if (!id) return;

                            setState((prev) => {
                              const next = structuredClone(prev);
                              removeEverywhere(next, id);

                              const replaced = next.courts[ci][si];
                              next.courts[ci][si] = id;
                              if (replaced) next.bench.unshift(replaced);

                              return next;
                            });
                          }}
                          style={{
                            minHeight: 52,
                            padding: 10,
                            border: "1px dashed #aaa",
                            borderRadius: 10,
                            background: "#fafafa",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          {pid ? (
                            <>
                              <div>{state.players[pid]?.name}</div>
                              <button onClick={() => moveToBench(pid)}>退回</button>
                            </>
                          ) : (
                            <span style={{ color: "#777" }}>[可拖人進來]</span>
                          )}
                        </div>
                      ))}
                    </div>

                    <div style={{ marginTop: 8, color: "#666", fontSize: 12 }}>
                      提示：你也可以直接把人拖進場地槽位（手動指定隊伍位置）。<br />
                      「上場」只有在空場且順位 1 滿 4 人時可按。
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, color: "#666", fontSize: 12 }}>
        資料會保留在本機瀏覽器（localStorage）。
      </div>
    </div>
  );
}