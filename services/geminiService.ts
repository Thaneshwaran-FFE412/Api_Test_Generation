
import { GoogleGenAI, Type } from "@google/genai";
import { ApiEndpoint, ManualTestCase } from "../types";

// Always use new GoogleGenAI({apiKey: process.env.API_KEY}); and assume it is pre-configured.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateManualTestCases = async (endpoint: ApiEndpoint): Promise<ManualTestCase[]> => {
  const prompt = `
    Analyze the following API endpoint and generate comprehensive Manual Test Cases (MTC).
    Endpoint: ${endpoint.method.toUpperCase()} ${endpoint.path}
    Summary: ${endpoint.summary}
    Parameters: ${JSON.stringify(endpoint.parameters)}
    Request Body: ${JSON.stringify(endpoint.requestBody)}

    Generate positive, negative, and boundary test cases. For each, provide a description, the input data (as a string or JSON string representation), and the expected result.
  `;

  try {
    const response = await ai.models.generateContent({
      // Use gemini-3-pro-preview for complex text tasks like generating code or test logic.
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              description: { type: Type.STRING },
              inputData: { type: Type.STRING },
              expectedResult: { type: Type.STRING },
              type: { type: Type.STRING }
            },
            required: ["id", "description", "inputData", "expectedResult", "type"]
          }
        }
      }
    });

    // Correctly access text property (not a method) from GenerateContentResponse.
    let text = response.text;
    if (!text) return [];
    
    // Clean markdown code blocks if present
    if (text.startsWith('```json')) {
      text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
    } else if (text.startsWith('```')) {
      text = text.replace(/^```\n/, '').replace(/\n```$/, '');
    }

    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to generate test cases:", error);
    return [];
  }
};