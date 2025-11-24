// api/twse-market.js
// 上市(TWSE) + 上櫃(TPEX) 整合版
// 所有資料都來自官方：TWSE + TPEX（真實資料）

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // ========= 1. TWSE（上市）官方資料 =========
    const [bwibbuRes, dayRes, t86Res, govRes] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetch('https://openapi.twse.com.tw/v1/fund/T86_ALL'),
      fetch('https://openapi.twse.com.tw/v1/opendata/t187ap46_L_9'),
    ]);

    const [dataBWIBBU, dataDay, dataT86, dataGov] = await Promise.all([
      bwibbuRes.json(),
      dayRes.json(),
      t86Res.json(),
      govRes.json(),
    ]);

    const marketMap = {};

    // ===== 1-1. TWSE 成交（價格、量）=====
    dataDay.forEach((item) => {
      const code = item.Code;
      marketMap[code] = {
        id: code,
        name: item.Name,
        listedBoard: 'TWSE',
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
        governanceScore: null,
        governanceRaw: null,
      };

      const prev = marketMap[code].price - marketMap[code].change;
      marketMap[code].changePercent =
        prev > 0 ? Number(((marketMap[code].change / prev) * 100).toFixed(2)) : 0;
    });

    // ===== 1-2. TWSE：基本面 =====
    dataBWIBBU.forEach((item) => {
      if (marketMap[item.Code]) {
        marketMap[item.Code].pe = parseFloat(item.PEratio) || 0;
        marketMap[item.Code].yield = parseFloat(item.DividendYield) || 0;
        marketMap[item.Code].pb = parseFloat(item.PBratio) || 0;
      }
    });

    // ===== 1-3. TWSE：法人 =====
    dataT86.forEach((item) => {
      if (marketMap[item.Code]) {
        marketMap[item.Code].foreignNet = Math.round((parseInt(item.ForeignInvestorsNetBuySell) || 0) / 1000);
        marketMap[item.Code].trustNet = Math.round((parseInt(item.InvestmentTrustNetBuySell) || 0) / 1000);
      }
    });

    // ===== 1-4. TWSE：公司治理（ESG）=====
    dataGov.forEach((item) => {
      const code = item.Code || item.SecuritiesCode;
      if (!code || !marketMap[code]) return;

      const pieces = [];
      if (item.BoardIndependentRatio) {
        const r = parseFloat(item.BoardIndependentRatio);
        if (!isNaN(r)) pieces.push(r >= 0.33 ? 40 : r >= 0.25 ? 25 : 10);
      }
      if (item.HasAuditCommittee === 'Y') pieces.push(20);
      if (item.HasRemunerationCommittee === 'Y') pieces.push(10);
      if (item.InfoSecurityPolicy === 'Y') pieces.push(10);

      const score = pieces.length ? pieces.reduce((a, b) => a + b, 0) : null;

      marketMap[code].governanceScore = score;
      marketMap[code].governanceRaw = item;
    });

    // ========= 2. TPEX（上櫃）官方資料 =========
    const tpexRes = await fetch('https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_quotes');

    if (tpexRes.ok) {
      const tpexData = await tpexRes.json();

      tpexData.forEach((item) => {
        const code =
          item.SecuritiesID ||
          item.SecuritiesCode ||
          item.Code ||
          item.StockNo;

        if (!code) return;

        const price = parseFloat(item.WeightedAveragePrice) || 0;

        if (!marketMap[code]) {
          // 上櫃獨有
          marketMap[code] = {
            id: code,
            name: item.Name || '',
            listedBoard: 'TPEX',
            price,
            change: 0,
            changePercent: 0,
            volume: parseInt(item.NumberOfSharesTraded) || 0,
            open: 0,
            high: parseFloat(item.HighestPrice) || 0,
            low: parseFloat(item.LowestPrice) || 0,
            pe: 0,
            yield: 0,
            pb: 0,
            foreignNet: 0,
            trustNet: 0,
            governanceScore: null,
            governanceRaw: null,
          };
        } else {
          // 若某股票由櫃轉市，或 TWSE API 有提供（少見）
          marketMap[code].listedBoard = 'TPEX';
          if (price) marketMap[code].price = price;
        }
      });
    }

    // ========= 3. 最後輸出：只留 4 碼股票 =========
    const result = Object.values(marketMap).filter((s) => s.id.length === 4);

    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE+TPEX market error:', err);
    res.status(500).json({ error: 'market fetch error', detail: err.message });
  }
}
