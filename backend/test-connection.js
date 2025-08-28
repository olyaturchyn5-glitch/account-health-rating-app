// test-connection.js
// Скрипт для тестування підключення до Google Sheets API

require('dotenv').config();
const { google } = require('googleapis');

const SPREADSHEET_ID = '1P5boeXBMpAaujGRrZZtXaokwRyqPU1abr422dcA1z1o';

async function testConnection() {
  try {
    console.log('🔍 Testing Google Sheets API connection...\n');

    // Перевіряємо змінні оточення
    const requiredVars = [
      'GOOGLE_PROJECT_ID',
      'GOOGLE_PRIVATE_KEY',
      'GOOGLE_CLIENT_EMAIL'
    ];

    console.log('📋 Environment variables check:');
    const missingVars = [];
    requiredVars.forEach(varName => {
      const exists = !!process.env[varName];
      console.log(`   ${varName}: ${exists ? '✅' : '❌'}`);
      if (!exists) missingVars.push(varName);
    });

    if (missingVars.length > 0) {
      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Створюємо автентифікацію
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
        auth_uri: "https://accounts.google.com/o/oauth2/auth",
        token_uri: "https://oauth2.googleapis.com/token",
        auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
        client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${encodeURIComponent(process.env.GOOGLE_CLIENT_EMAIL)}`,
        universe_domain: "googleapis.com"
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    console.log('\n🔑 Authentication created successfully');

    // Створюємо клієнт для Sheets API
    const sheets = google.sheets({ version: 'v4', auth });

    console.log('📊 Fetching spreadsheet metadata...');

    // Спочатку перевіряємо метадані таблиці
    const metadataResponse = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    console.log(`   Title: ${metadataResponse.data.properties.title}`);
    console.log(`   Sheets: ${metadataResponse.data.sheets.length}`);
    
    // Показуємо назви листів
    metadataResponse.data.sheets.forEach((sheet, index) => {
      console.log(`   Sheet ${index + 1}: "${sheet.properties.title}"`);
    });

    console.log('\n📋 Fetching data from Sheet1...');

    // Отримуємо дані
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:Z',
    });

    const rows = dataResponse.data.values;

    if (!rows || rows.length === 0) {
      console.log('❌ No data found');
      return;
    }

    console.log(`✅ Successfully fetched ${rows.length} rows`);
    console.log('\n📊 Sample data:');
    console.log('   Headers:', rows[0]);
    
    if (rows.length > 1) {
      console.log('   First row:', rows[1]);
    }
    
    if (rows.length > 2) {
      console.log('   Second row:', rows[2]);
    }

    console.log('\n🎉 Connection test successful!');

  } catch (error) {
    console.error('\n❌ Connection test failed:');
    console.error('   Error:', error.message);
    
    if (error.message.includes('403')) {
      console.error('\n💡 Tips for 403 errors:');
      console.error('   1. Make sure the service account has access to the spreadsheet');
      console.error('   2. Share the spreadsheet with:', process.env.GOOGLE_CLIENT_EMAIL);
      console.error('   3. Grant "Viewer" permissions');
    }
    
    if (error.message.includes('404')) {
      console.error('\n💡 Tips for 404 errors:');
      console.error('   1. Check if the spreadsheet ID is correct');
      console.error('   2. Make sure the spreadsheet exists and is not deleted');
    }

    process.exit(1);
  }
}

testConnection();