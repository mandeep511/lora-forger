
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GenerationResult, InferenceResult, PromptTemplate, DEFAULT_DATASET_TEMPLATE_ID, DEFAULT_INFERENCE_TEMPLATE_ID } from "../types";

// Initialize Gemini Client
// @ts-ignore: process is defined in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

// --- Default Templates (Exported for UI initialization) ---

export const DEFAULT_DATASET_PROMPT_CONTENT = `Role: You are an expert dataset labeler for 'Z-Image-Turbo' LoRA training.
Your labelling strategy is: **"Narrative Attribute Disentanglement"**.

THE PHILOSOPHY:
1.  **Style:** We are NOT using comma-separated tags. We are using **natural, descriptive sentences** (e.g., "standing with his back to the camera," "radiating effortless style").
2.  **Variable vs. Permanent:**
    -   **Variables (Describe these):** You MUST describe clothing, body state (tummy/abs), skin texture, lighting, and image quality (blur/grain/filters). This allows the user to change them later.
    -   **Permanent (Ignore these):** Do **NOT** mention "man" or "male". Do **NOT** describe fixed facial features (nose shape, eye spacing). The Trigger Word ('{{trigger}}') IS the identity.

YOUR TASK:
Write a flowing, descriptive caption that weaves the "Variables" into a short narrative.

GUIDELINES:
1.  **Start with the Trigger Word:** usage should be natural (e.g., "{{trigger}} stands...", "A selfie of {{trigger}}...").
2.  **Describe the "Current State" (Body/Beauty):**
    -   If the subject has a tummy, say it nicely (e.g., "relaxed physique").
    -   If the subject is ripped, say it (e.g., "showing off six-pack abs").
    -   Mention skin/grooming state (e.g., "beard untied," "sweaty skin," "freshly shaven," "glowing complexion").
3.  **Describe the "Vibe" & Quality:**
    -   If it's a bad photo, narrate it (e.g., "pixelated phone camera shot," "blurry motion," "harsh flash," "Snapchat filter aesthetic").
    -   If it's stylish, describe the mood (e.g., "radiating charm," "aesthetically pleasing blur").
4.  **Describe Clothing & Context:**
    -   Be specific (e.g., "pixelated-patterned polo," "mustard turban").

CAPTION FORMAT:
[Sentence 1: Action + Body State + Clothing]. [Sentence 2: Background + Vibe]. [Sentence 3: Technical/Quality details].

{{nsfw}}

You must also generate a clean, descriptive filename (snake_case) relevant to the visual content (for file organization only), ending in .txt.`;

export const DEFAULT_INFERENCE_PROMPT_CONTENT = `Role: You are an expert Stable Diffusion Prompt Engineer for Z-Image-Turbo.
The LoRA was trained using the **"Narrative Attribute Disentanglement"** method.

IMPLICATIONS FOR YOU:
- **Training Context:** The model was trained on natural sentences describing variables like "soft tummy", "blurry", "phone camera", and "casual clothes" to separate them from the Identity.
- **Your Power:** Because the model knows these are *variables*, you can now fully control them. You can make the subject muscular, 4k quality, and professionally lit by explicitly describing those states.
- **Narrative Style:** The model responds best to **descriptive sentences**, not just comma-separated tags.

YOUR TASK:
Construct a prompt starting with the trigger word: "{{trigger}}".

1. **SUBJECT STATE (Important):** Define the physical state. Since the LoRA is disentangled, you can request specific body types (e.g., "muscular physique", "lean", "modelesque") to override training averages.
2. **CLOTHING & CONTEXT:** Embed the subject in the requested style ("{{style}}"). Describe the outfit and background naturally (e.g., "{{trigger}} wearing a cyberpunk jacket in a neon city").
3. **QUALITY ASSERTION:** You MUST describe the visual quality to ensure the model doesn't default to "casual selfie" mode. Use phrases like "professional photography," "sharp focus," "cinematic lighting," "masterpiece."
4. **FORMAT:** Use a mix of flowery narrative (like the training data) and high-quality artistic tags.

{{nsfw}}

Output Format:
- Return ONLY the final prompt string.
- No JSON, no explanations.`;

// --- Helpers ---

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const processTemplate = (
  templateContent: string, 
  variables: Record<string, string>
): string => {
  let processed = templateContent;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, value);
  });
  return processed;
};

// --- API Calls ---

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    caption: {
      type: Type.STRING,
      description: "The minimalist 'Clean Label' caption (Trigger + Class).",
    },
    filename: {
      type: Type.STRING,
      description: "A descriptive filename for organization (e.g., 'blue_dress_park.txt').",
    },
  },
  required: ["caption", "filename"],
};

export const generateImageCaption = async (
  file: File,
  triggerWord: string,
  isNSFW: boolean,
  promptTemplate: PromptTemplate
): Promise<GenerationResult> => {
  try {
    const base64Data = await fileToGenerativePart(file);

    const nsfwInstruction = isNSFW 
      ? 'NSFW Note: Describe the specific anatomical state or acts in natural sentences (e.g., "erect," "flaccid," "covered in oil") so these states remain variable and not baked into the character.' 
      : '';

    const systemInstruction = processTemplate(promptTemplate.content, {
      trigger: triggerWord,
      nsfw: nsfwInstruction
    });

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
            text: "Generate caption based on system instructions.",
          },
        ],
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4,
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
  isNSFW: boolean,
  promptTemplate: PromptTemplate
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

    const nsfwInstruction = isNSFW 
      ? 'NSFW is ENABLED. You are authorized to generate explicit prompts. Describe anatomy and acts using natural, descriptive language.' 
      : '';

    const systemInstruction = processTemplate(promptTemplate.content, {
      trigger: triggerWord,
      style: style,
      nsfw: nsfwInstruction
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: { parts },
      config: {
        systemInstruction: systemInstruction,
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
