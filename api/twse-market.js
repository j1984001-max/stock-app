// /api/twse-market.js

export default async function handler(req, res) {
  // CORS 設定（給前端 fetch 用）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // =========================
    // 1. 先抓「上市 TWSE」三個主要資料集
    // =========================
    const [bwibbuRes, dayRes, t86Res] = await Promise.all([
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL'),
      fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL'),
      fetch('https://openapi.twse.com.tw/v1/fund/T86_ALL'),
    ]);

    if (!bwibbuRes.ok || !dayRes.ok || !t86Res.ok) {
      throw new Error(
        `TWSE status: BWIBBU=${bwibbuRes.status}, DAY=${dayRes.status}, T86=${t86Res.status}`
      );
    }

    const [dataBWIBBU, dataDay, dataT86] = await Promise.all([
      bwibbuRes.json(),
      dayRes.json(),
      t86Res.json(),
    ]);

    const marketMap = {};

    // -------------------------
    // 1-1. 價格與成交量 (STOCK_DAY_ALL)
    // -------------------------
    dataDay.forEach((item) => {
      // Code: 股票代號, Name: 股票名稱
      const id = item.Code;
      if (!id) return;

      const price = parseFloat(item.ClosingPrice);
      const change = parseFloat(item.Change);
      const volume = parseInt(item.TradeVolume, 10);

      marketMap[id] = {
        id,
        name: item.Name,
        price: Number.isFinite(price) ? price : 0,
        change: Number.isFinite(change) ? change : 0,
        volume: Number.isFinite(volume) ? volume : 0,
        open: Number.parseFloat(item.OpeningPrice) || 0,
        high: Number.parseFloat(item.HighestPrice) || 0,
        low: Number.parseFloat(item.LowestPrice) || 0,
        pe: 0,
        yield: 0,
        pb: 0,
        foreignNet: 0,
        trustNet: 0,
        governanceScore: null,
        governanceRaw: null,
        // 預留給前端使用的欄位
        sector: '上市公司',
      };

      const prev = marketMap[id].price - marketMap[id].change;
      marketMap[id].changePercent =
        prev > 0
          ? Number(((marketMap[id].change / prev) * 100).toFixed(2))
          : 0;
    });

    // -------------------------
    // 1-2. 本益比、殖利率、PB (BWIBBU_ALL)
    // -------------------------
    dataBWIBBU.forEach((item) => {
      const id = item.Code;
      if (!id || !marketMap[id]) return;

      marketMap[id].pe = parseFloat(item.PEratio) || 0;
      marketMap[id].yield = parseFloat(item.DividendYield) || 0;
      marketMap[id].pb = parseFloat(item.PBratio) || 0;
    });

    // -------------------------
    // 1-3. 三大法人籌碼 (T86_ALL)
    // -------------------------
    dataT86.forEach((item) => {
      const id = item.Code;
      if (!id || !marketMap[id]) return;

      const foreign = parseInt(item.ForeignInvestorsNetBuySell, 10) || 0;
      const trust = parseInt(item.InvestmentTrustNetBuySell, 10) || 0;

      marketMap[id].foreignNet = Math.round(foreign / 1000);
      marketMap[id].trustNet = Math.round(trust / 1000);
    });

    // =========================
    // 2. 上櫃（TPEX）: 先做「不影響主流程」的嘗試
    // =========================
    try {
      // ⚠️ 這裡只是範例 endpoint，你之後可以換成你要的 dataset。
      // 請挑一個包含「證券代號／股票代碼」＋「成交價」的 TPEX API。
      // 例如（假設有 Code / ClosingPrice 之類欄位）：
      //
      //   https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes
      //
      const tpexRes = await fetch(
        'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes'
      );

      if (tpexRes.ok) {
        const tpexData = await tpexRes.json();

        tpexData.forEach((item) => {
          // 下面這兩行「欄位名稱」一定要用實際 API 的欄位改掉：
          const id = item.Code || item.SecuritiesCode; // ← 自己確認實際欄位
          if (!id) return;

          // 如果這檔在 TWSE 已經有，就視為重複，不覆蓋
          if (marketMap[id]) return;

          const price = parseFloat(item.ClosingPrice || item.WeightedAveragePrice);
          const volume = parseInt(item.NumberOfSharesTraded, 10);

          marketMap[id] = {
            id,
            name: item.Name || '',
            price: Number.isFinite(price) ? price : 0,
            change: 0,
            changePercent: 0,
            volume: Number.isFinite(volume) ? volume : 0,
            open: 0,
            high: 0,
            low: 0,
            pe: 0,
            yield: 0,
            pb: 0,
            foreignNet: 0,
            trustNet: 0,
            governanceScore: null,
            governanceRaw: null,
            sector: '上櫃公司',
          };
        });
      } else {
        console.error('TPEX API status:', tpexRes.status);
      }
    } catch (tpexErr) {
      // 這裡只記 log，不要 throw，避免整個 API 掛掉
      console.error('TPEX API error:', tpexErr);
    }

    // =========================
    // 3. 組合 + 回傳
    // =========================

    const result = Object.values(marketMap).filter((s) => s.id && s.id.length === 4);

    // 即使 result 為空，也回傳 200，讓前端可以顯示「找不到」而不是整個壞掉
    res.status(200).json(result);
  } catch (err) {
    console.error('TWSE API error:', err);

    // ❗ 為了不要讓前端整個炸裂，這裡回傳 200 + 空陣列，而不是 500
    res.status(200).json([]);
  }
}
