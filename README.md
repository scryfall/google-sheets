Retrieve Scryfall results from inside Google Sheets

![](example_output.png)

# Installation

To install, copy the contents of [scryfall-google-sheets.js](https://raw.githubusercontent.com/scryfall/google-sheets/main/scryfall-google-sheets.js).


Once you've copied it to your clipboard, open your sheet and go to Extensions -> Apps Script. Paste the contents of
your clipboard into the script editor and choose to save. You may get a pop-up that requests permission though, the script should work either way. Once you've done so, return to your spreadsheet
and the `=SCRYFALL()` function should now be available. You can click on info in the apps script page to see which file is listed as the Container for the script it should match the spreadsheet you're working on.

# Usage

```
SCRYFALL(query, fields, num_results, order, dir, unique)

* `query`: Scryfall search query
* `fields`: List of fields from a card object to return, using `.` for nested items (e.g. prices.eur)
* `num_results`: Number of results to return (maximum 700)
* `order`: The order to sort cards by, "name" is default
* `dir`: Direction to return the sorted cards: auto, asc, or desc
* `unique`: Remove duplicate "cards" (default), art, or prints
```

If you are unsure what fields can be in a [card object](https://scryfall.com/docs/api/cards), here is [an example](https://api.scryfall.com/cards/4dcdcad5-e4fb-480e-984f-1ac5cdc986b9?format=json&pretty=true).

# Examples

As it can be difficult to describe how to use a function, here are some examples:

### List of creatures with 10 or more power
`=SCRYFALL("type:creature pow>=10")`

### The price of every card in Dominaria, sorted by price (USD)
`=SCRYFALL("set:dom", "name prices.usd prices.eur", 750, "price")`

### Legacy legal cards in paper but not available on Magic Online, returning 700 results
`=SCRYFALL("in:paper -in:mtgo legal:legacy", "name", 700)`

### List of cards with Jaya Ballard flavor text, returning card name, set name, mana cost, and flavor text
`=SCRYFALL("flavor:'jaya ballard'", "name set_name mana flavor")`

### Commander cards not available in foil, with name, set name, release date, color identity, URL, and oracle text, sorted by EDHREC popularity
`=SCRYFALL("-in:foil game:paper legal:commander -is:reprint -is:reserved", "name set_name released_at color url oracle", 150, "edhrec")`

# "Bugs"

Note that your search *must* return a result in 30 seconds or less. Asking for too many results can result in 
your spreadsheet showing an ERROR. Repeating a `=SCRYFALL()` function with the same query may work on a second
attempt, as Scryfall caches results.

If you want to have a spreadsheet with more than 700 results, your best bet is to shard your results. For example,
if you wanted a list of all legal Commanders (which has over 1000 results), you can do:

`=SCRYFALL("is:commander legal:commander name:/^[abcdefghijklm]/", "name", 700)`
`=SCRYFALL("is:commander legal:commander name:/^[nopqrstuvwxyz]/", "name", 700)`
