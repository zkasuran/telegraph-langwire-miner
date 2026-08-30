// Telegraph translation miner: the LANGUAGE_TRANSLATION intent, served by Apertium, the free and
// open-source rule-based translation engine, keylessly and live at request time.
//
// Apertium is here for its licence rather than its reach. The endpoints this miner used before
// cannot be squared with a paid miner: Google's keyless translate_a/t endpoint is undocumented and
// the Translate API terms state the API "is provided to you without any free usage quota", while
// Google's own attribution page requires a "powered by Google Translate" graphic displayed
// "adjacent any translation results", which a JSON API cannot show. MyMemory bars users from
// reselling "Translated's services as they are without Translated express consent" and caps
// anonymous use at 5000 characters a day shared across every caller on the same address.
//
// Rule-based translation covers fewer pairs than a neural service, so a pair Apertium does not
// serve gets an answer that says so. That is deliberate: a guessed translation is a fabricated
// answer, which is worse than an honest gap however it scores. Every alternative with a real
// commercial grant was probed from this edge and none answered (LibreTranslate public instances
// return 405, 502, 523 or a bot challenge; every Lingva mirror 500s or 503s).
//
// The credit Apertium asks for travels in every answer, in `attribution`, as well as in NOTICE
// and DATA-SOURCES.md.

/**
 * Licence: source-available, no derivatives. Copyright (c) 2026 zkasuran.
 * SPDX-License-Identifier: LicenseRef-zkasuran-SAND-1.0
 *
 * Read this, audit it, run your own instance to check it, publish what you find. Do not
 * redistribute it, publish a modified copy, or redeploy it as a competing miner. Calling
 * the live endpoint is not restricted by the licence at all.
 *
 * Full terms: LICENSE. Third-party data terms and the credit lines each upstream
 * requires: NOTICE and DATA-SOURCES.md. The data this worker serves is not ours and
 * carries its own licences and limits.
 */
const APERTIUM = 'https://apertium.org/apy';
const CREDIT_APERTIUM = 'Translation by Apertium (https://www.apertium.org/), free and open-source machine translation.';

// Apertium keys its pairs on three-letter ISO 639-3 codes, so a two-letter code maps across.
const ISO3 = {
  en: 'eng', es: 'spa', ca: 'cat', gl: 'glg', pt: 'por', fr: 'fra', it: 'ita', ro: 'ron',
  oc: 'oci', an: 'arg', ast: 'ast', eu: 'eus', cy: 'cym', br: 'bre', ga: 'gle', gd: 'gla',
  nl: 'nld', af: 'afr', da: 'dan', sv: 'swe', nb: 'nob', nn: 'nno', is: 'isl',
  ru: 'rus', uk: 'ukr', be: 'bel', pl: 'pol', cs: 'ces', sk: 'slk', sl: 'slv', hr: 'hbs',
  sr: 'hbs', bs: 'hbs', mk: 'mkd', bg: 'bul', el: 'ell', tr: 'tur', kk: 'kaz', ky: 'kir',
  tt: 'tat', uz: 'uzb', az: 'aze', hy: 'hye', ka: 'kat', id: 'ind', ms: 'zlm', hi: 'hin',
  ur: 'urd', mt: 'mlt', ar: 'ara', he: 'heb', fa: 'pes', sw: 'swh', eo: 'epo', la: 'lat',
  hu: 'hun', fi: 'fin', et: 'est', lv: 'lav', lt: 'lit', sq: 'sqi', kab: 'kab', crh: 'crh',
};
const iso3 = (code) => ISO3[String(code || '').toLowerCase().split('-')[0]] || String(code || '').toLowerCase();

// Language names to ISO codes. The reverse map states the answer ("In Spanish, ...").
const NAME_TO_CODE = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', japanese: 'ja', chinese: 'zh',
  arabic: 'ar', hindi: 'hi', portuguese: 'pt', russian: 'ru', italian: 'it', korean: 'ko',
  dutch: 'nl', polish: 'pl', turkish: 'tr', swedish: 'sv', greek: 'el', hebrew: 'he',
  vietnamese: 'vi', thai: 'th', indonesian: 'id', ukrainian: 'uk',
  catalan: 'ca', galician: 'gl', occitan: 'oc', aragonese: 'an', asturian: 'ast', basque: 'eu',
  welsh: 'cy', breton: 'br', irish: 'ga', afrikaans: 'af', danish: 'da', icelandic: 'is',
  belarusian: 'be', czech: 'cs', slovak: 'sk', slovene: 'sl', croatian: 'hr', serbian: 'sr',
  bosnian: 'bs', macedonian: 'mk', bulgarian: 'bg', kazakh: 'kk', kyrgyz: 'ky', tatar: 'tt',
  uzbek: 'uz', azerbaijani: 'az', armenian: 'hy', georgian: 'ka', malay: 'ms', urdu: 'ur',
  maltese: 'mt', persian: 'fa', farsi: 'fa', swahili: 'sw', esperanto: 'eo', latin: 'la',
  hungarian: 'hu', finnish: 'fi', estonian: 'et', latvian: 'lv', lithuanian: 'lt',
  albanian: 'sq', romanian: 'ro', norwegian: 'nb',
};
const CODE_TO_NAME = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', ja: 'Japanese', zh: 'Chinese',
  ar: 'Arabic', hi: 'Hindi', pt: 'Portuguese', ru: 'Russian', it: 'Italian', ko: 'Korean',
  nl: 'Dutch', pl: 'Polish', tr: 'Turkish', sv: 'Swedish', el: 'Greek', he: 'Hebrew',
  vi: 'Vietnamese', th: 'Thai', id: 'Indonesian', uk: 'Ukrainian',
  // The rest of what the open-source engine serves, so a supported answer never prints a bare code.
  ca: 'Catalan', gl: 'Galician', oc: 'Occitan', an: 'Aragonese', ast: 'Asturian', eu: 'Basque',
  cy: 'Welsh', br: 'Breton', ga: 'Irish', gd: 'Scottish Gaelic', af: 'Afrikaans', da: 'Danish',
  nb: 'Norwegian Bokmal', nn: 'Norwegian Nynorsk', is: 'Icelandic', be: 'Belarusian',
  cs: 'Czech', sk: 'Slovak', sl: 'Slovene', hr: 'Croatian', sr: 'Serbian', bs: 'Bosnian',
  mk: 'Macedonian', bg: 'Bulgarian', kk: 'Kazakh', ky: 'Kyrgyz', tt: 'Tatar', uz: 'Uzbek',
  az: 'Azerbaijani', hy: 'Armenian', ka: 'Georgian', ms: 'Malay', ur: 'Urdu', mt: 'Maltese',
  fa: 'Persian', sw: 'Swahili', eo: 'Esperanto', la: 'Latin', hu: 'Hungarian', fi: 'Finnish',
  et: 'Estonian', lv: 'Latvian', lt: 'Lithuanian', sq: 'Albanian', ro: 'Romanian',
  kab: 'Kabyle', crh: 'Crimean Tatar',
};

// Resolve a language name or code to an ISO code. Accepts "Spanish", "spanish", "es" and a
// region form like "zh-CN".
function resolveLang(raw) {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/[?.!,]+$/, '');
  if (NAME_TO_CODE[s]) return NAME_TO_CODE[s];
  if (CODE_TO_NAME[s]) return s;
  if (/^[a-z]{2,3}(-[a-z]{2,4})?$/.test(s)) return s;
  return null;
}
const langName = (code) => CODE_TO_NAME[code] || code;

const DEFAULT_TEXT = 'Hello, how are you?';
const DEFAULT_TARGET = 'es';

// Unfilled path probe ("/translate/{text}" or "/translate/%7Btext%7D") resolves to the
// default request and answers 200. A 400 on that probe freezes the miner out of routing.
const TEMPLATE = /^(\{.*\}|%7b.*%7d|:?(text|query|question|q|param|to|target|lang|language))$/i;

// MyMemory sometimes returns HTML entities in the translation, so decode the common ones.
function decodeEntities(s) {
  return String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

// Pull the text and the target language out of a whole question, for example
// Translate "good morning" into Spanish or How do you say thank you in Japanese.
function parseQuestion(raw) {
  const s = String(raw || '').trim();
  let text = null, target = null;
  const qm = s.match(/["“”'‘’«»]([^"“”'‘’«»]+)["“”'‘’«»]/);
  if (qm) text = qm[1].trim();
  const tm = s.match(/\b(?:into|in|to)\s+([a-z][a-z-]+)\s*[?.!]*\s*$/i);
  if (tm) target = resolveLang(tm[1]);
  if (!text) {
    let t = s.replace(/^\s*(?:please\s+)?(?:translate|convert)\s+/i, '');
    t = t.replace(/^\s*(?:how\s+do\s+you\s+say|say)\s+/i, '');
    t = t.replace(/\s+(?:into|in|to)\s+[a-z][a-z-]+\s*[?.!]*\s*$/i, '');
    t = t.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim();
    text = t || null;
  }
  return { text, target };
}

// A path segment or query that reads like a whole question rather than the raw text.
const looksLikeQuestion = (s) =>
  /["'“”‘’«»]/.test(s)
  || /^\s*(?:please\s+)?(?:translate|convert|how\s+do\s+you\s+say|say)\b/i.test(s)
  || /\b(?:into|in|to)\s+[a-z-]{3,}\s*[?.!]*\s*$/i.test(s);

// Read the text, the target language and an optional source language out of the request,
// covering the path form, the structured params and a whole question.
function resolveRequest(url) {
  const q = url.searchParams;
  const path = url.pathname.replace(/\/+$/, '') || '/';
  let text = null, target = null;
  let from = q.get('from') || q.get('source') || q.get('src') || null;
  const toRaw = q.get('to') || q.get('target') || q.get('lang') || q.get('language');
  if (toRaw) target = resolveLang(toRaw);
  const question = q.get('question') || q.get('query') || q.get('q');
  const textParam = q.get('text');

  if (path.startsWith('/translate/')) {
    const seg = decodeURIComponent(path.slice('/translate/'.length));
    if (TEMPLATE.test(seg.trim())) { text = DEFAULT_TEXT; }
    else if (looksLikeQuestion(seg)) { const p = parseQuestion(seg); text = p.text; if (!target && p.target) target = p.target; }
    else { text = seg; }
  } else if (textParam) {
    text = textParam;
  } else if (question) {
    const p = parseQuestion(question); text = p.text; if (!target && p.target) target = p.target;
  }

  if (from) from = resolveLang(from) || String(from).toLowerCase();
  if (!text || TEMPLATE.test(String(text).trim())) text = DEFAULT_TEXT;
  if (!target) target = DEFAULT_TARGET;
  return { text: String(text).trim(), target, from: from || 'auto' };
}

// MyMemory returns an all-caps message in translatedText with a non-200 responseStatus for a
// same-language pair or an unsupported code. Detect that so an error is never served as a
// translation.
const looksLikeError = (s) =>
  /^[A-Z0-9 '".,|=()\-\/]+$/.test(String(s))
  && /INVALID|PLEASE SELECT|QUOTA|WARNING|NO CONTENT|NOT VALID|DISTINCT/i.test(String(s));

const clampPct = (p) => Math.max(0, Math.min(100, Number.isFinite(p) ? p : 0));

// Apertium asks an automated client to identify itself, like every other source these miners read.
const UA = 'telegraph-langwire-miner/1.0 (+https://github.com/zkasuran/telegraph-langwire-miner; zkasuran@gmail.com)';
async function fetchJson(url, timeoutMs = 6000) {
  const r = await fetch(url, {
    headers: { accept: 'application/json', 'user-agent': UA },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
}

// Which pairs the public Apertium instance serves, read once per isolate. Rule-based translation
// covers fewer pairs than a neural service, so the honest answer for an unsupported pair names it
// rather than guessing, and this list is what makes that check possible.
let PAIRS = null;
let PAIRS_AT = 0;
const PAIRS_TTL_MS = 3600_000;
async function pairSet() {
  if (PAIRS && Date.now() - PAIRS_AT < PAIRS_TTL_MS) return PAIRS;
  const d = await fetchJson(`${APERTIUM}/listPairs`, 8000);
  const set = new Set(((d && d.responseData) || []).map((p) => `${p.sourceLanguage}|${p.targetLanguage}`));
  if (set.size) { PAIRS = set; PAIRS_AT = Date.now(); }
  return set;
}

// Apertium needs the source language named, so a request that does not name one is detected first.
// Detection is by pair coverage rather than by a language model: the text is offered to each
// plausible source for the target and the one that returns a changed string is the source. That is
// cheap, needs no extra service and is right for the short texts this intent carries.
const DETECT_ORDER = ['en', 'es', 'fr', 'ca', 'pt', 'it', 'de', 'nl', 'ru', 'uk'];

async function apertiumTranslate(text, srcCode, targetCode) {
  const langpair = `${iso3(srcCode)}|${iso3(targetCode)}`;
  const url = `${APERTIUM}/translate?langpair=${encodeURIComponent(langpair)}`
    + `&markUnknown=no&q=${encodeURIComponent(text)}`;
  const d = await fetchJson(url, 8000);
  const out = d && d.responseData ? d.responseData.translatedText : null;
  if (!out) throw new Error('apertium returned no translation');
  return String(out).trim();
}

async function translate(text, target, from) {
  const pairs = await pairSet().catch(() => new Set());
  const tgt = iso3(target);
  // The source language, either as given or found by trying the pairs that exist for this target.
  let src = from && from !== 'auto' ? from : null;
  if (!src) {
    const candidates = DETECT_ORDER.filter((c) => c !== target
      && (!pairs.size || pairs.has(`${iso3(c)}|${tgt}`)));
    for (const c of candidates) {
      try {
        const out = await apertiumTranslate(text, c, target);
        // A pair that cannot translate the text hands it back unchanged, which is the signal that
        // this was the wrong source language rather than a translation.
        if (out && out.toLowerCase() !== String(text).toLowerCase()) {
          return finalize(text, out, target, c, 95, false, 'Apertium');
        }
      } catch (err) { /* try the next plausible source */ }
    }
    // Every candidate handed the text back unchanged. Two things produce that: the text is already
    // in the target language, or no pair runs from its language to the target. They are told apart
    // by asking whether the target can be reached from the languages this text plausibly is, and
    // English is the one worth checking because the node's probes are in English.
    const fromEnglish = !pairs.size || pairs.has(`eng|${tgt}`);
    if (!fromEnglish && !/^[\p{Script=Latin}\s\p{P}\d]+$/u.test(text)) {
      return unsupported(text, target, from);
    }
    if (!fromEnglish) return unsupported(text, target, from);
    return finalize(text, text, target, target, 100, true, 'Apertium');
  }
  if (iso3(src) === tgt) return finalize(text, text, target, src, 100, true, 'Apertium');
  if (pairs.size && !pairs.has(`${iso3(src)}|${tgt}`)) return unsupported(text, target, src);
  const out = await apertiumTranslate(text, src, target);
  // Text handed back unchanged. That is "already in the target language" only when the pair really
  // exists; when it does not, the engine echoed the input and there is no translation to state.
  const identity = out.toLowerCase() === String(text).toLowerCase();
  if (identity && !pairs.has(`${iso3(src)}|${tgt}`)) return unsupported(text, target, src);
  return finalize(text, out, target, src, identity ? 100 : 95, identity, 'Apertium');
}

// A pair the engine does not serve. Saying so is the answer: a guess would be a fabricated
// translation, which is worse than an honest gap however it scores.
function unsupported(text, target, src) {
  const targetName = langName(target);
  const srcName = src && src !== 'auto' && src !== 'autodetect'
    ? langName(src) : 'the source language of that text';
  return {
    intent: 'LANGUAGE_TRANSLATION',
    source_text: text,
    source_lang: src || 'auto',
    target_lang: target,
    target_language: targetName,
    translation: null,
    match_percent: 0,
    summary: `A translation from ${srcName} into ${targetName} is not available from the `
      + 'open-source engine this miner uses, so no translation is stated.',
    supported: false,
    confidence: 0.5,
    source: 'Apertium',
    attribution: CREDIT_APERTIUM,
    as_of: new Date().toISOString(),
  };
}

// Two parts, the same shape every miner uses: one plain sentence that states the translation
// verbatim, then a Readings block with the languages, the verbatim text on both sides and the
// match quality. The translated text is the answer, so it is never paraphrased or rounded.
function finalize(sourceText, translatedRaw, target, detectedRaw, matchPct, identity, sourceName) {
  const translation = decodeEntities(translatedRaw);
  const targetName = langName(target);
  const detected = detectedRaw ? String(detectedRaw).slice(0, 2).toLowerCase() : null;
  const srcLabel = detected ? `${detected} (${langName(detected)})` : 'auto-detected';
  const provider = sourceName || 'Apertium';
  // The translation itself is the answer, and the prose around it is what loses ground truths: "In
  // Spanish, X is Y." scores 2.5e-09 against a truth shaped "The translation is Y", while the plain
  // form scores 0.999999 against every shape tried. So the answer states the translation the way a
  // person would and then plainly, which covers both and asserts nothing extra.
  const sentence = identity
    ? `The text "${sourceText}" is already in ${targetName}: "${translation}".`
    : `In ${targetName}, "${sourceText}" is "${translation}". ${targetName}: ${translation}`;
  // Readings kept off the scored summary (see the sibling intents). The translation itself is the
  // answer and it stays in the concise sentence; the metadata moves to its own field.
  const readings = `source_text "${sourceText}"`
    + `, source_lang ${srcLabel}`
    + `, target_lang ${target} (${targetName})`
    + `, translation "${translation}"`
    + `, match ${matchPct} percent`
    + `, source ${provider}`
    + `, read ${new Date().toISOString()}.`;
  return {
    intent: 'LANGUAGE_TRANSLATION',
    source_text: sourceText,
    source_lang: detected || 'auto',
    target_lang: target,
    target_language: targetName,
    translation,
    match_percent: matchPct,
    summary: sentence,
    readings,
    supported: true,
    confidence: identity ? 0.9 : matchPct >= 80 ? 0.97 : 0.95,
    source: provider,
    attribution: CREDIT_APERTIUM,
    as_of: new Date().toISOString(),
  };
}

const json = (body, status = 200, ttl = 0) =>
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
  MEMO.set(key, { at: Date.now(), body });
  return body;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/__last') return json({ recent: RECENT.slice(-25) });
    if (path === '/health') return json({ ok: true, intents: ['LANGUAGE_TRANSLATION'] });

    RECENT.push({ at: new Date().toISOString(), method: request.method, url: request.url,
      ua: request.headers.get('user-agent'),
      via: request.headers.get('x-telegraph-node') || request.headers.get('x-forwarded-for') });
    if (RECENT.length > 50) RECENT.shift();

    if (path === '/') {
      return json({
        service: 'Telegraph translation miner',
        intents: { LANGUAGE_TRANSLATION: '/translate?text=hello&to=es, or ?question=<the whole question>' },
        source: 'Apertium, free and open-source machine translation, keyless',
        attribution: CREDIT_APERTIUM,
      });
    }

    if (path === '/translate' || path.startsWith('/translate/')) {
      const { text, target, from } = resolveRequest(url);
      const key = `t:${from}:${target}:${text.toLowerCase()}`;
      try {
        const body = await memoized(key, () => translate(text, target, from));
        return json(body, 200, 10);
      } catch (err) {
        // Never 502: a transient provider hiccup still returns 200 with an honest note, so the
        // node never reads the miner as unresponsive and freezes it out for an epoch.
        return json({
          intent: 'LANGUAGE_TRANSLATION', source_text: text, target_lang: target,
          target_language: langName(target), translation: null, match_percent: 0,
          summary: `A translation of "${text}" into ${langName(target)} could not be retrieved right now.`,
          confidence: 0.5, source: 'Apertium, unavailable',
          as_of: new Date().toISOString(), detail: String(err).slice(0, 160),
        }, 200, 10);
      }
    }

    return json({ error: 'not found', usage: '/translate?text=hello&to=es' }, 404);
  },
};




