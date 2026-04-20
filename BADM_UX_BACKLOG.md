# BADM UX Backlog

## Scope
在不大改現有架構、資料流與版面的前提下，持續做最小高價值優化。

## Priority P1
### 1. 三區點擊移動人工驗收紀錄
- 目的：補足自動化驗證不穩的缺口
- 驗收項：
  - 休息區 -> 上場區
  - 休息區 -> 排隊區
  - 上場區 / 排隊區 -> 休息區
  - 點到已有人時交換與確認流程

### 2. Toast 文案一致化檢查
- 目的：確認成功 / 失敗 / 提醒語氣一致
- 驗收項：
  - 新增
  - 更新
  - 刪除
  - 重置
  - 保存到歷史
  - 匯入
  - 複製

### 3. 管理 / 名單匯入匯出操作驗收清單
- 目的：讓後續維護時有固定 smoke test

## Priority P2
### 4. README / 專案文件補強
- 已完成第一版 README
- 後續可再補部署與操作範例

### 5. move logic 重複區段收斂
- 範圍：`placeSelected` / `dropTo`
- 原則：不改 UI，只降重複與維護成本

### 6. lint baseline cleanup
- Status: done
- 已完成：`npm run lint` ✅、`npm run build` ✅
- 目的：降低後續修改噪音
- 原則：先修低風險項，避免改到功能

## Priority P3
### 7. 小型互動優化
- 選取狀態更清楚
- modal 完成後聚焦更一致
- 文案更統一

### 8. 之後再評估是否拆檔
- 非當前優先
- 僅在維護成本明顯升高時再做

## Definition of Done
每個 backlog item 至少需要：
- changed files
- verification method
- current status
- next step / blocker
