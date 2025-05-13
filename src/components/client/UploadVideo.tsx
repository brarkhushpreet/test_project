"use client";

import { useState, useRef } from "react";
import { FiUpload } from "react-icons/fi";
import { FaYoutube } from "react-icons/fa";
import { Analysis } from "./Inference";
import ContentModeration from "./ContentModerationComponent";

interface UploadVideoProps {
  apiKey: string;
  onAnalysis: (analysis: Analysis) => void;
}

function UploadVideo({ apiKey, onAnalysis }: UploadVideoProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "analyzing" | "moderating">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>("");
  const [showYoutubeInput, setShowYoutubeInput] = useState<boolean>(false);
  const [moderationResult, setModerationResult] = useState<any>(null);
  const [rawAnalysis, setRawAnalysis] = useState<Analysis | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeWithGemini = async (analysisData: Analysis) => {
    try {
      setStatus("moderating");
      
      // Prepare data for Gemini API
      const utterances = analysisData.analysis.utterances;
      
      // Create a comprehensive prompt for content moderation
      const prompt = `
        As a content moderation AI, analyze this video transcript data for any problematic content:
        
        ${utterances.map((u: any, i: number) => `
        Utterance ${i+1} (${u.start_time}s - ${u.end_time}s): "${u.text}"
        - Dominant emotions: ${u.emotions.slice(0, 2).map((e: any) => `${e.label} (${(e.confidence * 100).toFixed(1)}%)`).join(', ')}
        - Sentiment: ${u.sentiments[0]?.label} (${(u.sentiments[0]?.confidence * 100).toFixed(1)}%)
        `).join('\n')}
        
        Please evaluate if this content contains any of the following:
        1. Hate speech or discrimination
        2. Explicit or violent content
        3. Harassment or bullying
        4. Misinformation
        5. Content that violates community guidelines
        
        For each category, provide a YES/NO determination and brief explanation.
        Then provide an overall assessment on whether this content is suitable for social media platforms.
        Rate the overall content risk on a scale of 1-10 (1 being completely safe, 10 being highly problematic).
      `;

      // Call to Gemini API
      const response = await fetch("/api/gemini-moderation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze with Gemini");
      }

      const moderationData = await response.json();
      setModerationResult(moderationData);
      
      // Call the original onAnalysis with the raw sentiment data
      onAnalysis(analysisData);
      
      setStatus("idle");
    } catch (error) {
      console.error("Gemini analysis failed:", error);
      setError(error instanceof Error ? error.message : "Moderation analysis failed");
      setStatus("idle");
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setStatus("analyzing");
      setError(null);
      setModerationResult(null);
      
      // Create object URL for the video file
      const objectUrl = URL.createObjectURL(file);
      setVideoSrc(objectUrl);

      // Create FormData
      const formData = new FormData();
      formData.append("video", file);

      // Send directly to our API endpoint
      const analysisRes = await fetch("/api/sentiment-inference", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
        },
        body: formData,
      });

      if (!analysisRes.ok) {
        const errorData = await analysisRes.json();
        throw new Error(errorData?.error || "Failed to analyze video");
      }

      const analysis = await analysisRes.json();
      setRawAnalysis(analysis);
      console.log("Analysis: ", analysis);
      
      // Now process with Gemini
      await analyzeWithGemini(analysis);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Upload failed");
      console.error("Upload failed", error);
      setStatus("idle");
    }
  };

  const handleYoutubeAnalysis = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!youtubeUrl) {
      setError("Please enter a YouTube URL");
      return;
    }

    try {
      setStatus("analyzing");
      setError(null);
      setModerationResult(null);
      
      // For YouTube videos, we'll set the videoSrc to the YouTube URL
      // This assumes our ContentModeration component can handle YouTube embeds
      // Alternatively, we could use a YouTube thumbnail as a placeholder
      setVideoSrc(youtubeUrl);

      // Send YouTube URL to our API endpoint as JSON
      const analysisRes = await fetch("/api/sentiment-inference", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ youtubeUrl }),
      });

      if (!analysisRes.ok) {
        const errorData = await analysisRes.json();
        throw new Error(errorData?.error || "Failed to analyze YouTube video");
      }

      const analysis = await analysisRes.json();
      setRawAnalysis(analysis);
      console.log("Analysis: ", analysis);
      
      // Now process with Gemini
      await analyzeWithGemini(analysis);
      setYoutubeUrl("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "YouTube analysis failed");
      console.error("YouTube analysis failed", error);
      setStatus("idle");
    }
  };

  const toggleInputMethod = () => {
    setShowYoutubeInput(!showYoutubeInput);
    setError(null);
    setVideoSrc(null);
    
    // Reset file input when switching methods
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Clean up the object URL when component unmounts or when videoSrc changes
  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex justify-end mb-2">
        {/* <button
          type="button"
          onClick={toggleInputMethod}
          className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          {showYoutubeInput ? (
            <>Upload a video file instead</>
          ) : (
            <>Use YouTube URL instead</>  
          )}
        </button> */}
      </div>

      {showYoutubeInput ? (
        <div className="w-full rounded-xl border border-dashed border-gray-300 p-6">
          <form onSubmit={handleYoutubeAnalysis} className="flex flex-col gap-4">
            <div className="flex items-center justify-center mb-2">
              <FaYoutube className="text-red-600 text-3xl mr-2" />
              <h3 className="text-md from-indigo-50 text-slate-800">
                Analyze YouTube Video
              </h3>
            </div>
            <p className="text-center text-xs text-gray-500 mb-2">
              Enter a YouTube URL to analyze the video's sentiment and check for policy violations.
            </p>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              disabled={status !== "idle"}
            />
            <button
              type="submit"
              className="w-full rounded-md bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none disabled:bg-blue-400"
              disabled={status !== "idle"}
            >
              {status === "analyzing" ? "Analyzing..." : 
               status === "moderating" ? "Processing content..." : 
               "Analyze Content"}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 p-10">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/mov,video/avi"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
            id="video-upload"
            disabled={status !== "idle"}
          />
          <label
            htmlFor="video-upload"
            className="flex cursor-pointer flex-col items-center"
          >
            <FiUpload className="min-h-8 min-w-8 text-gray-400" />
            <h3 className="text-md mt-2 from-indigo-50 text-slate-800">
              {status === "analyzing" ? "Analyzing video..." : 
               status === "moderating" ? "Moderating content..." : 
               "Upload a video"}
            </h3>
            <p className="text-center text-xs text-gray-500">
              Get started with advanced content moderation by uploading a video.
            </p>
          </label>
        </div>
      )}
      
      {error && <div className="text-sm text-red-500">{error}</div>}
      
      {moderationResult && <ContentModeration result={moderationResult} rawAnalysis={rawAnalysis} videoSrc={videoSrc} />}
    </div>
  );
}

import { useEffect } from "react";
export default UploadVideo;