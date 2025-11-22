// api/twse-market.js  （放在專案根目錄，不是 src 裡）

export default async function handler(req, res) {
  // CORS headers（同網域通常不需要，但放著比較保險）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ----------- 同步向 TWSE 抓三種資料 -----------
    const [bwibbuRes, dayRes, t86Res] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetch('https://openapi.twse.com.tw/v1/fund/T86_ALL'),
    ]);

    const [dataBWIBBU, dataDay, dataT86] = await Promise.all([
      bwibbuRes.json(),
      dayRes.json(),
      t86Res.json(),
    ]);

    const marketMap = {};

    // ----------- (1) 今日價格、漲跌、成交量等 -----------

    dataDay.forEach((item) => {
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

      // 漲跌幅計算
      const s = marketMap[item.Code];
      if (s.price !== 0) {
        const prev = s.price - s.change;
        s.changePercent = prev > 0 ? Number(((s.change / prev) * 100).toFixed(2)) : 0;
      } else {
        s.changePercent = 0;
      }
    });

    // ----------- (2) 本益比 / 殖利率 / PB -----------

    dataBWIBBU.forEach((item) => {
      if (marketMap[item.Code]) {
        marketMap[item.Code].pe = parseFloat(item.PEratio) || 0;
        marketMap[item.Code].yield = parseFloat(item.DividendYield) || 0;
        marketMap[item.Code].pb = parseFloat(item.PBratio) || 0;
      }
    });

    // ----------- (3) 三大法人買賣超（股數→張數） -----------

    dataT86.forEach((item) => {
      if (marketMap[item.Code]) {
        const foreign = parseInt(item.ForeignInvestorsNetBuySell) || 0;
        const trust = parseInt(item.InvestmentTrustNetBuySell) || 0;

        marketMap[item.Code].foreignNet = Math.round(foreign / 1000);
        marketMap[item.Code].trustNet = Math.round(trust / 1000);
      }
    });

    // ----------- 整理結果：只留 4 位數股票 -----------

    const result = Object.values(marketMap).filter((s) => s.id.length === 4);

    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE API error:', err);
    res.status(500).json({
      error: 'TWSE fetch failed',
      message: err.message,
    });
  }
}
