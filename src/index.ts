import 'dotenv/config';
import express, { Request, Response } from 'express';
import * as line from '@line/bot-sdk';
import { handleEvent } from './handler';
import { DEFAULT_PORT, HTTP_STATUS } from './constants';

// create LINE SDK config from env variables
const config: line.MiddlewareConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

// create Express app
const app = express();

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
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
