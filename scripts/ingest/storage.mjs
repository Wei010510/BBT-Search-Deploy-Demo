import { createReadStream, statSync } from "node:fs";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

export function createR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      ".env.local 缺少 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY",
    );
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function uploadVideo(client, bucket, objectKey, localPath) {
  const size = statSync(localPath).size;
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: objectKey,
      Body: createReadStream(localPath),
      ContentType: "video/mp4",
    },
  });

  await upload.done();

  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!base) {
    throw new Error(".env.local 缺少 R2_PUBLIC_BASE_URL");
  }

  return {
    size,
    publicUrl: `${base}/${objectKey}`,
  };
}
