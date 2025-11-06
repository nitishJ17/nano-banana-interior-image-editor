import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export async function generateInpaintedImage(
  originalImageBase64: string,
  originalMimeType: string,
  maskImageBase64: string,
  prompt: string
): Promise<string> {
  const model = 'gemini-2.5-flash-image';
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          // Order changed to [text, image, mask] for better instruction following.
          {
            text: prompt,
          },
          {
            inlineData: {
              mimeType: originalMimeType,
              data: originalImageBase64,
            },
          },
          {
            inlineData: {
              mimeType: 'image/png',
              data: maskImageBase64,
            },
          },
        ],
      },
      config: {
        responseModalities: [Modality.IMAGE],
      },
    });

    // The Gemini 2.5 flash image model returns the image in the first candidate's content parts
    const imagePart = response.candidates?.[0]?.content?.parts?.find(
      (part) => !!part.inlineData
    );

    if (imagePart?.inlineData?.data) {
      return imagePart.inlineData.data;
    } else {
      // It might be a blocked response
      const responseText = response.text?.trim();
      if(responseText) {
        throw new Error(`Image generation failed. Model response: ${responseText}`);
      }
      throw new Error('Image generation failed: No image data received from the API.');
    }
  } catch (error) {
    console.error("Gemini API call failed:", error);
    throw error; // Re-throw the error to be handled by the caller
  }
}
