import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import defs from "./screenshots.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

const filePath = join(tmpdir(), `asc-shot-${process.pid}.png`);
const contents = Buffer.from("PNG-bytes-screenshot");

beforeAll(() => writeFile(filePath, contents));
afterAll(() => rm(filePath, { force: true }));

describe("screenshots tools", () => {
  it("asc_list_screenshot_sets lists sets with display type", async () => {
    const { run, requests } = await makeToolRig(() => ({
      json: { data: [{ id: "set1", attributes: { screenshotDisplayType: "APP_DESKTOP" } }] },
    }));
    const res = (await run(getTool(defs, "asc_list_screenshot_sets"), { localizationId: "loc1" })) as {
      sets: Array<{ id: string; displayType?: string }>;
    };
    expect(res.sets[0]).toEqual({ id: "set1", displayType: "APP_DESKTOP" });
    expect(requests[0].url).toContain("/appScreenshotSets");
  });

  it("asc_upload_screenshot does reserve → upload → commit with correct checksum", async () => {
    const { run, requests } = await makeToolRig((req) => {
      if (req.method === "POST") {
        return {
          status: 201,
          json: {
            data: {
              id: "shot1",
              attributes: {
                uploadOperations: [
                  {
                    method: "PUT",
                    url: "https://upload.example/part",
                    offset: 0,
                    length: contents.byteLength,
                    requestHeaders: [{ name: "Content-Type", value: "image/png" }],
                  },
                ],
              },
            },
          },
        };
      }
      if (req.method === "PUT") return { status: 200 };
      return { json: { data: { id: "shot1" } } }; // PATCH commit
    });

    const res = (await run(getTool(defs, "asc_upload_screenshot"), {
      screenshotSetId: "set1",
      filePath,
    })) as { id: string; uploaded: boolean };
    expect(res).toEqual({ id: "shot1", uploaded: true });

    // reserve POST
    const reserve = JSON.parse(requests[0].body!);
    expect(requests[0].method).toBe("POST");
    expect(reserve.data.type).toBe("appScreenshots");
    expect(reserve.data.attributes.fileSize).toBe(contents.byteLength);
    expect(reserve.data.relationships.appScreenshotSet.data).toEqual({
      type: "appScreenshotSets",
      id: "set1",
    });
    // upload PUT
    expect(requests[1].method).toBe("PUT");
    expect(requests[1].url).toBe("https://upload.example/part");
    // commit PATCH with md5 checksum
    const commit = JSON.parse(requests[2].body!);
    expect(requests[2].method).toBe("PATCH");
    expect(commit.data.attributes.uploaded).toBe(true);
    expect(commit.data.attributes.sourceFileChecksum).toBe(
      createHash("md5").update(contents).digest("hex"),
    );
  });

  it("asc_delete_screenshot issues DELETE", async () => {
    const { run, requests } = await makeToolRig(() => ({ status: 204 }));
    const res = (await run(getTool(defs, "asc_delete_screenshot"), { screenshotId: "shot1" })) as {
      deleted: boolean;
    };
    expect(res.deleted).toBe(true);
    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url).toContain("/v1/appScreenshots/shot1");
  });
});
