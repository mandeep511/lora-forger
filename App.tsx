
import React, { useState, useRef, useEffect } from "react";
import JSZip from "jszip";
import { v4 as uuidv4 } from "uuid";
import {
  Upload,
  Download,
  Sparkles,
  Loader2,
  ImagePlus,
  Zap,
  Shield,
  Flame,
  Wand2,
  Database,
  Heart,
  Settings,
  ChevronDown
} from "lucide-react";
import { DatasetImage, ProcessingStatus, AppTab, PromptTemplate, DEFAULT_DATASET_TEMPLATE_ID, DEFAULT_INFERENCE_TEMPLATE_ID } from "./types";
import { generateImageCaption, DEFAULT_DATASET_PROMPT_CONTENT, DEFAULT_INFERENCE_PROMPT_CONTENT } from "./services/geminiService";
import { ImageCard } from "./components/ImageCard";
import { InferenceLab } from "./components/InferenceLab";
import { PromptTuner } from "./components/PromptTuner";

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.DATASET);
  const [images, setImages] = useState<DatasetImage[]>([]);
  const [triggerWord, setTriggerWord] = useState<string>("");
  const [triggerError, setTriggerError] = useState<boolean>(false);
  const [isNSFW, setIsNSFW] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isZipping, setIsZipping] = useState(false);
  
  // --- Prompt Management State ---
  const [isPromptTunerOpen, setIsPromptTunerOpen] = useState(false);
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedDatasetPromptId, setSelectedDatasetPromptId] = useState<string>(DEFAULT_DATASET_TEMPLATE_ID);
  const [selectedInferencePromptId, setSelectedInferencePromptId] = useState<string>(DEFAULT_INFERENCE_TEMPLATE_ID);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Theme Colors based on active tab ---
  const activeColorClass = activeTab === AppTab.DATASET ? "text-sky-500" : "text-pink-500";
  const activeBgClass = activeTab === AppTab.DATASET ? "bg-sky-500" : "bg-pink-500";
  const activeLightBgClass = activeTab === AppTab.DATASET ? "bg-sky-50" : "bg-pink-50";

  // --- Initialization ---
  useEffect(() => {
    // Load prompts from local storage or set defaults
    const storedPrompts = localStorage.getItem('lora_forger_prompts');
    if (storedPrompts) {
      setPrompts(JSON.parse(storedPrompts));
    } else {
      const defaults: PromptTemplate[] = [
        {
          id: DEFAULT_DATASET_TEMPLATE_ID,
          name: 'Flux [Klein] Style Guide',
          content: DEFAULT_DATASET_PROMPT_CONTENT,
          type: 'DATASET',
          isDefault: true,
          lastModified: Date.now()
        },
        {
          id: DEFAULT_INFERENCE_TEMPLATE_ID,
          name: 'Default (Z-Image-Turbo)',
          content: DEFAULT_INFERENCE_PROMPT_CONTENT,
          type: 'INFERENCE',
          isDefault: true,
          lastModified: Date.now()
        }
      ];
      setPrompts(defaults);
      localStorage.setItem('lora_forger_prompts', JSON.stringify(defaults));
    }
    
    // Load last selections
    const lastDatasetId = localStorage.getItem('selected_dataset_prompt_id');
    const lastInferenceId = localStorage.getItem('selected_inference_prompt_id');
    if (lastDatasetId) setSelectedDatasetPromptId(lastDatasetId);
    if (lastInferenceId) setSelectedInferencePromptId(lastInferenceId);
  }, []);

  const savePromptsToStorage = (newPrompts: PromptTemplate[]) => {
    setPrompts(newPrompts);
    localStorage.setItem('lora_forger_prompts', JSON.stringify(newPrompts));
  };

  const handleSavePrompt = (updatedPrompt: PromptTemplate) => {
    const exists = prompts.find(p => p.id === updatedPrompt.id);
    let newPrompts;
    if (exists) {
      newPrompts = prompts.map(p => p.id === updatedPrompt.id ? updatedPrompt : p);
    } else {
      newPrompts = [...prompts, updatedPrompt];
    }
    savePromptsToStorage(newPrompts);
  };

  const handleDeletePrompt = (id: string) => {
    const newPrompts = prompts.filter(p => p.id !== id);
    savePromptsToStorage(newPrompts);
    // Reset selection if deleted
    if (activeTab === AppTab.DATASET && id === selectedDatasetPromptId) {
       setSelectedDatasetPromptId(DEFAULT_DATASET_TEMPLATE_ID);
    } else if (activeTab === AppTab.INFERENCE && id === selectedInferencePromptId) {
       setSelectedInferencePromptId(DEFAULT_INFERENCE_TEMPLATE_ID);
    }
  };

  const activePrompt = prompts.find(p => 
    p.id === (activeTab === AppTab.DATASET ? selectedDatasetPromptId : selectedInferencePromptId)
  );

  // --- File Handling ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newImages: DatasetImage[] = (Array.from(e.target.files) as File[]).map(
        (file) => ({
          id: uuidv4(),
          file,
          previewUrl: URL.createObjectURL(file),
          caption: "",
          suggestedFilename: file.name.replace(/\.[^/.]+$/, "") + ".txt",
          status: ProcessingStatus.PENDING,
        })
      );
      setImages((prev) => [...prev, ...newImages]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const updateImage = (id: string, updates: Partial<DatasetImage>) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
    );
  };

  // --- Generation Logic ---

  const processImage = async (image: DatasetImage) => {
    updateImage(image.id, { status: ProcessingStatus.PROCESSING, errorMessage: undefined });

    try {
      // Find the prompt template object
      const template = prompts.find(p => p.id === selectedDatasetPromptId) || prompts[0];
      
      const result = await generateImageCaption(image.file, triggerWord, isNSFW, template);
      updateImage(image.id, {
        status: ProcessingStatus.COMPLETED,
        caption: result.caption,
        suggestedFilename: result.filename,
      });
    } catch (error) {
      updateImage(image.id, {
        status: ProcessingStatus.ERROR,
        errorMessage: "Generation failed",
      });
    }
  };

  const handleGenerateAll = async () => {
    if (!triggerWord.trim()) {
      setTriggerError(true);
      return;
    }

    setIsGenerating(true);
    const pendingImages = images.filter(
      (img) =>
        img.status === ProcessingStatus.PENDING ||
        img.status === ProcessingStatus.ERROR
    );
    const BATCH_SIZE = 3;
    for (let i = 0; i < pendingImages.length; i += BATCH_SIZE) {
        const batch = pendingImages.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map((img) => processImage(img)));
    }
    setIsGenerating(false);
  };

  const handleRegenerate = (id: string) => {
    if (!triggerWord.trim()) {
      setTriggerError(true);
      return;
    }
    const img = images.find((i) => i.id === id);
    if (img) processImage(img);
  };

  const handleTriggerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTriggerWord(e.target.value);
    if (e.target.value.trim()) {
      setTriggerError(false);
    }
  };

  // --- Export Logic ---

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      for (const img of images) {
        const imageContent = await img.file.arrayBuffer();
        const imageExt = img.file.name.split('.').pop() || 'png';
        const baseName = img.suggestedFilename.replace(/\.txt$/i, "");
        zip.file(`${baseName}.${imageExt}`, imageContent);
        zip.file(`${baseName}.txt`, img.caption);
      }
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lora_dataset_${triggerWord.toLowerCase() || "untitled"}_${new Date().getTime()}.zip`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to zip", err);
      alert("Failed to create ZIP file.");
    } finally {
      setIsZipping(false);
    }
  };

  const stats = {
    total: images.length,
    completed: images.filter(i => i.status === ProcessingStatus.COMPLETED).length,
    pending: images.filter(i => i.status === ProcessingStatus.PENDING).length,
    processing: images.filter(i => i.status === ProcessingStatus.PROCESSING).length,
  };

  const handleSelectPrompt = (id: string) => {
    if (activeTab === AppTab.DATASET) {
      setSelectedDatasetPromptId(id);
      localStorage.setItem('selected_dataset_prompt_id', id);
    } else {
      setSelectedInferencePromptId(id);
      localStorage.setItem('selected_inference_prompt_id', id);
    }
  };

  return (
    <div className="flex flex-col h-screen text-slate-600">
      
      <PromptTuner 
        isOpen={isPromptTunerOpen}
        onClose={() => setIsPromptTunerOpen(false)}
        type={activeTab === AppTab.DATASET ? 'DATASET' : 'INFERENCE'}
        prompts={prompts}
        activePromptId={activeTab === AppTab.DATASET ? selectedDatasetPromptId : selectedInferencePromptId}
        onSavePrompt={handleSavePrompt}
        onDeletePrompt={handleDeletePrompt}
        onSelectPrompt={handleSelectPrompt}
      />

      {/* --- Soft Header --- */}
      <header className="z-50 px-4 pt-4 pb-2 md:px-8 md:pt-6">
        <div className="glass-panel rounded-3xl px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Branding */}
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-2xl ${activeLightBgClass} transition-colors duration-500`}>
                    <Heart className={`${activeColorClass} fill-current`} size={24} />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-800 leading-none">LoRA Forger</h1>
                    <span className="text-xs font-semibold text-slate-400">Make LORA datasets</span>
                </div>
            </div>

            {/* Center: Pill Tabs */}
            <div className="flex p-1 bg-slate-100/80 rounded-full border border-slate-200">
                <button 
                    onClick={() => setActiveTab(AppTab.DATASET)}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                        activeTab === AppTab.DATASET 
                        ? 'bg-white text-sky-500 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <Database size={16} />
                    Dataset
                </button>
                <button 
                    onClick={() => setActiveTab(AppTab.INFERENCE)}
                    className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                        activeTab === AppTab.INFERENCE 
                        ? 'bg-white text-pink-500 shadow-sm' 
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <Wand2 size={16} />
                    Inference
                </button>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3">
                 {/* Trigger Input */}
                 <div className={`hidden md:flex items-center gap-2 rounded-2xl px-3 py-1.5 transition-all shadow-sm border ${
                     triggerError 
                     ? "bg-red-50 border-red-400 ring-2 ring-red-200 animate-pulse" 
                     : "bg-white/50 border-slate-200 focus-within:bg-white focus-within:border-indigo-300"
                 }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${triggerError ? "text-red-500" : "text-slate-400"}`}>
                        {triggerError ? "Required!" : "Trigger"}
                    </span>
                    <input
                        type="text"
                        value={triggerWord}
                        onChange={handleTriggerChange}
                        className={`bg-transparent border-none outline-none text-sm font-bold w-20 text-center ${triggerError ? "text-red-600 placeholder:text-red-300" : activeColorClass}`}
                        placeholder="OHWX"
                    />
                </div>

                {/* NSFW Toggle (Cute Style) */}
                <button
                    onClick={() => setIsNSFW(!isNSFW)}
                    className={`p-2.5 rounded-2xl border transition-all duration-300 ${
                        isNSFW 
                        ? "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100" 
                        : "bg-white/50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-white"
                    }`}
                    title={isNSFW ? "NSFW Enabled" : "Safe Mode"}
                >
                    {isNSFW ? <Flame size={20} className="fill-rose-100" /> : <Shield size={20} />}
                </button>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 relative">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          multiple
          accept="image/*"
          className="hidden"
        />

        {activeTab === AppTab.DATASET && (
            <>
                {images.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-8 animate-in fade-in zoom-in duration-300 pb-20">
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className="group cursor-pointer flex flex-col items-center justify-center w-full max-w-lg h-72 border-4 border-dashed border-slate-200 hover:border-sky-300 hover:bg-sky-50 rounded-[2rem] transition-all relative overflow-hidden bg-white/40"
                        >
                            <div className="p-6 bg-white rounded-3xl mb-4 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-slate-100">
                                <Upload size={32} className="text-slate-300 group-hover:text-sky-400" />
                            </div>
                            <p className="text-xl font-bold text-slate-600 group-hover:text-sky-500 transition-colors">Drop Dataset Images</p>
                            <p className="text-sm text-slate-400 mt-2 font-medium">Supports JPG, PNG, WEBP</p>
                        </div>
                        
                        {/* Steps */}
                        <div className="flex gap-12 opacity-80">
                            {[
                                { num: 1, label: "Upload" },
                                { num: 2, label: "Caption" },
                                { num: 3, label: "Export" }
                            ].map((step, idx) => (
                                <div key={idx} className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm">
                                        {step.num}
                                    </div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{step.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Action Bar */}
                        <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 glass-panel p-3 rounded-2xl mb-8">
                             <div className="flex items-center gap-4 px-4">
                                 <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Total: <span className="text-slate-700">{stats.total}</span>
                                 </span>
                                 <div className="h-4 w-px bg-slate-200"></div>
                                 <div className="flex items-center gap-2 text-xs font-medium">
                                     <span className={stats.completed === stats.total ? "text-emerald-500 font-bold" : "text-slate-500"}>
                                        {stats.completed} Done
                                     </span>
                                     {stats.processing > 0 && (
                                         <span className="text-sky-500 font-bold flex items-center gap-1">
                                            <Loader2 size={10} className="animate-spin" />
                                            {stats.processing} Working
                                         </span>
                                     )}
                                 </div>
                             </div>

                             <div className="flex gap-2">
                                {/* Prompt Selector */}
                                <div className="hidden md:flex items-center gap-2 bg-white/60 rounded-xl px-2 border border-slate-200 shadow-sm">
                                  <button onClick={() => setIsPromptTunerOpen(true)} className="p-2 hover:bg-white rounded-lg transition-colors text-slate-400 hover:text-sky-500">
                                    <Settings size={16} />
                                  </button>
                                  <div className="h-4 w-px bg-slate-200"></div>
                                  <select 
                                    value={selectedDatasetPromptId} 
                                    onChange={(e) => handleSelectPrompt(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-slate-600 outline-none w-32 py-2 truncate cursor-pointer"
                                  >
                                    {prompts.filter(p => p.type === 'DATASET').map(p => (
                                      <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors border border-slate-200 shadow-sm"
                                >
                                    <ImagePlus size={14} />
                                    <span className="hidden sm:inline">Add</span>
                                </button>

                                <button
                                    onClick={handleGenerateAll}
                                    disabled={isGenerating || stats.pending + stats.processing === 0}
                                    className={`flex items-center gap-2 px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-sky-200
                                        ${isGenerating ? 'opacity-80 cursor-not-allowed' : ''}
                                        ${(stats.pending === 0 && stats.processing === 0) ? 'opacity-50 bg-slate-300 shadow-none' : ''}
                                    `}
                                >
                                    {isGenerating ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                                    <span className="hidden sm:inline">{isGenerating ? 'Processing...' : 'Generate All'}</span>
                                </button>

                                <button
                                    onClick={handleDownloadZip}
                                    disabled={isZipping || images.length === 0}
                                    className="flex items-center gap-2 px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:bg-slate-300 disabled:shadow-none"
                                >
                                    {isZipping ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                                    <span className="hidden sm:inline">Download ZIP</span>
                                </button>
                             </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 pb-20">
                            {images.map((img) => (
                                <ImageCard
                                    key={img.id}
                                    image={img}
                                    onUpdate={updateImage}
                                    onRemove={removeImage}
                                    onRegenerate={handleRegenerate}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </>
        )}

        {activeTab === AppTab.INFERENCE && (
            <InferenceLab 
                triggerWord={triggerWord} 
                isNSFW={isNSFW} 
                onTriggerError={() => setTriggerError(true)}
                prompts={prompts}
                selectedPromptId={selectedInferencePromptId}
                onSelectPrompt={handleSelectPrompt}
                onOpenTuner={() => setIsPromptTunerOpen(true)}
            />
        )}

      </main>
    </div>
  );
};

export default App;
