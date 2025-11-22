// api/twse-market.js

export default async function handler(req, res) {
  const urls = {
    bwibbu: 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',
    day: 'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
    t86: 'https://openapi.twse.com.tw/v1/fund/T86_ALL',
  };

  try {
    const [dataBWIBBU, dataDay, dataT86] = await Promise.all([
      fetch(urls.bwibbu).then((r) => r.json()),
      fetch(urls.day).then((r) => r.json()),
      fetch(urls.t86).then((r) => r.json()),
    ]);

    // 可以讓 Vercel edge cache 10 分鐘
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate');

    res.status(200).json({
      dataBWIBBU,
      dataDay,
      dataT86,
    });
  } catch (err) {
    console.error('TWSE API error', err);
    res.status(500).json({ error: 'TWSE fetch failed' });
  }
}
