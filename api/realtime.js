// api/realtime.js
// 接近即時價格 + 分 K + 爆量偵測 + AI 多空訊號
// 資料來源：FinMind（真實成交資料，非亂數）

const FINMIND_API = 'https://api.finmindtrade.com/api/v4/data';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFinMind(dataset, params) {
  const url =
    FINMIND_API +
    '?' +
    new URLSearchParams({
      dataset,
      ...params,
    }).toString();

  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) await delay(1000 * 2 ** i);
      const res = await fetch(url);

      if (!res.ok) throw new Error('FinMind HTTP error');

      const json = await res.json();
      return json.data || [];
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
  }
  return [];
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { stockId } = req.query;

  if (!stockId) {
    res.status(400).json({ error: 'stockId is required' });
    return;
  }

  try {
    const today = new Date();
    const ymd = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // ========= 1. 分 K 資料（真實成交） =========
    const minuteData = await fetchFinMind(
      'TaiwanStockPriceMinute', // FinMind 官方資料集
      {
        data_id: stockId,
        start_date: ymd,
        end_date: ymd,
      }
    );

    const intraday = minuteData.map((d) => ({
      time: d.time || d.date,
      open: d.open,
      high: d.max,
      low: d.min,
      close: d.close,
      volume: d.Trading_Volume || d.volume || 0,
    }));

    const last = intraday[intraday.length - 1] || null;

    // ========= 2. 爆量偵測（最近 3 vs 前 20） =========
    let volumeSpike = null;

    if (intraday.length > 23) {
      const last3 = intraday.slice(-3);
      const prev20 = intraday.slice(-23, -3);

      const avgPrev =
        prev20.reduce((sum, x) => sum + x.volume, 0) / prev20.length;

      const avgLast =
        last3.reduce((sum, x) => sum + x.volume, 0) / last3.length;

      const ratio = avgPrev > 0 ? avgLast / avgPrev : 0;

      if (ratio >= 2) {
        volumeSpike = {
          ratio: Number(ratio.toFixed(2)),
          level: ratio >= 4 ? 'extreme' : ratio >= 3 ? 'high' : 'mild',
        };
      }
    }

    // ========= 3. AI 多空趨勢判斷 =========
    let aiTrend = 'neutral';
    let probability = 0.5;

    if (intraday.length > 5) {
      const first = intraday[0];
      const lastClose = last.close;
      const firstOpen = first.open;

      // 當日漲跌幅
      const dayChangePct = firstOpen > 0 ? (lastClose - firstOpen) / firstOpen : 0;

      let score = 0;

      // 當日漲跌加權
      score += dayChangePct * 10;

      // 爆量加權
      if (volumeSpike) score += volumeSpike.ratio;

      // 最後 5 根的趨勢斜率
      const short = intraday.slice(-5);
      const shortChange = short[4].close - short[0].open;

      if (shortChange > 0) score += 1;
      if (shortChange < 0) score -= 1;

      // logistic 轉成機率 0~1
      const p = 1 / (1 + Math.exp(-score));
      probability = Number(p.toFixed(2));

      if (p > 0.6) aiTrend = 'bull';
      else if (p < 0.4) aiTrend = 'bear';
    }

    // ========= 4. 回傳 =========
    res.status(200).json({
      stockId,
      lastPrice: last?.close || null,
      lastVolume: last?.volume || null,
      lastTime: last?.time || null,
      intraday,
      volumeSpike,
      aiSignal: {
        trend: aiTrend,
        probability,
      },
      source: 'FinMind (real trade data)',
    });
  } catch (err) {
    console.error('Realtime API ERROR:', err);
    res.status(500).json({
      error: 'realtime fetch failed',
      message: err.message,
    });
  }
}
