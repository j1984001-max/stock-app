// api/twse-market.js

export default async function handler(req, res) {
  // CORS（其實同網域通常用不到，但加著保險）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 小工具：安全抓 JSON，如果是 HTML 或壞掉就回空陣列 / 丟錯
  const fetchJsonSafe = async (url, { allowEmptyOnHtml = true } = {}) => {
    const r = await fetch(url);

    const text = await r.text();

    if (!r.ok) {
      console.error('[TWSE] HTTP error', r.status, url, text.slice(0, 200));
      throw new Error(`HTTP ${r.status} from ${url}`);
    }

    // 有些時候 TWSE 回的是 HTML 錯誤頁
    const trimmed = text.trim();
    if (trimmed.startsWith('<')) {
      console.error('[TWSE] Got HTML instead of JSON from', url);
      if (allowEmptyOnHtml) {
        // 回空陣列讓前端至少可以動（少一部份資料而已）
        return [];
      }
      throw new Error(`Invalid JSON (HTML) from ${url}`);
    }

    try {
      return JSON.parse(text);
    } catch (e) {
      console.error('[TWSE] JSON parse error from', url, 'body snippet:', text.slice(0, 200));
      if (allowEmptyOnHtml) return [];
      throw new Error(`JSON parse failed from ${url}: ${e.message}`);
    }
  };

  try {
    // 1. 同步去拿三份資料
    const [dataBWIBBU, dataDay, dataT86] = await Promise.all([
      // 本益比 / 殖利率 / PB
      fetchJsonSafe('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
      // 全市場日成交
      fetchJsonSafe('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      // 三大法人
      fetchJsonSafe('https://openapi.twse.com.tw/v1/fund/T86_ALL'),
    ]);

    const marketMap = {};

    // 2. 價格與成交量
    (dataDay || []).forEach((item) => {
      if (!item.Code) return;

      marketMap[item.Code] = {
        id: item.Code,
        name: item.Name,
        price: parseFloat(item.ClosingPrice) || 0,
        change: parseFloat(item.Change) || 0,
        volume: parseInt(item.TradeVolume) || 0,
        open: parseFloat(item.OpeningPrice) || 0,
        high: parseFloat(item.HighestPrice) || 0,
        low: parseFloat(item.LowestPrice) || 0,
        pe: 0,
        yield: 0,
        pb: 0,
        foreignNet: 0,
        trustNet: 0,
      };

      if (marketMap[item.Code].price !== 0 && item.OpeningPrice) {
        const prev = marketMap[item.Code].price - marketMap[item.Code].change;
        if (prev > 0) {
          marketMap[item.Code].changePercent = Number(
            ((marketMap[item.Code].change / prev) * 100).toFixed(2),
          );
        } else {
          marketMap[item.Code].changePercent = 0;
        }
      } else {
        marketMap[item.Code].changePercent = 0;
      }
    });

    // 3. 本益比、殖利率、PB
    (dataBWIBBU || []).forEach((item) => {
      if (!item.Code || !marketMap[item.Code]) return;
      marketMap[item.Code].pe = parseFloat(item.PEratio) || 0;
      marketMap[item.Code].yield = parseFloat(item.DividendYield) || 0;
      marketMap[item.Code].pb = parseFloat(item.PBratio) || 0;
    });

    // 4. 三大法人籌碼（股數 /1000 變張數）
    (dataT86 || []).forEach((item) => {
      if (!item.Code || !marketMap[item.Code]) return;

      const foreign = parseInt(item.ForeignInvestorsNetBuySell) || 0;
      const trust = parseInt(item.InvestmentTrustNetBuySell) || 0;

      marketMap[item.Code].foreignNet = Math.round(foreign / 1000);
      marketMap[item.Code].trustNet = Math.round(trust / 1000);
    });

    // 只留四碼股票
    const result = Object.values(marketMap).filter((s) => s.id && s.id.length === 4);

    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE API error in /api/twse-market:', err);
    res.status(500).json({
      error: 'TWSE fetch failed',
      message: err.message || String(err),
    });
  }
}
