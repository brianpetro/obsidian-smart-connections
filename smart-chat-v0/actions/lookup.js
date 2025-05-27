/**
 * @openapi
 * /lookup:
 *   post:
 *     operationId: lookup
 *     summary: Semantic search
 *     description: "Performs a semantic search of the user's data. Required: hypothetical_1 and hypothetical_2. Optional: hypothetical_3."
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               hypothetical_1:
 *                 type: string
 *                 description: "Short hypothetical notes predicted to be semantically similar to the notes necessary to fulfill the user's request. At least three hypotheticals per request. The hypothetical notes may contain paragraphs, lists, or checklists in markdown format. Hypothetical notes always begin with breadcrumbs containing the anticipated folder(s), file name, and relevant headings separated by ' > ' (no slashes). Format: PARENT FOLDER NAME > CHILD FOLDER NAME > FILE NAME > HEADING 1 > HEADING 2 > HEADING 3: HYPOTHETICAL NOTE CONTENTS."
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
export async function lookup(env, params={}) {
  const { hypotheticals = [], hypothetical_1, hypothetical_2, hypothetical_3, ...other_params } = params;
  if(hypothetical_1) hypotheticals.push(hypothetical_1);
  if(hypothetical_2) hypotheticals.push(hypothetical_2);
  if(hypothetical_3) hypotheticals.push(hypothetical_3);
  if(!hypotheticals) return {error: "hypotheticals is required"};
  const collection = env.smart_blocks?.smart_embed ? env.smart_blocks : env.smart_sources;
  return await collection.lookup({...(other_params || {}), hypotheticals});
}

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


// get nearest until next deviation exceeds std dev
export function get_nearest_until_next_dev_exceeds_std_dev(nearest) {
  if(nearest.length === 0) return []; // return empty array if no items
  // get std dev of similarity
  const sims = nearest.map((n) => n.score);
  const mean = sims.reduce((a, b) => a + b) / sims.length;
  let std_dev = Math.sqrt(sims.map((x) => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / sims.length);
  // slice where next item deviation is greater than std_dev
  let slice_i = 0;
  while (slice_i < nearest.length) {
    const next = nearest[slice_i + 1];
    if (next) {
      const next_dev = Math.abs(next.score - nearest[slice_i].score);
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

// sort by quotient of similarity divided by len DESC
export function sort_by_len_adjusted_similarity(nearest) {
  // re-sort by quotient of similarity divided by len DESC
  nearest = nearest.sort((a, b) => {
    const a_score = a.score / a.tokens;
    const b_score = b.score / b.tokens;
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

