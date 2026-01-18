
import React, { useState, useEffect, useCallback } from "react";
import { X, Plus, Trash2, Save, Copy, AlertCircle, RefreshCw, PenLine, Lock, Eye, EyeOff, BrainCircuit, Check } from "lucide-react";
import { PromptTemplate, PromptType } from "../types";
import { v4 as uuidv4 } from "uuid";
import { DATASET_STRATEGY_PROMPT } from "../services/geminiService";

interface PromptTunerProps {
  isOpen: boolean;
  onClose: () => void;
  type: PromptType;
  prompts: PromptTemplate[];
  activePromptId: string;
  onSavePrompt: (prompt: PromptTemplate) => void;
  onDeletePrompt: (id: string) => void;
  onSelectPrompt: (id: string) => void;
}

const VARIABLES_MAP = {
  DATASET: [
    { name: "{{trigger}}", desc: "The Trigger Word (e.g., OHWX)" },
    { name: "{{nsfw}}", desc: "NSFW Guidelines (if toggle enabled)" },
  ],
  INFERENCE: [
    { name: "{{trigger}}", desc: "The Trigger Word" },
    { name: "{{style}}", desc: "Selected Art Style" },
    { name: "{{nsfw}}", desc: "NSFW Guidelines" },
  ]
};

export const PromptTuner: React.FC<PromptTunerProps> = ({
  isOpen,
  onClose,
  type,
  prompts,
  activePromptId,
  onSavePrompt,
  onDeletePrompt,
  onSelectPrompt
}) => {
  const [selectedId, setSelectedId] = useState<string>(activePromptId);
  const [editedName, setEditedName] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);

  // Filter prompts by current type (Dataset vs Inference)
  const currentTypePrompts = prompts.filter(p => p.type === type);
  const activeTemplate = currentTypePrompts.find(p => p.id === selectedId) || currentTypePrompts[0];

  useEffect(() => {
    if (isOpen && activePromptId) {
      setSelectedId(activePromptId);
    }
  }, [isOpen, activePromptId]);

  // Load template into editor when selection changes
  useEffect(() => {
    if (activeTemplate) {
      setEditedName(activeTemplate.name);
      setEditedContent(activeTemplate.content);
      setHasUnsavedChanges(false);
      setIsSaving(false);
    }
  }, [activeTemplate, selectedId]);

  // --- Auto Save Logic ---
  const saveChanges = useCallback((overrideName?: string, overrideContent?: string) => {
    if (!activeTemplate || activeTemplate.isDefault) return;
    
    setIsSaving(true);
    const updatedPrompt: PromptTemplate = {
      ...activeTemplate,
      name: overrideName ?? editedName,
      content: overrideContent ?? editedContent,
      lastModified: Date.now()
    };
    
    // Simulate network delay for effect
    setTimeout(() => {
        onSavePrompt(updatedPrompt);
        setHasUnsavedChanges(false);
        setIsSaving(false);
    }, 600);

  }, [activeTemplate, editedName, editedContent, onSavePrompt]);

  useEffect(() => {
    // Only auto-save if it's NOT a default template and there are changes
    if (hasUnsavedChanges && activeTemplate && !activeTemplate.isDefault) {
      const timer = setTimeout(() => {
        saveChanges();
      }, 3000); // 3 seconds auto-save
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, activeTemplate, saveChanges]);


  const handleContentChange = (val: string) => {
    setEditedContent(val);
    setHasUnsavedChanges(true);
  };

  const handleNameChange = (val: string) => {
    setEditedName(val);
    setHasUnsavedChanges(true);
  };

  const handleManualSave = () => {
    if (!activeTemplate) return;

    // Logic: If Default, create copy. If Custom, update.
    if (activeTemplate.isDefault) {
      const newPrompt: PromptTemplate = {
        id: uuidv4(),
        name: `Copy of ${activeTemplate.name}`,
        content: editedContent,
        type: type,
        isDefault: false,
        lastModified: Date.now()
      };
      onSavePrompt(newPrompt);
      setSelectedId(newPrompt.id); // Switch to new
      onSelectPrompt(newPrompt.id);
    } else {
      saveChanges();
    }
  };

  const handleCreateNew = () => {
    const newPrompt: PromptTemplate = {
      id: uuidv4(),
      name: "Untitled System Prompt",
      content: "STYLE GUIDE: My Custom Style\n\n1. Always describe the lighting.\n2. Start with {{trigger}}.\n3. Keep it concise.",
      type: type,
      isDefault: false,
      lastModified: Date.now()
    };
    onSavePrompt(newPrompt);
    setSelectedId(newPrompt.id);
    onSelectPrompt(newPrompt.id);
  };

  const insertVariable = (variable: string) => {
    setEditedContent(prev => prev + ` ${variable} `);
    setHasUnsavedChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white/90 backdrop-blur-xl w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/50">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/50">
          <div className="flex items-center gap-3">
             <div className={`p-2 rounded-xl ${type === 'DATASET' ? 'bg-sky-100 text-sky-600' : 'bg-pink-100 text-pink-600'}`}>
                <PenLine size={20} />
             </div>
             <div>
               <h2 className="text-lg font-bold text-slate-800">Prompt Tuner</h2>
               <p className="text-xs text-slate-500 font-semibold">Customize {type === 'DATASET' ? 'Captioning' : 'Inference'} Logic</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar: List */}
          <div className="w-64 md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
             <div className="p-4">
                <button 
                  onClick={handleCreateNew}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:shadow-md rounded-xl text-sm font-bold text-slate-600 transition-all"
                >
                  <Plus size={16} /> New Prompt
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto px-2 space-y-1 pb-4">
                {currentTypePrompts.map(prompt => (
                   <div 
                      key={prompt.id}
                      onClick={() => setSelectedId(prompt.id)}
                      className={`group relative p-3 rounded-xl cursor-pointer border transition-all ${
                         selectedId === prompt.id 
                           ? 'bg-white border-slate-200 shadow-sm' 
                           : 'bg-transparent border-transparent hover:bg-white/60'
                      }`}
                   >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wider ${prompt.isDefault ? 'text-amber-500' : 'text-slate-400'}`}>
                          {prompt.isDefault ? 'System Default' : 'Custom'}
                        </span>
                        {prompt.isDefault && <Lock size={12} className="text-slate-300" />}
                      </div>
                      <div className="text-sm font-bold text-slate-700 truncate pr-6">{prompt.name}</div>
                      
                      {!prompt.isDefault && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); onDeletePrompt(prompt.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                   </div>
                ))}
             </div>
          </div>

          {/* Main Editor */}
          <div className="flex-1 flex flex-col bg-white">
             {/* Toolbar */}
             <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                <div className="flex-1">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Prompt Name</label>
                   <input 
                      type="text" 
                      value={editedName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={activeTemplate?.isDefault}
                      className="w-full text-lg font-bold text-slate-700 bg-transparent outline-none placeholder:text-slate-300 disabled:opacity-50"
                      placeholder="Untitled Prompt"
                   />
                </div>
                <div className="flex items-center gap-3">
                   
                   {/* Auto-save Status */}
                   {!activeTemplate?.isDefault && (
                       <div className="flex items-center gap-2 px-3">
                           {isSaving ? (
                               <>
                                <RefreshCw size={12} className="animate-spin text-slate-400" />
                                <span className="text-xs font-medium text-slate-400">Saving...</span>
                               </>
                           ) : hasUnsavedChanges ? (
                                <span className="text-xs font-medium text-amber-500">Unsaved</span>
                           ) : (
                                <>
                                <Check size={14} className="text-emerald-500" />
                                <span className="text-xs font-medium text-emerald-500">Saved</span>
                                </>
                           )}
                       </div>
                   )}

                   <div className="h-6 w-px bg-slate-200 mx-2"></div>

                   <button 
                      onClick={handleManualSave}
                      disabled={!hasUnsavedChanges && !activeTemplate?.isDefault}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-lg ${
                         activeTemplate?.isDefault 
                           ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' 
                           : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                      }`}
                   >
                      {activeTemplate?.isDefault ? <Copy size={16} /> : <Save size={16} />}
                      {activeTemplate?.isDefault ? 'Duplicate to Edit' : 'Save Now'}
                   </button>
                </div>
             </div>

             {/* Content Area */}
             <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
                <div className="flex-1 relative flex flex-col">
                  
                  {/* Strategy Context Block */}
                  {type === 'DATASET' && (
                      <div className="border-b border-slate-100 bg-slate-50/50">
                        <button 
                            onClick={() => setShowStrategy(!showStrategy)}
                            className="w-full flex items-center justify-between px-6 py-3 text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                <BrainCircuit size={16} className="text-indigo-500" />
                                <span>Includes "Disentanglement" Strategy Context</span>
                            </div>
                            {showStrategy ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                        {showStrategy && (
                            <div className="px-6 py-4 bg-slate-100/50 border-t border-slate-100 max-h-48 overflow-y-auto shadow-inner">
                                <pre className="text-[10px] text-slate-500 font-mono whitespace-pre-wrap leading-relaxed">
                                    {DATASET_STRATEGY_PROMPT}
                                </pre>
                            </div>
                        )}
                      </div>
                  )}

                  <div className="flex-1 relative">
                    <textarea 
                        value={editedContent}
                        onChange={(e) => handleContentChange(e.target.value)}
                        disabled={activeTemplate?.isDefault}
                        className="w-full h-full p-6 resize-none outline-none text-sm font-mono leading-relaxed text-slate-600 bg-white"
                        placeholder="Enter system prompt instructions here..."
                        spellCheck={false}
                    />
                    {activeTemplate?.isDefault && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100/50 backdrop-blur-[1px] cursor-not-allowed z-10">
                        <div className="bg-white px-6 py-4 rounded-2xl shadow-xl flex flex-col items-center gap-2 border border-slate-100">
                            <Lock size={24} className="text-amber-500" />
                            <p className="text-sm font-bold text-slate-600">Default Prompt is Locked</p>
                            <button onClick={handleManualSave} className="text-xs font-bold text-white bg-amber-500 px-4 py-2 rounded-lg hover:bg-amber-600 transition-colors">
                                Click to Duplicate & Edit
                            </button>
                        </div>
                        </div>
                    )}
                  </div>
                </div>

                {/* Variables Sidebar */}
                <div className="w-48 bg-white border-l border-slate-100 p-4 overflow-y-auto shadow-[-4px_0_24px_-10px_rgba(0,0,0,0.05)] z-20">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Variables</h3>
                   <div className="flex flex-col gap-2">
                      {VARIABLES_MAP[type].map((v) => (
                        <button
                          key={v.name}
                          onClick={() => !activeTemplate?.isDefault && insertVariable(v.name)}
                          disabled={activeTemplate?.isDefault}
                          className="text-left group p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                           <code className="block text-xs font-bold text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded w-fit mb-1">{v.name}</code>
                           <span className="text-[10px] text-slate-400 font-medium leading-tight block">{v.desc}</span>
                        </button>
                      ))}
                   </div>

                   <div className="mt-6 p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="flex gap-2 mb-1">
                        <AlertCircle size={14} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600 uppercase">Tip</span>
                      </div>
                      <p className="text-[10px] text-amber-700/80 leading-relaxed">
                        Variables are replaced automatically. The "Strategy" (logic) is pre-pended to your prompt.
                      </p>
                   </div>
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
