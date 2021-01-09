// this function is available here:
// https://github.com/scryfall/google-sheets/blob/main/scryfall-google-sheets.js
// and was last updated on 2021-01-08 (probably)

const MAX_RESULTS_ = 700;  // a safe max due to Google Sheets timeout system

/**
 * Inserts the results of a search in Scryfall into your spreadsheet
 *
 * @param {"name:braids type:legendary"}  query       Scryfall search query
 * @param {"name power toughness"}        fields      List of fields to return from Scryfall, "name" is default
 * @param {150}                           num_results Number of results (default 150, maximum 700)
 * @param {name}                          order       The order to sort cards by, "name" is default
 * @param {auto}                          dir         Direction to return the sorted cards: auto, asc, or desc 
 * @param {cards}                         unique      Remove duplicate cards (default), art, or prints
 * @return                                List of Scryfall search results
 * @customfunction
 */
const SCRYFALL = (query, fields = "name", num_results = 150,
                  order = "name", dir = "auto", unique = "cards") => {
  if (query === undefined) { 
    throw new Error("Must include a query");
  }

  // don't break scryfall
  if (num_results > MAX_RESULTS_) {
    num_results = MAX_RESULTS_;
  }

  // the docs say fields is space separated, but allow comma separated too
  fields = fields.split(/[\s,]+/);

  // most people won't know the JSON field names for cards, so let's do some mapping of
  // what they'll try to what it should be
  const field_mappings = {
    "color": "color_identity",
    "colors": "color_identity",
    "flavor": "flavor_text",
    "mana": "mana_cost",
    "o": "oracle_text",
    "oracle": "oracle_text",
    "price": "prices.usd",
    "type": "type_line",
    "uri": "scryfall_uri",
    "url": "scryfall_uri",
  }

  // do the same friendly thing, but for sorting options
  const order_mappings = {
    "price": "usd",
    "prices.eur": "eur",
    "prices.usd": "usd",
  };

  fields = fields.map(field => field_mappings[field] === undefined ? field : field_mappings[field]);
  order = order_mappings[order] === undefined ? order : order_mappings[order];

  // google script doesn't have URLSearchParams
  const scryfall_query = {
    q: query,
    order: order,
    dir: dir,
    unique: unique,
  };

  // query scryfall
  const cards = scryfallSearch_(scryfall_query, num_results);

  // now, let's accumulate the results
  let output = [];

  cards.splice(0, num_results).forEach(card => {
    let row = [];

    // there is probably a better way to handle card faces, but this is
    // probably sufficient for the vast majority of use cases
    if ("card_faces" in card) {
      Object.assign(card, card["card_faces"][0]);
    }

    // a little hack to make images return an image function; note that Google
    // sheets doesn't currently execute it or anything
    card["image"] = `=IMAGE("${card["image_uris"]["normal"]}", 4, 340, 244)`;

    fields.forEach(field => {
      // grab the field from the card data
      let val = deepFind_(card, field) || "";

      // then, let's do some nice data massaging for use inside Sheets
      if (typeof val === "string") {
        val = val.replace(/\n/g, "\n\n");  // double space for readability
      } else if (Array.isArray(val)) {
        val = field.includes("color") ? val.join("") : val.join(", ");
      }

      row.push(val);
    });

    output.push(row);
  });

  return output;
};

const deepFind_ = (obj, path) => {
  return path.split(".").reduce((prev, curr) => prev && prev[curr], obj)
};


// paginated query of scryfall
const scryfallSearch_ = (params, num_results = MAX_RESULTS_) => {
  const query_string = Object.entries(params).map(([key, val]) => `${key}=${encodeURIComponent(val)}`).join('&');
  const scryfall_url = `https://api.scryfall.com/cards/search?${query_string}`;

  let data = [];
  let page = 1;
  let response;

  // try to get the results from scryfall
  try {
    while (true) {
      response = JSON.parse(UrlFetchApp.fetch(`${scryfall_url}&page=${page}`).getContentText());

      if (!response.data) {
        throw new Error("No results from Scryfall");
      }

      data.push(...response.data);

      if (!response.has_more || data.length > num_results) {
        break;
      }

      page++;
    }
  } catch (error) {
    throw new Error(`Unable to retrieve results from Scryfall: ${error}`);
  }

  return data;
};
