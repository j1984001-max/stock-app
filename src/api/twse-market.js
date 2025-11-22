// api/twse-market.js

export default async function handler(req, res) {
    const endpoints = {
      day: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
      bwibbu: 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',
      t86: 'https://openapi.twse.com.tw/v1/fund/T86_ALL',
    };
  
    try {
      const [dataDay, dataBWIBBU, dataT86] = await Promise.all([
        fetch(endpoints.day).then((r) => r.json()),
        fetch(endpoints.bwibbu).then((r) => r.json()),
        fetch(endpoints.t86).then((r) => r.json()),
      ]);
  
      // 讓任何網域都能叫這個 API（其實你前端同網域就沒差，但保險起見）
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/json');
  
      res.status(200).json({
        dataDay,
        dataBWIBBU,
        dataT86,
      });
    } catch (error) {
      console.error('TWSE API proxy error:', error);
      res.status(500).json({
        error: 'TWSE fetch failed',
        message: error.message || 'Unknown error',
      });
    }
  }
  