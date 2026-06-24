import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import defs from "./previews.tool.js";
import { getTool, makeToolRig } from "../../../test/toolHarness.js";

const filePath = join(tmpdir(), `asc-preview-${process.pid}.mp4`);
const contents = Buffer.from("MP4-bytes-preview");

beforeAll(() => writeFile(filePath, contents));
afterAll(() => rm(filePath, { force: true }));

describe("previews tools", () => {
  it("asc_upload_preview passes mimeType on reserve and frame time code on commit", async () => {
    const { run, requests } = await makeToolRig((req) => {
      if (req.method === "POST") {
        return {
          status: 201,
          json: {
            data: {
              id: "prev1",
              attributes: {
                uploadOperations: [
                  { method: "PUT", url: "https://upload.example/p", offset: 0, length: contents.byteLength },
                ],
              },
            },
          },
        };
      }
      if (req.method === "PUT") return { status: 200 };
      return { json: { data: { id: "prev1" } } };
    });

    await run(getTool(defs, "asc_upload_preview"), {
      previewSetId: "pset1",
      filePath,
      mimeType: "video/mp4",
      previewFrameTimeCode: "00:00:05:00",
    });

    const reserve = JSON.parse(requests[0].body!);
    expect(reserve.data.type).toBe("appPreviews");
    expect(reserve.data.attributes.mimeType).toBe("video/mp4");
    expect(reserve.data.relationships.appPreviewSet.data.id).toBe("pset1");

    const commit = JSON.parse(requests[2].body!);
    expect(commit.data.attributes.uploaded).toBe(true);
    expect(commit.data.attributes.previewFrameTimeCode).toBe("00:00:05:00");
  });

  it("asc_delete_preview issues DELETE", async () => {
    const { run, requests } = await makeToolRig(() => ({ status: 204 }));
    await run(getTool(defs, "asc_delete_preview"), { previewId: "prev1" });
    expect(requests[0].method).toBe("DELETE");
    expect(requests[0].url).toContain("/v1/appPreviews/prev1");
  });
});
