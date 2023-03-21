// set module export to be a function to support dependency injection
module.exports = function injectMethod( modifyMe ){

  // inject this method: 
  modifyMe.prototype.computeCosineSimilarity = function (vector1, vector2) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      normA += vector1[i] * vector1[i];
      normB += vector2[i] * vector2[i];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    } else {
      return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
  }
    
  // inject function returns nothing, it just modifies the class

}