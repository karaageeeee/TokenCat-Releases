import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { AscClient, UploadOperation } from "../client/ascClient.js";

interface ReserveResponse {
  data: {
    id: string;
    attributes?: { uploadOperations?: UploadOperation[] };
  };
}

export interface AssetUploadParams {
  /** Reservation collection path, e.g. "/v1/appScreenshots". */
  reservePath: string;
  /** JSON:API resource type, e.g. "appScreenshots". */
  resourceType: string;
  /** Parent relationship, e.g. { name: "appScreenshotSet", type: "appScreenshotSets", id }. */
  relationship: { name: string; type: string; id: string };
  /** Absolute path to the asset file to upload. */
  filePath: string;
  /** Extra attributes to send on the reservation (e.g. mimeType for previews). */
  reserveAttributes?: Record<string, unknown>;
  /** Extra attributes to send on the commit PATCH (e.g. previewFrameTimeCode). */
  commitAttributes?: Record<string, unknown>;
}

/**
 * Run the App Store Connect asset upload flow:
 *   1. reserve (POST) — declares fileName + fileSize, returns uploadOperations
 *   2. PUT each chunk (via client.uploadAsset)
 *   3. commit (PATCH) — uploaded:true + sourceFileChecksum (MD5)
 *
 * Shared by screenshots and previews. Returns the committed resource id.
 */
export async function uploadAsset(
  client: AscClient,
  params: AssetUploadParams,
): Promise<{ id: string }> {
  const data = await readFile(params.filePath);
  const fileName = params.filePath.split("/").pop() ?? "asset";

  const reserved = await client.request<ReserveResponse>(params.reservePath, {
    method: "POST",
    body: {
      data: {
        type: params.resourceType,
        attributes: { fileName, fileSize: data.byteLength, ...params.reserveAttributes },
        relationships: {
          [params.relationship.name]: {
            data: { type: params.relationship.type, id: params.relationship.id },
          },
        },
      },
    },
  });

  const id = reserved.data.id;
  const operations = reserved.data.attributes?.uploadOperations ?? [];
  await client.uploadAsset(operations, data);

  const checksum = createHash("md5").update(data).digest("hex");
  await client.request(`${params.reservePath}/${id}`, {
    method: "PATCH",
    body: {
      data: {
        type: params.resourceType,
        id,
        attributes: { uploaded: true, sourceFileChecksum: checksum, ...params.commitAttributes },
      },
    },
  });

  return { id };
}
