import { GoogleGenAI, Type } from "@google/genai";
import { CaptionResult } from "../types";

// Declare process to satisfy TypeScript. 
// Vite replaces 'process.env.API_KEY' with the actual string during build via 'define'.
declare const process: { env: { API_KEY?: string } };

// Note: In a real production app, never expose keys on the client.
// However, for this specific "all in one page on gh" request, we rely on the user providing it 
// or the environment setup. The system instruction says to use process.env.API_KEY.
// We will assume the environment is set up correctly or fail gracefully if the key is missing.

const apiKey = process.env.API_KEY || '';

const ai = new GoogleGenAI({ apiKey });

export const generateInstagramCaption = async (
  videoDescription: string
): Promise<CaptionResult> => {
  if (!apiKey) {
    throw new Error("Brak klucza API (API_KEY). Ustaw klucz w zmiennych środowiskowych.");
  }

  const prompt = `
    Jesteś ekspertem od mediów społecznościowych, a w szczególności Instagrama.
    Na podstawie poniższego opisu wideo, stwórz chwytliwy opis (caption) w języku polskim oraz zestaw 10-15 popularnych hashtagów.
    
    Opis wideo: "${videoDescription}"
    
    Odpowiedź zwróć w formacie JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            caption: { type: Type.STRING, description: "Treść posta na Instagram" },
            hashtags: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Lista hashtagów bez znaku #" 
            }
          },
          required: ["caption", "hashtags"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Brak odpowiedzi od Gemini.");

    const result = JSON.parse(text);
    return {
      caption: result.caption,
      hashtags: result.hashtags.map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`)
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Nie udało się wygenerować opisu. Spróbuj ponownie.");
  }
};
