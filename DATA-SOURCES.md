# Data sources

Every figure this miner serves is a live read at request time. This file records, per source,
what it provides, what its own terms say about commercial use and redistribution, what credit it
requires and what its real rate limit is.

Two rules were followed in writing it. A licence is only recorded when the provider's own terms
page was read; where a page could not be read, that is stated as unverified rather than guessed.
And every source was called from a Cloudflare Worker before it went in, because several hosts
answer differently from a worker than from a laptop.

| Host | Provides | Licence | Commercial use | Attribution | Rate limit |
| --- | --- | --- | --- | --- | --- |
| apertium.org | Machine translation | Free and open-source (GPL for the engine and the language data). | Not restricted by the project. The public instance publishes no terms, which is recorded as unverified for the hosted service. | Credited in every answer. | No published limit on the public instance. One or two calls per uncached request. |

## Per source

### apertium.org

Machine translation.

Commercial use: Not restricted by the project. The public instance publishes no terms, which is recorded as unverified for the hosted service.

Attribution: Credited in every answer.

Credit line published in every answer:

    Translation by Apertium (https://www.apertium.org/), free and open-source machine translation.

Rate limit: No published limit on the public instance. One or two calls per uncached request.

Rule-based, so it covers 133 pairs rather than every pair. A pair it does not serve is answered by saying so, because a guessed translation is a fabricated answer. Google's keyless endpoint was dropped: the Translate API "is provided to you without any free usage quota" and its attribution rules require a "powered by Google Translate" graphic a JSON API cannot show. MyMemory was dropped for its resale bar and its 5000 character shared daily cap.

## Compliance

Met:

- apertium.org: the required credit line travels in every answer and in NOTICE.

No open items: every source this miner calls permits the use, and every required credit line is published.
