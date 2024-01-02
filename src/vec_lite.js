export default class {
  constructor(config) {
    this.config = {
      file_name: "embeddings-3.json",
      folder_path: ".vec_lite",
      exists_adapter: null,
      mkdir_adapter: null,
      read_adapter: null,
      rename_adapter: null,
      stat_adapter: null,
      write_adapter: null,
      ...config,
    };
    this.file_name = this.config.file_name;
    this.folder_path = config.folder_path;
    this.file_path = this.folder_path + "/" + this.file_name;
    this.embeddings = false;
  }
  async file_exists(path) {
    if (this.config.exists_adapter) {
      return await this.config.exists_adapter(path);
    } else {
      throw new Error("exists_adapter not set");
    }
  }
  async mkdir(path) {
    if (this.config.mkdir_adapter) {
      return await this.config.mkdir_adapter(path);
    } else {
      throw new Error("mkdir_adapter not set");
    }
  }
  async read_file(path) {
    if (this.config.read_adapter) {
      return await this.config.read_adapter(path);
    } else {
      throw new Error("read_adapter not set");
    }
  }
  async rename(old_path, new_path) {
    if (this.config.rename_adapter) {
      return await this.config.rename_adapter(old_path, new_path);
    } else {
      throw new Error("rename_adapter not set");
    }
  }
  async stat(path) {
    if (this.config.stat_adapter) {
      return await this.config.stat_adapter(path);
    } else {
      throw new Error("stat_adapter not set");
    }
  }
  async write_file(path, data) {
    if (this.config.write_adapter) {
      return await this.config.write_adapter(path, data);
    } else {
      throw new Error("write_adapter not set");
    }
  }
  async load(retries = 0) {
    try {
      const embeddings_file = await this.read_file(this.file_path);
      this.embeddings = JSON.parse(embeddings_file);
      console.log("loaded embeddings file: " + this.file_path);
      return true;
    } catch (error) {
      if (retries < 3) {
        console.log("retrying load()");
        await new Promise((r) => setTimeout(r, 1e3 + 1e3 * retries));
        return await this.load(retries + 1);
      }
      console.log(
        "failed to load embeddings file, prompt user to initiate bulk embed"
      );
      return false;
    }
  }
  async init_embeddings_file() {
    if (!(await this.file_exists(this.folder_path))) {
      await this.mkdir(this.folder_path);
      console.log("created folder: " + this.folder_path);
    } else {
      console.log("folder already exists: " + this.folder_path);
    }
    if (!(await this.file_exists(this.file_path))) {
      await this.write_file(this.file_path, "{}");
      console.log("created embeddings file: " + this.file_path);
    } else {
      console.log("embeddings file already exists: " + this.file_path);
    }
  }
  async save() {
    const embeddings = JSON.stringify(this.embeddings);
    const embeddings_file_exists = await this.file_exists(this.file_path);
    if (embeddings_file_exists) {
      const new_file_size = embeddings.length;
      const existing_file_size = await this.stat(this.file_path).then(
        (stat) => stat.size
      );
      if (new_file_size > existing_file_size * 0.5) {
        await this.write_file(this.file_path, embeddings);
        console.log("embeddings file size: " + new_file_size + " bytes");
      } else {
        const warning_message = [
          "Warning: New embeddings file size is significantly smaller than existing embeddings file size.",
          "Aborting to prevent possible loss of embeddings data.",
          "New file size: " + new_file_size + " bytes.",
          "Existing file size: " + existing_file_size + " bytes.",
          "Restarting Obsidian may fix this.",
        ];
        console.log(warning_message.join(" "));
        await this.write_file(
          this.folder_path + "/unsaved-embeddings.json",
          embeddings
        );
        throw new Error(
          "Error: New embeddings file size is significantly smaller than existing embeddings file size. Aborting to prevent possible loss of embeddings data."
        );
      }
    } else {
      await this.init_embeddings_file();
      return await this.save();
    }
    return true;
  }
  cos_sim(vector1, vector2) {
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
  nearest(to_vec, filter = {}) {
    filter = {
      results_count: 30,
      ...filter,
    };
    let nearest = [];
    const from_keys = Object.keys(this.embeddings);
    for (let i = 0; i < from_keys.length; i++) {
      if (filter.skip_sections) {
        const from_path = this.embeddings[from_keys[i]].meta.path;
        if (from_path.indexOf("#") > -1) continue;
      }
      if (filter.skip_key) {
        if (filter.skip_key === from_keys[i]) continue;
        if (filter.skip_key === this.embeddings[from_keys[i]].meta.parent)
          continue;
      }
      if (filter.path_begins_with) {
        if (
          typeof filter.path_begins_with === "string" &&
          !this.embeddings[from_keys[i]].meta.path.startsWith(
            filter.path_begins_with
          )
        )
          continue;
        if (
          Array.isArray(filter.path_begins_with) &&
          !filter.path_begins_with.some((path) =>
            this.embeddings[from_keys[i]].meta.path.startsWith(path)
          )
        )
          continue;
      }
      nearest.push({
        link: this.embeddings[from_keys[i]].meta.path,
        similarity: this.cos_sim(to_vec, this.embeddings[from_keys[i]].vec),
        size: this.embeddings[from_keys[i]].meta.size,
      });
    }
    nearest.sort(function (a, b) {
      return b.similarity - a.similarity;
    });
    nearest = nearest.slice(0, filter.results_count);
    return nearest;
  }
  find_nearest_embeddings(to_vec, filter = {}) {
    const default_filter = {
      max: this.max_sources,
    };
    filter = { ...default_filter, ...filter };
    if (Array.isArray(to_vec) && to_vec.length !== this.vec_len) {
      this.nearest = {};
      for (let i = 0; i < to_vec.length; i++) {
        this.find_nearest_embeddings(to_vec[i], {
          max: Math.floor(filter.max / to_vec.length),
        });
      }
    } else {
      const from_keys = Object.keys(this.embeddings);
      for (let i = 0; i < from_keys.length; i++) {
        if (this.validate_type(this.embeddings[from_keys[i]])) continue;
        const sim = this.computeCosineSimilarity(
          to_vec,
          this.embeddings[from_keys[i]].vec
        );
        if (this.nearest[from_keys[i]]) {
          this.nearest[from_keys[i]] += sim;
        } else {
          this.nearest[from_keys[i]] = sim;
        }
      }
    }
    let nearest = Object.keys(this.nearest).map((key) => {
      return {
        key,
        similarity: this.nearest[key],
      };
    });
    nearest = this.sort_by_similarity(nearest);
    nearest = nearest.slice(0, filter.max);
    nearest = nearest.map((item) => {
      return {
        link: this.embeddings[item.key].meta.path,
        similarity: item.similarity,
        len:
          this.embeddings[item.key].meta.len ||
          this.embeddings[item.key].meta.size,
      };
    });
    return nearest;
  }
  sort_by_similarity(nearest) {
    return nearest.sort(function (a, b) {
      const a_score = a.similarity;
      const b_score = b.similarity;
      if (a_score > b_score) return -1;
      if (a_score < b_score) return 1;
      return 0;
    });
  }
  // check if key from embeddings exists in files
  clean_up_embeddings(files) {
    console.log("cleaning up embeddings");
    const keys = Object.keys(this.embeddings);
    let deleted_embeddings = 0;
    for (const key of keys) {
      const path = this.embeddings[key].meta.path;
      if (!files.find((file) => path.startsWith(file.path))) {
        delete this.embeddings[key];
        deleted_embeddings++;
        continue;
      }
      if (path.indexOf("#") > -1) {
        const parent_key = this.embeddings[key].meta.parent;
        if (!this.embeddings[parent_key]) {
          delete this.embeddings[key];
          deleted_embeddings++;
          continue;
        }
        if (!this.embeddings[parent_key].meta) {
          delete this.embeddings[key];
          deleted_embeddings++;
          continue;
        }
        if (
          this.embeddings[parent_key].meta.children &&
          this.embeddings[parent_key].meta.children.indexOf(key) < 0
        ) {
          delete this.embeddings[key];
          deleted_embeddings++;
          continue;
        }
      }
    }
    return { deleted_embeddings, total_embeddings: keys.length };
  }
  get(key) {
    return this.embeddings[key] || null;
  }
  get_meta(key) {
    const embedding = this.get(key);
    if (embedding && embedding.meta) {
      return embedding.meta;
    }
    return null;
  }
  get_mtime(key) {
    const meta = this.get_meta(key);
    if (meta && meta.mtime) {
      return meta.mtime;
    }
    return null;
  }
  get_hash(key) {
    const meta = this.get_meta(key);
    if (meta && meta.hash) {
      return meta.hash;
    }
    return null;
  }
  get_size(key) {
    const meta = this.get_meta(key);
    if (meta && meta.size) {
      return meta.size;
    }
    return null;
  }
  get_children(key) {
    const meta = this.get_meta(key);
    if (meta && meta.children) {
      return meta.children;
    }
    return null;
  }
  get_vec(key) {
    const embedding = this.get(key);
    if (embedding && embedding.vec) {
      return embedding.vec;
    }
    return null;
  }
  save_embedding(key, vec, meta) {
    this.embeddings[key] = {
      vec,
      meta,
    };
  }
  mtime_is_current(key, source_mtime) {
    const mtime = this.get_mtime(key);
    if (mtime && mtime >= source_mtime) {
      return true;
    }
    return false;
  }
  async force_refresh() {
    this.embeddings = null;
    this.embeddings = {};
    let current_datetime = Math.floor(Date.now() / 1e3);
    await this.rename(
      this.file_path,
      this.folder_path + "/embeddings-" + current_datetime + ".json"
    );
    await this.init_embeddings_file();
  }
};

