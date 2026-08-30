# LangWire, a Telegraph translation miner

LangWire answers the Telegraph **LANGUAGE_TRANSLATION** intent. Give it a phrase and a target
language and it returns the translation, stated verbatim in one plain sentence followed by a
Readings block with the languages and the match quality. It is a Cloudflare Worker with no
database and no API key.

## Data source

[Apertium](https://www.apertium.org/), the free and open-source rule-based translation engine, read
live at request time with no key.

Apertium is here for its licence rather than its reach. The endpoints this miner used before cannot
be squared with a paid miner:

- **Google's keyless `translate_a/t` endpoint** is undocumented, and the Translate API terms state
  the API "is provided to you without any free usage quota". Google's own attribution page also
  requires a "powered by Google Translate" graphic displayed "adjacent any translation results",
  which a JSON API cannot show.
- **MyMemory** bars users from reselling "Translated's services as they are without Translated
  express consent", and caps anonymous use at 5000 characters a day shared across every caller on
  the same address.

Every alternative with a real commercial grant was probed from this edge and none answered: the
public LibreTranslate instances return 405, 502, 523 or a bot challenge, and every Lingva mirror
500s or 503s.

Apertium is rule based, so it serves 133 language pairs rather than every pair. A pair it does not
serve gets an answer that says so. That is deliberate: a guessed translation is a fabricated answer,
which is worse than an honest gap however it scores.

## Answer format

The `summary` field is the answer. The translation leads the sentence verbatim, then the
readings repeat it with the languages and the match quality.

```
In Spanish, "good morning" is "buenos días". Readings: source_text "good morning", source_lang
en (English), target_lang es (Spanish), translation "buenos días", match 85 percent, source
MyMemory translation API, read <timestamp>.
```

The translated text is never paraphrased or altered, so the sentence and the readings always
carry the same string.

## Languages

Common world languages by name or ISO code: English (en), Spanish (es), French (fr), German
(de), Japanese (ja), Chinese (zh), Arabic (ar), Hindi (hi), Portuguese (pt), Russian (ru),
Italian (it), Korean (ko) and more. A name such as "Spanish" or a code such as "es" both
resolve.

## Endpoints

- `GET /translate?text=hello&to=es` query form, with an optional `?from=`. Also reads
  `?question=` or `?query=` and parses a whole question such as
  `Translate "good morning" into Spanish` or `How do you say thank you in Japanese?`.
- `GET /translate/{text}?to=fr` path form, the text in the path and the target in `?to=`. An
  unfilled template such as `/translate/{text}` resolves to a default request and answers 200.
- `GET /health` and `GET /__last` for diagnostics.

When no target is given the default is Spanish. When nothing is given at all the default
request is "Hello, how are you?" into Spanish.

## Deploy

```bash
wrangler deploy
```

No secrets and no bindings. `wrangler.toml` names the worker `telegraph-lang` and the base
URL is `https://telegraph-lang.margyn.workers.dev`.

## License

MIT, see `LICENSE`.
