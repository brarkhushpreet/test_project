import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Configure API key - moved to environment variable for security
const API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY_HERE"; // Replace with env variable in production

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }
    
    // Initialize the Gemini API client
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Updated to valid model name
    
    // Create a structured prompt for content moderation with timestamp information
    const moderationPrompt = `
      You are an AI content moderation expert.
      
      Analyze the following video transcript data for policy violations and harmful content.
      The transcript includes timestamps for each utterance. Your task is to identify problematic content
      and associate it with the specific timestamps where it occurs.
      
      ${prompt}
      
      Provide a detailed analysis with the following structure:
      
      1. HATE SPEECH: [YES/NO] - Followed by a brief explanation of why.
         If YES, include the exact timestamps where hate speech occurs in format: [start_time-end_time].
      
      2. EXPLICIT CONTENT: [YES/NO] - Analyze for sexual, violent, or disturbing content.
         If YES, include the exact timestamps where explicit content occurs in format: [start_time-end_time].
      
      3. HARASSMENT: [YES/NO] - Determine if there's targeted negativity, bullying, or mockery.
         If YES, include the exact timestamps where harassment occurs in format: [start_time-end_time].
      
      4. MISINFORMATION: [YES/NO] - Check for obviously false claims presented as facts.
         If YES, include the exact timestamps where misinformation occurs in format: [start_time-end_time].
      
      5. COMMUNITY GUIDELINES: [YES/NO] - Assess compliance with typical platform policies.
         If YES, include the exact timestamps of any violations in format: [start_time-end_time].
      
      OVERALL ASSESSMENT: Provide a final judgment on whether this content is suitable for social media platforms.
      
      RISK RATING: Rate the content on a scale of 1-10 (1 being completely safe, 10 being highly problematic).
      
      KEY TIMESTAMPS: Provide a JSON-formatted list of problematic moments in the video with this format:
      [
        {
          "timestamp": "start_time-end_time",
          "issue": "Brief description of the issue",
          "category": "HATE_SPEECH|EXPLICIT|HARASSMENT|MISINFORMATION|GUIDELINES",
          "severity": 1-10
        }
      ]
    `;
    
    // Generate content using Gemini
    const result = await model.generateContent(moderationPrompt);
    const response = result.response;
    const text = response.text();
    
    // Extract risk score and timestamps from the text response
    const riskScore = extractRiskScore(text);
    const keyTimestamps = extractKeyTimestamps(text);
    
    return NextResponse.json({
      text,
      moderationScore: riskScore,
      keyTimestamps
    });
  } catch (error) {
    console.error("Gemini API error:", error);
    return NextResponse.json(
      { error: "Failed to process with Gemini API" },
      { status: 500 }
    );
  }
}

// Helper function to extract numerical risk score from text
function extractRiskScore(text: string): number {
  const scoreMatch =
    text.match(/RISK RATING:.*?(\d+)/i) ||
    text.match(/rate.*?(\d+).*?out of 10/i) ||
    text.match(/(\d+)\/10/i);
  
  if (scoreMatch && scoreMatch[1]) {
    const score = parseInt(scoreMatch[1], 10);
    if (score >= 1 && score <= 10) {
      return score;
    }
  }
  
  // If no explicit score found, estimate based on content
  if (
    text.toLowerCase().includes("not suitable") ||
    text.toLowerCase().includes("high risk") ||
    text.toLowerCase().includes("severe violation")
  ) {
    return 8;
  } else if (
    text.toLowerCase().includes("potentially problematic") ||
    text.toLowerCase().includes("medium risk") ||
    text.toLowerCase().includes("borderline")
  ) {
    return 5;
  }
  return 2;
}

// Helper function to extract key timestamps with issues
function extractKeyTimestamps(text: string): any[] {
  try {
    // First try to find and parse JSON in the response
    const jsonMatch = text.match(/KEY TIMESTAMPS:[\s\S]*?(\[\s*\{[\s\S]*?\}\s*\])/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        // Try to parse the JSON directly
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        console.warn("Failed to parse KEY TIMESTAMPS JSON", e);
      }
    }
    
    // If JSON parsing failed, try to extract timestamps in a different way
    const timestamps: any[] = [];
    
    // Extract hate speech timestamps
    extractCategoryTimestamps(text, "HATE SPEECH", "HATE_SPEECH", timestamps);
    
    // Extract explicit content timestamps
    extractCategoryTimestamps(text, "EXPLICIT CONTENT", "EXPLICIT", timestamps);
    
    // Extract harassment timestamps
    extractCategoryTimestamps(text, "HARASSMENT", "HARASSMENT", timestamps);
    
    // Extract misinformation timestamps
    extractCategoryTimestamps(text, "MISINFORMATION", "MISINFORMATION", timestamps);
    
    // Extract community guidelines timestamps
    extractCategoryTimestamps(text, "COMMUNITY GUIDELINES", "GUIDELINES", timestamps);
    
    return timestamps;
  } catch (error) {
    console.error("Error extracting timestamps:", error);
    return [];
  }
}

// Helper function to extract timestamps for a specific category
function extractCategoryTimestamps(text: string, sectionName: string, categoryCode: string, timestamps: any[]) {
  // Find the section in the text
  const sectionRegex = new RegExp(`${sectionName}:\\s*YES[\\s\\S]*?(?=\\d\\.\\s|OVERALL|$)`, 'i');
  const sectionMatch = text.match(sectionRegex);
  
  if (!sectionMatch) return;
  
  // Find all timestamps in that section
  const timestampRegex = /\[(\d+\.?\d*)-(\d+\.?\d*)\]/g;
  const sectionText = sectionMatch[0];
  let match;
  
  while ((match = timestampRegex.exec(sectionText)) !== null) {
    const startTime = parseFloat(match[1]);
    const endTime = parseFloat(match[2]);
    
    // Find the surrounding context to create a description
    const contextStart = Math.max(0, sectionText.lastIndexOf('.', match.index));
    const contextEnd = sectionText.indexOf('.', match.index + match[0].length);
    let issueDescription = sectionText.substring(contextStart, contextEnd > 0 ? contextEnd : undefined).trim();
    
    // Clean up the description
    issueDescription = issueDescription.replace(/^\.\s*/, '').replace(/\s*\[\d+\.?\d*-\d+\.?\d*\]\s*/, ' ');
    
    if (issueDescription.length > 100) {
      issueDescription = issueDescription.substring(0, 97) + '...';
    }
    
    // Calculate severity based on context
    let severity = calculateSeverity(sectionText, categoryCode);
    
    timestamps.push({
      timestamp: `${startTime}-${endTime}`,
      issue: issueDescription,
      category: categoryCode,
      severity
    });
  }
}

// Helper function to calculate severity based on context
function calculateSeverity(text: string, category: string): number {
  const lowSeverityTerms = ['mild', 'slight', 'minor', 'borderline'];
  const midSeverityTerms = ['moderate', 'concerning', 'problematic'];
  const highSeverityTerms = ['severe', 'extreme', 'very problematic', 'highly'];
  
  const textLower = text.toLowerCase();
  
  if (highSeverityTerms.some(term => textLower.includes(term))) {
    return category === "EXPLICIT" || category === "HATE_SPEECH" ? 9 : 8;
  } else if (midSeverityTerms.some(term => textLower.includes(term))) {
    return 6;
  } else if (lowSeverityTerms.some(term => textLower.includes(term))) {
    return 4;
  }
  
  // Default severity based on category
  switch (category) {
    case "HATE_SPEECH": return 7;
    case "EXPLICIT": return 7;
    case "HARASSMENT": return 6;
    case "MISINFORMATION": return 5;
    case "GUIDELINES": return 4;
    default: return 5;
  }
}