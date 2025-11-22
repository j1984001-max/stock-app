// api/twse-market.js

export default async function handler(req, res) {
  // CORS（同網域其實用不到，但留著沒關係）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // 1) 先把三個 TWSE API 都打一次
    const [bwibbuRes, dayRes, t86Res] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetch('https://openapi.twse.com.tw/v1/fund/T86_ALL'),
    ]);

    // 如果有任何一個不是 200，直接丟錯
    if (!bwibbuRes.ok || !dayRes.ok || !t86Res.ok) {
      throw new Error(
        `TWSE status: BWIBBU ${bwibbuRes.status}, DAY ${dayRes.status}, T86 ${t86Res.status}`
      );
    }

    // 2) 轉成 JSON
    const [dataBWIBBU, dataDay, dataT86] = await Promise.all([
      bwibbuRes.json(),
      dayRes.json(),
      t86Res.json(),
    ]);

    const marketMap = {};

    // 3) 價格與成交量
    (dataDay || []).forEach((item) => {
      // 有些欄位可能是空字串，用 parseFloat / parseInt 轉換
      const price = parseFloat(item.ClosingPrice);
      const change = parseFloat(item.Change);
      const volume = parseInt(item.TradeVolume, 10);

      marketMap[item.Code] = {
        id: item.Code,
        name: item.Name,
        price: isNaN(price) ? 0 : price,
        change: isNaN(change) ? 0 : change,
        volume: isNaN(volume) ? 0 : volume,
        open: isNaN(parseFloat(item.OpeningPrice)) ? 0 : parseFloat(item.OpeningPrice),
        high: isNaN(parseFloat(item.HighestPrice)) ? 0 : parseFloat(item.HighestPrice),
        low: isNaN(parseFloat(item.LowestPrice)) ? 0 : parseFloat(item.LowestPrice),
        pe: 0,
        yield: 0,
        pb: 0,
        foreignNet: 0,
        trustNet: 0,
        changePercent: 0,
      };

      const prev = marketMap[item.Code].price - marketMap[item.Code].change;
      if (prev > 0) {
        marketMap[item.Code].changePercent = Number(
          ((marketMap[item.Code].change / prev) * 100).toFixed(2)
        );
      }
    });

    // 4) 本益比、殖利率、PB
    (dataBWIBBU || []).forEach((item) => {
      if (!marketMap[item.Code]) return;

      const pe = parseFloat(item.PEratio);
      const yld = parseFloat(item.DividendYield);
      const pb = parseFloat(item.PBratio);

      marketMap[item.Code].pe = isNaN(pe) ? 0 : pe;
      marketMap[item.Code].yield = isNaN(yld) ? 0 : yld;
      marketMap[item.Code].pb = isNaN(pb) ? 0 : pb;
    });

    // 5) 三大法人籌碼（股數 / 1000 變張數）
    (dataT86 || []).forEach((item) => {
      if (!marketMap[item.Code]) return;

      const foreign = parseInt(item.ForeignInvestorsNetBuySell, 10);
      const trust = parseInt(item.InvestmentTrustNetBuySell, 10);

      marketMap[item.Code].foreignNet = Math.round((isNaN(foreign) ? 0 : foreign) / 1000);
      marketMap[item.Code].trustNet = Math.round((isNaN(trust) ? 0 : trust) / 1000);
    });

    // 6) 只回傳四碼股票
    const result = Object.values(marketMap).filter((s) => s.id && s.id.length === 4);

    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE API error:', err);

    res.status(500).json({
      error: 'TWSE fetch failed',
      message: err.message || 'Unknown error',
    });
  }
}
