// this function is available here:
// https://github.com/scryfall/google-sheets/blob/main/scryfall-google-sheets.js
// and was updated with bug fixes for API rate limits and User-Agent policies (2026-04-03).

const MAX_RESULTS_ = 700;  // a safe max due to Google Sheets timeout system

// ---- Configure these ----
const SCRYFALL_USER_AGENT_ = "TLASheet-Scryfall-Integration/1.1";
const SCRYFALL_ACCEPT_ = "application/json;q=0.9,*/*;q=0.8";
// -------------------------

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
  if (typeof fields === "string") {
    fields = fields.split(/[\s,]+/);
  }

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
    if (card["image_uris"] && card["image_uris"]["normal"]) {
      card["image"] = `=IMAGE("${card["image_uris"]["normal"]}", 4, 340, 244)`;
    }

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

  // If no cards were found, return an error message to display in the cell gracefully
  if (output.length === 0) {
    return [Array(fields.length).fill("Card not found")];
  }

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
  let responseText;

  // Set up headers to comply with new Scryfall API requirements
  const options = {
    'method': 'get',
    'headers': {
      'User-Agent': SCRYFALL_USER_AGENT_,
      'Accept': SCRYFALL_ACCEPT_
    },
    'muteHttpExceptions': true
  };

  // try to get the results from scryfall
  try {
    while (true) {
      Utilities.sleep(150); // Respect Scryfall's rate limit of 10 requests/sec

      let response = UrlFetchApp.fetch(`${scryfall_url}&page=${page}`, options);
      let responseCode = response.getResponseCode();
      responseText = response.getContentText();

      // Handle 404 (no results found for the query) Gracefully
      if (responseCode === 404) {
        break; // Return empty data array
      }

      // Handle Rate Limiting
      if (responseCode === 429) {
        Utilities.sleep(1000); // Sleep longer if we hit rate limits and retry
        continue;
      }

      // Throw error ONLY on other actual HTTP errors
      if (responseCode !== 200) {
        throw new Error(`Scryfall API returned ${responseCode}: ${responseText}`);
      }

      let parsedResponse = JSON.parse(responseText);

      if (!parsedResponse.data) {
        break;
      }

      data.push(...parsedResponse.data);

      if (!parsedResponse.has_more || data.length >= num_results) {
        break;
      }

      page++;
    }
  } catch (error) {
    throw new Error(`Unable to retrieve results from Scryfall: ${error.message}`);
  }

  return data;
};