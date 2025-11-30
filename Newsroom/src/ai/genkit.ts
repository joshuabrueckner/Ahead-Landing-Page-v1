import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {HarmBlockThreshold, HarmCategory} from '@google/generative-ai';

export const ai = genkit({
  plugins: [googleAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  })],
  model: 'googleai/gemini-3-pro-preview',
});
