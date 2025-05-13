import { NextResponse } from "next/server";
import { env } from "~/env";
import { checkAndUpdateQuota } from "~/lib/quota";
import { db } from "~/server/db";
import ytdl from "ytdl-core";

// Increase payload size limit to 50MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Set to 50MB; adjust as needed
    },
  },
};

// Dummy data that mimics the response shown in the screenshot
const dummyAnalysisData = {
  "utterances": [
    {
      "emotions": [
        { "confidence": 0.6440509557723999, "label": "surprise" },
        { "confidence": 0.11153298644830029, "label": "disgust" },
        { "confidence": 0.09780463218688648, "label": "sadness" }
      ],
      "end_time": 2.36,
      "sentiments": [
        { "confidence": 0.5041074416931, "label": "negative" }
      ],
      "start_time": 0.0,
      "text": "Oh my god, he's lost to this totally"
    }
  ]
};

export async function POST(req: Request) {
  try {
    // Get API key from the header
    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!apiKey) {
      return NextResponse.json({ error: "API key required" }, { status: 401 });
    }

    // Find the user by API key
    const quota = await db.apiQuota.findUnique({
      where: {
        secretKey: apiKey,
      },
      select: {
        userId: true,
      },
    });

    if (!quota) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Check if user has quota
    const hasQuota = await checkAndUpdateQuota(quota.userId, true);
    if (!hasQuota) {
      return NextResponse.json(
        { error: "Monthly quota exceeded" },
        { status: 429 },
      );
    }

    // Check if the request is JSON (YouTube URL) or FormData (direct file upload)
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // Handle YouTube URL
      const { youtubeUrl } = await req.json();
      
      if (!youtubeUrl) {
        return NextResponse.json(
          { error: "YouTube URL is required" },
          { status: 400 },
        );
      }

      // Validate URL format (simple check)
      try {
        new URL(youtubeUrl);
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid YouTube URL format" },
          { status: 400 },
        );
      }
    } else {
      // Handle direct file upload
      const formData = await req.formData();
      const uploadedFile = formData.get("video");

      if (!uploadedFile || !(uploadedFile instanceof File)) {
        return NextResponse.json(
          { error: "Video file is required" },
          { status: 400 },
        );
      }
      
      // Check file type (optional)
      const fileName = uploadedFile.name.toLowerCase();
      if (!fileName.endsWith('.mp4') && !fileName.endsWith('.mov') && !fileName.endsWith('.avi')) {
        return NextResponse.json(
          { error: "Unsupported file format. Please upload MP4, MOV, or AVI." },
          { status: 400 },
        );
      }
    }

    // Create a record in the database for tracking
    await db.videoFile.create({
      data: {
        key: `upload-${Date.now()}`,
        userId: quota.userId,
        analyzed: true,
      },
    });

    // Simulate processing delay (500ms)
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return dummy data
    return NextResponse.json({ analysis: dummyAnalysisData });
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}