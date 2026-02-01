import * as line from '@line/bot-sdk';

/**
 * 封裝 LINE SDK 的回覆邏輯，簡化 handler 調用
 */
export class LineBotContext {
  constructor(private client: line.Client, private replyToken: string) {}

  async sendText(text: string) {
    return this.client.replyMessage(this.replyToken, { type: 'text', text });
  }

  async sendConfirm(text: string, actions: line.Action[]) {
    return this.client.replyMessage(this.replyToken, {
      type: 'template',
      altText: text,
      template: {
        type: 'confirm',
        text,
        actions,
      },
    });
  }

  async sendButtons(text: string, altText: string, actions: line.Action[]) {
    return this.client.replyMessage(this.replyToken, {
      type: 'template',
      altText: altText || text,
      template: {
        type: 'buttons',
        text,
        actions,
      },
    });
  }
}
