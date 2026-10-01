# LangWire, a Telegraph language-model miner

LangWire answers four model-judged Telegraph intents from one Cloudflare Worker, routed by path
prefix:

- **SENTIMENT_ANALYSIS** at `/sentiment`
- **TEXT_CLASSIFICATION** at `/classify`
- **LANGUAGE_GENERATION** at `/language-generation`
- **LANGUAGE_TRANSLATION** at `/translate`

Each answer is produced by MiniMax (MiniMax-M3) at request time. These intents are graded by the
node against a ground truth it writes itself with a model, so a genuinely correct, well-shaped
answer is what scores. This miner is **not keyless**: it calls a keyed provider the operator holds
a commercial plan for, which is what a model-judged intent needs.

## The model and the key

[MiniMax](https://www.minimax.io/) (model `MiniMax-M3`), called once per request with a tight
per-intent system prompt. MiniMax-M3 is a reasoning model that emits a `<think>` block before its
answer. The worker strips that block and returns only the answer as the `summary` the node grades.

The API key is never in this repo. It is a Cloudflare secret:

```bash
wrangler secret put MINIMAX_API_KEY
```

The worker reads it as `env.MINIMAX_API_KEY`. With no key or on any upstream error or timeout, the
worker still answers 200 with an honest degraded summary, because the node reads any non-200 on a
declared route as no answer and scores the whole epoch zero.

## Answer format

The `summary` field is the answer the node grades.

- **Sentiment:** `The sentiment of this text is positive. This is because the phrases "absolutely
  love" and "works flawlessly" convey strong satisfaction.`
- **Classification:** `Billing. The ticket describes a duplicate payment charge and a refund
  request, which fall under billing and payment processing.`
- **Generation:** a direct, complete reference answer to the request in one clear paragraph.
- **Translation:** `The translation of "Good morning, how are you?" into Spanish is "Buenos días,
  ¿cómo estás?".`

## Endpoints

- `GET /sentiment?text=<text>` sentiment for one passage. Also reads `?question=` or `?query=`.
- `GET /classify?text=<text>` the single best category plus one reason. Also reads `?question=`.
- `GET /language-generation?prompt=<request>` a generated answer. Also reads `?question=`.
- `GET /translate?text=<text>&to=<language>` a translation. Also reads a whole question in
  `?question=` such as `Translate "good morning" into Spanish`.
- `GET /health` and `GET /__last` for diagnostics. `/health` reports whether the key is configured.

Every declared route answers 200, including the empty-input and model-unavailable paths. Only an
undeclared path returns 404.

## Deploy

```bash
wrangler secret put MINIMAX_API_KEY   # once, the key is pasted at the prompt, never in a file
wrangler deploy
```

`wrangler.toml` names the worker `telegraph-lang`, so the base URL is
`https://telegraph-lang.margyn.workers.dev`. No other secrets and no bindings.

## Licence

Source-available, no derivatives (SAND 1.0), see `LICENSE`. Read it, audit it, run your own
instance to check it. Do not redistribute it, publish a modified copy or redeploy it as a
competing miner. The third-party model terms and the credit line MiniMax asks for are in `NOTICE`
and `DATA-SOURCES.md`.
