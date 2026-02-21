import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __testing, createWebSearchTool } from "./web-search.js";

const {
  resolveSearxngBaseUrl,
  resolveSearxngApiKey,
  freshnessToSearxngTimeRange,
  stripHtml,
} = __testing;

describe("Web Search: SearXNG", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Configuration resolution", () => {
    it("reads baseUrl from config", () => {
      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
              searxng: { baseUrl: "https://search.example.com/" },
            },
          },
        },
      };
      // @ts-expect-error - testing private/internal function via exported helper
      expect(resolveSearxngBaseUrl(config.tools.web.search.searxng)).toBe(
        "https://search.example.com/",
      );
    });

    it("reads baseUrl from env var", () => {
      process.env.SEARXNG_BASE_URL = "https://env-search.example.com";
      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
            },
          },
        },
      };
      // @ts-expect-error - testing private/internal function via exported helper
      expect(resolveSearxngBaseUrl(config.tools.web.search.searxng)).toBe(
        "https://env-search.example.com",
      );
    });

    it("prefers config over env var for baseUrl", () => {
      process.env.SEARXNG_BASE_URL = "https://env-search.example.com";
      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
              searxng: { baseUrl: "https://config-search.example.com" },
            },
          },
        },
      };
      // @ts-expect-error - testing private/internal function via exported helper
      expect(resolveSearxngBaseUrl(config.tools.web.search.searxng)).toBe(
        "https://config-search.example.com",
      );
    });

    it("reads apiKey from config", () => {
      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
              searxng: { apiKey: "secret-key" },
            },
          },
        },
      };
      // @ts-expect-error - testing private/internal function via exported helper
      expect(resolveSearxngApiKey(config.tools.web.search.searxng)).toBe("secret-key");
    });

    it("reads apiKey from env var", () => {
      process.env.SEARXNG_API_KEY = "env-secret-key";
      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
            },
          },
        },
      };
      // @ts-expect-error - testing private/internal function via exported helper
      expect(resolveSearxngApiKey(config.tools.web.search.searxng)).toBe("env-secret-key");
    });
  });

  describe("Freshness mapping", () => {
    it("maps standard shortcuts to SearXNG time_range", () => {
      expect(freshnessToSearxngTimeRange("pd")).toBe("day");
      expect(freshnessToSearxngTimeRange("pw")).toBe("week");
      expect(freshnessToSearxngTimeRange("pm")).toBe("month");
      expect(freshnessToSearxngTimeRange("py")).toBe("year");
    });

    it("returns undefined for unknown freshness values", () => {
      expect(freshnessToSearxngTimeRange("unknown")).toBeUndefined();
      expect(freshnessToSearxngTimeRange(undefined)).toBeUndefined();
    });
  });

  describe("Content sanitization", () => {
    it("strips HTML tags", () => {
      expect(stripHtml("<b>Bold</b> text")).toBe("Bold text");
      expect(stripHtml("<a href='example.com'>Link</a>")).toBe("Link");
      expect(stripHtml("Plain text")).toBe("Plain text");
      expect(stripHtml("Mixed <i>styles</i> and <br> breaks")).toBe("Mixed styles and  breaks");
    });
  });

  describe("Tool execution", () => {
    it("constructs correct request URL and headers", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { title: "Result 1", url: "http://example.com/1", content: "Description 1" },
          ],
        }),
      } as Response);

      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
              searxng: {
                baseUrl: "https://search.example.com",
                apiKey: "my-api-key",
              },
            },
          },
        },
      };

      const tool = createWebSearchTool({
        // @ts-expect-error - mock config
        config,
      });

      if (!tool) throw new Error("Tool not created");

      await tool.execute("call-id", { query: "test query", freshness: "pw" });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const url = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(url.origin).toBe("https://search.example.com");
      expect(url.pathname).toBe("/search");
      expect(url.searchParams.get("q")).toBe("test query");
      expect(url.searchParams.get("format")).toBe("json");
      expect(url.searchParams.get("time_range")).toBe("week");

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers["X-Self-Hosted-Auth"]).toBe("my-api-key");
      expect(headers["Authorization"]).toBe("Bearer my-api-key");
    });

    it("handles 429 Rate Limit error", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      } as Response);

      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
              searxng: { baseUrl: "https://search.example.com" },
            },
          },
        },
      };

      const tool = createWebSearchTool({
        // @ts-expect-error - mock config
        config,
      });

      if (!tool) throw new Error("Tool not created");

      try {
        await tool.execute("call-id", { query: "test" });
      } catch (error) {
        expect((error as Error).message).toContain(
          "SearXNG API error (429): Too Many Requests",
        );
      }
    });

    it("handles 403 Forbidden error", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response);

      const config = {
        tools: {
          web: {
            search: {
              provider: "searxng",
              searxng: { baseUrl: "https://search.example.com" },
            },
          },
        },
      };

      const tool = createWebSearchTool({
        // @ts-expect-error - mock config
        config,
      });

      if (!tool) throw new Error("Tool not created");

      try {
        await tool.execute("call-id", { query: "test" });
      } catch (error) {
        expect((error as Error).message).toContain(
          "SearXNG API error (403): Forbidden",
        );
      }
    });
  });
});
