"use client";

import { useState } from "react";

function CodeExamples() {
  const [activeTab, setActiveTab] = useState<"ts" | "curl">("ts");

  const tsCode = `// Direct API call with video file
const formData = new FormData();
formData.append("video", videoFile);

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
console.log("Analysis: ", analysis);`;

  const curlCode = `# Direct API call with video file
curl -X POST \\
  -H "Authorization: Bearer \${YOUR_API_KEY}" \\
  -F "video=@path/to/your/video.mp4" \\
  /api/sentiment-inference

# For direct access to EC2 endpoint (bypassing your authentication)
curl -X POST \\
  -F "video=@path/to/your/video.mp4" \\
  http://ec2-65-1-135-230.ap-south-1.compute.amazonaws.com/predict`;

  return (
    <div className="mt-3 flex h-fit w-full flex-col rounded-xl bg-gray-100 bg-opacity-70 p-4">
      <span className="text-sm">API Usage</span>
      <span className="mb-4 text-sm text-gray-500">
        Examples of how to use the API with TypeScript and cURL.
      </span>

      <div className="overflow-hidden rounded-md bg-gray-900">
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab("ts")}
            className={`px-4 py-2 text-xs ${activeTab === "ts" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-300"}`}
          >
            TypeScript
          </button>
          <button
            onClick={() => setActiveTab("curl")}
            className={`px-4 py-2 text-xs ${activeTab === "curl" ? "bg-gray-800 text-white" : "text-gray-400 hover:text-gray-300"}`}
          >
            cURL
          </button>
        </div>
        <div className="p-4">
          <pre className="max-h-[300px] overflow-y-auto text-xs text-gray-300">
            <code>{activeTab === "ts" ? tsCode : curlCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}

export default CodeExamples;