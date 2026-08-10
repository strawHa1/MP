const questions = [
  'hi',
  'which company is at high risk right now',
  'what is a hedge fund',
  'explain diversification in simple terms',
  'what does this app do',
  'how do I set an alert',
  "what's 25 * 4",
  'tell me a fun fact about the stock market',
  'what is the risk score for India'
];

async function ask(message) {
  const r = await fetch('http://localhost:3002/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: [] })
  });
  const j = await r.json().catch(() => ({}));
  const text = j.reply || j.error || '';
  return {
    status: r.status,
    source: j.source || null,
    model: j.model || null,
    text,
    looksLikeOldSnapshot: /Highest-risk names/i.test(text) && /Elevated country risk/i.test(text),
    preview: text.replace(/\s+/g, ' ').trim().slice(0, 220)
  };
}

const status = await (await fetch('http://localhost:3002/api/chat/status')).json();
console.log('STATUS', JSON.stringify(status));
console.log('---');

const results = [];
for (const q of questions) {
  const row = await ask(q);
  results.push({ q, ...row });
  console.log(`\nQ: ${q}`);
  console.log(`status=${row.status} source=${row.source} snapshotBug=${row.looksLikeOldSnapshot}`);
  console.log(`A: ${row.preview}`);
}

// Trade is handled client-side; verify the backend search used by resolveTicker.
const search = await (await fetch('http://localhost:3002/api/search?q=NVDA')).json();
const nvda = (search.results || []).find((r) => r.symbol === 'NVDA');
console.log('\nTRADE_PREREQ', { found: Boolean(nvda), price: nvda?.quote?.price });

const uniquePreviews = new Set(results.map((r) => r.preview));
const anySnapshotBug = results.some((r) => r.looksLikeOldSnapshot);
console.log('\nSUMMARY', {
  geminiConfigured: status.geminiConfigured,
  questions: results.length,
  uniqueAnswerPreviews: uniquePreviews.size,
  anyOldRiskSnapshotBug: anySnapshotBug
});
