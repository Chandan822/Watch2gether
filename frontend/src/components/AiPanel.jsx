import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  FileText, 
  HelpCircle, 
  CheckSquare, 
  BookOpen, 
  Send,
  Loader2,
  AlertCircle,
  Check,
  X
} from 'lucide-react';

export default function AiPanel({ roomId, _socket, aiState, videoTitle, videoUrl }) {
  const { fetchWithAuth } = useAuth();
  
  // Tabs within AI panel
  const [subTab, setSubTab] = useState('summary'); // 'summary' | 'questions' | 'quiz' | 'explain'
  
  // Loading & error states for generations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Explain query text state
  const [explainQuery, setExplainQuery] = useState('');
  
  // User's quiz answers tracking (local only)
  // Store as: { [questionIndex]: selectedOptionIndex }
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  // Reset user's answers when a new quiz is generated
  useEffect(() => {
    setSelectedAnswers({});
    setQuizSubmitted(false);
  }, [aiState?.quiz]);

  const handleGenerate = async (type) => {
    setLoading(true);
    setError('');
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/ai/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoTitle, videoUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to generate ${type}`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error generating content.');
    } finally {
      setLoading(false);
    }
  };

  const handleExplainSubmit = async (e) => {
    e.preventDefault();
    if (!explainQuery.trim() || loading) return;

    const queryText = explainQuery.trim();
    setExplainQuery('');
    setLoading(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/ai/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoTitle, query: queryText }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to explain topic');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error fetching explanation.');
    } finally {
      setLoading(false);
    }
  };

  const selectOption = (qIdx, optIdx) => {
    if (quizSubmitted) return;
    setSelectedAnswers(prev => ({
      ...prev,
      [qIdx]: optIdx
    }));
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative">
      
      {/* Sub-tab Selectors Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-950/20 p-2 gap-1.5 shrink-0 overflow-x-auto">
        {[
          { id: 'summary', name: 'Summary', icon: FileText },
          { id: 'questions', name: 'Prompts', icon: HelpCircle },
          { id: 'quiz', name: 'Quiz', icon: CheckSquare },
          { id: 'explain', name: 'Explain', icon: BookOpen }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setSubTab(tab.id);
                setError('');
              }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-600/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 shadow-sm'
                  : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/40'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Error alert wrapper */}
      {error && (
        <div className="p-3 mx-4 mt-3 bg-rose-50 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-900/45 rounded-xl text-[10px] font-semibold text-rose-600 dark:text-rose-400 flex items-start gap-2 shrink-0 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500 dark:text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Scrollable Workstation Content Panel */}
      <div className="flex-1 p-4 overflow-y-auto min-h-0 text-left">
        
        {/* Loader backdrop */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12 space-y-3 animate-pulse shrink-0">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Gemini Thinking...</p>
          </div>
        )}

        {/* 1. Summary View Panel */}
        {!loading && subTab === 'summary' && (
          <div className="space-y-4">
            {aiState?.summary ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-900">
                  <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider">Video Summary</span>
                  <button
                    onClick={() => handleGenerate('summary')}
                    className="text-[9px] font-bold text-slate-500 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans prose prose-slate dark:prose-invert select-text whitespace-pre-wrap">
                  {aiState.summary}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-500/20 shadow-md">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">No Summary Generated</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 max-w-[200px] leading-tight">Generate a structured AI summary of the active video.</p>
                </div>
                <button
                  onClick={() => handleGenerate('summary')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/15"
                >
                  Generate Summary
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. Discussion Questions View Panel */}
        {!loading && subTab === 'questions' && (
          <div className="space-y-4">
            {aiState?.questions ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-900">
                  <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider">Discussion Prompts</span>
                  <button
                    onClick={() => handleGenerate('questions')}
                    className="text-[9px] font-bold text-slate-500 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    Regenerate
                  </button>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap select-text">
                  {aiState.questions}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-500/20 shadow-md">
                  <HelpCircle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">No Discussion Prompts</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 max-w-[200px] leading-tight">Generate thought-provoking open questions to debate together.</p>
                </div>
                <button
                  onClick={() => handleGenerate('questions')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/15"
                >
                  Generate Prompts
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. Quiz Workspace Panel */}
        {!loading && subTab === 'quiz' && (
          <div className="space-y-4">
            {aiState?.quiz && Array.isArray(aiState.quiz) ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-900">
                  <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider">Multiple-Choice Quiz</span>
                  <button
                    onClick={() => handleGenerate('quiz')}
                    className="text-[9px] font-bold text-slate-500 dark:text-slate-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                  >
                    New Quiz
                  </button>
                </div>

                <div className="space-y-5">
                  {aiState.quiz.map((q, qIdx) => {
                    const selectedOpt = selectedAnswers[qIdx];
                    const isCorrect = selectedOpt === q.correctIndex;
                    
                    return (
                      <div key={qIdx} className="space-y-2.5 bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-900/60 p-3.5 rounded-2xl">
                        <span className="text-[9px] font-extrabold text-slate-500 dark:text-slate-500 uppercase tracking-wide">Question {qIdx + 1}</span>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{q.question}</p>
                        
                        {/* Option buttons */}
                        <div className="flex flex-col gap-1.5 pt-1">
                          {q.options.map((opt, optIdx) => {
                            const isChosen = selectedOpt === optIdx;
                            let btnStyle = 'border-slate-200 dark:border-slate-900 bg-slate-50 dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-800 text-slate-600 dark:text-slate-400';
                            
                            if (isChosen) {
                              if (quizSubmitted) {
                                btnStyle = isCorrect
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 font-bold'
                                  : 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-bold';
                              } else {
                                btnStyle = 'border-indigo-500 bg-indigo-50 dark:bg-indigo-650/10 text-indigo-600 dark:text-indigo-400 font-bold';
                              }
                            } else if (quizSubmitted && optIdx === q.correctIndex) {
                              // Show correct choice if user answered incorrectly
                              btnStyle = 'border-emerald-400/50 dark:border-emerald-500/40 bg-emerald-50/50 dark:bg-emerald-950/10 text-emerald-600/80 dark:text-emerald-500/80 font-bold';
                            }

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={quizSubmitted}
                                onClick={() => selectOption(qIdx, optIdx)}
                                className={`w-full text-left p-2.5 border rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer focus:outline-none ${btnStyle}`}
                              >
                                <span>{opt}</span>
                                {quizSubmitted && isChosen && (
                                  isCorrect ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Submit Workspace Quiz */}
                {!quizSubmitted ? (
                  <button
                    onClick={() => {
                      if (Object.keys(selectedAnswers).length < aiState.quiz.length) {
                        alert('Please answer all questions before submitting.');
                        return;
                      }
                      setQuizSubmitted(true);
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 rounded-xl cursor-pointer shadow active:scale-[0.99] transition-all"
                  >
                    Submit Answers
                  </button>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/45 border border-slate-200 dark:border-slate-900 rounded-xl text-center space-y-2">
                    <p className="text-xs font-bold text-slate-800 dark:text-white">
                      Score: {Object.entries(selectedAnswers).filter(([qIdx, optIdx]) => optIdx === aiState.quiz[qIdx].correctIndex).length} / {aiState.quiz.length}
                    </p>
                    <button
                      onClick={() => {
                        setSelectedAnswers({});
                        setQuizSubmitted(false);
                      }}
                      className="text-[10px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-500/20 shadow-md">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-white">No Quiz Active</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 max-w-[200px] leading-tight">Create a 3-question multiple choice quiz to test everyone&apos;s comprehension.</p>
                </div>
                <button
                  onClick={() => handleGenerate('quiz')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/15"
                >
                  Generate Quiz
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Study Guide Q&A (Explain) Panel */}
        {!loading && subTab === 'explain' && (
          <div className="flex flex-col h-full space-y-4 justify-between">
            {/* Explanations timeline feed */}
            <div className="space-y-4">
              <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-400 tracking-wider block border-b border-slate-200 dark:border-slate-900 pb-2">Shared Q&amp;A Explanations</span>
              
              {aiState?.explanations && aiState.explanations.length > 0 ? (
                <div className="space-y-4.5">
                  {aiState.explanations.map((item) => (
                    <div key={item.id} className="space-y-2 p-3.5 bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-2xl text-xs">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-900 pb-1.5">
                        <span className="font-bold text-indigo-500 dark:text-indigo-400">Asked by: {item.username}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-600">
                          {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-extrabold uppercase text-slate-500 dark:text-slate-500">Query:</span>
                        <p className="text-slate-700 dark:text-slate-200 font-bold font-sans">&ldquo;{item.query}&rdquo;</p>
                      </div>
                      <div className="space-y-1 pt-1.5 border-t border-slate-100 dark:border-slate-900/60 select-text">
                        <span className="text-[9px] font-extrabold uppercase text-indigo-500 dark:text-indigo-500">Tutor Response:</span>
                        <div className="text-slate-600 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                          {item.explanation}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-500/20 shadow-md">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-white">Ask anything</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-500 max-w-[200px] leading-tight">Type a topic or concept below and get a detailed structured study guide explanation from Gemini.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input form sticking to bottom */}
            <form onSubmit={handleExplainSubmit} className="pt-3 border-t border-slate-200/60 dark:border-slate-900/50 flex gap-2 shrink-0 bg-slate-50/50 dark:bg-slate-950/20 p-1 rounded-xl">
              <input
                type="text"
                placeholder="Ask AI to explain a concept..."
                value={explainQuery}
                onChange={(e) => setExplainQuery(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-sans"
                maxLength={80}
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-xl cursor-pointer hover:shadow-lg hover:shadow-indigo-600/10 active:scale-[0.98] transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
