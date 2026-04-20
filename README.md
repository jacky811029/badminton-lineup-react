# BADM / badminton-lineup-react

羽球排點與管理工具（React + Vite 單頁前端）。

## 專案定位
這是一個給固定羽球團使用的本地前端工具，主要用途：
- 排點
- 排隊 / 上場 / 休息區移動
- 收費管理
- 用球紀錄
- 歷史紀錄保存

目前資料儲存在瀏覽器 `localStorage`，不依賴後端。

## 主要功能
- 4 面上場區
- 4 組排隊區
- 休息區名條管理
- 點選 / 拖曳移動名條
- 下場自動補位與排隊推進
- Undo / Redo
- 名單匯入 / 匯出
- 收費管理
- 用球紀錄
- 歷史清單
- 重置功能
- 增刪修整合入口

## 技術棧
- React 19
- Vite 7
- ESLint

## 開發
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## 專案結構
- `src/main.jsx`：入口
- `src/App.jsx`：主要 UI、狀態、事件流與業務邏輯
- `src/index.css` / `src/App.css`：樣式
- `public/`：靜態資源

## 目前架構特徵
- 核心功能目前主要集中在 `src/App.jsx`
- 採單頁應用與 localStorage persistence
- 現階段優化原則：
  - 不大改既有版面
  - 不脫離既有操作脈絡
  - 以最小高價值改善為優先

## 驗證基線
每次修改後至少執行：
```bash
npm run build
```

若涉及互動功能，建議再手動驗：
- 管理入口
- 增刪修入口
- 重置
- 名單匯入 / 匯出
- 三區點擊移動
