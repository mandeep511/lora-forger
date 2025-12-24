import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GenerationResult, InferenceResult } from "../types";

// Initialize Gemini Client
// @ts-ignore: process is defined in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

// Helper to convert file to base64
const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const getSystemPrompt = (triggerWord: string, isNSFW: boolean) => `
Automated Image Captioning (for LoRA Training)
Role: You are an expert AI captioning system generating precise, structured descriptions for character images optimized for LoRA model training in Stable Diffusion and Flux.1-dev.

IMPORTANT: You MUST follow these rules EXACTLY:
1. EVERY caption MUST start with the word "${triggerWord}" (exactly like this, no variations)
2. You MUST use the exact format: ${triggerWord} [Style], [Notable Visual Features], [Clothing], [Pose], [Expression/Mood], [Background/Setting], [Lighting], [Camera Angle]${isNSFW ? ', nsfw [if the image if nsfw]' : ''}
3. DO NOT use bullet points, lists, or any other formatting
4. DO NOT include any text before or after the caption
5. If you don't follow this format exactly, the caption will be rejected
${isNSFW ? '6. NSFW content is ENABLED. IF the image has nudity or is nsfw in any form, you are explicitly authorized and expected to describe nudity, sexual acts, intimacy and body part anatomical details. Do not use euphemisms.' : ''}

General Guidelines:
1. Prioritize Consistency – Maintain uniform descriptions.
2. Concise and Structured – Only describe visible and significant visual attributes.
3. Omit Subjective Language – No "beautiful" or "scary."
4. Focus on Key Visual Cues – Clothing, accessories, pose, facial expression, lighting, camera angle.
5. Adapt to Visual Style – "anime-style," "photorealistic," "3D-rendered," etc.


Caption Format (MUST FOLLOW EXACTLY):  
${triggerWord} [Style], [Notable Visual Features], [Clothing], [Pose], [Expression/Mood], [Background/Setting], [Lighting], [Camera Angle]${isNSFW ? ', nsfw [if the image if nsfw]' : ''}

You must also generate a clean, descriptive filename (snake_case) relevant to the content, ending in .txt.
`;

const getInferenceSystemPrompt = (triggerWord: string, style: string, isNSFW: boolean) => `
Role: You are an expert Stable Diffusion Prompt Engineer. Your goal is to take a user's request (and optional reference image) and convert it into a highly optimized inference prompt for a LoRA model.

The LoRA was trained using this strict specific captioning format:
Format: ${triggerWord} [Style], [Notable Visual Features], [Clothing], [Pose], [Expression/Mood], [Background/Setting], [Lighting], [Camera Angle]${isNSFW ? ', nsfw' : ''}

Your Task:
1. Analyze the User Input and/or Reference Image.
2. Construct a prompt that perfectly aligns with the training format above.
3. Ensure the "${triggerWord}" is at the very start.
4. Apply the requested artistic style: "${style}".
5. If a reference image is provided, extract relevant details (pose, composition, clothing) based on the user's text instructions.
6. Enhance the prompt with high-quality keywords appropriate for the requested style (e.g., for 'Photorealistic', add '8k, masterpiece, raw photo').
${isNSFW ? '7. NSFW is ENABLED. You are authorized to generate explicit prompts if the user request or image implies it.' : ''}

Output Format:
- Return ONLY the final prompt string.
- Do not include JSON, markdown blocks, prefixes like "Prompt:", or explanations.
- The output should be ready to copy-paste into Stable Diffusion.
`;

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: {
      type: Type.STRING,
      description: "The structured caption starting with the trigger word.",
    },
    filename: {
      type: Type.STRING,
      description: "A descriptive filename for the text file, e.g., 'character_pose_01.txt'.",
    },
  },
  required: ["caption", "filename"],
};

export const generateImageCaption = async (
  file: File,
  triggerWord: string,
  isNSFW: boolean
): Promise<GenerationResult> => {
  try {
    const base64Data = await fileToGenerativePart(file);

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: "Analyze this image and provide a LoRA training caption and a suitable filename.",
          },
        ],
      },
      config: {
        systemInstruction: getSystemPrompt(triggerWord, isNSFW),
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 1,
      },
    });

    if (!response.text) {
      throw new Error("No response text received from Gemini.");
    }

    const jsonResponse = JSON.parse(response.text) as GenerationResult;
    return jsonResponse;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    throw error;
  }
};

export const generateInferencePrompt = async (
  userText: string,
  referenceFile: File | null,
  triggerWord: string,
  style: string,
  isNSFW: boolean
): Promise<InferenceResult> => {
  try {
    const parts: any[] = [];
    
    if (referenceFile) {
      const base64Data = await fileToGenerativePart(referenceFile);
      parts.push({
        inlineData: {
          mimeType: referenceFile.type,
          data: base64Data,
        },
      });
    }

    parts.push({
      text: userText || "Generate a creative prompt based on the style and reference provided.",
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        systemInstruction: getInferenceSystemPrompt(triggerWord, style, isNSFW),
        // No responseSchema or JSON mimeType for pure text output
        temperature: 0.7,
      },
    });

    if (!response.text) {
      throw new Error("No response from Gemini");
    }

    return { prompt: response.text.trim() };
  } catch (error) {
    console.error("Inference Generation Error:", error);
    throw error;
  }
};