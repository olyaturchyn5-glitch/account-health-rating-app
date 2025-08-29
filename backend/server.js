const express = require('express');
const cors = require('cors');
const app = express();

// ВАЖЛИВО: PORT з environment variables для Render
const PORT = process.env.PORT || 3002;

// Кеш для даних
let cachedData = null;
let lastFetchTime = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 хвилин

// ВИПРАВЛЕНИЙ CORS - динамічна перевірка origin
const corsOptions = {
  origin: function (origin, callback) {
    // Дозволити запити без origin (мобільні додатки, Postman, тести)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      // Development origins
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173', // Vite
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      // Production origins
      'https://account-health-rating-app.vercel.app'
    ];
    
    // Перевіряємо точний збіг або паттерн *.vercel.app
    if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      console.log(`CORS заблокував origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200 // Для підтримки старих браузерів
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Додаткові заголовки безпеки
app.use((req, res, next) => {
  res.header('X-Powered-By', 'Account Health API');
  next();
});

// Health check endpoint для Render
app.get('/', (req, res) => {
  res.json({ 
    message: 'Account Health Rating API is running!', 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    cors: 'enabled'
  });
});

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
        
        // Додаємо timeout для fetch запитів
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 секунд timeout
        
        const response = await fetch(csvUrl, { 
          signal: controller.signal,
          headers: {
            'User-Agent': 'Node.js Server'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log(`Помилка HTTP ${response.status} для ${businessName}`);
          continue;
        }

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
        if (sheetError.name === 'AbortError') {
          console.error(`Timeout для ${businessName}`);
        }
      }
    }

    if (allData.length <= 1) {
      console.log('Не вдалося отримати дані, використовуємо fallback');
      throw new Error('Не вдалося отримати дані з жодного аркуша.');
    }

    cachedData = allData;
    lastFetchTime = now;
    console.log(`Дані успішно оновлено. Записів: ${allData.length - 1}`);
    return { data: cachedData, fromCache: false };

  } catch (error) {
    console.error('Помилка при отриманні даних:', error.message);
    if (cachedData) {
      console.log('Повертаємо старі дані з кешу');
      return { data: cachedData, fromCache: true, error: error.message };
    }
    console.log('Використовуємо резервні дані');
    return { data: fallbackData, fromCache: false, error: error.message };
  }
}

// API маршрути
app.get('/api/sheet-data', async (req, res) => {
  try {
    console.log(`API запит на /api/sheet-data від origin: ${req.get('origin') || 'без origin'}`);
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
    console.error('Критична помилка в API:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message, 
      data: fallbackData 
    });
  }
});

app.post('/api/refresh-cache', async (req, res) => {
  try {
    console.log('Примусове оновлення кешу');
    cachedData = null;
    lastFetchTime = null;
    const result = await getCachedData();
    res.json({ 
      success: true, 
      data: result.data, 
      meta: { fromCache: result.fromCache } 
    });
  } catch (error) {
    console.error('Помилка при оновленні кешу:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/status', (req, res) => {
  res.json({
    status: 'running',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    cache: {
      hasData: !!cachedData,
      lastUpdate: lastFetchTime ? new Date(lastFetchTime).toISOString() : null,
      recordCount: cachedData ? cachedData.length - 1 : 0,
      nextUpdate: lastFetchTime ? new Date(lastFetchTime + CACHE_DURATION).toISOString() : null
    },
    config: {
      spreadsheetId: SPREADSHEET_ID,
      businesses: Object.keys(SHEET_GIDS),
      port: PORT
    }
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS працює!',
    origin: req.get('origin'),
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Необроблена помилка:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Внутрішня помилка сервера' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Ендпоінт не знайдено',
    availableEndpoints: [
      'GET /',
      'GET /api/status',
      'GET /api/sheet-data',
      'GET /api/cors-test',
      'POST /api/refresh-cache'
    ]
  });
});

// ВАЖЛИВО: Слухати на 0.0.0.0 для Render
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check: http://localhost:${PORT}/`);
  console.log(`CORS enabled for Vercel domains`);
  
  // Preload cache on startup
  getCachedData().then(() => {
    console.log('✅ Початковий кеш завантажено');
  }).catch(err => {
    console.log('⚠️ Не вдалося завантажити початковий кеш:', err.message);
  });
});
