import { google, sheets_v4 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!SPREADSHEET_ID) {
  console.error('GOOGLE_SHEET_ID is not set in environment variables.');
  process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function getGoogleSheetClient(): Promise<sheets_v4.Sheets> {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"(.*)"$/, '$1').trim()
    : undefined;

  const credentials = {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: privateKey,
  };

  // 檢查環境變數是否完整且私鑰格式正確 (包含 PEM 標記)
  const isEnvValid = !!(
    credentials.client_email && 
    credentials.private_key && 
    credentials.private_key.includes('BEGIN PRIVATE KEY')
  );

  const auth = new GoogleAuth({
    credentials: isEnvValid ? credentials : undefined,
    // 如果環境變數不完全，則嘗試讀取本地檔案
    keyFile: isEnvValid ? undefined : 'service-account.json',
    scopes: SCOPES,
  });

  return google.sheets({ version: 'v4', auth });
}

export async function readSheet(range: string): Promise<string[][] | null | undefined> {
  try {
    const sheets = await getGoogleSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
    });
    return response.data.values;
  } catch (error) {
    console.error('Error reading from Google Sheet:', error);
    throw error;
  }
}

export async function appendSheet(range: string, values: any[][]): Promise<void> {
  try {
    const sheets = await getGoogleSheetClient();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });
    console.log('Appended to Google Sheet successfully.');
  } catch (error) {
    console.error('Error appending to Google Sheet:', error);
    throw error;
  }
}

export async function updateSheet(range: string, values: any[][]): Promise<void> {
  try {
    const sheets = await getGoogleSheetClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: values,
      },
    });
    console.log('Updated Google Sheet successfully.');
  } catch (error) {
    console.error('Error updating Google Sheet:', error);
    throw error;
  }
}