import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Конфігурація API з fallback
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'https://account-health-rating-app.onrender.com';

console.log('API_BASE_URL:', API_BASE_URL);
console.log('Environment variables:', {
  VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
  VITE_API_URL: import.meta.env.VITE_API_URL
});

// Резервні дані з усіма бізнесами
const mockData = [
  ['Business', 'Country', '6.8.2025', '7.8.2025', '8.8.2025', '11.8.2025', '12.8.2025', '13.8.2025', '14.8.2025', '15.8.2025', '18.8.2025', '19.8.2025', '20.8.2025', '21.8.2025', '22.8.2025', '25.8.2025'],
  
  // Bixme
  ['Bixme', 'United Kingdom', 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 356, 360],
  ['Bixme', 'Germany', 424, 424, 424, 424, 424, 424, 424, 424, 428, 426, 426, 428, 428, 430],
  ['Bixme', 'France', 268, 268, 268, 268, 268, 268, 268, 268, 268, 276, 276, 276, 276, 280],
  ['Bixme', 'Spain', 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 260],
  ['Bixme', 'Italy', 272, 272, 272, 272, 268, 268, 268, 268, 268, 268, 268, 268, 268, 270],
  
  // Dinan
  ['Dinan', 'United Kingdom', 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 225],
  ['Dinan', 'Germany', 248, 248, 248, 256, 256, 256, 256, 256, 256, 256, 256, 256, 256, 260],
  ['Dinan', 'France', 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 210],
  ['Dinan', 'Spain', 212, 212, 212, 212, 212, 212, 212, 212, 212, 212, 212, 212, 212, 215],
  
  // Monatik
  ['Monatik', 'United Kingdom', 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 205],
  ['Monatik', 'Germany', 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 216, 220],
  ['Monatik', 'France', 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 208, 210],
  
  // Seller Tower (без Turkey)
  ['Seller Tower', 'United Kingdom', 180, 180, 180, 185, 185, 185, 185, 185, 190, 190, 190, 195, 195, 200],
  ['Seller Tower', 'Germany', 195, 195, 200, 200, 200, 205, 205, 205, 210, 210, 210, 215, 215, 220],
  ['Seller Tower', 'France', 175, 175, 175, 180, 180, 180, 185, 185, 185, 190, 190, 190, 195, 195],
  
  // Wixez (без Turkey)
  ['Wixez', 'United Kingdom', 240, 240, 245, 245, 250, 250, 255, 255, 260, 260, 265, 265, 270, 275],
  ['Wixez', 'Germany', 280, 280, 285, 285, 290, 290, 295, 295, 300, 300, 305, 305, 310, 315],
  ['Wixez', 'France', 230, 230, 235, 235, 240, 240, 245, 245, 250, 250, 255, 255, 260, 265]
];

// Функція для безпечного fetch з timeout
async function safeFetch(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 секунд timeout
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export default function App() {
  const [allData, setAllData] = useState([]);
  const [selectedBusiness, setSelectedBusiness] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [visibleCountries, setVisibleCountries] = useState(new Set());
  const [connectionStatus, setConnectionStatus] = useState('checking');

  // Функція для тестування підключення
  const testConnection = async () => {
    try {
      console.log('Тестування підключення до бекенду...');
      const response = await safeFetch(`${API_BASE_URL}/api/status`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Підключення до бекенду успішне:', data);
        setConnectionStatus('connected');
        return true;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Помилка підключення до бекенду:', error.message);
      setConnectionStatus('disconnected');
      return false;
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('Початок завантаження даних...');
        console.log('Використовуємо API URL:', API_BASE_URL);
        
        // Спочатку тестуємо підключення
        const isConnected = await testConnection();
        
        if (!isConnected) {
          throw new Error('Бекенд недоступний - використовуються демонстраційні дані');
        }
        
        // Тепер пробуємо завантажити дані
        const apiUrl = `${API_BASE_URL}/api/sheet-data`;
        console.log('Завантаження з:', apiUrl);
        
        const response = await safeFetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Отримана відповідь:', result);
        
        if (result.success && Array.isArray(result.data) && result.data.length > 1) {
          console.log('✅ Дані успішно завантажені з backend API');
          console.log('Кількість рядків:', result.data.length);
          
          const businesses = [...new Set(result.data.slice(1).map(row => row[0]))];
          console.log('Знайдені бізнеси:', businesses);
          
          setAllData(result.data);
          setLastUpdate(result.meta?.lastUpdate);
          setConnectionStatus('connected');
          
          if (result.meta?.fromCache) {
            console.log('ℹ️ Дані з кешу');
          }
          if (result.meta?.error) {
            setError(`Попередження: ${result.meta.error}`);
          }
        } else {
          throw new Error('Невалідні дані від API');
        }
        
      } catch (error) {
        console.error('❌ Помилка завантаження:', error.message);
        
        // Використовуємо резервні дані
        console.log('Використання резервних даних');
        setAllData(mockData);
        setConnectionStatus('disconnected');
        setError(`Backend API недоступний (${error.message}), використовуються демонстраційні дані`);
        
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleBusinessChange = (e) => {
    const businessName = e.target.value;
    setSelectedBusiness(businessName);
    setSelectedCountry('');
    setVisibleCountries(new Set());
  };

  const handleCountryChange = (e) => {
    setSelectedCountry(e.target.value);
  };

  const handleLegendClick = (data) => {
    const country = data.value;
    const newVisibleCountries = new Set(visibleCountries);
    
    if (newVisibleCountries.has(country)) {
      newVisibleCountries.delete(country);
    } else {
      newVisibleCountries.add(country);
    }
    
    setVisibleCountries(newVisibleCountries);
  };

  // Функція для отримання останнього рейтингу
  const getLatestRating = (row) => {
    for (let i = row.length - 1; i >= 2; i--) {
      const value = Number(row[i]);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
    return 0;
  };

  // Підготовка даних для графіка
  const getChartData = () => {
    if (!selectedBusiness || !allData || allData.length < 2) {
      return [];
    }

    const headers = allData[0];
    const businessRows = allData.slice(1).filter(row => row[0] === selectedBusiness);
    
    if (businessRows.length === 0) {
      return [];
    }

    const dateColumns = headers.slice(2);
    
    return dateColumns.map((date, index) => {
      const dataPoint = { date };
      businessRows.forEach(row => {
        const country = row[1];
        const value = Number(row[index + 2]) || 0;
        dataPoint[country] = value;
      });
      return dataPoint;
    });
  };

  const chartData = getChartData();
  
  // Кольори для країн
  const getCountryColors = () => {
    const colors = [
      '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', 
      '#00c49f', '#ffbb28', '#8dd1e1', '#d084d0', '#87d068',
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#f0932b'
    ];
    
    const countries = selectedBusiness 
      ? [...new Set(allData.slice(1).filter(row => row[0] === selectedBusiness).map(row => row[1]))]
      : [];
    
    return countries.reduce((acc, country, index) => {
      acc[country] = colors[index % colors.length];
      return acc;
    }, {});
  };

  const countryColors = getCountryColors();

  // Функція для оновлення кешу
  const refreshCache = async () => {
    try {
      setLoading(true);
      const apiUrl = `${API_BASE_URL}/api/refresh-cache`;
      const response = await safeFetch(apiUrl, { method: 'POST' });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setAllData(result.data);
          setLastUpdate(result.meta?.lastUpdate);
          setError(null);
          setConnectionStatus('connected');
          console.log('✅ Кеш успішно оновлено');
        }
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('❌ Помилка оновлення:', err);
      setError(`Не вдалося оновити дані: ${err.message}`);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>Завантаження даних...</div>
          <div style={{ color: '#666' }}>Зачекайте, поки завантажуються останні дані</div>
          <div style={{ 
            color: connectionStatus === 'connected' ? '#28a745' : connectionStatus === 'disconnected' ? '#dc3545' : '#6c757d', 
            fontSize: '12px', 
            marginTop: '10px' 
          }}>
            Статус: {connectionStatus === 'connected' ? 'Підключено' : connectionStatus === 'disconnected' ? 'Відключено' : 'Перевірка...'}
          </div>
          <div style={{ color: '#999', fontSize: '12px', marginTop: '5px' }}>API: {API_BASE_URL}</div>
        </div>
      </div>
    );
  }

  // Отримуємо унікальні бізнеси та країни
  const businesses = allData.length > 1 
    ? [...new Set(allData.slice(1).map(row => row[0]))].filter(Boolean).sort()
    : [];

  const countries = selectedBusiness
    ? [...new Set(allData.slice(1).filter(row => row[0] === selectedBusiness).map(row => row[1]))].filter(Boolean).sort()
    : [];

  // Фільтруємо дані для таблиці поточних рейтингів
  const filteredDataForTable = allData.slice(1).filter(item => {
    return (
      (!selectedBusiness || item[0] === selectedBusiness) &&
      (!selectedCountry || item[1] === selectedCountry)
    );
  });

  // Підрахунок статистики
  const riskCount = filteredDataForTable.filter(row => getLatestRating(row) < 200).length;

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ color: '#2c3e50', marginBottom: '10px' }}>Account Health Rating Dashboard</h1>
        
        {/* Connection Status */}
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold',
          backgroundColor: connectionStatus === 'connected' ? '#d4edda' : '#f8d7da',
          color: connectionStatus === 'connected' ? '#155724' : '#721c24',
          marginBottom: '15px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: connectionStatus === 'connected' ? '#28a745' : '#dc3545',
            marginRight: '8px'
          }}></div>
          {connectionStatus === 'connected' ? 'Backend підключено' : 'Backend відключено'}
        </div>
        
        <div style={{ color: '#666', fontSize: '14px', marginBottom: '15px' }}>
          Джерело даних: {connectionStatus === 'connected' ? 'Backend API з кешуванням' : 'Демонстраційні дані'}
          {lastUpdate && ` (останнє оновлення: ${new Date(lastUpdate).toLocaleString('uk-UA')})`}
          <br />
          <small style={{ color: '#999' }}>API: {API_BASE_URL}</small>
        </div>
        
        {/* Кнопки управління */}
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={refreshCache}
            disabled={loading || connectionStatus !== 'connected'}
            style={{
              backgroundColor: loading || connectionStatus !== 'connected' ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: loading || connectionStatus !== 'connected' ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Оновлення...' : 'Оновити дані'}
          </button>
          
          <button
            onClick={async () => {
              if (connectionStatus !== 'connected') {
                alert('Backend недоступний. Неможливо отримати статус кешу.');
                return;
              }
              
              try {
                const response = await safeFetch(`${API_BASE_URL}/api/status`);
                const status = await response.json();
                const cacheAge = status.cache.cacheAge ? Math.round(status.cache.cacheAge / 1000 / 60) : 0;
                alert(`Статус кешу:\nЄ дані: ${status.cache.hasData ? 'Так' : 'Ні'}\nОстаннє оновлення: ${status.cache.lastUpdate ? new Date(status.cache.lastUpdate).toLocaleString('uk-UA') : 'Немає'}\nВік кешу: ${cacheAge} хв\nКількість записів: ${status.cache.recordCount || 0}`);
              } catch (err) {
                alert(`Не вдалося отримати статус: ${err.message}`);
              }
            }}
            disabled={connectionStatus !== 'connected'}
            style={{
              backgroundColor: connectionStatus !== 'connected' ? '#ccc' : '#6c757d',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: connectionStatus !== 'connected' ? 'not-allowed' : 'pointer',
              fontSize: '14px'
            }}
          >
            Статус кешу
          </button>
          
          <button
            onClick={testConnection}
            style={{
              backgroundColor: '#17a2b8',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Тест з'єднання
          </button>
        </div>
        
        {/* Повідомлення про помилки */}
        {error && (
          <div style={{ 
            backgroundColor: error.includes('недоступний') ? '#d1ecf1' : '#fff3cd', 
            border: `1px solid ${error.includes('недоступний') ? '#bee5eb' : '#ffeaa7'}`, 
            color: error.includes('недоступний') ? '#0c5460' : '#856404',
            padding: '12px',
            borderRadius: '5px',
            marginTop: '10px',
            maxWidth: '800px',
            margin: '10px auto'
          }}>
            {error}
          </div>
        )}
      </header>

      {/* Статистика */}
      <section style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Всього бізнесів</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff' }}>{businesses.length}</div>
        </div>
        
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Всього записів</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>{allData.length - 1}</div>
        </div>
        
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Ризикових рейтингів</h3>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: riskCount > 0 ? '#dc3545' : '#28a745' }}>{riskCount}</div>
        </div>
        
        <div style={{
          backgroundColor: '#f8f9fa',
          padding: '20px',
          borderRadius: '8px',
          textAlign: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Статус підключення</h3>
          <div style={{ 
            fontSize: '16px', 
            fontWeight: 'bold', 
            color: connectionStatus === 'connected' ? '#28a745' : '#dc3545'
          }}>
            {connectionStatus === 'connected' ? '✅ Підключено' : '❌ Відключено'}
          </div>
        </div>
      </section>

      {/* Селектори */}
      <section style={{ 
        display: 'flex', 
        gap: '20px', 
        marginBottom: '30px',
        flexWrap: 'wrap'
      }}>
        <div style={{ flex: '1', minWidth: '250px' }}>
          <label htmlFor="business-select" style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 'bold',
            color: '#2c3e50'
          }}>
            Бізнес:
          </label>
          <select
            id="business-select"
            value={selectedBusiness}
            onChange={handleBusinessChange}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e9ecef',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: '#fff',
              transition: 'border-color 0.3s'
            }}
          >
            <option value="">-- Оберіть бізнес --</option>
            {businesses.map((biz, index) => (
              <option key={index} value={biz}>
                {biz}
              </option>
            ))}
          </select>
        </div>

        <div style={{ flex: '1', minWidth: '250px' }}>
          <label htmlFor="country-select" style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: 'bold',
            color: '#2c3e50'
          }}>
            Країна:
          </label>
          <select
            id="country-select"
            value={selectedCountry}
            onChange={handleCountryChange}
            disabled={!selectedBusiness}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: '2px solid #e9ecef',
              borderRadius: '6px',
              fontSize: '14px',
              backgroundColor: !selectedBusiness ? '#f8f9fa' : '#fff',
              cursor: !selectedBusiness ? 'not-allowed' : 'pointer',
              transition: 'border-color 0.3s'
            }}
          >
            <option value="">-- Оберіть країну --</option>
            {countries.map((country, index) => (
              <option key={index} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Таблиця поточних рейтингів */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ color: '#2c3e50', marginBottom: '20px', fontSize: '24px' }}>Поточні рейтинги</h2>
        <div style={{ 
          overflowX: 'auto',
          backgroundColor: '#fff',
          borderRadius: '10px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '1px solid #e9ecef'
        }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '14px'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f8f9fa' }}>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 'bold' }}>Бізнес</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 'bold' }}>Країна</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 'bold' }}>Останній рейтинг</th>
                <th style={{ padding: '16px', textAlign: 'left', borderBottom: '2px solid #dee2e6', fontWeight: 'bold' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {filteredDataForTable.map((row, index) => {
                const latestRating = getLatestRating(row);
                const isRisk = latestRating < 200;
                const status = isRisk ? 'Ризик' : 'Добре';
                
                return (
                  <tr key={index} style={{ 
                    borderBottom: '1px solid #dee2e6',
                    backgroundColor: index % 2 === 0 ? '#fff' : '#f8f9fa',
                    transition: 'background-color 0.3s'
                  }}>
                    <td style={{ padding: '16px', fontWeight: '500' }}>{row[0]}</td>
                    <td style={{ padding: '16px' }}>{row[1]}</td>
                    <td style={{ 
                      padding: '16px', 
                      fontWeight: 'bold',
                      fontSize: '16px',
                      color: isRisk ? '#dc3545' : '#28a745'
                    }}>
                      {latestRating}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        backgroundColor: isRisk ? '#f8d7da' : '#d4edda',
                        color: isRisk ? '#721c24' : '#155724'
                      }}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredDataForTable.length === 0 && (
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: '#666',
              fontStyle: 'italic',
              fontSize: '16px'
            }}>
              Немає даних для обраних критеріїв
            </div>
          )}
        </div>
      </section>

      {/* Історичний графік */}
      <section>
        <h2 style={{ color: '#2c3e50', marginBottom: '20px', fontSize: '24px' }}>Історія рейтингів</h2>
        {selectedBusiness ? (
          <div style={{ 
            backgroundColor: '#fff',
            borderRadius: '10px',
            padding: '24px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            height: '500px'
          }}>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6c757d"
                    fontSize={12}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis stroke="#6c757d" fontSize={12} />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #dee2e6',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend 
                    onClick={handleLegendClick}
                    wrapperStyle={{
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  />
                  {countries.map(country => (
                    <Line
                      key={country}
                      type="monotone"
                      dataKey={country}
                      stroke={countryColors[country]}
                      strokeWidth={0.5}
                      dot={{ fill: countryColors[country], strokeWidth: 1, r: 2 }}
                      activeDot={{ r: 4, stroke: countryColors[country], strokeWidth: 1 }}
                      hide={!visibleCountries.has(country)}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#666',
                fontSize: '18px'
              }}>
                Немає даних для графіка обраного бізнесу
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            backgroundColor: '#f8f9fa',
            borderRadius: '10px',
            padding: '60px 40px',
            textAlign: 'center',
            color: '#666',
            fontStyle: 'italic',
            fontSize: '18px',
            border: '2px dashed #dee2e6'
          }}>
            Оберіть бізнес для перегляду історії рейтингів
          </div>
        )}
      </section>
    </div>
  );
}