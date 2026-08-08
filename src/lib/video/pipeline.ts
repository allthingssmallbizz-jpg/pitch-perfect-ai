// Staged async pipeline for Agent Annie's video analysis path: download -> transcribe ->
// extract frames -> analyze -> record result. Runs inside a Next.js `after()` callback (see
// src/app/api/analyze/video/process/route.ts) so it isn't bound by the HTTP request/response
// cycle, only by the route's `maxDuration`. Uses the admin client throughout — this executes
// after the response has been sent, so there's no user session/cookies to read from.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createAdminClient } from "@/lib/supabase/admin";
import { getVideoDurationSeconds, extractAudio, chunkAudio, extractFrameAt } from "@/lib/video/ffmpeg";
import {
  transcribeChunk,
  formatTranscript,
  estimateSpeakingPaceWpm,
  estimateTranscriptionCostUsd,
  type TranscriptSegment,
} from "@/lib/video/transcription";
import { generateAsset, type ImageInput } from "@/lib/ai/anthropic";
import { getAnalyzerSystemPrompt } from "@/lib/ai/analyzer";
import {
  VIDEO_ANALYZER_CREDIT_COST,
  VIDEO_ANALYZER_MAX_OUTPUT_TOKENS,
  VIDEO_MAX_DURATION_SECONDS,
  VIDEO_CHUNK_SECONDS,
  computeFrameTimestamps,
  buildVideoAnalyzerUserPrompt,
} from "@/lib/ai/videoAnalyzer";
import { decrementCredits } from "@/lib/credits";
import { recordGenerationVersion } from "@/lib/generations";
import type { Generation, PresentationType } from "@/types/database";

export async function runVideoAnalysisPipeline(params: {
  generationId: string;
  userId: string;
  presentationType: PresentationType;
  videoPath: string;
}): Promise<void> {
  const { generationId, userId, presentationType, videoPath } = params;
  const admin = createAdminClient();
  const workDir = path.join(os.tmpdir(), "video-analysis", generationId);

  async function updateGeneration(fields: Partial<Generation>) {
    await admin.from("generations").update(fields).eq("id", generationId);
  }

  try {
    await fs.mkdir(workDir, { recursive: true });

    // 1. Download the uploaded video from Storage.
    const ext = path.extname(videoPath) || ".mp4";
    const sourcePath = path.join(workDir, `source${ext}`);
    const { data: videoBlob, error: downloadError } = await admin.storage
      .from("presentation-videos")
      .download(videoPath);
    if (downloadError || !videoBlob) {
      throw new Error(`Could not read the uploaded video: ${downloadError?.message ?? "not found"}`);
    }
    const videoBuffer = Buffer.from(await videoBlob.arrayBuffer());
    await fs.writeFile(sourcePath, videoBuffer);

    // 2. Probe duration and enforce the length cap before spending anything on transcription.
    const durationSeconds = await getVideoDurationSeconds(sourcePath);
    if (durationSeconds > VIDEO_MAX_DURATION_SECONDS) {
      throw new Error(
        `Video is ${Math.round(durationSeconds / 60)} minutes — longer than the ${Math.round(VIDEO_MAX_DURATION_SECONDS / 60)}-minute limit. Trim it and re-upload.`
      );
    }

    await updateGeneration({
      status: "transcribing",
      progress_message: "Extracting and transcribing audio...",
      video_duration_seconds: Math.round(durationSeconds),
      video_size_bytes: videoBuffer.byteLength,
    });

    // 3. Extract + chunk audio, then transcribe each chunk in parallel and stitch on one timeline.
    const audioPath = path.join(workDir, "audio.mp3");
    await extractAudio(sourcePath, audioPath);

    const chunksDir = path.join(workDir, "chunks");
    await fs.mkdir(chunksDir, { recursive: true });
    const chunkPaths = await chunkAudio(audioPath, chunksDir, VIDEO_CHUNK_SECONDS);

    const chunkResults = await Promise.all(
      chunkPaths.map((chunkPath, i) => transcribeChunk(chunkPath, i * VIDEO_CHUNK_SECONDS))
    );
    const segments: TranscriptSegment[] = chunkResults.flat().sort((a, b) => a.start - b.start);
    const transcript = formatTranscript(segments);
    const speakingPaceWpm = estimateSpeakingPaceWpm(segments);
    const transcriptionCostUsd = estimateTranscriptionCostUsd(durationSeconds);

    await updateGeneration({
      status: "extracting_frames",
      progress_message: "Sampling video frames for visual review...",
      transcript,
      transcription_cost_usd: transcriptionCostUsd,
    });

    // 4. Sample frames spread across the runtime for visual/delivery signal.
    const framesDir = path.join(workDir, "frames");
    await fs.mkdir(framesDir, { recursive: true });
    const timestamps = computeFrameTimestamps(durationSeconds);
    const images: ImageInput[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const framePath = path.join(framesDir, `frame_${i}.jpg`);
      await extractFrameAt(sourcePath, framePath, timestamps[i]);
      const frameBuffer = await fs.readFile(framePath);
      images.push({ base64: frameBuffer.toString("base64"), mediaType: "image/jpeg" });
    }

    await updateGeneration({ status: "analyzing", progress_message: "Running the full conversion review..." });

    // 5. Run the analysis itself — same rubric/persona as the text path, vision-enabled.
    const userPrompt = buildVideoAnalyzerUserPrompt(presentationType, transcript, durationSeconds, speakingPaceWpm, images.length);
    const result = await generateAsset(getAnalyzerSystemPrompt(), userPrompt, VIDEO_ANALYZER_MAX_OUTPUT_TOKENS, images);

    await updateGeneration({
      status: "complete",
      progress_message: null,
      content: result.content,
      model: result.model,
      input_tokens: result.inputTokens,
      output_tokens: result.outputTokens,
      cost_usd: result.costUsd + transcriptionCostUsd,
    });

    await recordGenerationVersion(generationId, userId, result.content, "generate", "Generated video analysis");
    await decrementCredits(userId, VIDEO_ANALYZER_CREDIT_COST);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Video analysis failed";
    await updateGeneration({ status: "failed", progress_message: null, error: message });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
