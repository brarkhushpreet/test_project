import { NextResponse } from "next/server";
import { checkAndUpdateQuota } from "~/lib/quota";
import { db } from "~/server/db";
import ytdl from "ytdl-core";

// API endpoint for analysis
const API_ENDPOINT = "http://ec2-13-232-39-77.ap-south-1.compute.amazonaws.com";

// Increase payload size limit to 50MB
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Set to 50MB; adjust as needed
    },
  },
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
    
    let analysisData;
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
      
      // Validate URL format
      try {
        new URL(youtubeUrl);
      } catch (e) {
        return NextResponse.json(
          { error: "Invalid YouTube URL format" },
          { status: 400 },
        );
      }
      
      // Call the analysis API with YouTube URL
      const response = await fetch(`${API_ENDPOINT}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl }),
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      analysisData = await response.json();
      
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
      
      // Check file type
      const fileName = uploadedFile.name.toLowerCase();
      if (!fileName.endsWith('.mp4') && !fileName.endsWith('.mov') && !fileName.endsWith('.avi')) {
        return NextResponse.json(
          { error: "Unsupported file format. Please upload MP4, MOV, or AVI." },
          { status: 400 },
        );
      }
      
      // Create new FormData to forward the file
      const apiFormData = new FormData();
      apiFormData.append('video', uploadedFile);
      
      // Call the analysis API with the file
      const response = await fetch(`${API_ENDPOINT}/predict`, {
        method: 'POST',
        body: apiFormData,
      });
      
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      
      analysisData = await response.json();
    }
    
    // Create a record in the database for tracking
    await db.videoFile.create({
      data: {
        key: `upload-${Date.now()}`,
        userId: quota.userId,
        analyzed: true,
      },
    });
    
    // Return the analysis data from the external API
    return NextResponse.json({ analysis: analysisData });
    
  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}