const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3002;

// Кеш для даних
let cachedData = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 хвилин

// Middleware
app.use(cors());
app.use(express.json());

// Конфігурація Google Sheets
const SPREADSHEET_ID = '1P5boeXBMpAaujGRrZZtXaokwRyqPU1abr422dcA1z1o';
const SHEET_GIDS = {
  'Bixme': '0',
  'Dinan': '915982082',
  'Monatik': '971902462',
  'Seller Tower': '1797345950',
  'Wixez': '757695599'
};

// Резервні дані (без Wixez TR та Seller Tower TR)
const fallbackData = [
  ['Business', 'Country', '6.8.2025', '7.8.2025', '8.8.2025', '11.8.2025', '12.8.2025', '13.8.2025', '14.8.2025', '15.8.2025', '18.8.2025', '19.8.2025', '20.8.2025', '21.8.2025', '22.8.2025'],

  ['Bixme', 'United Kingdom', 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 356],
  ['Bixme', 'Germany', 424, 424, 424, 424, 424, 424, 424, 424, 428, 426, 426, 428, 428],
  ['Bixme', 'France', 268, 268, 268, 268, 268, 268, 268, 268, 268, 276, 276, 276, 276],

  ['Dinan', 'United Kingdom', 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220],
  ['Dinan', 'Germany', 248, 248, 248, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256],

  ['Monatik', 'United Kingdom', 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200],
  ['Monatik', 'Germany', 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216],

  ['Seller Tower', 'United Kingdom', 180, 180, 180, 185, 185, 185, 185, 185, 190, 190, 190, 195, 195],
  ['Seller Tower', 'Germany', 195, 195, 200, 200, 200, 205, 205, 205, 210, 210, 210, 215, 215],

  ['Wixez', 'United Kingdom', 240, 240, 245, 245, 250, 250, 255, 255, 260, 260, 265, 265, 270],
  ['Wixez', 'Germany', 280, 280, 285, 285, 290, 290, 295, 295, 300, 300, 305, 305, 310]
];

// Функція для парсингу CSV
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const result = [];

  for (let line of lines) {
    const row = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' && (i === 0 || line[i-1] === ',')) inQuotes = true;
      else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === ',')) inQuotes = false;
      else if (char === ',' && !inQuotes) {
        const value = current.trim();
        const num = parseFloat(value);
        row.push(isNaN(num) ? value : num);
        current = '';
      } else current += char;
    }
    const value = current.trim();
    const num = parseFloat(value);
    row.push(isNaN(num) ? value : num);
    result.push(row);
  }

  return result;
}

// Фільтр рядків для Wixez та Seller Tower TR
function filterTurkeyRows(business, row) {
  const country = row[0];
  if ((business === 'Wixez' || business === 'Seller Tower') && country === 'Turkey') {
    return false;
  }
  return true;
}

// Функція для отримання даних з кешем
async function getCachedData() {
  const now = Date.now();

  if (cachedData && lastFetchTime && (now - lastFetchTime) < CACHE_DURATION) {
    console.log('Повертаємо дані з кешу');
    return { data: cachedData, fromCache: true };
  }

  try {
    console.log('Оновлюємо дані з Google Sheets...');
    const allData = [];
    let headers = null;
    const businesses = ['Bixme', 'Dinan', 'Monatik', 'Seller Tower', 'Wixez'];

    for (const businessName of businesses) {
      try {
        console.log(`Обробляємо бізнес: ${businessName}`);
        const gid = SHEET_GIDS[businessName];
        if (!gid) continue;

        const csvUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
        const response = await fetch(csvUrl);
        if (!response.ok) continue;

        const csvText = await response.text();
        const parsedData = parseCSV(csvText);

        if (!headers && parsedData.length > 1) {
          const dateRow = parsedData[1];
          headers = ['Business', 'Country', ...dateRow.slice(1)];
          allData.push(headers);
        }

        for (let i = 2; i < parsedData.length; i++) {
          const row = parsedData[i];
          if (!filterTurkeyRows(businessName, row)) continue;
          if (row.length < 2) continue;
          const country = row[0];
          if (!country || country === 'Country' || country.trim() === '') continue;

          allData.push([businessName, country, ...row.slice(1)]);
        }

      } catch (sheetError) {
        console.error(`Помилка при обробці ${businessName}:`, sheetError.message);
      }
    }

    if (allData.length <= 1) throw new Error('Не вдалося отримати дані з жодного аркуша.');

    cachedData = allData;
    lastFetchTime = now;
    return { data: cachedData, fromCache: false };

  } catch (error) {
    console.error('Помилка при отриманні даних:', error.message);
    if (cachedData) return { data: cachedData, fromCache: true, error: error.message };
    return { data: fallbackData, fromCache: false, error: error.message };
  }
}

// Головний маршрут
app.get('/', (req, res) => {
  res.json({
    message: 'Account Health Rating Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      'GET /': 'API information',
      'GET /api/sheet-data': 'Get sheet data',
      'POST /api/refresh-cache': 'Refresh data cache',
      'GET /api/status': 'Server status'
    },
    timestamp: new Date().toISOString()
  });
});

// API маршрути
app.get('/api/sheet-data', async (req, res) => {
  try {
    const result = await getCachedData();
    res.json({
      success: true,
      data: result.data,
      meta: {
        fromCache: result.fromCache,
        lastUpdate: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
        nextUpdate: lastFetchTime ? new Date(lastFetchTime + CACHE_DURATION).toISOString() : null,
        error: result.error || null,
        recordCount: result.data.length - 1,
        businessCount: result.data.length > 1 ? [...new Set(result.data.slice(1).map(row => row[0]))].length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, data: fallbackData });
  }
});

app.post('/api/refresh-cache', async (req, res) => {
  cachedData = null;
  lastFetchTime = null;
  const result = await getCachedData();
  res.json({ success: true, data: result.data, meta: { fromCache: result.fromCache } });
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    cache: {
      hasData: !!cachedData,
      lastUpdate: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
      recordCount: cachedData ? cachedData.length - 1 : 0
    },
    config: {
      spreadsheetId: SPREADSHEET_ID,
      businesses: Object.keys(SHEET_GIDS)
    }
  });
});

// Обробка 404 помилок
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    availableRoutes: [
      'GET /',
      'GET /api/sheet-data',
      'POST /api/refresh-cache',
      'GET /api/status'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
