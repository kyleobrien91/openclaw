
import { describe, it, expect } from "vitest";
import { cleanSchemaForGemini } from "./clean-for-gemini";

describe("cleanSchemaForGemini (recursion)", () => {
  it("removes patternProperties from nested object", () => {
    const schema = {
      type: "object",
      properties: {
        env: {
          type: "object",
          patternProperties: {
            "^[a-zA-Z_][a-zA-Z0-9_]*$": { type: "string" },
          },
        },
      },
    };

    const cleaned = cleanSchemaForGemini(schema) as any;
    expect(cleaned.properties.env.patternProperties).toBeUndefined();
    expect(cleaned.properties.env.type).toBe("object");
  });

  it("removes minimum from nested number", () => {
    const schema = {
      type: "object",
      properties: {
        timeout: {
          type: "number",
          minimum: 1,
        },
      },
    };

    const cleaned = cleanSchemaForGemini(schema) as any;
    expect(cleaned.properties.timeout.minimum).toBeUndefined();
    expect(cleaned.properties.timeout.type).toBe("number");
  });

  it("removes additionalProperties from items", () => {
    const schema = {
      type: "object",
      properties: {
        fields: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
          },
        },
      },
    };

    const cleaned = cleanSchemaForGemini(schema) as any;
    expect(cleaned.properties.fields.items.additionalProperties).toBeUndefined();
  });

  it("removes unsupported keywords from unknown/generic keywords (like 'not')", () => {
     const schema = {
        type: "object",
        not: {
           type: "object",
           additionalProperties: false
        }
     };
     const cleaned = cleanSchemaForGemini(schema) as any;
     expect(cleaned.not.additionalProperties).toBeUndefined();
  });

  it("removes unsupported keywords from if/then/else", () => {
     const schema = {
        type: "object",
        if: { properties: { foo: { type: "string", minLength: 1 } } },
        then: { properties: { bar: { type: "number", maximum: 10 } } },
        else: { properties: { baz: { type: "array", minItems: 1 } } }
     };
     const cleaned = cleanSchemaForGemini(schema) as any;
     expect(cleaned.if.properties.foo.minLength).toBeUndefined();
     expect(cleaned.then.properties.bar.maximum).toBeUndefined();
     expect(cleaned.else.properties.baz.minItems).toBeUndefined();
  });
});
