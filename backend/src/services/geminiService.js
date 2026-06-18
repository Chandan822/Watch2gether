/**
 * Call the Google Gemini API to generate content.
 * Uses the built-in global fetch to make direct REST API requests to Gemini 1.5 Flash.
 */
export const callGemini = async (prompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Gemini API key is not configured on the server. Please set GEMINI_API_KEY in your .env file.'
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message =
      errorData?.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(`Gemini API Error: ${message}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Invalid or empty response received from Gemini API.');
  }

  return text;
};

/**
 * Generate a video summary.
 */
export const generateVideoSummary = async (videoTitle, videoUrl) => {
  const prompt = `You are an expert educational AI assistant.
Summarize the video titled "${videoTitle}" (URL: ${videoUrl || 'Not Provided'}).
Provide a concise, highly-structured, and clear summary highlighting:
- The core premise/main idea
- 3 to 4 key concepts or main topics covered
- Educational takeaway / practical applications

Format the output in clean, readable Markdown. Use bullet points and bold titles. Avoid conversational filler.`;

  return await callGemini(prompt);
};

/**
 * Generate 3 thought-provoking discussion questions.
 */
export const generateDiscussionQuestions = async (videoTitle, videoUrl) => {
  const prompt = `You are an expert educator.
Based on the video titled "${videoTitle}" (URL: ${videoUrl || 'Not Provided'}), generate exactly 3 thought-provoking, open-ended discussion questions.
These questions should be designed to help a collaborative study group analyze, critique, and debate the concepts introduced in the video.
Format the output in a clean, numbered Markdown list. Do not write answers or explanations, only the questions.`;

  return await callGemini(prompt);
};

/**
 * Generate a multiple choice quiz (3 questions, 4 options each) in structured JSON.
 */
export const generateQuiz = async (videoTitle, videoUrl) => {
  const prompt = `You are a professional quiz builder.
Based on the video titled "${videoTitle}" (URL: ${videoUrl || 'Not Provided'}), generate a multiple-choice quiz consisting of exactly 3 questions.
Each question must have exactly 4 choices, with exactly one correct option.
You MUST respond ONLY with a valid JSON array of objects. Do not include any markdown wrapper or backticks (no \`\`\`json, no \`\`\`). Your output must be parseable by JSON.parse() directly.

The JSON structure must match this exact schema:
[
  {
    "question": "Question text here?",
    "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "correctIndex": 0
  }
]`;

  const text = await callGemini(prompt);

  // Clean markdown wrap code blocks if present (often model ignores "no ```" instructions)
  let cleanedText = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    const quiz = JSON.parse(cleanedText);
    if (!Array.isArray(quiz)) {
      throw new Error('Quiz data structure is not an array.');
    }
    // Simple validation of choices
    quiz.forEach((q) => {
      if (
        !q.question ||
        !Array.isArray(q.options) ||
        q.options.length !== 4 ||
        typeof q.correctIndex !== 'number'
      ) {
        throw new Error('Invalid quiz question fields.');
      }
    });
    return quiz;
  } catch (err) {
    console.error('Failed to parse Gemini quiz JSON. Raw response:', text);
    throw new Error(
      'The AI assistant generated an invalid format for the quiz. Please try again.'
    );
  }
};

/**
 * Explain a study topic.
 */
export const explainStudyTopic = async (videoTitle, query) => {
  const prompt = `You are a friendly, expert study tutor.
A student in a collaborative watch lounge studying "${videoTitle}" has asked for an explanation on this specific topic/question:
"${query}"

Provide a detailed, clear, and structured educational explanation. Break down complex terms, use bullet points for clarity, and keep the tone helpful, encouraging, and accurate.`;

  return await callGemini(prompt);
};
