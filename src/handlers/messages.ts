import { UI_LIMITS } from '../constants';

/**
 * 集中管理所有的回覆訊息模板
 */
export const MessageUI = {
  // 查詢相關
  petList: (pets: string[]) => 
    pets.length > 0 ? `目前已記錄的寵物有：\n- ${pets.join('\n- ')}` : '目前沒有記錄任何寵物。',
  
  actionList: (actions: string[]) => 
    actions.length > 0 ? `目前已設定的動作有：\n- ${actions.join('\n- ')}` : '目前沒有設定任何動作。',
  
  diaryEntries: (entries: string[]) => 
    entries.length > 0 
      ? `查詢結果 (最多顯示 ${UI_LIMITS.MAX_DIARY_QUERY} 筆)：\n${entries.join('\n')}` 
      : '找不到符合條件的日記。',
  
  noDiaryFound: () => '目前沒有任何日記。',
  queryUnclear: () => '抱歉，我不確定您想查詢什麼。',

  // 編輯相關
  petUpdated: (oldName: string, newName: string, newType: string) => 
    `已更新寵物「${oldName}」的資訊為：${newName} (${newType})`,
  
  petUpdateFailedDuplicate: (name: string) => `更新失敗：名稱「${name}」已存在。`,
  petNotFound: (name: string) => `找不到寵物「${name}」。`,
  
  diaryUpdated: (changes: string[]) => `已更新日記內容：\n${changes.join('\n')}`,
  confirmEditDiary: (petName: string, time: string, changes: string[]) => 
    `確定要修改這筆日記嗎？\n對象：${petName}\n時間：${time}\n\n修改內容：\n${changes.join('\n')}`,
  diaryUpdateNoChanges: () => '未偵測到需要修改的內容。',
  diaryNotFound: () => '找不到符合條件的日記。',
  editUnclear: () => '抱歉，我不確定您想修改什麼。',

  // 新增相關
  confirmAddPet: (name: string, type: string) => `確定要新增寵物嗎？\n名稱：${name}\n種類：${type}`,
  petAlreadyExists: (name: string) => `寵物「${name}」已經存在囉！`,
  petAdded: (name: string) => `已成功新增寵物：${name}`,

  confirmAddDiary: (action: string, description: string, time: string, petName: string) => 
    `請確認日記內容：\n事件：${action}\n描述：${description || '無'}\n時間：${time}\n寵物：${petName}`,
  diarySaved: () => '日記已成功儲存！',

  // 多重新增相關
  confirmMultiAddPet: (pets: {name: string, type: string}[]) => {
    const list = pets.map(p => `- ${p.name} (${p.type || '未知'})`).join('\n');
    return `確定要新增以下 ${pets.length} 隻寵物嗎？\n${list}`;
  },
  
  confirmMultiAddDiary: (entries: {petName: string, action: string, time: string}[]) => {
    const list = entries.map(e => `- ${e.petName}: ${e.action} (${e.time})`).join('\n');
    return `請確認以下 ${entries.length} 筆日記內容：\n${list}\n\n確定要全部儲存嗎？`;
  },

  // 系統相關
  cancel: () => '已取消操作。',
  modifyRequest: () => '好的，請輸入正確的完整內容（例如：大寶 12:00 在睡覺），我會重新為您解析。',
  error: () => '抱歉，處理您的請求時發生錯誤。',
  clarification: (prompt?: string | null) => 
    prompt || `我暫時還沒理解您的意思，您可以試著這樣說說看：

🐾 記錄內容：「大寶 12:00 吃飯」
🔍 查詢紀錄：「大寶今天做了什麼？」
🐱 管理寵物：「新增一隻叫肉包的貓」
✏️ 修改資料：「修改剛才的描述為好乖」`
};
