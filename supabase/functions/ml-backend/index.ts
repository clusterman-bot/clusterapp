import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ML_BACKEND_URL_RAW = Deno.env.get('ML_BACKEND_URL');
const ML_BACKEND_URL = ML_BACKEND_URL_RAW?.replace(/\/+$/, '');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ALPACA_API_KEY = Deno.env.get('ALPACA_API_KEY');
const ALPACA_API_SECRET = Deno.env.get('ALPACA_API_SECRET');

// ============================================================
// REAL ML ALGORITHMS IN TYPESCRIPT
// ============================================================

interface Bar { timestamp: number; date: string; open: number; high: number; low: number; close: number; volume: number; vwap?: number; }
type FeatureRow = number[];
type Label = number; // 0=HOLD, 1=BUY, 2=SELL

// --- Feature Engineering ---
function computeSMA(closes: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < window - 1) { out.push(NaN); continue; }
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += closes[j];
    out.push(sum / window);
  }
  return out;
}

function computeRSI(closes: number[], period: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss += Math.abs(diff);
  }
  avgGain /= period; avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function computeBollingerPctB(closes: number[], window: number, numStd: number): number[] {
  const sma = computeSMA(closes, window);
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = window - 1; i < closes.length; i++) {
    let variance = 0;
    for (let j = i - window + 1; j <= i; j++) variance += (closes[j] - sma[i]) ** 2;
    const std = Math.sqrt(variance / window);
    const upper = sma[i] + numStd * std;
    const lower = sma[i] - numStd * std;
    out[i] = upper === lower ? 0.5 : (closes[i] - lower) / (upper - lower);
  }
  return out;
}

function computeVolatility(closes: number[], window: number): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = window; i < closes.length; i++) {
    const returns: number[] = [];
    for (let j = i - window + 1; j <= i; j++) returns.push((closes[j] - closes[j - 1]) / closes[j - 1]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
    out[i] = Math.sqrt(variance);
  }
  return out;
}

function buildFeatureMatrix(bars: Bar[], indicators: any): { X: FeatureRow[]; validIndices: number[] } {
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);
  const featureCols: number[][] = [];
  const featureNames: string[] = [];

  // SMA deviations
  if (indicators?.sma?.enabled) {
    for (const w of (indicators.sma.windows || [20, 50])) {
      const sma = computeSMA(closes, w);
      featureCols.push(sma.map((s, i) => isNaN(s) ? NaN : (closes[i] - s) / s));
      featureNames.push(`sma_dev_${w}`);
    }
  }
  // RSI
  if (indicators?.rsi?.enabled) {
    const rsi = computeRSI(closes, indicators.rsi.period || 14);
    featureCols.push(rsi.map(r => isNaN(r) ? NaN : r / 100));
    featureNames.push('rsi');
  }
  // Bollinger %B
  if (indicators?.bollinger?.enabled) {
    const pctB = computeBollingerPctB(closes, indicators.bollinger.window || 20, indicators.bollinger.std || 2);
    featureCols.push(pctB);
    featureNames.push('bollinger_pctb');
  }
  // Volatility
  if (indicators?.volatility?.enabled) {
    const vol = computeVolatility(closes, indicators.volatility.window || 20);
    featureCols.push(vol);
    featureNames.push('volatility');
  }
  // Always add: price momentum (1, 5, 10 bars), volume change
  for (const lag of [1, 5, 10]) {
    const mom: number[] = new Array(closes.length).fill(NaN);
    for (let i = lag; i < closes.length; i++) mom[i] = (closes[i] - closes[i - lag]) / closes[i - lag];
    featureCols.push(mom);
    featureNames.push(`momentum_${lag}`);
  }
  const volChange: number[] = new Array(volumes.length).fill(NaN);
  for (let i = 1; i < volumes.length; i++) volChange[i] = volumes[i - 1] === 0 ? 0 : (volumes[i] - volumes[i - 1]) / volumes[i - 1];
  featureCols.push(volChange);
  featureNames.push('vol_change');

  // If no indicators enabled, at least we have momentum + vol_change
  if (featureCols.length === 0) {
    // Fallback: raw returns
    const ret: number[] = new Array(closes.length).fill(NaN);
    for (let i = 1; i < closes.length; i++) ret[i] = (closes[i] - closes[i - 1]) / closes[i - 1];
    featureCols.push(ret);
  }

  // Build matrix, only valid rows
  const X: FeatureRow[] = [];
  const validIndices: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const row = featureCols.map(col => col[i]);
    if (row.some(v => isNaN(v) || v === undefined || v === null)) continue;
    X.push(row);
    validIndices.push(i);
  }

  console.log(`[ML] Built feature matrix: ${X.length} rows × ${featureCols.length} features (${featureNames.join(', ')})`);
  return { X, validIndices };
}

function labelData(bars: Bar[], validIndices: number[], horizon: number, theta: number): Label[] {
  const closes = bars.map(b => b.close);
  const labels: Label[] = [];
  for (const i of validIndices) {
    if (i + horizon >= closes.length) { labels.push(0); continue; } // HOLD if no future data
    const futureReturn = (closes[i + horizon] - closes[i]) / closes[i];
    if (futureReturn > theta) labels.push(1); // BUY
    else if (futureReturn < -theta) labels.push(2); // SELL
    else labels.push(0); // HOLD
  }
  return labels;
}

// --- Utility ---
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function argmax(arr: number[]): number {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

// --- Decision Tree ---
interface TreeNode { featureIdx?: number; threshold?: number; left?: TreeNode; right?: TreeNode; label?: number; }

function gini(labels: number[], numClasses: number): number {
  if (labels.length === 0) return 0;
  const counts = new Array(numClasses).fill(0);
  for (const l of labels) counts[l]++;
  let impurity = 1;
  for (const c of counts) impurity -= (c / labels.length) ** 2;
  return impurity;
}

function majorityVote(labels: number[], numClasses: number): number {
  const counts = new Array(numClasses).fill(0);
  for (const l of labels) counts[l]++;
  return argmax(counts);
}

function buildTree(X: FeatureRow[], y: Label[], maxDepth: number, minSamplesSplit: number, numClasses: number, maxFeatures: number, depth = 0): TreeNode {
  if (depth >= maxDepth || X.length < minSamplesSplit || new Set(y).size <= 1) {
    return { label: majorityVote(y, numClasses) };
  }

  const nFeatures = X[0].length;
  const featureSubset = shuffleArray([...Array(nFeatures).keys()]).slice(0, Math.min(maxFeatures, nFeatures));

  let bestGain = -Infinity, bestFeat = 0, bestThresh = 0;
  const parentGini = gini(y, numClasses);

  for (const f of featureSubset) {
    const vals = X.map(row => row[f]);
    const sorted = [...new Set(vals)].sort((a, b) => a - b);
    // Sample up to 20 thresholds for speed
    const step = Math.max(1, Math.floor(sorted.length / 20));
    for (let t = 0; t < sorted.length - 1; t += step) {
      const thresh = (sorted[t] + sorted[t + 1]) / 2;
      const leftY: number[] = [], rightY: number[] = [];
      for (let i = 0; i < X.length; i++) {
        if (X[i][f] <= thresh) leftY.push(y[i]); else rightY.push(y[i]);
      }
      if (leftY.length === 0 || rightY.length === 0) continue;
      const gain = parentGini - (leftY.length / y.length) * gini(leftY, numClasses) - (rightY.length / y.length) * gini(rightY, numClasses);
      if (gain > bestGain) { bestGain = gain; bestFeat = f; bestThresh = thresh; }
    }
  }

  if (bestGain <= 0) return { label: majorityVote(y, numClasses) };

  const leftX: FeatureRow[] = [], leftY: Label[] = [], rightX: FeatureRow[] = [], rightY: Label[] = [];
  for (let i = 0; i < X.length; i++) {
    if (X[i][bestFeat] <= bestThresh) { leftX.push(X[i]); leftY.push(y[i]); }
    else { rightX.push(X[i]); rightY.push(y[i]); }
  }

  return {
    featureIdx: bestFeat,
    threshold: bestThresh,
    left: buildTree(leftX, leftY, maxDepth, minSamplesSplit, numClasses, maxFeatures, depth + 1),
    right: buildTree(rightX, rightY, maxDepth, minSamplesSplit, numClasses, maxFeatures, depth + 1),
  };
}

function predictTree(node: TreeNode, x: FeatureRow): number {
  if (node.label !== undefined) return node.label;
  if (x[node.featureIdx!] <= node.threshold!) return predictTree(node.left!, x);
  return predictTree(node.right!, x);
}

// --- Random Forest ---
function trainRandomForest(X: FeatureRow[], y: Label[], params: any, numClasses: number): TreeNode[] {
  const nEstimators = Math.min(params.n_estimators || 50, 80);
  const maxDepth = Math.min(params.max_depth || 8, 12);
  const minSamplesSplit = params.min_samples_split || 5;
  const maxFeatures = Math.max(1, Math.floor(Math.sqrt(X[0].length)));
  const trees: TreeNode[] = [];

  for (let t = 0; t < nEstimators; t++) {
    // Bootstrap sample
    const indices = Array.from({ length: X.length }, () => Math.floor(Math.random() * X.length));
    const bX = indices.map(i => X[i]);
    const bY = indices.map(i => y[i]);
    trees.push(buildTree(bX, bY, maxDepth, minSamplesSplit, numClasses, maxFeatures));
  }
  return trees;
}

function predictRandomForest(trees: TreeNode[], x: FeatureRow, numClasses: number): number {
  const votes = new Array(numClasses).fill(0);
  for (const tree of trees) votes[predictTree(tree, x)]++;
  return argmax(votes);
}

// --- Gradient Boosting (one-vs-rest with shallow trees for regression) ---
interface GBModel { trees: TreeNode[][]; learningRate: number; numClasses: number; }

function trainGradientBoosting(X: FeatureRow[], y: Label[], params: any, numClasses: number): GBModel {
  const nEstimators = Math.min(params.n_estimators || 50, 80);
  const lr = params.learning_rate || 0.1;
  const maxDepth = Math.min(params.max_depth || 4, 6);
  
  // One-vs-rest: for each class, fit regression trees on pseudo-residuals
  const allTrees: TreeNode[][] = [];
  
  for (let c = 0; c < numClasses; c++) {
    const binaryY = y.map(label => label === c ? 1 : 0);
    let predictions = new Array(X.length).fill(0.5);
    const classTrees: TreeNode[] = [];
    
    for (let iter = 0; iter < nEstimators; iter++) {
      // Pseudo-residuals
      const residuals = binaryY.map((actual, i) => actual - predictions[i]);
      // Quantize residuals for tree building: positive -> class 1, negative -> class 0
      const quantized = residuals.map(r => r > 0 ? 1 : 0);
      const tree = buildTree(X, quantized, maxDepth, 5, 2, Math.max(1, Math.floor(Math.sqrt(X[0].length))));
      classTrees.push(tree);
      
      // Update predictions
      for (let i = 0; i < X.length; i++) {
        const pred = predictTree(tree, X[i]);
        predictions[i] += lr * (pred === 1 ? 0.1 : -0.1);
        predictions[i] = Math.max(0, Math.min(1, predictions[i]));
      }
    }
    allTrees.push(classTrees);
  }
  
  return { trees: allTrees, learningRate: lr, numClasses };
}

function predictGradientBoosting(model: GBModel, x: FeatureRow): number {
  const scores = new Array(model.numClasses).fill(0);
  for (let c = 0; c < model.numClasses; c++) {
    let score = 0.5;
    for (const tree of model.trees[c]) {
      const pred = predictTree(tree, x);
      score += model.learningRate * (pred === 1 ? 0.1 : -0.1);
    }
    scores[c] = score;
  }
  return argmax(scores);
}

// --- Logistic Regression (multinomial, mini-batch SGD) ---
interface LRModel { weights: number[][]; bias: number[]; numClasses: number; }

function softmax(z: number[]): number[] {
  const max = Math.max(...z);
  const exp = z.map(v => Math.exp(v - max));
  const sum = exp.reduce((a, b) => a + b, 0);
  return exp.map(e => e / sum);
}

function trainLogisticRegression(X: FeatureRow[], y: Label[], params: any, numClasses: number): LRModel {
  const maxIter = Math.min(params.max_iter || 200, 500);
  const C = params.C || 1.0;
  const lr = 0.01;
  const nFeatures = X[0].length;
  
  // Initialize weights
  const weights: number[][] = Array.from({ length: numClasses }, () => 
    Array.from({ length: nFeatures }, () => (Math.random() - 0.5) * 0.1)
  );
  const bias: number[] = new Array(numClasses).fill(0);
  
  const batchSize = Math.min(32, X.length);
  
  for (let iter = 0; iter < maxIter; iter++) {
    // Mini-batch
    const indices = shuffleArray([...Array(X.length).keys()]).slice(0, batchSize);
    
    // Gradients
    const wGrad: number[][] = Array.from({ length: numClasses }, () => new Array(nFeatures).fill(0));
    const bGrad: number[] = new Array(numClasses).fill(0);
    
    for (const idx of indices) {
      const x = X[idx];
      const z = weights.map((w, c) => w.reduce((sum, wj, j) => sum + wj * x[j], 0) + bias[c]);
      const probs = softmax(z);
      
      for (let c = 0; c < numClasses; c++) {
        const error = probs[c] - (y[idx] === c ? 1 : 0);
        for (let j = 0; j < nFeatures; j++) {
          wGrad[c][j] += error * x[j];
        }
        bGrad[c] += error;
      }
    }
    
    // Update with L2 regularization
    const lambda = 1.0 / C;
    for (let c = 0; c < numClasses; c++) {
      for (let j = 0; j < nFeatures; j++) {
        weights[c][j] -= lr * (wGrad[c][j] / batchSize + lambda * weights[c][j]);
      }
      bias[c] -= lr * bGrad[c] / batchSize;
    }
  }
  
  return { weights, bias, numClasses };
}

function predictLogisticRegression(model: LRModel, x: FeatureRow): number {
  const z = model.weights.map((w, c) => w.reduce((sum, wj, j) => sum + wj * x[j], 0) + model.bias[c]);
  return argmax(softmax(z));
}

// --- Evaluation Metrics ---
function computeMetrics(yTrue: Label[], yPred: Label[], numClasses: number) {
  let correct = 0;
  for (let i = 0; i < yTrue.length; i++) if (yTrue[i] === yPred[i]) correct++;
  const accuracy = yTrue.length > 0 ? correct / yTrue.length : 0;

  // Per-class precision, recall, f1
  let totalF1 = 0, totalRecall = 0, totalPrecision = 0, classCount = 0;
  for (let c = 0; c < numClasses; c++) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < yTrue.length; i++) {
      if (yPred[i] === c && yTrue[i] === c) tp++;
      else if (yPred[i] === c && yTrue[i] !== c) fp++;
      else if (yPred[i] !== c && yTrue[i] === c) fn++;
    }
    const prec = tp + fp > 0 ? tp / (tp + fp) : 0;
    const rec = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = prec + rec > 0 ? 2 * prec * rec / (prec + rec) : 0;
    totalF1 += f1; totalRecall += rec; totalPrecision += prec;
    classCount++;
  }

  return {
    accuracy,
    f1: classCount > 0 ? totalF1 / classCount : 0,
    recall: classCount > 0 ? totalRecall / classCount : 0,
    precision: classCount > 0 ? totalPrecision / classCount : 0,
  };
}

// --- Fetch Market Data via Alpaca ---
async function fetchMarketData(ticker: string, startDate: string, endDate: string): Promise<Bar[]> {
  if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
    throw new Error('Alpaca credentials (ALPACA_API_KEY / ALPACA_API_SECRET) are not configured. Live market data is required.');
  }
  
  const url = `https://data.alpaca.markets/v2/stocks/${ticker}/bars?timeframe=1Day&start=${startDate}&end=${endDate}&limit=1000&adjustment=raw&sort=asc`;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[ML] Fetching from Alpaca (attempt ${attempt}/3): ${ticker} ${startDate} to ${endDate}`);
    try {
      const resp = await fetch(url, {
        headers: {
          'APCA-API-KEY-ID': ALPACA_API_KEY,
          'APCA-API-SECRET-KEY': ALPACA_API_SECRET,
        },
      });
      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`[ML] Alpaca HTTP ${resp.status}: ${errText}`);
        if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`Alpaca API error (${resp.status}): ${errText}`);
      }
      const data = await resp.json();
      if (data.bars && data.bars.length > 0) {
        console.log(`[ML] Got ${data.bars.length} bars from Alpaca`);
        return data.bars.map((bar: any) => ({
          timestamp: new Date(bar.t).getTime(),
          date: bar.t.split('T')[0],
          open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v, vwap: bar.vw,
        }));
      }
      console.warn(`[ML] Alpaca returned no bars (attempt ${attempt}/3)`);
      if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw new Error(`No market data returned from Alpaca for ${ticker} (${startDate} to ${endDate})`);
    } catch (e: any) {
      if (e.message.includes('Alpaca API error') || e.message.includes('No market data returned')) throw e;
      console.error(`[ML] Alpaca fetch error (attempt ${attempt}/3):`, e.message);
      if (attempt < 3) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw new Error(`Failed to fetch live market data from Alpaca after 3 attempts: ${e.message}`);
    }
  }
  throw new Error('Failed to fetch live market data from Alpaca after 3 attempts');
}

// --- REAL TRAINING PIPELINE ---
async function realTraining(supabase: any, trainingRunId: string, config: any) {
  console.log(`[ML] ===== REAL TRAINING PIPELINE for ${trainingRunId} =====`);
  
  try {
    await supabase.from('training_runs').update({ status: 'running' }).eq('id', trainingRunId);
    
    // 1. Fetch market data
    const bars = await fetchMarketData(config.ticker, config.start_date, config.end_date);
    if (bars.length < 50) {
      throw new Error(`Insufficient data: got ${bars.length} bars, need at least 50`);
    }
    console.log(`[ML] Fetched ${bars.length} bars for ${config.ticker}`);
    
    // 2. Build features
    const { X, validIndices } = buildFeatureMatrix(bars, config.indicators);
    if (X.length < 30) {
      throw new Error(`Insufficient valid features: got ${X.length} rows after indicator computation, need at least 30`);
    }
    
    // 3. Label data
    const horizon = config.hyperparameters?.horizon_minutes || config.horizon || 5;
    const theta = config.theta || 0.005;
    const labels = labelData(bars, validIndices, Math.min(horizon, Math.floor(bars.length / 4)), theta);
    
    // Trim X and labels to exclude last `horizon` rows (no future data)
    const usableLength = Math.max(1, X.length - horizon);
    const trimX = X.slice(0, usableLength);
    const trimY = labels.slice(0, usableLength);
    
    console.log(`[ML] Data: ${trimX.length} samples, ${trimX[0]?.length || 0} features`);
    console.log(`[ML] Label distribution: BUY=${trimY.filter(l=>l===1).length}, SELL=${trimY.filter(l=>l===2).length}, HOLD=${trimY.filter(l=>l===0).length}`);
    
    // 4. Chronological train/test split (80/20)
    const splitIdx = Math.floor(trimX.length * 0.8);
    const trainX = trimX.slice(0, splitIdx);
    const trainY = trimY.slice(0, splitIdx);
    const testX = trimX.slice(splitIdx);
    const testY = trimY.slice(splitIdx);
    
    console.log(`[ML] Train: ${trainX.length}, Test: ${testX.length}`);
    
    if (trainX.length < 10 || testX.length < 5) {
      throw new Error(`Not enough data for train/test split. Train: ${trainX.length}, Test: ${testX.length}`);
    }
    
    const numClasses = 3;
    const hp = config.hyperparameters || {};
    
    // 5. Train Random Forest
    console.log('[ML] Training Random Forest...');
    const rfTrees = trainRandomForest(trainX, trainY, hp.random_forest || { n_estimators: 50, max_depth: 8, min_samples_split: 5 }, numClasses);
    const rfPreds = testX.map(x => predictRandomForest(rfTrees, x, numClasses));
    const rfMetrics = computeMetrics(testY, rfPreds, numClasses);
    console.log(`[ML] RF: accuracy=${rfMetrics.accuracy.toFixed(3)}, f1=${rfMetrics.f1.toFixed(3)}`);
    
    // 6. Train Gradient Boosting
    console.log('[ML] Training Gradient Boosting...');
    const gbModel = trainGradientBoosting(trainX, trainY, hp.gradient_boosting || { n_estimators: 50, learning_rate: 0.1, max_depth: 4 }, numClasses);
    const gbPreds = testX.map(x => predictGradientBoosting(gbModel, x));
    const gbMetrics = computeMetrics(testY, gbPreds, numClasses);
    console.log(`[ML] GB: accuracy=${gbMetrics.accuracy.toFixed(3)}, f1=${gbMetrics.f1.toFixed(3)}`);
    
    // 7. Train Logistic Regression
    console.log('[ML] Training Logistic Regression...');
    const lrModel = trainLogisticRegression(trainX, trainY, hp.logistic_regression || { C: 1.0, max_iter: 200 }, numClasses);
    const lrPreds = testX.map(x => predictLogisticRegression(lrModel, x));
    const lrMetrics = computeMetrics(testY, lrPreds, numClasses);
    console.log(`[ML] LR: accuracy=${lrMetrics.accuracy.toFixed(3)}, f1=${lrMetrics.f1.toFixed(3)}`);
    
    // 8. Compile results
    const results: Record<string, any> = {
      random_forest: { accuracy: rfMetrics.accuracy, f1: rfMetrics.f1, recall: rfMetrics.recall, precision: rfMetrics.precision },
      gradient_boosting: { accuracy: gbMetrics.accuracy, f1: gbMetrics.f1, recall: gbMetrics.recall, precision: gbMetrics.precision },
      logistic_regression: { accuracy: lrMetrics.accuracy, f1: lrMetrics.f1, recall: lrMetrics.recall, precision: lrMetrics.precision },
    };
    
    const models = Object.entries(results);
    const bestModel = models.reduce((best, [name, metrics]: [string, any]) =>
      metrics.accuracy > (best.metrics?.accuracy || 0) ? { name, metrics } : best,
      { name: '', metrics: null as any }
    );
    
    await supabase.from('training_runs').update({
      status: 'completed',
      results,
      best_model_name: bestModel.name,
      best_model_metrics: bestModel.metrics,
      completed_at: new Date().toISOString(),
    }).eq('id', trainingRunId);
    
    console.log(`[ML] ✅ REAL training completed. Best: ${bestModel.name} (acc=${bestModel.metrics.accuracy.toFixed(3)})`);
    
  } catch (error: any) {
    console.error(`[ML] ❌ Training failed:`, error.message);
    await supabase.from('training_runs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    }).eq('id', trainingRunId);
  }
}

// --- REAL VALIDATION PIPELINE ---
async function realValidation(supabase: any, validationRunId: string, trainingRunId: string, modelId: string | null, startDate: string, endDate: string) {
  console.log(`[ML] ===== REAL VALIDATION PIPELINE for ${validationRunId} =====`);
  
  try {
    await supabase.from('validation_runs').update({ status: 'running' }).eq('id', validationRunId);
    
    // Get the training run to know what config was used
    const { data: trainingRun, error: trError } = await supabase
      .from('training_runs')
      .select('*')
      .eq('id', trainingRunId)
      .single();
    
    if (trError || !trainingRun) throw new Error('Training run not found');
    
    // Fetch validation data
    const bars = await fetchMarketData(trainingRun.ticker, startDate, endDate);
    if (bars.length < 30) throw new Error(`Insufficient validation data: ${bars.length} bars`);
    
    // Build features using same indicators
    const { X, validIndices } = buildFeatureMatrix(bars, trainingRun.indicators_enabled);
    if (X.length < 15) throw new Error(`Insufficient valid features for validation: ${X.length}`);
    
    const hp = trainingRun.hyperparameters || {};
    const horizon = hp.horizon_minutes || 5;
    const theta = 0.005;
    const labels = labelData(bars, validIndices, Math.min(horizon, Math.floor(bars.length / 4)), theta);
    
    const usableLength = Math.max(1, X.length - horizon);
    const valX = X.slice(0, usableLength);
    const valY = labels.slice(0, usableLength);
    
    // We need to retrain on validation data's preceding period to get models
    // Use the original training data to train, then predict on validation data
    const trainBars = await fetchMarketData(trainingRun.ticker, trainingRun.start_date, trainingRun.end_date);
    const trainFeats = buildFeatureMatrix(trainBars, trainingRun.indicators_enabled);
    const trainLabels = labelData(trainBars, trainFeats.validIndices, Math.min(horizon, Math.floor(trainBars.length / 4)), theta);
    
    const trainUsable = Math.max(1, trainFeats.X.length - horizon);
    const tX = trainFeats.X.slice(0, trainUsable);
    const tY = trainLabels.slice(0, trainUsable);
    
    const numClasses = 3;
    const bestModelName = trainingRun.best_model_name || 'random_forest';
    
    let predictions: number[];
    if (bestModelName === 'random_forest') {
      const trees = trainRandomForest(tX, tY, hp.random_forest || { n_estimators: 50, max_depth: 8 }, numClasses);
      predictions = valX.map(x => predictRandomForest(trees, x, numClasses));
    } else if (bestModelName === 'gradient_boosting') {
      const model = trainGradientBoosting(tX, tY, hp.gradient_boosting || { n_estimators: 50, learning_rate: 0.1, max_depth: 4 }, numClasses);
      predictions = valX.map(x => predictGradientBoosting(model, x));
    } else {
      const model = trainLogisticRegression(tX, tY, hp.logistic_regression || { C: 1.0, max_iter: 200 }, numClasses);
      predictions = valX.map(x => predictLogisticRegression(model, x));
    }
    
    const metrics = computeMetrics(valY, predictions, numClasses);
    const signalDistribution = {
      BUY: predictions.filter(p => p === 1).length,
      SELL: predictions.filter(p => p === 2).length,
      HOLD: predictions.filter(p => p === 0).length,
    };
    
    await supabase.from('validation_runs').update({
      status: 'completed',
      metrics,
      signal_distribution: signalDistribution,
      completed_at: new Date().toISOString(),
    }).eq('id', validationRunId);
    
    console.log(`[ML] ✅ REAL validation completed. Accuracy=${metrics.accuracy.toFixed(3)}, Signals: BUY=${signalDistribution.BUY} SELL=${signalDistribution.SELL} HOLD=${signalDistribution.HOLD}`);
    
  } catch (error: any) {
    console.error(`[ML] ❌ Validation failed:`, error.message);
    await supabase.from('validation_runs').update({
      status: 'failed',
      error_message: error.message,
      completed_at: new Date().toISOString(),
    }).eq('id', validationRunId);
  }
}

// Demo simulation removed — all training uses real data

// ============================================================
// MAIN SERVER
// ============================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const action = path[path.length - 1];

    console.log(`[ML-Backend] ===== ${action.toUpperCase()} REQUEST =====`);
    console.log(`[ML-Backend] User: ${user.id}`);

    if (req.method === 'POST') {
      const body = await req.json();

      if (action === 'train') {
        const isDemoMode = body.demo_mode === true;
        const horizonMinutes = body.horizon || 5;
        
        const { data: trainingRun, error: insertError } = await supabase
          .from('training_runs')
          .insert({
            user_id: user.id,
            model_id: body.model_id,
            ticker: body.ticker,
            start_date: body.start_date,
            end_date: body.end_date,
            indicators_enabled: body.indicators,
            hyperparameters: { ...body.hyperparameters, demo_mode: isDemoMode, horizon_minutes: horizonMinutes },
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) throw insertError;
        console.log(`[ML-Backend] Created training run: ${trainingRun.id}`);

        // If external ML backend is configured and not demo mode, forward there
        if (ML_BACKEND_URL && !isDemoMode) {
          const mlPayload = {
            model_id: body.model_id, training_run_id: trainingRun.id,
            ticker: body.ticker, start_date: body.start_date, end_date: body.end_date,
            horizon_minutes: horizonMinutes, indicators: body.indicators,
            hyperparameters: body.hyperparameters,
            callback_url: `${SUPABASE_URL}/functions/v1/ml-backend/callback`,
          };
          try {
            const mlResponse = await fetch(`${ML_BACKEND_URL}/train`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(mlPayload),
            });
            if (mlResponse.ok) {
              await mlResponse.json();
              await supabase.from('training_runs').update({ status: 'running' }).eq('id', trainingRun.id);
              console.log(`[ML-Backend] ✅ Forwarded to external engine`);
            } else {
              await mlResponse.text();
              console.log(`[ML-Backend] External engine error, using built-in ML`);
              realTraining(supabase, trainingRun.id, body);
            }
          } catch (e: any) {
            console.log(`[ML-Backend] Can't reach external engine: ${e.message}, using built-in ML`);
            realTraining(supabase, trainingRun.id, body);
          }
        } else if (false) {
          // Demo mode removed — always use real training
        } else {
          // USE REAL BUILT-IN ML TRAINING
          realTraining(supabase, trainingRun.id, body);
        }

        return new Response(JSON.stringify({
          success: true, training_run_id: trainingRun.id,
          message: isDemoMode ? 'Demo training started' : 'Real ML training started',
          demo_mode: isDemoMode, horizon_minutes: horizonMinutes,
          ml_backend: ML_BACKEND_URL ? 'external' : 'built-in',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'validate') {
        const { data: validationRun, error: insertError } = await supabase
          .from('validation_runs')
          .insert({
            user_id: user.id, model_id: body.model_id,
            training_run_id: body.training_run_id,
            start_date: body.start_date, end_date: body.end_date,
            status: 'pending',
          })
          .select()
          .single();

        if (insertError) throw insertError;

        if (ML_BACKEND_URL) {
          try {
            const mlResponse = await fetch(`${ML_BACKEND_URL}/validate`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model_id: body.model_id, validation_run_id: validationRun.id,
                training_run_id: body.training_run_id,
                start_date: body.start_date, end_date: body.end_date,
                callback_url: `${SUPABASE_URL}/functions/v1/ml-backend/callback`,
              }),
            });
            if (mlResponse.ok) {
              await mlResponse.json();
              await supabase.from('validation_runs').update({ status: 'running' }).eq('id', validationRun.id);
            } else {
              await mlResponse.text();
              realValidation(supabase, validationRun.id, body.training_run_id, body.model_id, body.start_date, body.end_date);
            }
          } catch {
            realValidation(supabase, validationRun.id, body.training_run_id, body.model_id, body.start_date, body.end_date);
          }
        } else {
          realValidation(supabase, validationRun.id, body.training_run_id, body.model_id, body.start_date, body.end_date);
        }

        return new Response(JSON.stringify({
          success: true, validation_run_id: validationRun.id,
          ml_backend: ML_BACKEND_URL ? 'external' : 'built-in',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'callback') {
        const { training_run_id, validation_run_id, status, results, best_model_name, best_model_metrics, metrics, signal_distribution, error_message } = body;
        if (training_run_id) {
          await supabase.from('training_runs').update({
            status, results, best_model_name, best_model_metrics, error_message,
            completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
          }).eq('id', training_run_id);
        }
        if (validation_run_id) {
          await supabase.from('validation_runs').update({
            status, metrics, signal_distribution, error_message,
            completed_at: status === 'completed' || status === 'failed' ? new Date().toISOString() : null,
          }).eq('id', validation_run_id);
        }
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      if (action === 'health') {
        let engineStatus = 'built-in-ml-active';
        let engineResponseTime = null;
        let engineError = null;

        if (ML_BACKEND_URL) {
          try {
            const start = Date.now();
            const resp = await fetch(`${ML_BACKEND_URL}/health`);
            engineResponseTime = Date.now() - start;
            engineStatus = resp.ok ? 'external-healthy' : 'external-unhealthy';
            await resp.text();
          } catch (e: any) {
            engineStatus = 'external-unreachable-using-builtin';
            engineError = e.message;
          }
        }

        return new Response(JSON.stringify({
          success: true, engine_status: engineStatus,
          engine_response_time_ms: engineResponseTime, engine_error: engineError,
          capabilities: ['random_forest', 'gradient_boosting', 'logistic_regression'],
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    if (req.method === 'GET' && action === 'status') {
      const trainingRunId = url.searchParams.get('training_run_id');
      const { data, error } = await supabase.from('training_runs').select('*').eq('id', trainingRunId).eq('user_id', user.id).single();
      if (error) throw error;
      return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('[ML-Backend] ❌ Error:', error);
    return new Response(JSON.stringify({ error: 'An error occurred while processing your request' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
