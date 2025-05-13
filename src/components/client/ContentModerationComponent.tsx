"use client";

import { useEffect, useState, useRef } from "react";
import { FaExclamationTriangle, FaCheckCircle, FaChevronDown, FaChevronUp, FaFlag, FaPlay, FaPause, FaVideo, FaFileAlt, FaSmile } from "react-icons/fa";
import { Analysis } from "./Inference";
import { useRouter, useSearchParams } from "next/navigation";

interface ContentModerationProps {
  result: any;
  rawAnalysis: Analysis | null;
  videoSrc?: string | null;
}

interface TimestampMarker {
  timestamp: string;
  issue: string;
  category: string;
  severity: number;
}

type TabType = "video" | "report" | "sentiment";

const ContentModeration: React.FC<ContentModerationProps> = ({ result, rawAnalysis, videoSrc }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const initialTab = (searchParams.get("tab") as TabType) || "video";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [expanded, setExpanded] = useState<boolean>(true);
  const [expandedTimestamps, setExpandedTimestamps] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [showTooltip, setShowTooltip] = useState<boolean>(false);
  const [tooltipContent, setTooltipContent] = useState<{issue: string, category: string, severity: number}>({
    issue: "", 
    category: "", 
    severity: 0
  });
  const [tooltipPosition, setTooltipPosition] = useState<{left: number, top: number}>({left: 0, top: 0});
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  
  // Extract risk score from the response
  const riskScore = result?.moderationScore || 5; // Default to medium if not provided
  
  // Extract timestamp markers
  const timestampMarkers: TimestampMarker[] = result?.keyTimestamps || [];
  
  // Determine risk level based on the score
  const getRiskLevel = (score: number) => {
    if (score <= 3) return { level: "Low Risk", color: "green" };
    if (score <= 6) return { level: "Medium Risk", color: "orange" };
    return { level: "High Risk", color: "red" };
  };
  
  const riskInfo = getRiskLevel(riskScore);
  
  // Update URL with tab parameter
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", activeTab);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [activeTab, router, searchParams]);
  
  // Handle video time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };
    
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    const handlePlay = () => {
      setIsPlaying(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };
    
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);
  
  // Get category color and icon
  const getCategoryInfo = (category: string) => {
    switch (category) {
      case "HATE_SPEECH":
        return { color: "red-600", bgColor: "#FEE2E2", label: "Hate Speech", icon: "⚠️" };
      case "EXPLICIT":
        return { color: "pink-600", bgColor: "#FCE7F3", label: "Explicit Content", icon: "🔞" };
      case "HARASSMENT":
        return { color: "orange-500", bgColor: "#FFEDD5", label: "Harassment", icon: "👊" };
      case "MISINFORMATION":
        return { color: "yellow-500", bgColor: "#FEF3C7", label: "Misinformation", icon: "❓" };
      case "GUIDELINES":
        return { color: "blue-500", bgColor: "#DBEAFE", label: "Policy Violation", icon: "📜" };
      default:
        return { color: "gray-500", bgColor: "#F3F4F6", label: "Issue", icon: "⚠️" };
    }
  };
  
  // Handle play/pause 
  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };
  
  // Handle seeking
  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const seekBar = seekBarRef.current;
    const video = videoRef.current;
    if (!seekBar || !video) return;
    
    const rect = seekBar.getBoundingClientRect();
    const position = (e.clientX - rect.left) / rect.width;
    const seekTime = position * duration;
    
    if (video && !isNaN(seekTime)) {
      video.currentTime = seekTime;
    }
  };
  
  // Handle hover on seekbar
  const handleSeekBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const seekBar = seekBarRef.current;
    if (!seekBar) return;
    
    const rect = seekBar.getBoundingClientRect();
    const hoverPosition = (e.clientX - rect.left) / rect.width;
    const hoverTime = hoverPosition * duration;
    
    // Check if any marker is at this position
    const hoveredMarker = timestampMarkers.find(marker => {
      const [start, end] = marker.timestamp.split('-').map(parseFloat);
      return hoverTime >= start && hoverTime <= end;
    });
    
    if (hoveredMarker) {
      setTooltipContent({
        issue: hoveredMarker.issue,
        category: hoveredMarker.category,
        severity: hoveredMarker.severity
      });
      setTooltipPosition({
        left: e.clientX,
        top: rect.top - 70 // Position above the seekbar
      });
      setShowTooltip(true);
    } else {
      setShowTooltip(false);
    }
  };
  
  // Format time display (seconds to MM:SS)
  const formatTime = (time: number): string => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };
  
  // Handle clicking on a timestamp to jump to that point in the video
  const handleTimestampClick = (timestamp: string) => {
    const video = videoRef.current;
    if (!video) return;
    
    const startTime = parseFloat(timestamp.split('-')[0]);
    video.currentTime = startTime;
    if (video.paused) {
      video.play();
    }
    
    // Switch to video tab when clicking on a timestamp
    setActiveTab("video");
  };
  
  function summarizeModeration(text: string) {
    // Extract key findings from the Gemini response
    const sections = [];
    
    // Look for hate speech
    if (text.match(/HATE SPEECH|1\.\s+/i)) {
      const isDetected = text.match(/HATE SPEECH.*?(YES|TRUE|DETECTED)/i) !== null;
      sections.push({
        title: "Hate Speech",
        detected: isDetected,
        description: extractSentenceContaining(text, "hate speech", 2)
      });
    }
    
    // Look for explicit content
    if (text.match(/EXPLICIT CONTENT|2\.\s+/i)) {
      const isDetected = text.match(/EXPLICIT CONTENT.*?(YES|TRUE|DETECTED)/i) !== null;
      sections.push({
        title: "Explicit Content",
        detected: isDetected,
        description: extractSentenceContaining(text, "explicit", 2)
      });
    }
    
    // Look for harassment
    if (text.match(/HARASSMENT|3\.\s+/i)) {
      const isDetected = text.match(/HARASSMENT.*?(YES|TRUE|DETECTED)/i) !== null;
      sections.push({
        title: "Harassment",
        detected: isDetected,
        description: extractSentenceContaining(text, "harass", 2)
      });
    }
    
    // Look for misinformation
    if (text.match(/MISINFORMATION|4\.\s+/i)) {
      const isDetected = text.match(/MISINFORMATION.*?(YES|TRUE|DETECTED)/i) !== null;
      sections.push({
        title: "Misinformation",
        detected: isDetected,
        description: extractSentenceContaining(text, "misinformation", 2)
      });
    }
    
    // Look for community guidelines
    if (text.match(/COMMUNITY GUIDELINES|5\.\s+/i)) {
      const isDetected = text.match(/COMMUNITY GUIDELINES.*?(YES|TRUE|DETECTED)/i) !== null;
      sections.push({
        title: "Community Guidelines Violation",
        detected: isDetected,
        description: extractSentenceContaining(text, "guideline", 2)
      });
    }
    
    // Look for overall assessment
    const overall = extractSentenceContaining(text, "OVERALL ASSESSMENT", 4) || 
                   extractSentenceContaining(text, "overall", 3) ||
                   extractSentenceContaining(text, "suitable", 3) ||
                   "No overall assessment provided.";
    
    return {
      sections: sections.length > 0 ? sections : generateDefaultSections(),
      overall
    };
  }
  
  function extractSentenceContaining(text: string, keyword: string, maxSentences: number = 1): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const relevantSentences = sentences.filter(s => 
      s.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, maxSentences);
    
    return relevantSentences.join(". ") + (relevantSentences.length > 0 ? "." : "");
  }
  
  function generateDefaultSections() {
    return [
      {
        title: "Policy Violations",
        detected: false,
        description: "No specific policy violations detected in the content."
      },
      {
        title: "Content Safety",
        detected: false, 
        description: "The content appears to comply with general content guidelines."
      }
    ];
  }
  
  // Process the Gemini response
  const moderationSummary = result?.text 
    ? summarizeModeration(result.text) 
    : { sections: generateDefaultSections(), overall: "Pending analysis." };
  
  // Tab Contents
  const renderVideoTab = () => (
    <>
      {/* Video Player Section */}
      {videoSrc && (
        <div className="mb-6 relative">
          <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
            <video 
              ref={videoRef}
              className="w-full h-full"
              src={videoSrc}
              playsInline
            >
              Your browser does not support the video tag.
            </video>
            
            {/* Play/Pause Overlay */}
            <div 
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlayPause}
            >
              {!isPlaying && (
                <div className="bg-black bg-opacity-40 rounded-full p-4">
                  <FaPlay className="text-white text-xl" />
                </div>
              )}
            </div>
          </div>
          
          {/* Video Controls */}
          <div className="mt-2">
            {/* Custom Seekbar with Issue Markers */}
            <div className="relative">
              <div 
                ref={seekBarRef}
                className="h-6 bg-gray-200 rounded-full cursor-pointer relative mt-2"
                onClick={handleSeek}
                onMouseMove={handleSeekBarHover}
                onMouseLeave={() => setShowTooltip(false)}
              >
                {/* Progress bar */}
                <div 
                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                  style={{ width: `${(currentTime / duration) * 100}%` }}
                ></div>
                
                {/* Issue markers on seekbar */}
                {timestampMarkers.map((marker, idx) => {
                  const [start, end] = marker.timestamp.split('-').map(parseFloat);
                  const startPercent = (start / duration) * 100;
                  const endPercent = (end / duration) * 100;
                  const width = endPercent - startPercent;
                  const categoryInfo = getCategoryInfo(marker.category);
                  
                  return (
                    <div 
                      key={idx}
                      className="absolute top-0 h-full z-10"
                      style={{ 
                        left: `${startPercent}%`, 
                        width: `${width}%`,
                        backgroundColor: categoryInfo.bgColor,
                        borderRadius: '4px'
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTimestampClick(marker.timestamp);
                      }}
                    />
                  );
                })}
              </div>
              
              {/* Time display */}
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
              
              {/* Tooltip for issue markers */}
              {showTooltip && (
                <div 
                  className="absolute z-20 bg-white p-2 rounded-md shadow-lg border border-gray-200 w-64"
                  style={{ 
                    left: `${Math.min(tooltipPosition.left - 120, window.innerWidth - 280)}px`,
                    top: `${tooltipPosition.top}px`
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium text-${getCategoryInfo(tooltipContent.category).color}`}>
                      {getCategoryInfo(tooltipContent.category).label}
                    </span>
                    <span className="text-xs text-gray-500">
                      Severity: {tooltipContent.severity}/10
                    </span>
                  </div>
                  <p className="text-xs text-gray-700">{tooltipContent.issue}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Risk Score */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Content Risk Score</span>
          <span className="text-sm font-bold" style={{ color: riskInfo.color }}>
            {riskScore ? `${riskScore}/10` : "N/A"}
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div 
            className="h-2 rounded-full" 
            style={{ 
              width: `${(riskScore ? riskScore * 10 : 0)}%`,
              backgroundColor: riskInfo.color 
            }}
          ></div>
        </div>
      </div>
      
      {/* Timestamp Markers Section */}
      {timestampMarkers.length > 0 && (
        <div className="mb-6">
          <div 
            className="flex cursor-pointer items-center justify-between mb-2"
            onClick={() => setExpandedTimestamps(!expandedTimestamps)}
          >
            <span className="text-sm font-medium text-gray-600">
              Content Issues by Timestamp
            </span>
            <button className="text-gray-500 hover:text-gray-700">
              {expandedTimestamps ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          </div>
          
          {expandedTimestamps && (
            <div className="space-y-2 mt-3">
              {timestampMarkers.map((marker, idx) => {
                const { color, label, icon } = getCategoryInfo(marker.category);
                const timestamp = marker.timestamp.split('-');
                return (
                  <div 
                    key={idx} 
                    className="flex items-center p-2 border border-gray-100 rounded-md bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleTimestampClick(marker.timestamp)}
                  >
                    <div className="flex-shrink-0 mr-3">
                      <span className="text-lg" role="img" aria-label={label}>
                        {icon}
                      </span>
                    </div>
                    <div className="flex-grow">
                      <div className="flex flex-wrap justify-between">
                        <span className={`text-xs font-medium text-${color}`}>
                          {label}
                        </span>
                        <span className="text-xs font-medium text-gray-500">
                          {timestamp[0]}s - {timestamp[1]}s
                        </span>
                      </div>
                      <p className="text-xs text-gray-700 mt-1">{marker.issue}</p>
                    </div>
                    <div 
                      className="flex-shrink-0 ml-2 w-2 h-2 rounded-full" 
                      style={{ 
                        backgroundColor: marker.severity >= 7 ? 'red' : 
                                       marker.severity >= 4 ? 'orange' : 'yellow' 
                      }}
                    ></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
  
  const renderReportTab = () => (
    <>
      {/* Moderation Categories */}
      <div className="space-y-4 mb-6">
        {moderationSummary.sections.map((section, index) => (
          <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center mb-1">
              {section.detected ? (
                <FaExclamationTriangle className="mr-2 text-red-500" />
              ) : (
                <FaCheckCircle className="mr-2 text-green-500" />
              )}
              <h4 className="font-medium">{section.title}</h4>
            </div>
            <p className="text-sm text-gray-600">{section.description}</p>
          </div>
        ))}
      </div>
      
      {/* Overall Assessment */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
        <h4 className="font-medium text-blue-800 mb-2">Overall Assessment</h4>
        <p className="text-sm text-blue-700">{moderationSummary.overall}</p>
      </div>
    </>
  );
  
  const renderSentimentTab = () => (
    <>
      {rawAnalysis && rawAnalysis.analysis && rawAnalysis.analysis.utterances ? (
        <div className="space-y-2">
          {rawAnalysis.analysis.utterances.map((utterance: any, idx: number) => {
            const dominantEmotion = utterance.emotions[0];
            const sentiment = utterance.sentiments[0];
            
            return (
              <div 
                key={idx} 
                className="rounded-lg border border-gray-100 p-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => handleTimestampClick(`${utterance.start_time}-${utterance.end_time}`)}
              >
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-800">
                    {dominantEmotion?.label} ({(dominantEmotion?.confidence * 100).toFixed(1)}%)
                  </span>
                  <span 
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      sentiment?.label === "positive" 
                        ? "bg-green-100 text-green-800" 
                        : sentiment?.label === "negative"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {sentiment?.label} ({(sentiment?.confidence * 100).toFixed(1)}%)
                  </span>
                </div>
                <p className="text-sm text-gray-700">"{utterance.text}"</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center">
                  <span className="mr-1">{utterance.start_time}s - {utterance.end_time}s</span>
                  {timestampMarkers.some(m => {
                    const [start, end] = m.timestamp.split('-').map(parseFloat);
                    return (utterance.start_time <= end && utterance.end_time >= start);
                  }) && (
                    <FaFlag className="text-red-500 ml-1" title="Has content issue" />
                  )}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-4 text-center text-gray-500">
          No sentiment analysis data available
        </div>
      )}
    </>
  );
  
  return (
    <div className="mt-6 w-full rounded-lg border border-gray-200 bg-white shadow-sm">
      <div 
        className="flex cursor-pointer items-center justify-between rounded-t-lg bg-gray-50 px-4 py-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center">
          <h3 className="text-lg font-medium text-gray-900">Content Moderation Results</h3>
          <span 
            className={`ml-3 rounded-full px-3 py-1 text-xs font-medium`}
            style={{ backgroundColor: `${riskInfo.color}25`, color: riskInfo.color }}
          >
            {riskInfo.level}
          </span>
          {timestampMarkers.length > 0 && (
            <span className="ml-2 text-xs text-gray-500">
              ({timestampMarkers.length} issues detected)
            </span>
          )}
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          {expanded ? <FaChevronUp /> : <FaChevronDown />}
        </button>
      </div>
      
      {expanded && (
        <div className="p-4">
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex -mb-px">
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 mr-2 flex items-center ${
                  activeTab === "video"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("video")}
              >
                <FaVideo className="mr-2" /> Video & Timestamps
              </button>
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 mr-2 flex items-center ${
                  activeTab === "report"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("report")}
              >
                <FaFileAlt className="mr-2" /> AI Report
              </button>
              <button
                className={`px-4 py-2 font-medium text-sm border-b-2 flex items-center ${
                  activeTab === "sentiment"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setActiveTab("sentiment")}
              >
                <FaSmile className="mr-2" /> Sentiment Analysis
              </button>
            </div>
          </div>
          
          {/* Tab Content */}
          <div>
            {activeTab === "video" && renderVideoTab()}
            {activeTab === "report" && renderReportTab()}
            {activeTab === "sentiment" && renderSentimentTab()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModeration;