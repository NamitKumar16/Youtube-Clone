import { db } from "@/db";
import { videos } from "@/db/schema";
import { serve } from "@upstash/workflow/nextjs";
import { and, eq } from "drizzle-orm";

interface InputType {
  userId: string;
  videoId: string;
}

const TITLE_SYSTEM_PROMPT = `Your task is to generate an SEO-focused title for a YouTube video based on its transcript. Please follow these guidelines:
- Be concise but descriptive, using relevant keywords to improve discoverability.
- Highlight the most compelling or unique aspect of the video content.
- Avoid jargon or overly complex language unless it directly supports searchability.
- Use action-oriented phrasing or clear value propositions where applicable.
- Ensure the title is 3-8 words long and no more than 100 characters.
- Only return the title itself. Do not include:
  - Quotes
  - Character count
  - Explanations
  - Markdown or formatting;
- Do not wrap the title in quotes`;

export const { POST } = serve(async (context) => {
  const input = context.requestPayload as InputType;
  const { userId, videoId } = input;

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

  const transcript = await context.run("get-transcript", async () => {
    const trackUrl = `https://stream.mux.com/${video.muxPlaybackId}/text/${video.muxTrackId}.txt`;
    const response = await fetch(trackUrl);
    const text = response.text();

    if (!text) {
      throw new Error("Bad Request: Transcript not found");
    }

    return text;
  });

  const openRouterResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OR_API_KEY!}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-nano-30b-a3b:free",
        messages: [
          {
            role: "system",
            content: TITLE_SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: transcript || "Hi!",
          },
        ],
      }),
    },
  );

  if (!openRouterResponse.ok) {
     throw new Error("Failed to get title from OpenRouter");
  }

  const responseJson = await openRouterResponse.json();
  const raw = responseJson.choices[0].message.content ?? "";
  const title = raw
    .replace(/^"(.*)"$/, "$1")
    .replace(/^'(.*)'$/, "$1")
    .replace(/\(\d+\s*characters\)/i, "")
    .trim();

  await context.run("update-video", async () => {
    await db
      .update(videos)
      .set({
        title: title || video.title,
      })
      .where(
        and(eq(videos.id, (await video).id), eq(videos.userId, video.userId)),
      );
  });
});
