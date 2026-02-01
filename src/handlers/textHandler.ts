import * as line from '@line/bot-sdk';
import { parseMessageWithGemini } from '../gemini';
import { LineBotContext } from '../context';
import { PetService } from '../services/petService';
import { ActionService } from '../services/actionService';
import { handleQueryMsg } from './queryHandler';
import { handleEditMsg } from './editHandler';
import { handleAddMsg } from './addHandler';
import { MessageUI } from './messages';

export async function handleTextMsg(ctx: LineBotContext, event: line.MessageEvent & { message: line.TextEventMessage }): Promise<any> {
  const userMessage = event.message.text.trim();
  const [pets, actions] = await Promise.all([PetService.getAllPetNames(), ActionService.getAllActions()]);
  const parsed = await parseMessageWithGemini(userMessage, pets, actions);
  
  switch (parsed.intent) {
    case 'query':
      return ctx.sendText(await handleQueryMsg(parsed));
    case 'edit':
      return ctx.sendText(await handleEditMsg(parsed));
    case 'add_pet':
    case 'add_diary':
      return handleAddMsg(ctx, parsed);
    default:
      return ctx.sendText(MessageUI.clarification(parsed.clarificationPrompt));
  }
}
