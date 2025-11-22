import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
  ReferenceLine,
  Cell,
  Scatter,
} from 'recharts';
import {
  Search,
  TrendingUp,
  Activity,
  Filter,
  Info,
  ArrowUpCircle,
  ArrowDownCircle,
  Menu,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Zap,
  ShieldAlert,
  TrendingDown,
  Calculator,
  Target,
  Gem,
  Banknote,
  Wifi,
  Heart,
  RefreshCw,
  AlertTriangle,
  Database,
  List,
  Sliders,
  BarChart2,
  DollarSign,
  X,
  CheckCircle2,
  Coins
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// =========================
// 基本設定
// =========================

const INITIAL_WATCH_LIST_IDS = [
  '2330', '2454', '2317', '2603', '2881', '2882', '2412', '2308', '2303', '1101', '0050', '0056'
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const formatDate = (date) => date.toISOString().split('T')[0];

// =========================
// Firebase 初始化設定
// =========================
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
  // 如果您在本地開發，請在此填入您的 Firebase Config
  apiKey: "AIzaSyDK3-cqlescL-IsjJhvsgvfBWsGAwb7JiM",
  authDomain: "rootmaster-d7548.firebaseapp.com",
  projectId: "rootmaster-d7548",
  storageBucket: "rootmaster-d7548.firebasestorage.app",
  messagingSenderId: "536194643036",
  appId: "1:536194643036:web:3fadd43098faff72452299",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'stock-app-pro';

// =========================
// 技術指標計算
// =========================

const calculateMA = (data, dayCount) =>
  data.map((item, index, arr) => {
    if (index < dayCount - 1) return { ...item, [`ma${dayCount}`]: null };
    const sum = arr
      .slice(index - dayCount + 1, index + 1)
      .reduce((acc, curr) => acc + curr.close, 0);
    return {
      ...item,
      [`ma${dayCount}`]: Number((sum / dayCount).toFixed(2)),
    };
  });

const calculateBB = (data, period = 20, multiplier = 2) =>
  data.map((item, index, arr) => {
    if (index < period - 1)
      return { ...item, bbUpper: null, bbMiddle: null, bbLower: null };
    const slice = arr.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, curr) => acc + curr.close, 0);
    const mean = sum / period;
    const squaredDiffs = slice.map((x) => Math.pow(x.close - mean, 2));
    const variance =
      squaredDiffs.reduce((acc, curr) => acc + curr, 0) / period;
    const stdDev = Math.sqrt(variance);
    return {
      ...item,
      bbMiddle: Number(mean.toFixed(2)),
      bbUpper: Number((mean + multiplier * stdDev).toFixed(2)),
      bbLower: Number((mean - multiplier * stdDev).toFixed(2)),
    };
  });

const calculateKD = (data, period = 9) => {
  let k = 50;
  let d = 50;
  return data.map((item, index) => {
    if (index < period - 1) return { ...item, k: 50, d: 50 };
    const window = data.slice(index - period + 1, index + 1);
    const lowest = Math.min(...window.map((w) => w.low));
    const highest = Math.max(...window.map((w) => w.high));
    let rsv = 50;
    if (highest !== lowest) {
      rsv = ((item.close - lowest) / (highest - lowest)) * 100;
    }
    k = (2 / 3) * k + (1 / 3) * rsv;
    d = (2 / 3) * d + (1 / 3) * k;
    return { ...item, k: Number(k.toFixed(2)), d: Number(d.toFixed(2)) };
  });
};

const calculateMACD = (data) => {
  if (!data || data.length === 0) return [];
  const getEMA = (val, prevEMA, days) => {
    const alpha = 2 / (days + 1);
    return val * alpha + prevEMA * (1 - alpha);
  };
  let ema12 = data[0].close;
  let ema26 = data[0].close;
  const withDIF = data.map((item) => {
    ema12 = getEMA(item.close, ema12, 12);
    ema26 = getEMA(item.close, ema26, 26);
    const dif = ema12 - ema26;
    return { ...item, dif };
  });
  let signal = withDIF[0].dif;
  return withDIF.map((item) => {
    signal = getEMA(item.dif, signal, 9);
    const osc = item.dif - signal;
    return {
      ...item,
      dif: Number(item.dif.toFixed(2)),
      macd: Number(signal.toFixed(2)),
      osc: Number(osc.toFixed(2)),
    };
  });
};

const calculateRSIArray = (data, period = 14) => {
  if (!data || data.length === 0) return [];
  let gains = 0;
  let losses = 0;
  const rsiArray = [];
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      rsiArray.push(50);
      continue;
    }
    const change = data[i].close - data[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    if (i <= period) {
      gains += gain;
      losses += loss;
      if (i === period) {
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsiArray.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
      } else {
        rsiArray.push(50);
      }
    } else {
      let sumGain = 0;
      let sumLoss = 0;
      for (let j = 0; j < period; j++) {
        if (i - j <= 0) break;
        const chg = data[i - j].close - data[i - j - 1].close;
        if (chg > 0) sumGain += chg;
        else sumLoss += Math.abs(chg);
      }
      const avgGain = sumGain / period;
      const avgLoss = sumLoss / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsiArray.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
    }
  }
  return rsiArray;
};

// =========================
// 回測
// =========================

const runBacktest = (history, strategyType) => {
  if (!history || history.length < 60)
    return { roi: 0, winRate: 0, count: 0, history: history || [] };

  const simulatedHistory = history.map((h) => ({
    ...h,
    buySignal: null,
    sellSignal: null,
  }));
  let capital = 100000;
  let position = 0;
  let entryPrice = 0;
  let tradeCount = 0;
  let wins = 0;
  let totalProfit = 0;

  for (let i = 20; i < simulatedHistory.length; i++) {
    const today = simulatedHistory[i];
    const prev = simulatedHistory[i - 1];
    let signalBuy = false;
    let signalSell = false;

    if (strategyType === 'long') {
      signalBuy = today.ma5 > today.ma20 && prev.k < prev.d && today.k > today.d;
      signalSell = prev.k > prev.d && today.k < today.d;
    } else if (strategyType === 'short') {
      signalBuy = today.ma5 < today.ma20 && prev.k > prev.d && today.k < today.d;
      signalSell = prev.k < prev.d && today.k > today.d;
    } else if (strategyType === 'value') {
      signalBuy = (today.rsi || 50) < 30 && (prev.rsi || 50) >= 30;
      signalSell = (today.rsi || 50) > 70 && (prev.rsi || 50) <= 70;
    }

    if (strategyType === 'short') {
      if (position === 0 && signalBuy) {
        entryPrice = today.close;
        position = 1;
        today.sellSignal = today.high * 1.04;
      } else if (position === 1 && signalSell) {
        const profitPct = (entryPrice - today.close) / entryPrice;
        const profit = 100000 * profitPct;
        totalProfit += profit;
        if (profit > 0) wins++;
        tradeCount++;
        position = 0;
        today.buySignal = today.low * 0.96;
      }
    } else {
      if (position === 0 && signalBuy) {
        position = Math.floor(capital / today.close);
        entryPrice = today.close;
        capital -= position * today.close;
        today.buySignal = today.low * 0.96;
      } else if (position > 0 && signalSell) {
        const profit = (today.close - entryPrice) * position;
        capital += position * today.close;
        totalProfit += profit;
        if (profit > 0) wins++;
        tradeCount++;
        position = 0;
        today.sellSignal = today.high * 1.04;
      }
    }
  }

  if (position > 0) {
    const lastPrice = simulatedHistory[simulatedHistory.length - 1].close;
    if (strategyType === 'short') {
      const profit = 100000 * ((entryPrice - lastPrice) / entryPrice);
      totalProfit += profit;
    } else {
      const profit = (lastPrice - entryPrice) * position;
      totalProfit += profit;
    }
  }

  return {
    roi: (totalProfit / 100000 * 100).toFixed(1),
    winRate: tradeCount > 0 ? ((wins / tradeCount) * 100).toFixed(0) : 0,
    count: tradeCount,
    history: simulatedHistory,
  };
};

// =========================
// API & Data Fetching (Updated with Multi-Proxy)
// =========================

const fetchWithFallback = async (url) => {
  // 1. Try Direct (Fastest, works in some environments)
  try {
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) { /* continue */ }

  // 2. Try corsproxy.io (Usually reliable)
  try {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) return await res.json();
  } catch (e) { /* continue */ }

  // 3. Try allorigins.win (Backup, wraps response in JSON)
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.contents) {
        return JSON.parse(data.contents);
      }
    }
  } catch (e) { /* continue */ }

  throw new Error("Network Error: Unable to fetch data from any source. Please check connection.");
};

// 從自家 Vercel API 抓取全市場資料（由 Serverless 幫忙 call TWSE，解決 CORS）
const fetchTWSEMarketData = async () => {
  try {
    // 這裡就只打同網域的 /api/twse-market，不再直接打 TWSE
    const res = await fetch('/api/twse-market');
    if (!res.ok) {
      throw new Error('Proxy API /api/twse-market failed');
    }

    const { dataBWIBBU, dataDay, dataT86 } = await res.json();

    const marketMap = {};

    // 1. 價格與成交量
    dataDay.forEach(item => {
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
          marketMap[item.Code].changePercent = Number(((marketMap[item.Code].change / prev) * 100).toFixed(2));
        } else {
          marketMap[item.Code].changePercent = 0;
        }
      }
    });

    // 2. 本益比、殖利率、PB
    dataBWIBBU.forEach(item => {
      if (marketMap[item.Code]) {
        marketMap[item.Code].pe = parseFloat(item.PEratio) || 0;
        marketMap[item.Code].yield = parseFloat(item.DividendYield) || 0;
        marketMap[item.Code].pb = parseFloat(item.PBratio) || 0;
      }
    });

    // 3. 三大法人籌碼 (注意：單位是股數，除以1000換成張)
    dataT86.forEach(item => {
      if (marketMap[item.Code]) {
        const foreign = parseInt(item.ForeignInvestorsNetBuySell) || 0;
        const trust = parseInt(item.InvestmentTrustNetBuySell) || 0;

        marketMap[item.Code].foreignNet = Math.round(foreign / 1000);
        marketMap[item.Code].trustNet = Math.round(trust / 1000);
      }
    });

    return Object.values(marketMap).filter(s => s.id.length === 4);

  } catch (error) {
    console.error("TWSE API Error via /api/twse-market:", error);
    throw new Error("連線證交所 API 失敗（Serverless Proxy），請稍後再試。");
  }
};


const fetchFinMind = async (dataset, stockId, startDate) => {
  const today = new Date();
  const url = `https://api.finmindtrade.com/api/v4/data?dataset=${dataset}&data_id=${stockId}&start_date=${startDate}&end_date=${formatDate(
    today,
  )}`;
  const maxRetries = 3;

  for (let i = 0; i < maxRetries; i++) {
    try {
      if (i > 0) await delay(1000 * Math.pow(2, i));
      const json = await fetchWithFallback(url);
      return json.data || [];
    } catch (err) {
      console.error(`FinMind Fetch Error (${dataset}):`, err);
      if (i === maxRetries - 1) return [];
    }
  }
  return [];
};

// =========================
// 資料處理
// =========================

const processStockData = (
  baseInfo,
  priceData = [],
  chipData = [],
  revData = [],
  fullHistory = false,
) => {
  
  let history = [];
  let ma5 = 0, ma20 = 0, ma60 = 0, rsi = 50, k = 50, d = 50, osc = 0;
  
  if (priceData && priceData.length > 0) {
    const cleanData = priceData.map((d) => {
      const isUp = d.close >= d.open;
      return {
        day: (d.date || '').slice(5),
        fullDate: d.date,
        open: d.open,
        close: d.close,
        high: d.max,
        low: d.min,
        price: d.close,
        volume: Math.round((d.Trading_Volume || 0) / 1000),
        candleBody: [Math.min(d.open, d.close), Math.max(d.open, d.close)],
        candleWick: [d.min, d.max],
        color: isUp ? '#f87171' : '#34d399',
        isUp,
      };
    });

    let processed = calculateMA(cleanData, 5);
    processed = calculateMA(processed, 20);
    processed = calculateMA(processed, 60);
    processed = calculateKD(processed, 9);
    processed = calculateMACD(processed);
    processed = calculateBB(processed, 20, 2);

    const rsiSeries = calculateRSIArray(cleanData);
    processed.forEach((p, idx) => {
      p.rsi = rsiSeries[idx] || 50;
    });

    history = processed;
    const last = history[history.length - 1];
    
    ma5 = last.ma5;
    ma20 = last.ma20;
    ma60 = last.ma60;
    k = last.k;
    d = last.d;
    osc = last.osc;
    rsi = last.rsi;
  }

  const processedChips = [];
  if (chipData && chipData.length > 0) {
    const chipMap = {};
    chipData.forEach((item) => {
      if (!chipMap[item.date])
        chipMap[item.date] = { foreign: 0, trust: 0, dealer: 0 };
      const netShares = item.buy - item.sell;
      const netLots = Math.round(netShares / 1000);
      if (item.name === 'Foreign_Investor') chipMap[item.date].foreign += netLots;
      else if (item.name === 'Investment_Trust')
        chipMap[item.date].trust += netLots;
      else if (item.name === 'Dealer') chipMap[item.date].dealer += netLots;
    });
    Object.keys(chipMap)
      .sort()
      .forEach((date) => {
        const match = history.find((h) => h.fullDate === date);
        if (match) {
          match.foreign = chipMap[date].foreign;
          match.trust = chipMap[date].trust;
          match.dealer = chipMap[date].dealer;
        }
        processedChips.push({ day: date.slice(5), ...chipMap[date] });
      });
  }
  
  // Use FinMind data if available, otherwise fallback to TWSE snapshot for today
  const foreignBuy = chipData.length > 0 ? processedChips.slice(-5).reduce((acc, curr) => acc + curr.foreign, 0) : baseInfo.foreignNet;
  const trustBuy = chipData.length > 0 ? processedChips.slice(-5).reduce((acc, curr) => acc + curr.trust, 0) : baseInfo.trustNet;

  let score = 60;
  if (baseInfo.pe > 0 && baseInfo.pe < 15) score += 15;
  if (baseInfo.yield > 4) score += 10;
  if (ma5 > ma20) score += 10;
  if (k > d && k < 80) score += 10;
  if (osc > 0) score += 5;
  if (foreignBuy > 0) score += 5;
  if (trustBuy > 0) score += 5;
  score = Math.min(99, score);

  return {
    ...baseInfo, 
    sector: '上市公司', 
    ma5,
    ma20,
    ma60,
    rsi,
    k,
    d,
    osc,
    foreignBuy,
    trustBuy,
    history,
    chipHistory: processedChips.slice(-30),
    score,
    isFullHistory: fullHistory,
    hasFundamentals: true,
    revenueYoY: 0, 
  };
};

const fetchDetailedHistory = async (stock, marketCacheStock) => {
  const today = new Date();
  const date5YearsAgo = new Date(new Date().setDate(today.getDate() - 1825));
  const startDateStr = formatDate(date5YearsAgo);

  const [priceData, chipData] = await Promise.all([
    fetchFinMind('TaiwanStockPrice', stock.id, startDateStr),
    fetchFinMind('TaiwanStockInstitutionalInvestorsBuySell', stock.id, startDateStr)
  ]);

  return processStockData(
    marketCacheStock,
    priceData,
    chipData,
    [],
    true,
  );
};


// =========================
// UI 小元件
// =========================

const BuyMarker = ({ cx, cy }) => {
  if (!cx || !cy) return null;
  return (
    <svg x={cx - 12} y={cy - 12} width={24} height={24} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#8b5cf6" stroke="#1e293b" strokeWidth="2" />
      <path d="M12 6l-5 5h3v7h4v-7h3z" fill="white" />
    </svg>
  );
};

const SellMarker = ({ cx, cy }) => {
  if (!cx || !cy) return null;
  return (
    <svg x={cx - 12} y={cy - 12} width={24} height={24} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="11" fill="#3b82f6" stroke="#1e293b" strokeWidth="2" />
      <path d="M12 18l-5-5h3v-7h4v7h3z" fill="white" />
    </svg>
  );
};

const CustomKLineTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-neutral-800 p-3 border border-neutral-700 rounded-lg shadow-lg text-xs z-50 text-neutral-200">
        <p className="font-bold text-white mb-1">
          {data.day} ({data.fullDate})
        </p>
        {data.buySignal && (
          <div className="flex items-center gap-1 text-purple-300 font-bold mb-1 bg-purple-900/30 p-1.5 rounded justify-center">
            <div className="w-3 h-3 rounded-full bg-purple-500" />
            <span>策略買進訊號</span>
          </div>
        )}
        {data.sellSignal && (
          <div className="flex items-center gap-1 text-blue-300 font-bold mb-1 bg-blue-900/30 p-1.5 rounded justify-center">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>策略賣出訊號</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
          <div className="flex justify-between gap-2">
            <span className="text-neutral-400">開:</span>
            <span className={data.close > data.open ? 'text-red-400' : 'text-emerald-400'}>
              {data.open}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-neutral-400">高:</span>
            <span className="text-red-400">{data.high}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-neutral-400">低:</span>
            <span className="text-emerald-400">{data.low}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-neutral-400">收:</span>
            <span
              className={`font-bold ${
                data.close > data.open ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {data.close}
            </span>
          </div>
          <div className="col-span-2 flex justify-between text-neutral-500 mt-2 pt-2 border-t border-neutral-700">
            <span>MA5: {data.ma5}</span>
            <span>RSI: {data.rsi}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const StockCard = ({ stock, onClick, isSelected, favorites, toggleFavorite, strategy }) => {
  return (
    <div
      onClick={() => onClick(stock)}
      className={`p-5 mb-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl relative overflow-hidden group ${
        isSelected
          ? 'border-amber-500 bg-neutral-800 shadow-lg shadow-amber-500/10'
          : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
      }`}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(stock.id);
        }}
        className={`absolute top-4 right-4 z-10 transition-colors ${
          favorites.includes(stock.id)
            ? 'text-red-500 fill-current'
            : 'text-neutral-600 hover:text-red-400'
        }`}
      >
        <Heart size={20} />
      </button>

      {strategy === 'long' && (
        <div className="absolute top-0 left-0 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold z-0">
          多頭潛力
        </div>
      )}
      {strategy === 'short' && (
        <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold z-0">
          空頭警示
        </div>
      )}
      {strategy === 'value' && (
        <div className="absolute top-0 left-0 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold z-0">
          價值存股
        </div>
      )}

      <div className="flex justify-between items-start mb-4 mt-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-bold text-xl text-white tracking-wide">
              {stock.name}
            </span>
            <span className="text-xs font-mono bg-neutral-800 px-2 py-0.5 rounded text-neutral-400 border border-neutral-700">
              {stock.id}
            </span>
          </div>
          <span className="text-xs text-neutral-500 font-medium">
            {stock.sector}
          </span>
        </div>
        <div className="text-right mt-1">
          <div
            className={`font-bold text-2xl ${
              stock.change >= 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {stock.price}
          </div>
          <div
            className={`text-xs flex items-center justify-end gap-1 mt-1 font-medium ${
              stock.change >= 0 ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {stock.change >= 0 ? (
              <ArrowUpCircle size={14} />
            ) : (
              <ArrowDownCircle size={14} />
            )}
            {Math.abs(stock.change)} ({Math.abs(stock.changePercent)}%)
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-2 bg-neutral-950/50 rounded-lg border border-neutral-800/50 group-hover:border-neutral-700 transition-colors">
          <div className="text-[10px] text-neutral-500 mb-0.5">外資買賣超</div>
          <div className={`text-sm font-medium ${stock.foreignNet > 0 ? 'text-red-400' : stock.foreignNet < 0 ? 'text-green-400' : 'text-neutral-300'}`}>
            {stock.foreignNet} 張
          </div>
        </div>
        <div className="text-center p-2 bg-neutral-950/50 rounded-lg border border-neutral-800/50 group-hover:border-neutral-700 transition-colors">
          <div className="text-[10px] text-neutral-500 mb-0.5">殖利率</div>
          <div
            className={`text-sm font-medium ${
              stock.yield > 4 ? 'text-amber-400' : 'text-neutral-300'
            }`}
          >
            {stock.yield}%
          </div>
        </div>
        <div className="text-center p-2 bg-neutral-950/50 rounded-lg border border-neutral-800/50 group-hover:border-neutral-700 transition-colors">
          <div className="text-[10px] text-neutral-500 mb-0.5">本益比</div>
          <div className="text-sm font-medium text-neutral-300">
            {stock.pe > 0 ? `${stock.pe}x` : '-'}
          </div>
        </div>
      </div>
    </div>
  );
};

// New Screener Modal Component
const ScreenerModal = ({ isOpen, onClose, onApply, currentFilters }) => {
  const [localFilters, setLocalFilters] = useState(currentFilters);

  // Reset local state when modal opens with new currentFilters
  useEffect(() => {
    if (isOpen) setLocalFilters(currentFilters);
  }, [isOpen, currentFilters]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 w-full max-w-md rounded-3xl border border-neutral-800 shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between sticky top-0 bg-neutral-900 z-10 rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">智慧選股設定</h3>
              <p className="text-xs text-neutral-500">自訂您的選股策略</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* Basic Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-sm uppercase tracking-wider border-b border-blue-500/20 pb-2">
              <Filter size={14} /> 基本面指標
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">最高本益比 (PE)</span>
                  <span className="text-white font-bold bg-neutral-800 px-2 py-0.5 rounded">{localFilters.maxPe}x</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  value={localFilters.maxPe}
                  onChange={(e) => setLocalFilters({ ...localFilters, maxPe: Number(e.target.value) })}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                  <span>5x</span>
                  <span>100x</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">最低殖利率 (Yield)</span>
                  <span className="text-white font-bold bg-neutral-800 px-2 py-0.5 rounded">{localFilters.minYield}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="15"
                  step="0.5"
                  value={localFilters.minYield}
                  onChange={(e) => setLocalFilters({ ...localFilters, minYield: Number(e.target.value) })}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                  <span>0%</span>
                  <span>15%</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">最高股價淨值比 (PB)</span>
                  <span className="text-white font-bold bg-neutral-800 px-2 py-0.5 rounded">{localFilters.maxPb}x</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  value={localFilters.maxPb}
                  onChange={(e) => setLocalFilters({ ...localFilters, maxPb: Number(e.target.value) })}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Chip Filters (NEW) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-sm uppercase tracking-wider border-b border-purple-500/20 pb-2">
              <Coins size={14} /> 籌碼面指標
            </div>
            
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">外資最少買超 (張)</span>
                  <span className="text-white font-bold bg-neutral-800 px-2 py-0.5 rounded">{localFilters.minForeign}</span>
                </div>
                <input
                  type="range"
                  min="-2000"
                  max="5000"
                  step="100"
                  value={localFilters.minForeign}
                  onChange={(e) => setLocalFilters({ ...localFilters, minForeign: Number(e.target.value) })}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                  <span>賣超</span>
                  <span>買超 5000</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">投信最少買超 (張)</span>
                  <span className="text-white font-bold bg-neutral-800 px-2 py-0.5 rounded">{localFilters.minTrust}</span>
                </div>
                <input
                  type="range"
                  min="-500"
                  max="2000"
                  step="50"
                  value={localFilters.minTrust}
                  onChange={(e) => setLocalFilters({ ...localFilters, minTrust: Number(e.target.value) })}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Tech Filters */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider border-b border-amber-500/20 pb-2">
              <BarChart2 size={14} /> 技術面
            </div>

            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-neutral-400">最低成交量 (張)</span>
                  <span className="text-white font-bold bg-neutral-800 px-2 py-0.5 rounded">{localFilters.minVol}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="100"
                  value={localFilters.minVol}
                  onChange={(e) => setLocalFilters({ ...localFilters, minVol: Number(e.target.value) })}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2 text-neutral-400">
                  <span>股價區間 (元)</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">$</div>
                    <input
                      type="number"
                      value={localFilters.minPrice}
                      onChange={(e) => setLocalFilters({ ...localFilters, minPrice: Number(e.target.value) })}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-2 pl-6 pr-3 text-sm text-white focus:border-amber-500 outline-none"
                      placeholder="Min"
                    />
                  </div>
                  <span className="text-neutral-500">-</span>
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">$</div>
                    <input
                      type="number"
                      value={localFilters.maxPrice}
                      onChange={(e) => setLocalFilters({ ...localFilters, maxPrice: Number(e.target.value) })}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-xl py-2 pl-6 pr-3 text-sm text-white focus:border-amber-500 outline-none"
                      placeholder="Max"
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm text-neutral-400 mb-3">今日走勢</div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setLocalFilters({ ...localFilters, trend: 'all' })}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors border ${localFilters.trend === 'all' ? 'bg-neutral-700 text-white border-neutral-600' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:bg-neutral-800'}`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setLocalFilters({ ...localFilters, trend: 'bullish' })}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors border ${localFilters.trend === 'bullish' ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:bg-neutral-800'}`}
                  >
                    強勢上漲
                  </button>
                  <button
                    onClick={() => setLocalFilters({ ...localFilters, trend: 'bearish' })}
                    className={`py-2 rounded-xl text-sm font-medium transition-colors border ${localFilters.trend === 'bearish' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-neutral-900 text-neutral-500 border-neutral-800 hover:bg-neutral-800'}`}
                  >
                    弱勢下跌
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-neutral-800 bg-neutral-900 sticky bottom-0 rounded-b-3xl flex gap-3">
          <button 
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-neutral-400 font-medium hover:bg-neutral-800 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={() => onApply(localFilters)}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold shadow-lg shadow-blue-500/20 hover:from-blue-500 hover:to-blue-400 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            開始篩選
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================
// 主元件：進階版 吳媽媽台股神探
// =========================

export default function App() {
  const [activeTab, setActiveTab] = useState('overview'); // overview | analysis
  
  // Market Data (TWSE Cache)
  const [marketCache, setMarketCache] = useState([]);
  const [stocks, setStocks] = useState([]); // 顯示在列表中的股票
  
  const [selectedStock, setSelectedStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Firebase User State
  const [user, setUser] = useState(null);

  const [techTab, setTechTab] = useState('chips'); // chips | kd | macd
  const [timeframe, setTimeframe] = useState('6m'); // 3m | 6m | 1y | 5y
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]); // 搜尋建議
  
  const [strategy, setStrategy] = useState('custom'); // custom | long | short | value | favorites
  const [filters, setFilters] = useState({
    maxPe: 30,
    minYield: 2,
    maxPb: 5,
    minVol: 500,
    minPrice: 0,
    maxPrice: 2000,
    trend: 'all', // all | bullish | bearish
    minForeign: 0, // 外資
    minTrust: 0,   // 投信
  });
  const [showBB, setShowBB] = useState(false);
  const [loadingFullHistory, setLoadingFullHistory] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modal State
  const [showScreenerModal, setShowScreenerModal] = useState(false);

  // 我的最愛
  const [favorites, setFavorites] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = window.localStorage.getItem('wuMamaFavorites_v2');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Firebase Auth: 自動登入
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {
        console.error("Firebase Auth Error:", e);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // Firebase Sync: 監聽雲端資料
  useEffect(() => {
    if (!user) return;
    // 定義雲端路徑: artifacts/{appId}/users/{userId}/data/favorites
    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'favorites');

    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.list && Array.isArray(data.list)) {
          // 從雲端下載並更新
          setFavorites(data.list);
          // 同步更新本地 localStorage 作為備份
          window.localStorage.setItem('wuMamaFavorites_v2', JSON.stringify(data.list));
        }
      } else {
        // 如果雲端是空的（新用戶），把本地現有的最愛上傳上去
        if (favorites.length > 0) {
          setDoc(docRef, { list: favorites }, { merge: true });
        }
      }
    }, (error) => {
      console.error("Sync Error:", error);
    });

    return () => unsubscribe();
  }, [user]); // 只有當使用者登入狀態改變時才重新訂閱

  // 修改後的 toggleFavorite: 同步寫入雲端
  const toggleFavorite = async (stockId) => {
    let newFavs;
    if (favorites.includes(stockId)) {
      newFavs = favorites.filter((id) => id !== stockId);
    } else {
      newFavs = [...favorites, stockId];
    }
    
    // 1. 立即更新畫面
    setFavorites(newFavs);
    // 2. 更新本地儲存
    window.localStorage.setItem('wuMamaFavorites_v2', JSON.stringify(newFavs));

    // 3. 寫入 Firebase 雲端
    if (user) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'data', 'favorites');
        await setDoc(docRef, { list: newFavs }, { merge: true });
      } catch (e) {
        console.error("Cloud save failed:", e);
      }
    }
  };

  // 初始化：從 TWSE 載入全市場資料
  const loadMarketData = async () => {
    setLoading(true);
    setErrorMsg('');
    setProgress(10);
    
    try {
      const marketData = await fetchTWSEMarketData();
      setMarketCache(marketData);
      setProgress(100);

      const initialStocks = marketData.filter(s => INITIAL_WATCH_LIST_IDS.includes(s.id));
      
      setStocks(initialStocks.map(s => processStockData(s)));
      setSelectedStock(processStockData(initialStocks[0]));

    } catch (e) {
      console.error(e);
      setErrorMsg('連線證交所 API 失敗，請檢查網路或是 CORS 設定。');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMarketData();
  }, []);

  const handleStrategyChange = (newStrategy) => {
    if (newStrategy === 'custom') {
      setShowScreenerModal(true);
    } else {
      setStrategy(newStrategy);
    }
  };

  const handleApplyScreener = (newFilters) => {
    setFilters(newFilters);
    setStrategy('custom');
    setShowScreenerModal(false);
    setActiveTab('overview'); // Switch to list view to see results
  };

  // 進入個股分析頁時，抓取詳細歷史資料 (FinMind)
  useEffect(() => {
    const checkAndLoadFullHistory = async () => {
      if (
        activeTab === 'analysis' &&
        selectedStock &&
        !selectedStock.isFullHistory &&
        !loadingFullHistory
      ) {
        setLoadingFullHistory(true);
        setErrorMsg('');
        try {
            const cachedBase = marketCache.find(s => s.id === selectedStock.id) || selectedStock;
            const fullData = await fetchDetailedHistory(selectedStock, cachedBase);
            
            setStocks((prev) => prev.map((s) => (s.id === fullData.id ? fullData : s)));
            setSelectedStock(fullData);
        } catch (e) {
          console.error(e);
          setErrorMsg('載入 K 線歷史資料時發生錯誤 (FinMind API 失敗)。');
        } finally {
          setLoadingFullHistory(false);
        }
      }
    };
    checkAndLoadFullHistory();
  }, [activeTab, selectedStock?.id]); 

  // 搜尋建議 (Fuzzy Search)
  useEffect(() => {
      if (!searchQuery.trim()) {
          setSearchSuggestions([]);
          return;
      }
      const query = searchQuery.trim().toLowerCase();
      const matches = marketCache.filter(s => 
          s.id.includes(query) || s.name.includes(query)
      ).slice(0, 8); 
      setSearchSuggestions(matches);
  }, [searchQuery, marketCache]);

  const selectSuggestion = (stockBase) => {
      const processed = processStockData(stockBase);
      if (!stocks.find(s => s.id === stockBase.id)) {
          setStocks(prev => [processed, ...prev]);
      }
      setSelectedStock(processed);
      setActiveTab('analysis');
      setSearchQuery('');
      setSearchSuggestions([]);
  };

  // =========================
  // 策略判斷 & 篩選
  // =========================

  const isLongStrategy = (stock) => {
    return stock.change > 0 && stock.yield > 3 && stock.pe > 0 && stock.pe < 25;
  };

  const isShortStrategy = (stock) => {
    return stock.change < 0 && (stock.pe > 40 || stock.pe < 0);
  };

  const isValueStrategy = (stock) => {
    return stock.pe > 0 && stock.pe < 15 && stock.yield > 5 && stock.pb < 1.5;
  };
  
  const getStrategyStocks = () => {
      if (strategy === 'long') return marketCache.filter(isLongStrategy).slice(0, 50); 
      if (strategy === 'short') return marketCache.filter(isShortStrategy).slice(0, 50);
      if (strategy === 'value') return marketCache.filter(isValueStrategy).slice(0, 50);
      if (strategy === 'favorites') return marketCache.filter(s => favorites.includes(s.id));
      
      // Enhanced Custom Filter (包含籌碼)
      return marketCache.filter((stock) => {
          const passPe = stock.pe <= filters.maxPe && stock.pe > 0;
          const passYield = stock.yield >= filters.minYield;
          const passPb = stock.pb <= filters.maxPb && stock.pb > 0;
          
          // Tech
          const passVol = (stock.volume / 1000) >= filters.minVol; 
          const passPrice = stock.price >= filters.minPrice && stock.price <= filters.maxPrice;
          
          let passTrend = true;
          if (filters.trend === 'bullish') passTrend = stock.change > 0;
          if (filters.trend === 'bearish') passTrend = stock.change < 0;

          // Chips (NEW)
          const passForeign = stock.foreignNet >= filters.minForeign;
          const passTrust = stock.trustNet >= filters.minTrust;

          return passPe && passYield && passPb && passVol && passPrice && passTrend && passForeign && passTrust;
      }).slice(0, 100); // Limit to 100 to prevent UI lag
  };

  const displayStocks = useMemo(() => {
     const strategyResults = getStrategyStocks();
     return strategyResults.map(s => {
         const existing = stocks.find(e => e.id === s.id);
         return existing || processStockData(s);
     });
  }, [strategy, filters, marketCache, stocks, favorites]);

  const strategyCounts = useMemo(
    () => ({
      long: marketCache.filter(isLongStrategy).length,
      short: marketCache.filter(isShortStrategy).length,
      value: marketCache.filter(isValueStrategy).length,
      favorites: favorites.length,
    }),
    [marketCache, favorites],
  );

  const currentBacktest = useMemo(() => {
    if (!selectedStock) return { roi: 0, winRate: 0, count: 0, history: [] };
    let t = 'long';
    if (strategy === 'short') t = 'short';
    if (strategy === 'value') t = 'value';
    return runBacktest(selectedStock.history, t);
  }, [selectedStock, strategy]);

  const displayChartData = useMemo(() => {
    const hist = currentBacktest.history && currentBacktest.history.length > 0 
      ? currentBacktest.history 
      : (selectedStock?.history || []);

    if (!hist.length) return [];

    if (!selectedStock.isFullHistory) {
      return hist;
    }

    const len = hist.length;
    if (timeframe === '3m') {
      const n = Math.min(len, 65);
      return hist.slice(-n);
    }
    if (timeframe === '6m') {
      const n = Math.min(len, 130);
      return hist.slice(-n);
    }
    if (timeframe === '1y') {
      const n = Math.min(len, 260);
      return hist.slice(-n);
    }
    return hist;
  }, [selectedStock, timeframe, currentBacktest]); 

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-neutral-950 text-neutral-400 font-sans">
        <Loader2 size={56} className="animate-spin text-amber-500 mb-6" />
        <h2 className="text-2xl font-bold mb-2 text-white tracking-wider">
          吳媽媽台股神探 PRO
        </h2>
        <p className="text-sm mb-4 font-light">正在連線台灣證券交易所 OpenAPI...</p>
        <div className="w-64 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-600 to-yellow-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 text-xs text-neutral-600 font-mono">
            Downloading TWSE Market Snapshot...
        </div>
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 text-xs text-red-400">
            <AlertTriangle size={14} />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-200 font-sans overflow-hidden selection:bg-amber-500/30">
      
      {/* Screener Modal */}
      <ScreenerModal 
        isOpen={showScreenerModal} 
        onClose={() => setShowScreenerModal(false)}
        onApply={handleApplyScreener}
        currentFilters={filters}
      />

      <div
        className={`${
          isSidebarOpen ? 'w-72' : 'w-0'
        } bg-neutral-900 border-r border-neutral-800 flex flex-col transition-all duration-300 overflow-hidden z-20 flex-shrink-0`}
      >
        <div className="p-6 border-b border-neutral-800 flex items-center gap-3 bg-gradient-to-r from-neutral-900 to-neutral-800/50">
          <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-amber-500/20 text-lg">
            吳
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">
            吳媽媽台股神探 PRO
          </h1>
        </div>
        <div className="p-5 flex flex-col gap-2 overflow-y-auto flex-1 custom-scrollbar">
          <div className="text-xs font-bold text-neutral-500 mb-2 px-2 uppercase tracking-wider">
            市場概況
          </div>
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'overview'
                ? 'bg-neutral-800 text-white shadow-md border border-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            <Search size={18} /> 選股總覽
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl transition-all ${
              activeTab === 'analysis'
                ? 'bg-neutral-800 text-white shadow-md border border-neutral-700'
                : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
            }`}
          >
            <Activity size={18} /> 個股深度分析
          </button>

          <div className="mt-8 text-xs font-bold text-neutral-500 mb-2 px-2 uppercase tracking-wider">
            TWSE 智慧選股
          </div>

          {/* 雲端同步狀態指示燈 */}
          <div className="px-4 py-2 mb-2 flex items-center gap-2 bg-neutral-800/50 rounded-lg mx-2 border border-neutral-800">
             <div className={`w-2 h-2 rounded-full ${user ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-neutral-600'}`}></div>
             <div className="flex flex-col">
               <span className="text-[10px] font-bold text-neutral-300">
                 {user ? '雲端同步中' : '離線模式'}
               </span>
               {user && <span className="text-[9px] text-neutral-600">ID: {user.uid.slice(0, 6)}...</span>}
             </div>
          </div>

          <button
            onClick={() => handleStrategyChange('long')}
            className={`group flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl mb-2 transition-all border relative overflow-hidden ${
              strategy === 'long'
                ? 'bg-neutral-800 border-red-500/30 text-white shadow-lg shadow-red-500/5'
                : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${strategy === 'long' ? 'bg-red-500/20 text-red-400' : 'bg-neutral-800 text-neutral-500 group-hover:text-red-400 group-hover:bg-red-500/10'}`}>
              <Zap size={18} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="font-bold flex justify-between">
                多頭潛力股
                {strategyCounts.long > 0 && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full ml-2 h-fit">{strategyCounts.long > 99 ? '99+' : strategyCounts.long}</span>}
              </div>
              <div className="text-[10px] opacity-60 font-normal mt-0.5">收紅+殖利率{'>'}3%+合理PE</div>
            </div>
          </button>

          <button
            onClick={() => handleStrategyChange('short')}
            className={`group flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl mb-2 transition-all border relative overflow-hidden ${
              strategy === 'short'
                ? 'bg-neutral-800 border-emerald-500/30 text-white shadow-lg shadow-emerald-500/5'
                : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${strategy === 'short' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-500 group-hover:text-emerald-400 group-hover:bg-emerald-500/10'}`}>
              <TrendingDown size={18} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="font-bold flex justify-between">
                空頭警示股
                {strategyCounts.short > 0 && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full ml-2 h-fit">{strategyCounts.short > 99 ? '99+' : strategyCounts.short}</span>}
              </div>
              <div className="text-[10px] opacity-60 font-normal mt-0.5">收黑+高本益比</div>
            </div>
          </button>

          <button
            onClick={() => handleStrategyChange('value')}
            className={`group flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl mb-2 transition-all border relative overflow-hidden ${
              strategy === 'value'
                ? 'bg-neutral-800 border-purple-500/30 text-white shadow-lg shadow-purple-500/5'
                : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${strategy === 'value' ? 'bg-purple-500/20 text-purple-400' : 'bg-neutral-800 text-neutral-500 group-hover:text-purple-400 group-hover:bg-purple-500/10'}`}>
              <Gem size={18} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="font-bold flex justify-between">
                價值型存股
                {strategyCounts.value > 0 && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full ml-2 h-fit">{strategyCounts.value > 99 ? '99+' : strategyCounts.value}</span>}
              </div>
              <div className="text-[10px] opacity-60 font-normal mt-0.5">低本益比+高殖利率+低PB</div>
            </div>
          </button>

          <button
            onClick={() => handleStrategyChange('favorites')}
            className={`group flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl mb-2 transition-all border relative overflow-hidden ${
              strategy === 'favorites'
                ? 'bg-neutral-800 border-amber-500/30 text-white shadow-lg shadow-amber-500/5'
                : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${strategy === 'favorites' ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-500 group-hover:text-amber-400 group-hover:bg-amber-500/10'}`}>
              <Heart size={18} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="font-bold flex justify-between">
                我的最愛
                {strategyCounts.favorites > 0 && <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full ml-2 h-fit">{strategyCounts.favorites}</span>}
              </div>
              <div className="text-[10px] opacity-60 font-normal mt-0.5">自選觀察名單</div>
            </div>
          </button>

          <button
            onClick={() => handleStrategyChange('custom')}
            className={`group flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl mb-2 transition-all border relative overflow-hidden ${
              strategy === 'custom'
                ? 'bg-neutral-800 border-blue-500/30 text-white shadow-lg shadow-blue-500/5'
                : 'bg-neutral-900/50 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:border-neutral-700'
            }`}
          >
            <div className={`p-2 rounded-lg transition-colors ${strategy === 'custom' ? 'bg-blue-500/20 text-blue-400' : 'bg-neutral-800 text-neutral-500 group-hover:text-blue-400 group-hover:bg-blue-500/10'}`}>
              <Sliders size={18} />
            </div>
            <div className="flex-1 flex flex-col">
              <div className="font-bold flex justify-between">
                全方位智慧篩選
              </div>
              <div className="text-[10px] opacity-60 font-normal mt-0.5">基本/技術/籌碼 自訂條件</div>
            </div>
          </button>

          {strategy === 'custom' && (
             <button 
               onClick={() => setShowScreenerModal(true)}
               className="mt-3 w-full py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-2"
             >
               <Sliders size={14} /> 編輯篩選條件
             </button>
          )}

          {errorMsg && (
            <div className="mt-5 p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5" />
              <div className="flex-1">
                <div>{errorMsg}</div>
                <button onClick={loadMarketData} className="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/20 border border-red-500/40 text-[11px] hover:bg-red-500/30">
                  <RefreshCw size={12} /> 重試連線
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-neutral-950 relative min-w-0">
        {/* Header */}
        <header className="h-20 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 flex items-center justify-between px-6 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4 w-full min-w-0">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2.5 hover:bg-neutral-800 rounded-xl text-neutral-400 hover:text-white shrink-0 transition-colors">
              <Menu size={20} />
            </button>

            {activeTab === 'analysis' ? (
              <div className="flex items-center gap-4 w-full overflow-hidden">
                <button onClick={() => setActiveTab('overview')} className="flex items-center justify-center px-4 py-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors shrink-0 border border-neutral-700/50 md:border-none md:pl-0 gap-2">
                  <ArrowLeft size={18} />
                  <span className="hidden md:inline text-sm font-medium">返回</span>
                </button>
                <div className="relative group flex flex-col min-w-0 flex-1 max-w-md">
                  <div className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-neutral-800 transition-colors">
                    <h2 className="text-xl font-bold text-white truncate">{selectedStock?.name}</h2>
                    <span className="text-amber-500 font-mono text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{selectedStock?.id}</span>
                    <ChevronDown size={16} className="text-neutral-500 shrink-0" />
                  </div>
                  <div className="absolute top-full left-0 w-full bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl mt-2 hidden group-hover:block max-h-60 overflow-y-auto z-50">
                     {stocks.map(s => (
                         <div key={s.id} onClick={() => setSelectedStock(s)} className="p-3 hover:bg-neutral-800 cursor-pointer flex justify-between">
                             <span>{s.id} {s.name}</span>
                             <span className={s.change >= 0 ? "text-red-400" : "text-green-400"}>{s.price}</span>
                         </div>
                     ))}
                  </div>
                </div>
                <button onClick={() => selectedStock && toggleFavorite(selectedStock.id)} className={`p-2 rounded-lg border transition-colors ${selectedStock && favorites.includes(selectedStock.id) ? 'bg-red-500/10 border-red-500/30 text-red-500' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white'}`}>
                  <Heart size={20} fill={selectedStock && favorites.includes(selectedStock.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="text-2xl font-bold text-white truncate">
                  {strategy === 'long' ? '多頭潛力股' : strategy === 'short' ? '空頭警示股' : strategy === 'value' ? '價值型存股' : strategy === 'favorites' ? '我的最愛' : strategy === 'custom' ? '智慧選股掃描' : '台股戰情室'}
                </h2>
                {strategy !== 'custom' && strategy !== 'favorites' && <span className="text-xs bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20 whitespace-nowrap">AI 策略模式</span>}
              </div>
            )}

            {activeTab !== 'analysis' && (
              <div className="relative shrink-0 ml-auto hidden md:block w-72">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="輸入代碼或名稱 (如: 台積, 2330)..." className="w-full pl-10 pr-4 py-2 text-sm border border-neutral-800 rounded-xl bg-neutral-900 text-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition-all placeholder-neutral-600" />
                </div>
                {searchSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                        {searchSuggestions.map(s => (
                            <button key={s.id} onClick={() => selectSuggestion(s)} className="w-full text-left px-4 py-3 hover:bg-neutral-800 flex justify-between items-center group border-b border-neutral-800/50 last:border-0">
                                <div>
                                    <span className="font-bold text-white mr-2">{s.id}</span>
                                    <span className="text-neutral-400 group-hover:text-amber-400">{s.name}</span>
                                </div>
                                <div className="text-right"><div className="text-xs text-neutral-500">PE: {s.pe}</div></div>
                            </button>
                        ))}
                    </div>
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-neutral-950">
          {errorMsg && (
            <div className="max-w-7xl mx-auto mb-4">
              <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle size={14} /> <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {activeTab === 'overview' && (
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-lg font-medium text-neutral-400">篩選結果</h3>
                  <p className="text-sm text-neutral-500 mt-1">共找到 <span className="text-white font-bold text-lg mx-1">{displayStocks.length}</span> 檔符合條件的標的 (來源: TWSE)</p>
                </div>
                <div className="relative shrink-0 ml-auto block md:hidden w-48">
                    <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜尋股票..." className="w-full pl-4 pr-3 py-1.5 text-xs border border-neutral-800 rounded-xl bg-neutral-900 text-white focus:border-amber-500 outline-none" />
                     {searchSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                            {searchSuggestions.map(s => (
                                <button key={s.id} onClick={() => selectSuggestion(s)} className="w-full text-left px-3 py-2 hover:bg-neutral-800 border-b border-neutral-800/50">
                                    <span className="font-bold text-white mr-2">{s.id}</span>
                                    <span className="text-neutral-400">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {displayStocks.map((stock) => (
                  <StockCard
                    key={stock.id}
                    stock={stock}
                    isSelected={selectedStock?.id === stock.id}
                    onClick={(s) => {
                        setSelectedStock(s);
                        setActiveTab('analysis');
                    }}
                    favorites={favorites}
                    toggleFavorite={toggleFavorite}
                    strategy={strategy}
                  />
                ))}
              </div>

              {displayStocks.length === 0 && (
                <div className="text-center py-32 flex flex-col items-center">
                  <div className="bg-neutral-900 w-24 h-24 rounded-full flex items-center justify-center mb-6 text-neutral-700 border border-neutral-800">
                    <Database size={48} />
                  </div>
                  <h3 className="text-neutral-300 font-bold text-xl mb-2">無符合篩選條件的股票</h3>
                  <p className="text-neutral-500 text-sm max-w-xs">請嘗試調整左側的篩選器數值，或切換其他策略。</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && selectedStock && (
            <div className="max-w-7xl mx-auto pb-10">
              <div className="bg-neutral-900/80 backdrop-blur border border-neutral-800 p-6 rounded-3xl mb-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500" />
                {loadingFullHistory && (
                  <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-10">
                    <div className="flex flex-col items-center">
                      <Loader2 className="animate-spin mb-3 text-amber-500" size={32} />
                      <span className="text-sm text-neutral-300 font-medium">正在連線 FinMind 抓取 5 年歷史 K 線...</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
                      <Calculator size={28} />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-xl tracking-tight">{selectedStock.isFullHistory ? '近五年' : '近半年'}策略回測報告</h3>
                      <p className="text-sm text-neutral-500 mt-1 font-medium">策略模式: <span className={strategy === 'short' ? 'text-emerald-400' : strategy === 'value' ? 'text-purple-400' : 'text-red-400'}>{strategy === 'short' ? '空頭避雷 (做空)' : strategy === 'value' ? '價值存股 (逆勢)' : '黃金多頭 (做多)'}</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!selectedStock.isFullHistory && <span className="text-xs bg-neutral-800 text-neutral-400 border border-neutral-700 px-3 py-1.5 rounded-lg">TWSE 預覽模式</span>}
                    <span className="text-xs bg-amber-950/30 text-amber-400 border border-amber-900/50 px-3 py-1.5 rounded-lg flex items-center gap-2"><Banknote size={14} /> 模擬資金: 10萬</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/50 flex flex-col justify-center">
                    <div className="text-xs text-neutral-500 mb-1 font-bold uppercase tracking-wider">總報酬率 (ROI)</div>
                    <div className={`text-3xl font-bold tracking-tight ${Number(currentBacktest.roi) >= 0 ? 'text-red-500' : 'text-emerald-500'}`}>{Number(currentBacktest.roi) > 0 ? '+' : ''}{currentBacktest.roi}%</div>
                  </div>
                  <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/50 flex flex-col justify-center">
                    <div className="text-xs text-neutral-500 mb-1 font-bold uppercase tracking-wider">交易勝率</div>
                    <div className="text-3xl font-bold text-amber-400 tracking-tight">{currentBacktest.winRate}%</div>
                  </div>
                  <div className="bg-neutral-950/50 p-5 rounded-2xl border border-neutral-800/50 flex flex-col justify-center">
                    <div className="text-xs text-neutral-500 mb-1 font-bold uppercase tracking-wider">總交易次數</div>
                    <div className="text-3xl font-bold text-white tracking-tight">{currentBacktest.count} <span className="text-lg text-neutral-600 font-medium">次</span></div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-xl relative overflow-hidden">
                    {loadingFullHistory && (
                      <div className="absolute inset-0 bg-neutral-950/60 backdrop-blur-sm flex items-center justify-center z-10">
                        <Loader2 className="animate-spin text-amber-500" size={32} />
                      </div>
                    )}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-3">
                      <h3 className="font-bold text-white flex items-center gap-3 text-lg"><TrendingUp size={22} className="text-amber-500" /> 股價趨勢 <span className="text-sm font-normal text-neutral-500">(K線 + 均線)</span></h3>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-3 bg-neutral-950/50 px-4 py-2 rounded-xl border border-neutral-800">
                          <input type="checkbox" id="showBB" checked={showBB} onChange={(e) => setShowBB(e.target.checked)} className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-amber-600 focus:ring-amber-500 focus:ring-offset-0 cursor-pointer" />
                          <label htmlFor="showBB" className="text-xs font-medium text-neutral-300 cursor-pointer select-none">顯示布林通道</label>
                        </div>
                        <div className="flex items-center gap-1 bg-neutral-950/50 px-2 py-1 rounded-xl border border-neutral-800 text-[11px]">
                          {[{ key: '3m', label: '3M' }, { key: '6m', label: '6M' }, { key: '1y', label: '1Y' }, { key: '5y', label: '5Y' }].map((t) => (
                            <button key={t.key} onClick={() => setTimeframe(t.key)} className={`px-2.5 py-1 rounded-lg font-semibold ${timeframe === t.key ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'text-neutral-400 hover:text-neutral-200'}`}>{t.label}</button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="h-[400px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={displayChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                          <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#737373' }} interval={Math.floor((displayChartData.length || 1) / 8)} axisLine={{ stroke: '#404040' }} tickLine={false} dy={10} />
                          <YAxis domain={['auto', 'auto']} orientation="right" tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} dx={-5} />
                          <Tooltip content={<CustomKLineTooltip />} cursor={{ stroke: '#525252', strokeWidth: 1, strokeDasharray: '4 4' }} />
                          <Bar dataKey="candleWick" barSize={1} xAxisId={0}>
                            {displayChartData.map((entry, index) => (<Cell key={`wick-${index}`} fill={entry.color} />))}
                          </Bar>
                          <Bar dataKey="candleBody" barSize={8} xAxisId={0}>
                            {displayChartData.map((entry, index) => (<Cell key={`body-${index}`} fill={entry.color} />))}
                          </Bar>
                          <Line type="monotone" dataKey="ma5" stroke="#fbbf24" strokeWidth={2} dot={false} name="MA5" />
                          <Line type="monotone" dataKey="ma20" stroke="#a855f7" strokeWidth={2} dot={false} name="MA20" />
                          <Scatter dataKey="buySignal" shape={<BuyMarker />} name="買進訊號" />
                          <Scatter dataKey="sellSignal" shape={<SellMarker />} name="賣出訊號" />
                          {showBB && (
                            <>
                              <Area type="monotone" dataKey="bbUpper" stroke="none" fill="#3b82f6" fillOpacity={0.05} />
                              <Area type="monotone" dataKey="bbLower" stroke="none" fill="#3b82f6" fillOpacity={0.05} />
                              <Line type="monotone" dataKey="bbUpper" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" dot={false} name="布林上" />
                              <Line type="monotone" dataKey="bbLower" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" dot={false} name="布林下" />
                            </>
                          )}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between mb-6 border-b border-neutral-800 pb-4">
                      <div className="flex gap-2 p-1 bg-neutral-950/50 rounded-xl border border-neutral-800">
                        <button onClick={() => setTechTab('chips')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${techTab === 'chips' ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>法人籌碼</button>
                        <button onClick={() => setTechTab('kd')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${techTab === 'kd' ? 'bg-neutral-800 text-amber-500 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>KD 指標</button>
                        <button onClick={() => setTechTab('macd')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${techTab === 'macd' ? 'bg-neutral-800 text-purple-400 shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}>MACD</button>
                      </div>
                    </div>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        {techTab === 'chips' && (
                          <BarChart data={displayChartData.filter((i) => i.foreign !== undefined)}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#737373' }} />
                            <YAxis tick={{ fontSize: 11, fill: '#737373' }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', backgroundColor: '#171717', border: '1px solid #404040' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} iconType="circle" />
                            <Bar dataKey="foreign" name="外資" fill="#f87171" stackId="a" />
                            <Bar dataKey="trust" name="投信" fill="#60a5fa" stackId="a" />
                            <Bar dataKey="dealer" name="自營" fill="#34d399" stackId="a" />
                          </BarChart>
                        )}
                        {techTab === 'kd' && (
                          <LineChart data={displayChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#737373' }} interval={Math.floor((displayChartData.length || 1) / 8)} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#737373' }} ticks={[20, 50, 80]} />
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', backgroundColor: '#171717', border: '1px solid #404040' }} />
                            <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="3 3" opacity={0.5} />
                            <ReferenceLine y={20} stroke="#10b981" strokeDasharray="3 3" opacity={0.5} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Line type="monotone" dataKey="k" stroke="#fbbf24" strokeWidth={2} dot={false} name="K(9)" />
                            <Line type="monotone" dataKey="d" stroke="#a855f7" strokeWidth={2} dot={false} name="D(9)" />
                          </LineChart>
                        )}
                        {techTab === 'macd' && (
                          <ComposedChart data={displayChartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#737373' }} interval={Math.floor((displayChartData.length || 1) / 8)} />
                            <YAxis tick={{ fontSize: 11, fill: '#737373' }} />
                            <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px', backgroundColor: '#171717', border: '1px solid #404040' }} />
                            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                            <Bar dataKey="osc" name="OSC" fill="#8884d8">{displayChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.osc > 0 ? '#f87171' : '#34d399'} />))}</Bar>
                            <Line type="monotone" dataKey="dif" stroke="#60a5fa" strokeWidth={2} dot={false} name="DIF" />
                            <Line type="monotone" dataKey="macd" stroke="#fbbf24" strokeWidth={2} dot={false} name="MACD" />
                          </ComposedChart>
                        )}
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-neutral-900 to-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                    <h3 className="font-bold mb-4 flex items-center gap-3 text-white text-lg relative z-10"><Target size={22} className="text-amber-500" /> AI 綜合評分</h3>
                    <div className="flex items-baseline gap-2 mb-4 relative z-10">
                      <span className="text-6xl font-black text-amber-400 tracking-tighter">{selectedStock.score}</span>
                      <span className="text-sm text-neutral-500 font-medium">/ 100 分</span>
                    </div>
                    <div className="w-full bg-neutral-800 h-3 rounded-full mb-5 overflow-hidden relative z-10 shadow-inner">
                      <div className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)] transition-all duration-1000" style={{ width: `${selectedStock.score}%` }} />
                    </div>
                    <div className="grid grid-cols-2 gap-3 relative z-10">
                      <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                        <div className="text-[10px] text-neutral-500 mb-1">價值面</div>
                        <div className={`font-bold ${selectedStock.pe < 15 ? 'text-emerald-400' : 'text-neutral-300'}`}>{selectedStock.pe < 15 ? '低估' : '合理'}</div>
                      </div>
                      <div className="bg-neutral-950/50 p-3 rounded-xl border border-neutral-800/50">
                        <div className="text-[10px] text-neutral-500 mb-1">技術面</div>
                        <div className={`font-bold ${selectedStock.k > selectedStock.d ? 'text-red-400' : 'text-neutral-300'}`}>{selectedStock.k > selectedStock.d ? '偏多' : '整理'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-neutral-900 p-6 rounded-3xl border border-neutral-800 shadow-xl">
                    <h3 className="font-bold text-white mb-5 flex items-center gap-3 text-lg"><Info size={22} className="text-blue-400" /> 基本面概況</h3>
                    <div className="space-y-5">
                      <div className="flex justify-between items-center text-sm border-b border-neutral-800 pb-3">
                        <span className="text-neutral-500">產業類別</span>
                        <span className="font-medium text-white bg-neutral-800 px-3 py-1 rounded-lg">{selectedStock.sector}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm border-b border-neutral-800 pb-3">
                        <span className="text-neutral-500">本益比 (PE)</span>
                        <span className={`font-bold ${selectedStock.pe > 0 && selectedStock.pe < 15 ? 'text-emerald-400' : 'text-neutral-200'}`}>{selectedStock.pe}</span>
                      </div>
                       <div className="flex justify-between items-center text-sm border-b border-neutral-800 pb-3">
                        <span className="text-neutral-500">股價淨值比 (PB)</span>
                        <span className="font-bold text-neutral-200">{selectedStock.pb}</span>
                      </div>

                      <div className="pt-1 mt-1 bg-neutral-950/30 p-4 rounded-2xl border border-neutral-800/50">
                        <div className="text-xs text-fuchsia-400 font-bold mb-3 flex items-center gap-2"><Banknote size={16} /> 殖利率資訊 (TWSE)</div>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-neutral-400 font-bold">公告殖利率</span>
                            <span className="font-bold text-fuchsia-400 text-lg">{selectedStock.yield}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs mt-2">
                        <span className="text-neutral-500">資料來源</span>
                        <span className="px-2 py-1 rounded-full border border-neutral-700 bg-neutral-800 text-[11px] text-neutral-300">TWSE 證交所公開資訊</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}