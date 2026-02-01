To test the application, you'll need to set up your environment variables and Google Sheets, then run the application locally and expose it to the internet using ngrok for LINE's webhook.

Here are the detailed steps:

### 1. Set up Environment Variables

Create a `.env` file in the root of your project (next to `package.json`) and fill it with your credentials. Refer to `.env.example` for the required variables:

```
# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=YOUR_LINE_CHANNEL_ACCESS_TOKEN
LINE_CHANNEL_SECRET=YOUR_LINE_CHANNEL_SECRET

# Google Sheets
GOOGLE_SHEET_ID=YOUR_GOOGLE_SHEET_ID
GOOGLE_SERVICE_ACCOUNT_EMAIL=YOUR_GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY="YOUR_GOOGLE_PRIVATE_KEY_WITH_ESCAPED_NEWLINES" # Important: Replace '\n' with actual newline characters if copying from a single line. Otherwise, enclose the entire key in double quotes and ensure actual newlines are present.

# Gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

**How to get these values:**
*   **LINE:** Go to the LINE Developers console, create a Messaging API channel, and find your Channel Access Token and Channel Secret.
*   **Google Sheets:**
    1.  Create a new Google Sheet (e.g., "Pet Diary"). Note its ID from the URL (e.g., `https://docs.google.com/spreadsheets/d/YOUR_GOOGLE_SHEET_ID/edit`).
    2.  Create three sheets within it named exactly: `Pets`, `Actions`, and `Diary`.
    3.  For `Pets` and `Actions` sheets, you can pre-fill some values in the first column (e.g., `Pets` sheet: "大寶", "肉包"; `Actions` sheet: "吃", "玩", "睡", "看醫生", "拉屎", "開罐罐").
    4.  Create a Google Cloud Project, enable the Google Sheets API.
    5.  Create a Service Account. Grant it "Google Sheets Editor" permissions to your spreadsheet.
    6.  Generate a new JSON key for the service account. The `GOOGLE_SERVICE_ACCOUNT_EMAIL` is the `client_email` from this JSON file, and `GOOGLE_PRIVATE_KEY` is the `private_key`. Be careful with newlines in the private key; if you copy it as a single string, you might need to manually replace `\n` with actual newline characters or ensure it's properly formatted.
*   **Gemini:** Obtain an API key from Google AI Studio or the Google Cloud Console.

### 2. Build the TypeScript Project

Open your terminal in the project's root directory and run:

```bash
npm run build
```

This will compile your TypeScript code into JavaScript in the `dist` directory.

### 3. Start the Application Locally

```bash
npm start
```

The application should start and listen on port 3000 (or whatever you configured `PORT` to be in your `.env` file). You should see `listening on 3000` (or your chosen port) in the console.

### 4. Expose Local Server with ngrok

LINE's webhook needs a publicly accessible URL. You can use `ngrok` for this:

1.  Download and install ngrok from [ngrok.com](https://ngrok.com/).
2.  In a new terminal window, run:
    ```bash
    ngrok http 3000
    ```
    (Replace `3000` with your application's port if it's different).
3.  ngrok will give you a forwarding URL (e.g., `https://xxxx-xx-xxx-xx-xx.ngrok-free.app`). Copy the `https` URL.

### 5. Configure LINE Webhook

1.  Go back to your LINE Developers console, select your Messaging API channel.
2.  Under "Messaging API" tab, scroll down to "Webhook settings".
3.  Set the "Webhook URL" to your ngrok `https` URL followed by `/webhook`. For example: `https://xxxx-xx-xxx-xx-xx.ngrok-free.app/webhook`.
4.  Enable "Use webhook".
5.  Click "Verify" to ensure LINE can reach your ngrok URL.
6.  Ensure "Auto-reply messages" and "Greeting messages" are disabled under "LINE Official Account features" -> "Response settings" if you want your bot to be the sole responder.

### 6. Test Your Bot

Now, send a message to your LINE bot.

*   Try messages like:
    *   `大寶剛剛拉屎`
    *   `小雞今天去看醫生`
    *   `開罐罐給肉包吃`
    *   `I have a new cat called Mimi` (The bot should still try to parse this)

The bot should respond with a confirmation message and you should see the entry appear in your "Diary" Google Sheet.

**Important Notes:**
*   The `parseMessageWithGemini` function's accuracy depends heavily on the prompt. You might need to refine the prompt in `src/gemini.ts` for better results.
*   The current confirmation message is basic. The multi-turn confirmation flow is not yet implemented.
*   Ensure your service account has editor access to your specific Google Sheet.
*   The `GOOGLE_PRIVATE_KEY` in `.env` needs to be correctly formatted with actual newlines.
