import 'dotenv/config';
import express, { Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { handleEvent } from './handlers';
import { DEFAULT_PORT, HTTP_STATUS } from './constants';

// create LINE SDK config from env variables
const config: line.MiddlewareConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// create Express app
const app = express();

// Root path for simple status check
app.get('/', (req: Request, res: Response) => {
  res.send(`
    <html>
      <head><title>大寶日記 Dabao Diary</title></head>
      <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f7f7f7;">
        <h1 style="color: #333;">🐾 大寶日記 Dabao Diary</h1>
        <p style="color: #666;">系統運行中，請透過 LINE 與我互動。</p>
        <div style="padding: 10px 20px; background: #00B900; color: white; border-radius: 5px; text-decoration: none; font-weight: bold;">LINE Bot Active</div>
      </body>
    </html>
  `);
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// register a webhook handler with middleware
app.post('/webhook', line.middleware(config), (req: Request, res: Response) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).end();
    });
});

// listen on port
const port = process.env.PORT || DEFAULT_PORT;
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`listening on ${port}`);
  });
}

export default app;
