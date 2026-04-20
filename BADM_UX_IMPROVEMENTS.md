# BADM UX Improvements

## Goal
在不大改既有架構、資料流與版面走向的前提下，持續做最小高價值 UX 優化。

## Guardrails
- 保持單頁 React + localStorage 架構
- 不重排主版面（左：上場/排隊；右：休息區）
- 不改主要資料結構：`players` / `bench` / `queues` / `courts` / `payments` / `dailyHistory`
- 不改主要操作脈絡：點選/拖曳移動、管理 modal、名單匯入/匯出

## Current verified baseline
- `npm run lint` ✅
- `npm run build` ✅

## Completed small UX improvements
### 1. 管理按鈕取消密碼
- 管理按鈕可直接進入，不再要求輸入密碼。

### 2. 單一「增刪修」入口
- 原本新增 / 更新 / 刪除分散控制，已統整為單一入口。

### 3. 新增重置按鈕
- 可一鍵清空上場區 / 排隊區
- 將名條移回休息區
- 將 `games` / `totalSeconds` 歸零

### 4. Toast feedback consistency
已統一改為 toast 的操作：
- 新增成功
- 更新成功
- 刪除成功
- 重置成功
- 保存到歷史成功
- 匯入完成
- 複製到剪貼簿成功 / 失敗
- 空白文字框提醒

## Suggested next improvements
### P1
- 補三區點擊移動的人工驗收紀錄
- 檢查 toast 文案是否需要再統一語氣
- 評估是否要替「名單匯入/匯出」加入更明確的完成後聚焦行為

### P2
- 將重複 move logic 收斂，但不改 UI
- 後續若再開新主線，再補人工驗收結果回填

## Verification baseline
- 每次修改後至少跑：`npm run lint` + `npm run build`
- 若涉及互動行為，補手動驗證：
  - 管理入口
  - 增刪修入口
  - 重置
  - 名單匯入/匯出
  - 三區點擊移動
