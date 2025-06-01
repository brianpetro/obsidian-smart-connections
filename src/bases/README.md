# Functions
### Numbers 
#### `cos_sim()`
- `cos_sim(file, compared_to)` returns the cosine similarity between the vector embeddings of two notes.
- The **first argument** is usually `file.file` (the note currently being evaluated).
- The **second argument** is a file path or file reference to compare against.
	- may be `this.file.file` for dynamically comparing to the current active file
	- Returns a decimal between **-1 and 1**, rounded to three decimal places.
	- If Smart Environment has not finished loading, the function temporarily returns `"Loading..."`; if either file lacks an embedding, it returns `0`.