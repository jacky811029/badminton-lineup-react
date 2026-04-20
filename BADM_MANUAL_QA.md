# BADM Manual QA Checklist

## Handoff / Usage Notes
- 這份檔案用於人工驗收 BADM 近期功能與 UX 改動
- 建議依 `Recommended Smoke Test Order` 執行，不要跳著驗
- 每完成一項，就同步更新：
  - checklist
  - Result
  - Evidence
  - Notes
- 若遇到 `fail`，請優先補清楚：
  - 實際結果
  - 重現步驟
  - 影響範圍
- 驗收結束後，請回填 `Execution Record` 與 `Summary`

## Final Report Template
- QA date:
- Executor:
- Build status:
- Passed items:
- Failed items:
- Pending items:
- Key findings:
- Recommended next action:

## Evidence Index
- Main implementation: `D:\badminton-lineup-react\src\App.jsx`
- Project README: `D:\badminton-lineup-react\README.md`
- UX improvements summary: `D:\badminton-lineup-react\BADM_UX_IMPROVEMENTS.md`
- UX backlog: `D:\badminton-lineup-react\BADM_UX_BACKLOG.md`
- This QA checklist: `D:\badminton-lineup-react\BADM_MANUAL_QA.md`

## Status Summary
### Known pass (browser-assisted)
- 管理按鈕可直接開啟，不再要求密碼
- `增刪修` 入口可同時顯示新增區、更新區、刪除按鈕

### Latest verified baseline
- `npm run lint` ✅
- `npm run build` ✅

### Pending manual verify
- 三區點擊移動
- 點到已有人時交換
- 重置最終 UI 狀態
- Toast feedback consistency

## Scope
針對目前已完成的 BADM 核心互動與近期 UX 優化，建立可直接勾核的人工驗收清單。

## Environment
- Project: `D:\badminton-lineup-react`
- Verification baseline: `npm run lint` + `npm run build`

## Execution Record
- QA date:
- Executor:
- Build verified: yes / no
- App URL / environment:
- Summary:

## Result Conventions
- `pass`: 預期行為完整出現，且無明顯偏差
- `fail`: 可重現不符合預期的行為、文案或流程
- `pending`: 尚未實測，或證據不足以判定 pass / fail
- 若為 `fail`，請在 `Notes` 補：
  - 實際結果
  - 重現步驟
  - 影響範圍

## Recommended Smoke Test Order
1. 管理按鈕
2. 增刪修入口
3. 休息區 -> 上場區
4. 休息區 -> 排隊區
5. 上場區 -> 休息區
6. 排隊區 -> 休息區
7. 點到已有人時交換
8. 重置
9. 新增 toast
10. 更新 toast
11. 刪除 toast
12. 重置 toast
13. 保存到歷史 toast
14. 匯入完成 toast
15. 複製成功 toast
16. 空白文字框提醒 toast

## Exit Criteria
可視為本輪 BADM 驗收完成，需同時滿足：
1. `npm run build` 通過
2. 管理按鈕驗收通過
3. 增刪修入口驗收通過
4. 三區點擊移動核心流程驗收通過
5. 交換流程驗收通過
6. 重置驗收通過
7. 關鍵 toast feedback consistency 驗收通過
8. QA 執行者已填寫 Execution Record 與 Summary

## Checklist

### 管理按鈕
- [x] 點擊 `管理` 後直接開啟收費 modal
- [x] 不再出現密碼 prompt
- Result:
  - pass (browser-assisted)
- Evidence:
  - management modal 可直接開啟
- Notes:
  - 已確認可直接開啟管理 modal

### 三區點擊移動
#### 休息區 -> 上場區
- Manual steps:
  1. 在休息區點選任一名條
  2. 確認上方出現「已選擇」提示
  3. 在任一上場區空格點一下
  4. 確認名條進入上場區
- [ ] 先點休息區名條
- [ ] 再點上場空格
- [ ] 名條成功進入上場區
- Result:
  - pass / fail / pending
- Evidence:
  - 
- Notes:
  - 

#### 休息區 -> 排隊區
- Manual steps:
  1. 在休息區點選任一名條
  2. 確認上方出現「已選擇」提示
  3. 在任一排隊區空格點一下
  4. 確認名條進入排隊區
- [ ] 先點休息區名條
- [ ] 再點排隊空格
- [ ] 名條成功進入排隊區
- Result:
  - pass / fail / pending
- Evidence:
  - 
- Notes:
  - 

#### 上場區 -> 休息區
- Manual steps:
  1. 在上場區點選任一名條
  2. 確認上方出現「已選擇」提示
  3. 在休息區任一名條區塊點一下
  4. 確認名條回到休息區
- [ ] 先點上場區名條
- [ ] 再點休息區名條區塊
- [ ] 名條成功回到休息區
- Result:
  - pass / fail / pending
- Evidence:
  - 
- Notes:
  - 

#### 排隊區 -> 休息區
- Manual steps:
  1. 在排隊區點選任一名條
  2. 確認上方出現「已選擇」提示
  3. 在休息區任一名條區塊點一下
  4. 確認名條回到休息區
- [ ] 先點排隊區名條
- [ ] 再點休息區名條區塊
- [ ] 名條成功回到休息區
- Result:
  - pass / fail / pending
- Evidence:
  - 
- Notes:
  - 

#### 點到已有人時交換
- Manual steps:
  1. 先在休息區、上場區或排隊區選取任一名條
  2. 確認上方出現「已選擇」提示
  3. 點選另一個已有名條的位置
  4. 確認跳出交換確認視窗
  5. 點選確認
  6. 確認兩個名條位置互換成功
- [ ] 點到已有名條的位置
- [ ] 出現確認
- [ ] 確認後交換成功
- Result:
  - pass / fail / pending
- Evidence:
  - 
- Notes:
  - 

### 增刪修入口
- [x] 點 `增刪修` 後可見新增區
- [x] 點 `增刪修` 後可見更新區
- [x] 點 `增刪修` 後可見刪除按鈕
- Result:
  - pass (browser-assisted)
- Evidence:
  - 已用 snapshot 確認入口開啟後三類控制都存在
- Notes:
  - 可作為人工驗收前的輔助證據

### 重置
- Manual steps:
  1. 先將至少一個名條移到上場區或排隊區
  2. 觀察該名條目前 `games` 顯示值
  3. 點擊 `重置`
  4. 在確認視窗中按確認
  5. 確認上場區清空
  6. 確認排隊區清空
  7. 確認名條回到休息區
  8. 確認 `games` 歸零
  9. 確認出現重置 toast
- [ ] 點 `重置`
- [ ] 上場區清空
- [ ] 排隊區清空
- [ ] 名條回到休息區
- [ ] `games` 歸零
- [ ] 出現重置 toast
- Result:
  - pass / fail / pending
- Evidence:
  - changed file: `src/App.jsx`
  - expected toast: `已重置：上場區 / 排隊區已清空，次數已歸零。`
- Notes:
  - 

### Toast feedback consistency
#### 新增
- Manual steps:
  1. 開啟 `增刪修`
  2. 輸入一個新名字
  3. 點 `新增`
  4. 確認右下角出現 `已新增：名字`
- [ ] 新增成功顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `已新增：<name>`
- Notes:
  - 

#### 更新
- Manual steps:
  1. 開啟 `增刪修`
  2. 點選休息區任一名條載入更新區
  3. 修改欄位後點 `更新`
  4. 確認右下角出現 `名條已更新。`
- [ ] 更新成功顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `名條已更新。`
- Notes:
  - 

#### 刪除
- Manual steps:
  1. 開啟 `增刪修`
  2. 點擊任一名條右側 `刪`
  3. 在確認視窗中按確認
  4. 確認右下角出現 `已刪除：名字`
- [ ] 刪除成功顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `已刪除：<name>`
- Notes:
  - 

#### 重置
- Manual steps:
  1. 先讓上場區或排隊區存在至少一個名條
  2. 點 `重置`
  3. 在確認視窗中按確認
  4. 確認右下角出現 `已重置：上場區 / 排隊區已清空，次數已歸零。`
- [ ] 重置成功顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `已重置：上場區 / 排隊區已清空，次數已歸零。`
- Notes:
  - 

#### 保存到歷史
- Manual steps:
  1. 點 `管理`
  2. 在收費 modal 中點 `保存到歷史`
  3. 確認右下角出現 `已保存到歷史清單（同日期會覆蓋更新）。`
- [ ] 保存到歷史顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `已保存到歷史清單（同日期會覆蓋更新）。`
- Notes:
  - 

#### 匯入完成
- Manual steps:
  1. 點 `管理`
  2. 點 `名單匯入/匯出`
  3. 輸入有效名單資料
  4. 點 `匯入（覆蓋名單並重置）`
  5. 在確認視窗中按確認
  6. 確認右下角出現 `匯入完成（已重置上場/排隊）。`
- [ ] 匯入完成顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `匯入完成（已重置上場/排隊）。`
- Notes:
  - 

#### 複製成功
- Manual steps:
  1. 點 `管理`
  2. 點 `名單匯入/匯出`
  3. 先讓文字框中有內容
  4. 點 `複製`
  5. 確認右下角出現 `已複製到剪貼簿。`
- [ ] 複製成功顯示 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `已複製到剪貼簿。`
- Notes:
  - 

#### 空白文字框提醒
- Manual steps:
  1. 點 `管理`
  2. 點 `名單匯入/匯出`
  3. 清空文字框內容
  4. 點 `複製`
  5. 確認右下角出現 `目前文字框是空的。`
- [ ] 空白文字框顯示提醒 toast
- Result:
  - pass / fail / pending
- Evidence:
  - expected toast: `目前文字框是空的。`
- Notes:
  - 
