# The Analytical Web

A web page computed on Charles Babbage's Analytical Engine (1837).

The site's content is not served as HTML. It is a deck of punched cards
(`page.cards`) run on an emulated Engine (`engine.js`). Each character is
stored as a three-digit number, sixteen to a fifty-digit column of the
Store. The Mill divides each column by 1,000; the remainder is printed as
the next character and the quotient goes back to the Store. A
combinatorial card turns the chain back until the column reads zero.

The Engine runs at Babbage's rated speeds (one addition a second, one
fifty-digit division a minute), scaled by the regulator. At true speed the
front page takes about two days and the engineer's manual about three and
a half.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The engine console, printing apparatus and sheet |
| `engine.js` | The Analytical Engine: Store, Mill, run-up lever, card reader |
| `page.cards` | The punched deck for the front page. This is the website. |
| `manuscript.html` | The compositor's manuscript the front page is punched from |
| `manual.cards` | The punched deck for the engineer's manual (`?deck=manual`) |
| `manual.html` | The manuscript the manual is punched from |
| `tools/punch.mjs` | The card punch for the Engine |
| `plate.css` | Styling shared by every machine's page |
| `loom.html` | The Jacquard loom's console and cloth |
| `loom.js` | The Jacquard loom: 400 hooks, one card per pick |
| `loom.cards` | The punched deck the loom weaves |
| `loom.txt` | The text woven into the plate |
| `tools/punch-loom.mjs` | The loom's card punch |

## Changing the page

Edit `manuscript.html` or `manual.html`, then punch fresh decks (Node 18 or later):

```sh
node tools/punch.mjs
```

The punch fills in the ledger figures, runs the deck on the Engine and
refuses to write a deck unless the Engine prints its manuscript exactly.
The Store holds 990 data columns, so each manuscript must stay under 15,840
characters. Characters above code 999 are set as HTML character references.

## Changing the woven plate

Edit `loom.txt` (the first line is the title), then punch a fresh deck:

```sh
node tools/punch-loom.mjs
```

The punch sets the text in a five-thread type, binds it in five-end satin
and refuses to write the deck unless the loom weaves the design exactly.
The type case holds capitals, figures and a little punctuation.

## Publishing on GitHub Pages

1. Create a repository and push these files to the `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch
   `main`, folder `/ (root)`, and save.
4. The site appears at `https://<user>.github.io/<repo>/` after a minute.

`.nojekyll` tells Pages to serve the files as they are.

## Card notation

After John Walker's Analytical Engine emulator at fourmilab.ch.

| Card | Meaning |
| --- | --- |
| `N017 12345` | Number card: put 12345 in column 17 |
| `+` `-` `×` `÷` | Operation card |
| `L017` | Copy column 17 to the next ingress axis (`Z017` also zeroes it) |
| `S017` / `S017'` | Store the egress axis / the remainder in column 17 |
| `P` | Print the egress axis |
| `CB?14` | If the run-up lever is set, turn the chain back 14 cards |
| `CF+3` | Skip forward 3 cards |
| `A set type` | Attendant: the printer sets each number as a type sort |
| `H` | Halt |
