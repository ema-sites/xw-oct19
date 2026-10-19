# carousel-winners

Custom **carousel** block. Purpose: rotating recent-winners slider with portrait, name, location, CTA, game logo and prize amount.

## Authoring (Document Authoring)

Model: `collection`

Repeating rows — one row per item. Each item: one row per slide: [portrait image | text | game logo image]. Text: heading (winner name), location paragraph, "Winner" label paragraph, prize amount paragraph (e.g. $500,000), CTA link. The game logo is placed next to the "Winner" label on decoration.

## Supported variations

No variations.

## Universal Editor fields

- Content fields derived from the block's decorate contract.
- A separate `-item` model defines one repeated item.
