/**
 * Inserts the results of a search in Scryfall into your spreadsheet
 *
 * @param {"name:braids type:legendary"}  query       Scryfall search query
 * @param {"name power toughness"}        fields      List of fields to return from Scryfall, "name" is default
 * @param {10}                            num_results Number of results (maximum 700)
 * @param {name}                          order       The order to sort cards by, "name" is default
 * @param {auto}                          dir         Direction to return the sorted cards: auto, asc, or desc 
 * @param {cards}                         unique      Remove duplicate cards (default), art, or prints
 * @return                                List of Scryfall search results
 * @customfunction
 */

const SCRYFALL = (query = "foo", fields = "name flavor", num_results = 700,
                  order = "name", dir = "auto", unique = "cards") => {
  if (query === undefined) { 
    throw new Error("Must include a query");
  }

  // don't break scryfall
  if (num_results > 700) {
    num_results = 700;
  }

  // the docs say fields is space separated, but allow comma separated too
  fields = fields.split(/[\s,]+/);

  // most people won't know the JSON field names for cards, so let's do some mapping of
  // what they'll try to what it should be
  const field_mappings = {
    "flavor": "flavor_text",
    "mana": "mana_cost",
    "o": "oracle_text",
    "oracle": "oracle_text",
    "type": "type_line",
  }

  fields = fields.map(field => field_mappings[field] === undefined ? field : field_mappings[field])

  // google script doesn't have URLSearchParams
  const scryfall_query = Object.entries({
    q: query,
    order: order,
    dir: dir,
    unique: unique,
  }).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&');

  const scryfall_url = `https://api.scryfall.com/cards/search?${scryfall_query}`;

  // try to get the results from scryfall
  let cards = [];
  let page = 1;
  let response;

  try {
    while (true) {
      response = JSON.parse(UrlFetchApp.fetch(`${scryfall_url}&page=${page}`).getContentText());

      if (!response.total_cards) {
        throw new Error("No results from Scryfall");
      }

      cards.push(...response.data);

      if (!response.has_more || cards.length > num_results) {
        break;
      } else {
        page++;
      }
    }
  } catch (error) {
    throw new Error(`Unable to retrieve results from Scryfall: ${error}`);
  }

  // now, let's accumulate the results
  let output = [];

  cards.splice(0, num_results).forEach(card => {
    let row = [];

    fields.forEach(field => {
      row.push(deepFind_(card, field) === undefined ? "" : deepFind_(card, field))
    });

    output.push(row);
  });

  return output;
}

const deepFind_ = (obj, path) => {
  return path.split(".").reduce((prev, curr) => prev && prev[curr], obj)
}
