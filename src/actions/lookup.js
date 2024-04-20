/**
 * @openapi
 * /lookup:
 *   post:
 *     operationId: lookup
 *     summary: Semantic search
 *     description: Performs a semantic search of the user's data.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hypothetical_1:
 *                 type: string
 *                 description: "Short hypothetical notes predicted to be semantically similar to the notes necessary to fulfill the user's request. At least three hypotheticals per request. The hypothetical notes may contain paragraphs, lists, or checklists in markdown format. Hypothetical notes always begin with breadcrumbs containing the anticipated folder(s), file name, and relevant headings separated by ' > ' (no slashes). Example: PARENT FOLDER NAME > CHILD FOLDER NAME > FILE NAME > HEADING 1 > HEADING 2 > HEADING 3: HYPOTHETICAL NOTE CONTENTS."
 *               hypothetical_2:
 *                 type: string
 *                 description: Must be distinct from and not share any breadcrumbs with hypothetical_1.
 *               hypothetical_3:
 *                 type: string
 *                 description: Must be distinct from hypothetical_1 and hypothetical_2.
 *             required:
 *               - hypothetical_1
 *               - hypothetical_2
 * 
 */
async function lookup(env, params={}) {
  // TODO 
  console.log("lookup", params);
  const { hypotheticals = [], hypothetical_1, hypothetical_2, hypothetical_3 } = params;
  if(hypothetical_1) hypotheticals.push(hypothetical_1);
  if(hypothetical_2) hypotheticals.push(hypothetical_2);
  if(hypothetical_3) hypotheticals.push(hypothetical_3);
  if(!hypotheticals) return {error: "hypotheticals is required"};
  const collection = env.smart_blocks?.smart_embed ? env.smart_blocks : env.smart_notes;
  console.log(collection);
  if(!collection || !collection.smart_embed) return {error: "Embedding search is not enabled."};
  const embeddings = await collection.smart_embed.embed_batch(hypotheticals.map(h => ({embed_input: h})));
  console.log(embeddings);
  const filter = {
    ...(env.chats?.current?.scope || {}),
    ...(params.filter || {}),
  };
  const results = embeddings.flatMap((embedding, i) => {
    return collection.nearest(embedding.vec, filter);
  });
  // console.log(results);
  // sort by sim sim desc
  results.sort((a, b) => {
    if(a.sim === b.sim) return 0;
    return (a.sim > b.sim) ? -1 : 1;
  });
  // get top K results
  const k = params.k || env.config.lookup_k || 10;
  let top_k = await Promise.all(results.slice(0, k)
    // filter duplicates by r.data.path
    .filter((r, i, a) => a.findIndex(t => t.data.path === r.data.path) === i)
    .map(async r => {
      return {
        score: r.sim,
        path: r.data.path,
      };
    })
  );
  // DO: decided whether to use these functions
  // console.log("nearest before std dev slice", top_k.length);
  // top_k = get_nearest_until_next_dev_exceeds_std_dev(top_k); // tested
  // console.log("nearest after std dev slice", top_k.length);
  // top_k = sort_by_len_adjusted_similarity(top_k); // tested
  console.log(top_k);
  console.log(`Found and returned ${top_k.length} ${collection.collection_name}.`);
  return top_k;
}
exports.lookup = lookup;

  // // IN DEVELOPMENT (Collection.retrieve(strategy, opts))
  // get retrieve_nearest_strategy() {
  //   return [
  //     get_top_k_by_sim,
  //   ];
  // }
  // get retrieve_context_strategy() {
  //   return [
  //     get_top_k_by_sim,
  //     get_nearest_until_next_dev_exceeds_std_dev,
  //     sort_by_len_adjusted_similarity,
  //   ];
  // }

// COSINE SIMILARITY
function cos_sim(vector1, vector2) {
  const dotProduct = vector1.reduce((acc, val, i) => acc + val * vector2[i], 0);
  const normA = Math.sqrt(vector1.reduce((acc, val) => acc + val * val, 0));
  const normB = Math.sqrt(vector2.reduce((acc, val) => acc + val * val, 0));
  return normA === 0 || normB === 0 ? 0 : dotProduct / (normA * normB);
}
function top_acc(_acc, item, ct = 10) {
  if (_acc.items.size < ct) {
    _acc.items.add(item);
  } else if (item.sim > _acc.min) {
    _acc.items.add(item);
    _acc.items.delete(_acc.minItem);
    _acc.minItem = Array.from(_acc.items).reduce((min, curr) => (curr.sim < min.sim ? curr : min));
    _acc.min = _acc.minItem.sim;
  }
}
exports.top_acc = top_acc;

// get nearest until next deviation exceeds std dev
function get_nearest_until_next_dev_exceeds_std_dev(nearest) {
  if(nearest.length === 0) return []; // return empty array if no items
  // get std dev of similarity
  const sims = nearest.map((n) => n.sim);
  const mean = sims.reduce((a, b) => a + b) / sims.length;
  let std_dev = Math.sqrt(sims.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / sims.length);
  // slice where next item deviation is greater than std_dev
  let slice_i = 0;
  while (slice_i < nearest.length) {
    const next = nearest[slice_i + 1];
    if (next) {
      const next_dev = Math.abs(next.sim - nearest[slice_i].sim);
      if (next_dev > std_dev) {
        if (slice_i < 3) std_dev = std_dev * 1.5;
        else break;
      }
    }
    slice_i++;
  }
  // select top results
  nearest = nearest.slice(0, slice_i + 1);
  return nearest;
}
exports.get_nearest_until_next_dev_exceeds_std_dev = get_nearest_until_next_dev_exceeds_std_dev;

// sort by quotient of similarity divided by len DESC
function sort_by_len_adjusted_similarity(nearest) {
  // re-sort by quotient of similarity divided by len DESC
  nearest = nearest.sort((a, b) => {
    const a_score = a.sim / a.tokens;
    const b_score = b.sim / b.tokens;
    // if a is greater than b, return -1
    if (a_score > b_score)
      return -1;
    // if a is less than b, return 1
    if (a_score < b_score)
      return 1;
    // if a is equal to b, return 0
    return 0;
  });
  return nearest;
}
exports.sort_by_len_adjusted_similarity = sort_by_len_adjusted_similarity;

function get_top_k_by_sim(results, opts) {
  return Array.from((results.reduce((acc, item) => {
    if(!item.data.embedding?.vec) return acc; // skip if no vec
    item.sim = cos_sim(opts.vec, item.data.embedding.vec);
    top_acc(acc, item, opts.k); // update acc
    return acc;
  }, { min: 0, items: new Set() })).items);
}
exports.get_top_k_by_sim = get_top_k_by_sim;