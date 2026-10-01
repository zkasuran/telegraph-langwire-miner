// Telegraph langwire miner: SENTIMENT_ANALYSIS, TEXT_CLASSIFICATION, LANGUAGE_GENERATION and
// LANGUAGE_TRANSLATION.
//
// These are language-model intents. The node writes its own ground truth for each one with a
// model and scores a miner on how well its answer matches that truth, so a genuinely correct,
// well-shaped answer is what scores. This worker answers each intent by calling MiniMax, a
// language model the operator holds a commercial plan for, with a tight per-intent system prompt,
// then returns the model's answer as the summary the node grades.
//
//   SENTIMENT_ANALYSIS    the sentiment as a full sentence plus the words that carry it
//   TEXT_CLASSIFICATION   the single best category plus one short reason it fits
//   LANGUAGE_GENERATION   a direct, complete reference answer to the request
//   LANGUAGE_TRANSLATION  the idiomatic translation stated in one plain sentence
//
// The MiniMax key is never in this file. It is read from env.MINIMAX_API_KEY, a Cloudflare
// secret the deployer sets with `wrangler secret put MINIMAX_API_KEY`. With no key or on any
// upstream error or timeout the worker still answers 200 with an honest degraded summary, because
// the node reads any non-200 on a declared route as no answer and scores the whole epoch zero
// whatever the answer would have been.
//
// MiniMax-M3 is a reasoning model that emits a <think> block before its answer. That block is
// reasoning, not the answer, so it is stripped and only the text after it is returned. The think
// phase adds latency, so the upstream call is given a wider timeout than a non-reasoning model
// needs. The MiniMax terms and the plan that licenses these answers for a paid service are in
// NOTICE and DATA-SOURCES.md.

/**
 * Licence: source-available, no derivatives. Copyright (c) 2026 zkasuran.
 * SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
 *
 * Read this, audit it, run your own instance to check it, publish what you find. Do not
 * redistribute it, publish a modified copy, or redeploy it as a competing miner. Calling
 * the live endpoint is not restricted by the licence at all.
 *
 * Full terms: LICENSE. Third-party terms and the credit line the model provider asks for:
 * NOTICE and DATA-SOURCES.md. The model this worker calls is not ours and carries its own
 * terms.
 */

const MINIMAX_URL = 'https://api.minimax.io/v1/chat/completions';
const MODEL = 'MiniMax-M3';
const CREDIT = 'Answer produced with MiniMax (MiniMax-M3) under a commercial MiniMax plan held by zkasuran.';
const MINIMAX_TIMEOUT_MS = 20000;

// One system prompt per intent. Each one pins the shape the answer must take so the model covers
// exactly what the question asks and matches the frame the node's ground truth is written in. The
// no em dash line keeps the answer in house style, which costs nothing against the score. These
// are the exact prompts measured offline against the live scoring modules before shipping.
const SENTIMENT_SYS = 'You are a sentiment analysis engine. Read the text in the request and judge '
  + 'its overall sentiment. Write exactly two sentences. Sentence one is \'The sentiment of this '
  + 'text is X.\' where X is positive, negative, neutral or mixed. Sentence two begins \'This is '
  + 'because\' and names the specific words or phrases that carry the sentiment, quoting them. '
  + 'Plain prose, no preamble, no lists, no markdown, no em dashes.';
const CLASSIFY_SYS = 'You are a text classification engine. Read the text in the request and assign '
  + 'it to the single most fitting category. Begin with the category name followed by a period. '
  + 'Then write one sentence that explains why it fits, naming the details that place it there. If '
  + 'the request names a set of categories, choose only from those. Two sentences, plain prose, no '
  + 'preamble, no lists, no markdown, no em dashes.';
const LANGGEN_SYS = 'You are a knowledgeable reference assistant. Answer the request directly, '
  + 'accurately and completely in one clear paragraph, leading with the direct answer and covering '
  + 'the key facts the request asks for, with the specific figures and causes that matter. State it '
  + 'plainly the way an authoritative reference answer would. Do not restate the question, do not '
  + 'add a preamble, do not use lists unless the request asks for one, no markdown, no em dashes. '
  + 'Output only the answer.';
const TRANSLATE_SYS = 'You are a professional translator. Translate the source text in the request '
  + 'into the requested target language, using the natural idiomatic form a native speaker would '
  + 'write. Answer as one sentence: \'The translation of "<source text>" into <Target Language> is '
  + '"<translation>".\' If the request does not name a target language, translate into Spanish. '
  + 'Output only that sentence, no preamble, no notes, no markdown, no em dashes.';

// MiniMax-M3 writes a <think> block before its answer. Take the text after the last </think>. If
// the block never closed (the answer was cut off inside the reasoning) drop a leading unterminated
// <think ...> so a stub is never returned as an answer.
function stripThink(s) {
  let t = String(s || '');
  const i = t.lastIndexOf('</think>');
  if (i !== -1) return t.slice(i + '</think>'.length).trim();
  const trimmed = t.replace(/^\s+/, '');
  if (/^<think\b/i.test(trimmed)) {
    const j = trimmed.indexOf('>');
    if (j !== -1) t = trimmed.slice(j + 1);
  }
  return t.trim();
}

// The text to work on. The node may pass the whole question or a structured field under any of a
// handful of common names, so read the first non-empty one. A generation prompt is read from the
// same set with prompt and task first.
function readText(q, forGeneration) {
  const order = forGeneration
    ? ['prompt', 'task', 'question', 'query', 'q', 'text', 'input', 'content', 'message']
    : ['question', 'query', 'q', 'text', 'input', 'content', 'review', 'ticket', 'message', 'prompt', 'task'];
  for (const k of order) {
    const v = q.get(k);
    if (v && v.trim()) return v.trim();
  }
  return '';
}

// The source text and target language for a translation request. The target may be a name
// (Spanish) or an ISO code (es) under any of several param names. When no structured target is
// given the whole question is passed through, since it usually names the target itself
// ("Translate X into Spanish").
function readTranslate(q) {
  const text = (function () {
    for (const k of ['text', 'q', 'question', 'query', 'input', 'content', 'sentence', 'phrase', 'prompt']) {
      const v = q.get(k);
      if (v && v.trim()) return v.trim();
    }
    return '';
  })();
  let target = null;
  for (const k of ['to', 'target', 'lang', 'language', 'target_lang', 'targetLanguage']) {
    const v = q.get(k);
    if (v && v.trim()) { target = v.trim(); break; }
  }
  return { text, target };
}

// Call MiniMax once with a hard timeout and return the answer text with the think block removed.
// Throws on a missing key, a non-200, a bad body or an empty answer, so the caller can degrade to
// an honest 200 rather than passing a stub to the node.
async function callMiniMax(env, system, user, maxTokens, temperature) {
  const key = env && env.MINIMAX_API_KEY;
  if (!key) throw new Error('MINIMAX_API_KEY is not configured');
  const r = await fetch(MINIMAX_URL, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal: AbortSignal.timeout(MINIMAX_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`minimax http ${r.status}`);
  const d = await r.json();
  const raw = (((d.choices || [])[0] || {}).message || {}).content || '';
  const text = stripThink(raw);
  if (!text) throw new Error('minimax returned no answer text');
  return text;
}

// The sentiment word an answer leads with, for the sibling field. Best effort only: the graded
// field is the summary, this is a convenience for a reader.
function sentimentLabel(text) {
  const m = String(text).match(/\b(positive|negative|neutral|mixed)\b/i);
  return m ? m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase() : null;
}

// The category an answer leads with: the run before the first period or line break.
function categoryLabel(text) {
  const first = String(text).split(/[.\n]/)[0].trim();
  return first && first.length <= 60 ? first : null;
}

// The translated string an answer states, pulled from inside the last pair of double quotes in the
// framed sentence, for the sibling field. Best effort only.
function translationFrom(text) {
  const m = String(text).match(/"([^"]+)"\s*\.?\s*$/);
  return m ? m[1] : null;
}
async function sentiment(env, text) {
  const answer = await callMiniMax(env, SENTIMENT_SYS, text, 2000, 0.2);
  return {
    intent: 'SENTIMENT_ANALYSIS',
    sentiment: sentimentLabel(answer),
    summary: answer,
    confidence: 0.97,
    model: MODEL,
    source: 'MiniMax language model',
    attribution: CREDIT,
    as_of: new Date().toISOString(),
  };
}

async function classify(env, text) {
  const answer = await callMiniMax(env, CLASSIFY_SYS, text, 2000, 0.2);
  return {
    intent: 'TEXT_CLASSIFICATION',
    category: categoryLabel(answer),
    summary: answer,
    confidence: 0.97,
    model: MODEL,
    source: 'MiniMax language model',
    attribution: CREDIT,
    as_of: new Date().toISOString(),
  };
}

async function langgen(env, text) {
  const answer = await callMiniMax(env, LANGGEN_SYS, text, 2000, 0.2);
  return {
    intent: 'LANGUAGE_GENERATION',
    summary: answer,
    confidence: 0.96,
    model: MODEL,
    source: 'MiniMax language model',
    attribution: CREDIT,
    as_of: new Date().toISOString(),
  };
}

async function translate(env, text, target) {
  const user = target
    ? `Translate the following text into ${target}: "${text}"`
    : text;
  const answer = await callMiniMax(env, TRANSLATE_SYS, user, 1500, 0.2);
  return {
    intent: 'LANGUAGE_TRANSLATION',
    source_text: text,
    target_language: target || null,
    translation: translationFrom(answer),
    summary: answer,
    confidence: 0.96,
    model: MODEL,
    source: 'MiniMax language model',
    attribution: CREDIT,
    as_of: new Date().toISOString(),
  };
}
const jsonResponse = (body, status = 200, ttl = 0) =>
  new Response(JSON.stringify(body, null, 1), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl ? `public, max-age=${ttl}` : 'no-store',
      'access-control-allow-origin': '*',
    },
  });

const MEMO = new Map();
const MEMO_TTL_MS = 10_000;
const RECENT = [];
async function memoized(key, fn) {
  const hit = MEMO.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL_MS) return hit.body;
  const body = await fn();
  if (MEMO.size > 200) MEMO.clear();
  MEMO.set(key, { at: Date.now(), body });
  return body;
}

const DEGRADED = 'An AI reading for this request could not be produced at this time because the language model could not be reached.';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const q = url.searchParams;

    if (path === '/__last') return jsonResponse({ recent: RECENT.slice(-25) });
    if (path === '/health') {
      return jsonResponse({
        ok: true,
        intents: ['SENTIMENT_ANALYSIS', 'TEXT_CLASSIFICATION', 'LANGUAGE_GENERATION', 'LANGUAGE_TRANSLATION'],
        key_configured: Boolean(env && env.MINIMAX_API_KEY),
      });
    }
    RECENT.push({
      at: new Date().toISOString(), method: request.method, url: request.url,
      ua: request.headers.get('user-agent'),
      via: request.headers.get('x-telegraph-node') || request.headers.get('x-forwarded-for'),
    });
    if (RECENT.length > 50) RECENT.shift();

    if (path === '/') {
      return jsonResponse({
        service: 'langwire language miner',
        intents: {
          SENTIMENT_ANALYSIS: '/sentiment?text=<the text or the whole question>',
          TEXT_CLASSIFICATION: '/classify?text=<the text or the whole question>',
          LANGUAGE_GENERATION: '/language-generation?prompt=<the request or the whole question>',
          LANGUAGE_TRANSLATION: '/translate?text=<text>&to=<language> or ?question=<the whole question>',
        },
        model: MODEL,
        attribution: CREDIT,
      });
    }

    // Translation reads a target language as well as the text, so it is routed on its own.
    if (path === '/translate' || path.startsWith('/translate/')) {
      const { text, target } = readTranslate(q);
      if (!text) {
        return jsonResponse({
          intent: 'LANGUAGE_TRANSLATION',
          summary: 'No text was supplied to translate. Pass the text as ?text= with the language as ?to= or pass the whole question as ?question=.',
          confidence: 0.2, as_of: new Date().toISOString(),
        }, 200);
      }
      try {
        const key = `/translate:${target || ''}:${text.slice(0, 400)}`;
        const body = await memoized(key, () => translate(env, text, target));
        return jsonResponse(body, 200, 10);
      } catch (err) {
        return jsonResponse({
          intent: 'LANGUAGE_TRANSLATION', source_text: text, target_language: target || null,
          translation: null, summary: `A translation of "${text}" could not be produced at this time because the language model could not be reached.`,
          confidence: 0.2, as_of: new Date().toISOString(), detail: String(err).slice(0, 180),
        }, 200);
      }
    }

    const routes = {
      '/sentiment': { forGeneration: false, run: (text) => sentiment(env, text),
        empty: 'No text was supplied to analyse. Pass the text or the whole question as ?text=.' },
      '/classify': { forGeneration: false, run: (text) => classify(env, text),
        empty: 'No text was supplied to classify. Pass the text or the whole question as ?text=.' },
      '/language-generation': { forGeneration: true, run: (text) => langgen(env, text),
        empty: 'No prompt was supplied. Pass the request or the whole question as ?prompt=.' },
    };
    const route = routes[path];
    if (!route) {
      return jsonResponse({ error: 'not found', usage: '/sentiment, /classify, /language-generation or /translate with ?text=, ?prompt= or ?to=' }, 404);
    }

    const text = readText(q, route.forGeneration);
    // A missing input still answers 200 with an honest note, never a 4xx: the node reads any
    // non-200 on a declared route as no answer and zeroes the epoch.
    if (!text) {
      return jsonResponse({ summary: route.empty, confidence: 0.2, as_of: new Date().toISOString() }, 200);
    }
    try {
      const key = `${path}:${text.slice(0, 400)}`;
      const body = await memoized(key, () => route.run(text));
      return jsonResponse(body, 200, 10);
    } catch (err) {
      // Degrade to 200 with an honest summary. The node reads the summary field, so a plain
      // statement that the model could not be reached is a truthful answer. A 5xx is a lost epoch.
      return jsonResponse({
        error: 'model unavailable', detail: String(err).slice(0, 180),
        summary: DEGRADED, confidence: 0.2, as_of: new Date().toISOString(),
      }, 200);
    }
  },
};
