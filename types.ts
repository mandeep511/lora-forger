
export enum ProcessingStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export interface DatasetImage {
  id: string;
  file: File;
  previewUrl: string;
  caption: string;
  suggestedFilename: string; // The text filename (without extension, or with .txt)
  status: ProcessingStatus;
  errorMessage?: string;
}

export interface GenerationResult {
  caption: string;
  filename: string;
}

export interface InferenceResult {
  prompt: string;
}

export enum AppTab {
  DATASET = 'DATASET',
  INFERENCE = 'INFERENCE',
}

export interface AppState {
  triggerWord: string;
  images: DatasetImage[];
  isGlobalProcessing: boolean;
}

// --- Prompt Engine Types ---

export type PromptType = 'DATASET' | 'INFERENCE';

export interface PromptTemplate {
  id: string;
  name: string;
  description?: string;
  content: string; // The raw text with {{variables}}
  type: PromptType;
  isDefault: boolean; // If true, cannot be deleted or renamed, edits create copies
  lastModified: number;
}

export const DEFAULT_DATASET_TEMPLATE_ID = 'default-dataset-v1';
export const DEFAULT_INFERENCE_TEMPLATE_ID = 'default-inference-v1';
