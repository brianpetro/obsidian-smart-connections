import test from 'ava';
import { json_ref_resolve } from './json_ref_resolve.js';

const schema = {
  "definitions": {
      "address": {
          "type": "object",
          "properties": {
              "street": { "type": "string" },
              "city": { "type": "string" }
          }
      }
  },
  "type": "object",
  "properties": {
      "billingAddress": { "$ref": "#/definitions/address" },
      "shippingAddress": { "$ref": "#/definitions/address" }
  }
};

test('should resolve refs', t => {
  const resolvedSchema = json_ref_resolve(schema);
  console.log(JSON.stringify(resolvedSchema, null, 2));
  t.is(resolvedSchema.properties.billingAddress.properties.street.type, 'string');
});
test('should skip missing refs', t => {
  const schema = {
    "type": "object",
    "properties": {
      "billingAddress": { "$ref": "#/definitions/address" },
      "shippingAddress": { "$ref": "#/definitions/address" }
    }
  };
  const resolvedSchema = json_ref_resolve(schema);
  console.log(JSON.stringify(resolvedSchema, null, 2));
  t.deepEqual(resolvedSchema.properties.billingAddress, {"$ref": "#/definitions/address"});
});