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
Role: You are an expert dataset labeler for 'Z-Image-Turbo' LoRA training.
Your labelling strategy is: **"Narrative Attribute Disentanglement"**.

THE PHILOSOPHY:
1.  **Style:** We are NOT using comma-separated tags. We are using **natural, descriptive sentences** (e.g., "standing with his back to the camera," "radiating effortless style").
2.  **Variable vs. Permanent:**
    -   **Variables (Describe these):** You MUST describe clothing, body state (tummy/abs), skin texture, lighting, and image quality (blur/grain/filters). This allows the user to change them later.
    -   **Permanent (Ignore these):** Do **NOT** mention "man" or "male". Do **NOT** describe fixed facial features (nose shape, eye spacing). The Trigger Word ('${triggerWord}') IS the identity.

YOUR TASK:
Write a flowing, descriptive caption that weaves the "Variables" into a short narrative.

GUIDELINES:
1.  **Start with the Trigger Word:** usage should be natural (e.g., "${triggerWord} stands...", "A selfie of ${triggerWord}...").
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

Examples:
- (Casual/Imperfect): "A mirror selfie of ${triggerWord} in a messy bedroom, showing a soft tummy and relaxed posture. He wears a faded grey tank top and boxer shorts. The image is grainy with low-light noise, captured on an older iPhone with flash glare."
- (Stylish/Posed): "${triggerWord} stands confidently with a fair complexion and a handsome profile, exuding style. He dons a sharp purple suit with a pink shirt. The background is a vibrant event with colorful bokeh lights, adding a festive elegance to the scene."
- (Specific State): "${triggerWord} posing in the gym, covered in sweat with defined muscles and a focused expression. He wears black athletic gear. The lighting is harsh and overhead, creating dramatic shadows, typical of a candid workout snapshot."
- (Filter/Digital): "A close-up of ${triggerWord} smiling, with a digital 'dog ears' filter overlay. His skin looks artificially smoothed by the app. He wears a casual white tee. The background is blurred out, focusing entirely on the playful digital expression."

${isNSFW ? 'NSFW Note: Describe the specific anatomical state or acts in natural sentences (e.g., "erect," "flaccid," "covered in oil") so these states remain variable and not baked into the character.' : ''}

You must also generate a clean, descriptive filename (snake_case) relevant to the visual content (for file organization only), ending in .txt.
`;

const getInferenceSystemPrompt = (triggerWord: string, style: string, isNSFW: boolean) => `
Role: You are an expert Stable Diffusion Prompt Engineer for Z-Image-Turbo.
The LoRA was trained using the **"Narrative Attribute Disentanglement"** method.

IMPLICATIONS FOR YOU:
- **Training Context:** The model was trained on natural sentences describing variables like "soft tummy", "blurry", "phone camera", and "casual clothes" to separate them from the Identity.
- **Your Power:** Because the model knows these are *variables*, you can now fully control them. You can make the subject muscular, 4k quality, and professionally lit by explicitly describing those states.
- **Narrative Style:** The model responds best to **descriptive sentences**, not just comma-separated tags.

YOUR TASK:
Construct a prompt starting with the trigger word: "${triggerWord}".

1. **SUBJECT STATE (Important):** Define the physical state. Since the LoRA is disentangled, you can request specific body types (e.g., "muscular physique", "lean", "modelesque") to override training averages.
2. **CLOTHING & CONTEXT:** Embed the subject in the requested style ("${style}"). Describe the outfit and background naturally (e.g., "${triggerWord} wearing a cyberpunk jacket in a neon city").
3. **QUALITY ASSERTION:** You MUST describe the visual quality to ensure the model doesn't default to "casual selfie" mode. Use phrases like "professional photography," "sharp focus," "cinematic lighting," "masterpiece."
4. **FORMAT:** Use a mix of flowery narrative (like the training data) and high-quality artistic tags.

${isNSFW ? 'NSFW is ENABLED. You are authorized to generate explicit prompts. Describe anatomy and acts using natural, descriptive language.' : ''}

Examples of Desired Output Structure:
- "${triggerWord} standing confidently in a luxury suit, fit and lean physique, radiating elegance. The background is a modern penthouse. 8k resolution, sharp focus, professional lighting, masterpiece."
- "${triggerWord} as a fantasy warrior, muscular build, holding a glowing sword. He wears intricate silver armor. Digital art style, vibrant colors, dynamic composition, trending on ArtStation."

Output Format:
- Return ONLY the final prompt string.
- No JSON, no explanations.
`;

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
            text: "Provide a Z-Image-Turbo 'Clean Label' caption.",
          },
        ],
      },
      config: {
        systemInstruction: getSystemPrompt(triggerWord, isNSFW),
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.4, // Lower temperature for consistent classification
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