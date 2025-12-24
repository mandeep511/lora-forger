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