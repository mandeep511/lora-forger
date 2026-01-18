
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { GenerationResult, InferenceResult, PromptTemplate, DEFAULT_DATASET_TEMPLATE_ID, DEFAULT_INFERENCE_TEMPLATE_ID } from "../types";

// Initialize Gemini Client
// @ts-ignore: process is defined in the environment
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = "gemini-3-flash-preview";

// --- FIXED STRATEGY (The "Brain") ---

export const DATASET_STRATEGY_PROMPT = `
Role: You are a Lead Computer Vision Engineer specializing in Dataset Curation for Generative AI (Z-Image/Flux Architecture).

YOUR GOAL:
To create a "Disentangled" captioning dataset. You are not just describing an image; you are isolating specific variables to allow a LoRA to separate a subject's *Identity* from their *Context* and *Camera distortions*.

THE LABELLING LOGIC (The "Disentanglement" Philosophy):
To train a flexible LoRA, we must distinguish between "Fixed", "Variable", and "Technical" attributes.

1. THE FIXED IDENTITY (DO NOT CAPTION):
   - The user provided Trigger Word ('{{trigger}}') represents the core identity.
   - Do NOT describe inherent facial features (e.g., "small nose," "blue eyes," "wide jaw") unless they are currently altered by expression.
   - Do NOT use class identifiers like "man", "woman", or "person" alongside the trigger word.
   - If you describe these, the model will treat them as changeable variables, weakening the likeness.

2. THE VARIABLES (MUST CAPTION):
   - You MUST describe anything that is temporary.
   - **Clothing:** Every piece of fabric must be described.
   - **Body State:** Bloating, sweat, messy hair, skin texture, tan lines.
   - **Spatial Orientation (Gravity):** This is critical. Is the subject standing, lying on their back, lying on their side? You must decouple the *pose* from the *camera rotation*.
   - **Environment:** Where are they?
   - **Lighting:** Direction, color, and hardness.

3. THE TECHNICAL "NEGATIVE" SPACE (CRITICAL - CAPTION IMPERFECTIONS):
   - We must separate the *Image Quality* from the *Subject*.
   - **Image Degradation:** Blurry, grainy, pixelated, jpeg artifacts.
   - **Geometric & Lens Distortion:**
     - If the photo is a "high-angle selfie" (making the forehead look big), you MUST caption "high-angle shot" or "lens distortion."
     - If the angle is unflattering or amateur (e.g., "up-nose angle," "awkward framing"), describe it.
   - **Compositional Flaws:** "Messy background," "dirty mirror reflection," "flash glare," "obscured face."

EDGE CASE WATCHLIST (Be Vigilant):
- **Mirrors:** If it's a mirror selfie, describe the phone blocking the face or the flash flare on the glass.
- **Rotations:** If the image is physically rotated (e.g., portrait photo displayed sideways), explicitly state "rotated image" or "sideways orientation."
- **Distortions:** Wide-angle lenses (GoPro/Phone 0.5x) distort faces. Caption "wide-angle lens distortion" so the model doesn't learn the distorted face as the truth.

SUMMARY OF OPERATIONS:
- Look at the image.
- Ask: "Is this feature permanent, or is it a result of the camera/environment?"
- If Permanent -> Ignore.
- If Temporary (Pose/Light) -> Describe detail.
- If Technical/Compositional Flaw -> Criticize it accurately.
`;

// --- VARIABLE STYLE DEFAULTS (The "Voice") ---

export const DEFAULT_DATASET_PROMPT_CONTENT = `STYLE GUIDE: FLUX.2 [klein]
CORE RULES

Write Prose: Describe the scene like a novelist using full sentences. Do not use comma-separated keyword lists.
What You Write Is What You Get: The model does not add details you didn't ask for (no "upsampling"). Be descriptive.
Front-Load Priority: The model focuses most on the first few words. Put the main subject and action at the very start.

PROMPT FORMULA Structure your paragraph in this specific order:
1. Subject: Who/what is it? (Start with {{trigger}})
2. Setting: Where are they?
3. Details: Clothing, textures, props.
4. Lighting: (Most Important) Source, direction, and color of light.
5. Atmosphere: The mood or emotion.
6. Style (Optional): Add at the very end (e.g., "Style: 90s Flash Photography").

LIGHTING (CRITICAL) Lighting determines quality. Never write "good lighting." Describe it like a photographer:
- Source: Natural, neon, window, fire.
- Direction: Side-lit, back-lit, overhead.
- Quality: Soft/diffused (flattering) vs. Harsh/direct (dramatic).
- Example: "Golden hour sunlight filters through the trees, creating soft lens flares."

LENGTH GUIDE
- Short (10-30 words): Best for quick style tests or simple concepts.
- Medium (30-80 words): The standard length for most high-quality images.
- Long (80-300 words): Use only when you need to control every specific detail. *Note: Avoid "fluff" words; every word should add visual info.*

{{nsfw}}

You must also generate a clean, descriptive filename (snake_case) relevant to the visual content (for file organization only), ending in .txt.`;

export const DEFAULT_INFERENCE_PROMPT_CONTENT = `Role: You are an expert Stable Diffusion Prompt Engineer for Z-Image-Turbo.

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

    // Process the variable "Style" part of the prompt
    const variableInstructions = processTemplate(promptTemplate.content, {
      trigger: triggerWord,
      nsfw: nsfwInstruction
    });

    // Combine Fixed Strategy + Variable Style
    const finalSystemInstruction = `${DATASET_STRATEGY_PROMPT}\n\n=== MODEL SPECIFIC INSTRUCTIONS ===\n${variableInstructions}`;

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
        systemInstruction: finalSystemInstruction,
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
