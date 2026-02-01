import * as line from '@line/bot-sdk';
import { parseMessageWithGemini } from './gemini';
import { LineBotContext } from './context';
import { PetService } from './services/pet.service';
import { ActionService } from './services/action.service';
import { handleQueryIntent } from './intents/query';
import { handleEditIntent } from './intents/edit';
import { handleAddIntent } from './intents/add';
import { handlePostbackIntent } from './intents/postback';

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
      return handleTextMessage(ctx, event as line.MessageEvent & { message: line.TextEventMessage });
    }
    if (event.type === 'postback') {
      return handlePostbackIntent(ctx, new URLSearchParams(event.postback.data));
    }
  } catch (error) {
    console.error('Handler Error:', error);
    return ctx.sendText('抱歉，處理您的請求時發生錯誤。');
  }
}

async function handleTextMessage(ctx: LineBotContext, event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();
  const [pets, actions] = await Promise.all([PetService.getAllPetNames(), ActionService.getAllActions()]);
  const parsed = await parseMessageWithGemini(userMessage, pets, actions);
  
  switch (parsed.intent) {
    case 'query':
      return ctx.sendText(await handleQueryIntent(parsed));
    case 'edit':
      return ctx.sendText(await handleEditIntent(parsed));
    case 'add_pet':
    case 'add_diary':
      return handleAddIntent(ctx, parsed);
    default:
      return ctx.sendText(parsed.clarificationPrompt || "抱歉，我不太懂您的意思，可以再說清楚一點嗎？");
  }
}
