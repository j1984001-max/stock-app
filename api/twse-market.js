// api/twse-market.js  （放在專案根目錄，不是 src 裡）

export default async function handler(req, res) {
  // CORS headers（其實同網域通常用不到，但加著比較保險）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
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

    // 1. 價格與成交量
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

      if (marketMap[item.Code].price !== 0 && item.OpeningPrice) {
        const prev =
          marketMap[item.Code].price - marketMap[item.Code].change;
        if (prev > 0) {
          marketMap[item.Code].changePercent = Number(
            ((marketMap[item.Code].change / prev) * 100).toFixed(2),
          );
        } else {
          marketMap[item.Code].changePercent = 0;
        }
      }
    });

    // 2. 本益比、殖利率、PB
    dataBWIBBU.forEach((item) => {
      if (marketMap[item.Code]) {
        marketMap[item.Code].pe = parseFloat(item.PEratio) || 0;
        marketMap[item.Code].yield = parseFloat(item.DividendYield) || 0;
        marketMap[item.Code].pb = parseFloat(item.PBratio) || 0;
      }
    });

    // 3. 三大法人籌碼（股數 /1000 變張數）
    dataT86.forEach((item) => {
      if (marketMap[item.Code]) {
        const foreign = parseInt(item.ForeignInvestorsNetBuySell) || 0;
        const trust = parseInt(item.InvestmentTrustNetBuySell) || 0;

        marketMap[item.Code].foreignNet = Math.round(foreign / 1000);
        marketMap[item.Code].trustNet = Math.round(trust / 1000);
      }
    });

    const result = Object.values(marketMap).filter(
      (s) => s.id.length === 4,
    );

    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE API error:', err);
    res
      .status(500)
      .json({ error: 'TWSE fetch failed', message: err.message });
  }
}
