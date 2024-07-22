export function json_ref_resolve(schema, rootSchema = null) {
  rootSchema = rootSchema || schema; // Set the root schema context

  if (typeof schema === 'object' && !Array.isArray(schema) && schema !== null) {
      if (schema.hasOwnProperty('$ref')) {
          const refPath = schema['$ref'];
          try {
            const resolvedSchema = get_schema_by_path(rootSchema, refPath);
            return json_ref_resolve(resolvedSchema, rootSchema);
          } catch (e) {
            console.log(`Error resolving ref: ${refPath}`, e);
            return schema;
          }
      } else {
          Object.keys(schema).forEach(key => {
              schema[key] = json_ref_resolve(schema[key], rootSchema);
          });
      }
  }

  return schema;
}

function get_schema_by_path(rootSchema, path) {
  const parts = path.split('/').slice(1); // remove the first empty string from `#/definitions/example`
  let currentSchema = rootSchema;
  for (let part of parts) {
      currentSchema = currentSchema[part];
      if (!currentSchema) {
          throw new Error(`Reference not found: ${path}`);
      }
  }
  return currentSchema;
}