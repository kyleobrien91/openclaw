
import { cleanSchemaForGemini } from "./src/agents/schema/clean-for-gemini.ts";

const schema = {
  type: "object",
  properties: {
    foo: {
      type: "string",
      minLength: 1
    }
  },
  patternProperties: {
    "^[a-z]+$": { type: "string" }
  },
  additionalProperties: false
};

const cleaned = cleanSchemaForGemini(schema);
console.log(JSON.stringify(cleaned, null, 2));
