# cards-game-tile

Custom **cards** block. Purpose: grid of game/promo tiles with image, optional NEW badge or jackpot band, title, details and CTA.

## Authoring (Document Authoring)

Model: `collection`

Repeating rows — one row per item. Each item: one row per card: [image | text]. Text: optional lead paragraph before the heading (short text such as NEW becomes a corner badge; anything else, e.g. a jackpot amount, becomes a band over the image bottom), heading (title), description, optional draw details, CTA link as the last paragraph.

## Supported variations

No variations.

## Universal Editor fields

- Content fields derived from the block's decorate contract.
- A separate `-item` model defines one repeated item.
