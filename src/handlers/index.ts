import * as line from '@line/bot-sdk';
import { LineBotContext } from '../context';
import { handlePostbackMsg } from './postbackHandler';
import { handleTextMsg } from './textHandler';
import { MessageUI } from './messages';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || '',
  channelSecret: process.env.LINE_CHANNEL_SECRET || '',
};

const client = new line.Client(config);

export async function handleEvent(event: line.WebhookEvent): Promise<any> {
  if (!('replyToken' in event)) return Promise.resolve(null);
  const ctx = new LineBotContext(client, event.replyToken);

  try {
    if (event.type === 'message' && event.message.type === 'text') {
      return handleTextMsg(ctx, event as line.MessageEvent & { message: line.TextEventMessage });
    }
    if (event.type === 'postback') {
      return handlePostbackMsg(ctx, new URLSearchParams(event.postback.data));
    }
  } catch (error) {
    console.error('Handler Error:', error);
    return ctx.sendText(MessageUI.error());
  }
}
