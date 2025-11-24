// api/twse-market.js

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const [bwibbuRes, dayRes, t86Res, govRes] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetch('https://openapi.twse.com.tw/v1/fund/T86_ALL'),
      // 公司治理（ESG－治理面）資料集
      fetch('https://openapi.twse.com.tw/v1/opendata/t187ap46_L_9'),
    ]);

    const [dataBWIBBU, dataDay, dataT86, dataGov] = await Promise.all([
      bwibbuRes.json(),
      dayRes.json(),
      t86Res.json(),
      govRes.json(),
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
        // 先給預設值
        governanceScore: null,
        governanceRaw: null,
      };

      const prev = marketMap[item.Code].price - marketMap[item.Code].change;
      marketMap[item.Code].changePercent =
        prev > 0
          ? Number(((marketMap[item.Code].change / prev) * 100).toFixed(2))
          : 0;
    });

    // 2. 本益比、殖利率、PB
    dataBWIBBU.forEach((item) => {
      if (marketMap[item.Code]) {
        marketMap[item.Code].pe = parseFloat(item.PEratio) || 0;
        marketMap[item.Code].yield = parseFloat(item.DividendYield) || 0;
        marketMap[item.Code].pb = parseFloat(item.PBratio) || 0;
      }
    });

    // 3. 三大法人籌碼
    dataT86.forEach((item) => {
      if (marketMap[item.Code]) {
        const foreign = parseInt(item.ForeignInvestorsNetBuySell) || 0;
        const trust = parseInt(item.InvestmentTrustNetBuySell) || 0;
        marketMap[item.Code].foreignNet = Math.round(foreign / 1000);
        marketMap[item.Code].trustNet = Math.round(trust / 1000);
      }
    });

    // 4. 公司治理指標
    dataGov.forEach((item) => {
      // ⚠️ 這裡請先用瀏覽器直接打開 API 看欄位名稱
      // 通常會有 item.Code 或 item.SecuritiesCode 之類的
      const code = item.Code || item.SecuritiesCode;
      if (!code || !marketMap[code]) return;

      // 範例：假設 API 有以下欄位（實際名稱請以官方為準）
      // item.BoardIndependentRatio, item.HasAuditCommittee, item.InfoSecurityPolicy, ...
      const governanceScorePieces = [];

      if (item.BoardIndependentRatio) {
        const ratio = parseFloat(item.BoardIndependentRatio);
        // 董事會獨立董事比率 > 1/3 加分
        if (!Number.isNaN(ratio)) {
          governanceScorePieces.push(
            ratio >= 0.33 ? 40 : ratio >= 0.25 ? 25 : 10
          );
        }
      }

      if (item.HasAuditCommittee === 'Y') {
        governanceScorePieces.push(20);
      }

      if (item.HasRemunerationCommittee === 'Y') {
        governanceScorePieces.push(10);
      }

      if (item.InfoSecurityPolicy === 'Y') {
        governanceScorePieces.push(10);
      }

      const governanceScore =
        governanceScorePieces.length > 0
          ? governanceScorePieces.reduce((a, b) => a + b, 0)
          : null;

      marketMap[code].governanceScore = governanceScore;
      marketMap[code].governanceRaw = item; // 原始欄位保留給前端顯示細節
    });

    const result = Object.values(marketMap).filter((s) => s.id.length === 4);
    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE API error:', err);
    res
      .status(500)
      .json({ error: 'TWSE fetch failed', message: err.message });
  }
}
