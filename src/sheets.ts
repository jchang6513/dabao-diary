import { google, sheets_v4 } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

if (!SPREADSHEET_ID) {
  console.error('GOOGLE_SHEET_ID is not set in environment variables.');
  process.exit(1);
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

async function getGoogleSheetClient(): Promise<sheets_v4.Sheets> {
  console.log('DEBUG: GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  console.log('DEBUG: GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY);
  
  const auth = new GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
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
    return null;
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
  }
}