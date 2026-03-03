import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { and, eq } from "drizzle-orm";
import { UTApi } from "uploadthing/server";
interface InputType {
  userId: string;
  videoId: string;
  prompt: string;
}

export const { POST } = serve(async (context) => {
  const input = context.requestPayload as InputType;
  const { userId, videoId, prompt } = input;
  const utapi = new UTApi();

  const video = await context.run("get-video", async () => {
    const [existingVideo] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));

    if (!existingVideo) {
      throw new Error("Not found");
    }

    return existingVideo;
  });

  const workerResponse = await fetch(process.env.CF_WORKER_URL!, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.CF_WORKER_API_KEY}`,
    },
    body: JSON.stringify({ prompt }),
  });

  if (!workerResponse.ok) {
    const errorText = await workerResponse.text();
    console.error("Cloudflare Worker error:", errorText);
    throw new Error("Thumbnail generation failed");
  }

  const imageBuffer = await workerResponse.arrayBuffer();
  await context.run("cleanup-thumbnail", async () => {
    if (video.thumbnailKey) {
      await utapi.deleteFiles(video.thumbnailKey);
      await db
        .update(videos)
        .set({
          thumbnailKey: null,
          thumbnailUrl: null,
        })
        .where(and(eq(videos.id, videoId), eq(videos.userId, userId)));
    }
  });

  const uploadedThumbnail = await context.run("upload-thumbnail", async () => {
    const blob = new Blob([imageBuffer], { type: "image/png" });

    // Cast to File-like object
    const file = Object.assign(blob, {
      name: `thumbnail-${videoId}.png`,
    });

    const result = await utapi.uploadFiles(file);

    if (!result?.data) {
      throw new Error("Upload failed");
    }

    return result.data;
  });

  await context.run("update-video", async () => {
    await db
      .update(videos)
      .set({
        thumbnailKey: uploadedThumbnail.key,
        thumbnailUrl: uploadedThumbnail.url,
      })
      .where(and(eq(videos.id, video.id), eq(videos.userId, video.userId)));
  });
});
