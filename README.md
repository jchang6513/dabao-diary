# 大寶日記 (Dabao Diary) 🐾

一個結合 **LINE Bot**、**Google Sheets** 與 **Google Gemini AI** 的寵物生活紀錄助手。透過自然語言處理，讓您可以像跟朋友聊天一樣，輕鬆記錄、查詢與修改寵物的日常點滴。

## 🌟 功能亮點

- **自然語言紀錄**：直接輸入「大寶 12:00 在睡覺」，AI 會自動解析寵物、時間與行為並存入表格。
- **靈活查詢**：支援「大寶今天做了什麼？」、「幫我查肉包最近的紀錄」等指令。
- **日記修改**：支援全欄位修改，如「修改剛才那筆的時間為 13:00」。
- **寵物管理**：自動同步 Google Sheets 中的寵物清單與動作類型。
- **AI 導引**：當語意不明時，AI 會主動提供操作範例。
- **無資料庫設計**：完全使用 Google Sheets 作為後端存儲，方便手機隨時查看原始資料。

---

## 🛠 安裝與設定

### 1. 複製專案
```bash
git clone https://github.com/jchang6513/dabao-diary.git
cd dabao-diary
yarn install
```

### 2. Google Sheets 設定
1. 建立一個新的 Google 試算表。
2. 建立三個工作表，名稱分別為：`Pets`、`Actions`、`Diary`。
3. 在 Google Cloud Console 建立 **Service Account** 並下載 JSON 憑證金鑰。
4. 將該 Service Account 的 Email 加入到試算表的「共用」名單中，並給予「編輯者」權限。

### 3. 環境變數 (.env)
複製 `.env.example` 並更名為 `.env`，填入以下必要資訊：

```env
# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=你的_TOKEN
LINE_CHANNEL_SECRET=你的_SECRET

# Google Sheets
GOOGLE_SHEET_ID=試算表的_ID
# 建議將金鑰內容填入或指定路徑
# 專案目前讀取根目錄的 service-account.json

# Google Gemini API
GEMINI_API_KEY=你的_GEMINI_API_KEY
```

### 4. 編譯與啟動
```bash
# 編譯 TypeScript
yarn build

# 啟動伺服器
yarn start
```

---

## 🚀 本地開發與調試 (ngrok)

由於 LINE Webhook 需要 HTTPS 公網 URL，開發時建議使用 `ngrok`：

1. 啟動本機伺服器：`yarn start` (預設埠號 3000)。
2. 啟動 ngrok：`ngrok http 3000`。
3. 將 ngrok 產生的 URL 填入 LINE Developers Console 的 **Webhook URL** (記得加上 `/webhook` 後綴)。

---

## 📂 專案結構
- `src/handlers/`: 處理各種對話意圖與回覆訊息。
- `src/services/`: 封裝 Google Sheets 的業務邏輯。
- `src/gemini.ts`: AI 意圖解析引擎。
- `src/context.ts`: LINE 通訊層封裝。
- `src/constants.ts`: 全域常量與設定。

---

## 📄 授權
ISC License. 使用愉快！
