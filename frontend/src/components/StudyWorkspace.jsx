import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import Editor from '@monaco-editor/react';
import { executeCode } from '../services/codeRunner.js';
import { 
  FileText, 
  BookOpen, 
  ArrowLeft, 
  ArrowRight, 
  Upload, 
  Download, 
  Save, 
  Trash2, 
  Eye, 
  Edit3, 
  Loader2, 
  AlertCircle,
  Code2,
  Play,
  Terminal,
  X
} from 'lucide-react';

export default function StudyWorkspace({ roomId, socket, userRole, onClose }) {
  const { fetchWithAuth } = useAuth();
  
  // State variables
  const [notesText, setNotesText] = useState('');
  const [activePdfUrl, setActivePdfUrl] = useState(null);
  const [activePdfPage, setActivePdfPage] = useState(1);
  const [previewMode, setPreviewMode] = useState(false); // false = Edit, true = Preview
  const [workspaceTab, setWorkspaceTab] = useState('study'); // 'study' or 'code'
  const [codeText, setCodeText] = useState('// Type your code here...\nconsole.log("Hello, World!");');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeOutput, setCodeOutput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  
  // UI states
  const [pdfUploadLoading, setPdfUploadLoading] = useState(false);
  const [pdfUrlInput, setPdfUrlInput] = useState('');
  const [pdfPageInput, setPdfPageInput] = useState('1');
  const [sessionNotesList, setSessionNotesList] = useState([]);
  const [sessionNotesLoading, setSessionNotesLoading] = useState(false);
  const [newSnapshotTitle, setNewSnapshotTitle] = useState('');
  const [isSavingSnapshot, setIsSavingSnapshot] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Refs for cursor tracking
  const notesTextareaRef = useRef(null);
  
  // Roles
  const isHostOrCoHost = userRole === 'host' || userRole === 'co-host';
  const isGuest = userRole === 'guest';

  // API URL prefix
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

  // 1. Fetch saved session notes on load
  const fetchSessionNotes = useCallback(async () => {
    setSessionNotesLoading(true);
    try {
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/session-notes`);
      const data = await res.json();
      if (res.ok) {
        setSessionNotesList(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching session notes:', err);
    } finally {
      setSessionNotesLoading(false);
    }
  }, [roomId, apiUrl, fetchWithAuth]);

  useEffect(() => {
    fetchSessionNotes();

    // 2. Wire Socket Events
    socket.on('study-init', ({ sharedNotes, sharedCode, sharedCodeLang, activePdfUrl, activePdfPage }) => {
      setNotesText(sharedNotes || '');
      if (sharedCode !== undefined) setCodeText(sharedCode || '// Type your code here...\nconsole.log("Hello, World!");');
      if (sharedCodeLang !== undefined) setCodeLanguage(sharedCodeLang || 'javascript');
      setActivePdfUrl(activePdfUrl || null);
      setActivePdfPage(activePdfPage || 1);
      setPdfPageInput(String(activePdfPage || 1));
    });

    socket.on('notes-update', ({ text }) => {
      const el = notesTextareaRef.current;
      if (el && document.activeElement === el) {
        // Preserve cursor position to avoid cursor jumps
        const start = el.selectionStart;
        const end = el.selectionEnd;
        setNotesText(text);
        setTimeout(() => {
          el.setSelectionRange(start, end);
        }, 0);
      } else {
        setNotesText(text);
      }
    });

    socket.on('code-update', ({ text, lang }) => {
      if (text !== undefined) setCodeText(text);
      if (lang !== undefined) setCodeLanguage(lang);
    });

    socket.on('pdf-url-update', ({ pdfUrl, page }) => {
      setActivePdfUrl(pdfUrl);
      setActivePdfPage(page);
      setPdfPageInput(String(page));
    });

    socket.on('pdf-page-update', ({ page }) => {
      setActivePdfPage(page);
      setPdfPageInput(String(page));
    });

    socket.on('session-notes-update', () => {
      fetchSessionNotes();
    });

    // Request initial state catching up if socket is already connected
    socket.emit('join-room', { roomId });

    return () => {
      socket.off('study-init');
      socket.off('notes-update');
      socket.off('code-update');
      socket.off('pdf-url-update');
      socket.off('pdf-page-update');
      socket.off('session-notes-update');
    };
  }, [roomId, socket, fetchSessionNotes]);

  // 3. Handle Notes Change (emits change to other peers)
  const handleNotesChange = (e) => {
    const val = e.target.value;
    setNotesText(val);
    socket.emit('notes-update', { text: val });
  };

  // Handle Code Editor text change
  const handleCodeChange = (val) => {
    setCodeText(val);
    socket.emit('code-update', { text: val, lang: codeLanguage });
  };

  // Handle Code Sandbox Language selection
  const handleLanguageChange = (lang) => {
    setCodeLanguage(lang);
    
    // Automatically fill with a simple helper template if code is empty/default
    let newCode = codeText;
    if (!codeText || codeText.trim().startsWith('//') || codeText.trim().startsWith('#')) {
      if (lang === 'python') {
        newCode = '# Type your Python code here...\nprint("Hello, World!")';
      } else {
        newCode = '// Type your JavaScript code here...\nconsole.log("Hello, World!");';
      }
      setCodeText(newCode);
    }
    
    socket.emit('code-update', { text: newCode, lang });
  };

  // Run the code client-side
  const handleRunCode = async () => {
    setIsExecuting(true);
    setCodeOutput('Executing code in client browser...');
    try {
      const output = await executeCode(codeText, codeLanguage);
      setCodeOutput(output);
    } catch (err) {
      setCodeOutput(`[ERROR] Run failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  // 4. Handle PDF Upload
  const handlePdfUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      showError('Please upload a valid PDF document.');
      return;
    }

    setPdfUploadLoading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/pdf`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.message || 'Failed to upload PDF');
      }

      showSuccess('PDF uploaded and synced successfully!');
    } catch (err) {
      showError(err.message || 'Error uploading PDF.');
    } finally {
      setPdfUploadLoading(false);
      e.target.value = null; // Clear input field
    }
  };

  // 5. Handle PDF URL set directly
  const handlePdfUrlSubmit = async (e) => {
    e.preventDefault();
    if (!pdfUrlInput.trim()) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/pdf-url`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: pdfUrlInput.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to set PDF link');
      }

      showSuccess('PDF link synced successfully!');
      setPdfUrlInput('');
    } catch (err) {
      showError(err.message || 'Error setting PDF link.');
    }
  };

  // 6. Handle PDF Page Updates
  const updatePdfPage = (newPage) => {
    const page = Math.max(1, parseInt(newPage) || 1);
    setActivePdfPage(page);
    setPdfPageInput(String(page));
    socket.emit('pdf-page-update', { page });
  };

  const handlePageChangeSubmit = (e) => {
    e.preventDefault();
    updatePdfPage(pdfPageInput);
  };

  // 7. Clear / Close the active PDF for everyone
  const handleClearPdf = async () => {
    if (!confirm('Remove the shared PDF for everyone in the room?')) return;
    try {
      await fetchWithAuth(`${apiUrl}/rooms/${roomId}/pdf-url`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfUrl: '' }),
      });
      setActivePdfUrl(null);
      setActivePdfPage(1);
      setPdfPageInput('1');
    } catch (err) {
      showError('Failed to clear PDF.');
    }
  };

  // 8. Save Session Note Snapshot
  const handleSaveSnapshot = async (e) => {
    e.preventDefault();
    if (!newSnapshotTitle.trim()) return;
    if (!notesText.trim()) {
      showError('Notes are empty. Write something before saving.');
      return;
    }

    setIsSavingSnapshot(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/session-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newSnapshotTitle.trim(),
          content: notesText,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to save snapshot');
      }

      showSuccess('Session note snapshot saved!');
      setNewSnapshotTitle('');
      fetchSessionNotes();
      socket.emit('session-notes-update');
    } catch (err) {
      showError(err.message || 'Error saving session note.');
    } finally {
      setIsSavingSnapshot(false);
    }
  };

  // 8. Delete Session Note Snapshot
  const handleDeleteSnapshot = async (noteId) => {
    if (!confirm('Are you sure you want to delete this session note?')) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth(`${apiUrl}/rooms/${roomId}/session-notes/${noteId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete snapshot');
      }

      showSuccess('Note snapshot deleted.');
      fetchSessionNotes();
      socket.emit('session-notes-update');
    } catch (err) {
      showError(err.message || 'Error deleting note.');
    }
  };

  // 9. Load Snapshot into active editor
  const handleLoadSnapshot = (note) => {
    if (!confirm('Loading this snapshot will replace the current active shared notes. Are you sure?')) return;
    setNotesText(note.content);
    socket.emit('notes-update', { text: note.content });
    showSuccess(`Loaded session note: "${note.title}"`);
  };

  // 10. Download Notes as Markdown
  const handleDownloadMarkdown = () => {
    if (!notesText.trim()) {
      showError('Notes are empty.');
      return;
    }
    const blob = new Blob([notesText], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-notes-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Alert helpers
  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 4500);
  };

  const showSuccess = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4500);
  };

  // Extremely basic regex-based markdown renderer for previewing notes
  const renderMarkdown = (text) => {
    if (!text) return '<p class="text-slate-500 italic">No notes written yet. Start typing...</p>';
    
    // Escape HTML to prevent XSS
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3 class="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-3 mb-1 font-display">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 class="text-base font-bold text-slate-800 dark:text-white mt-4 mb-2 border-b border-slate-200 dark:border-slate-900 pb-1 font-display">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 class="text-lg font-extrabold text-slate-900 dark:text-white mt-5 mb-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-1 font-display">$1</h1>');

    // Bold & Italics
    html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');
    html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');
    
    // Lists
    html = html.replace(/^\s*-\s+(.*$)/gim, '<li class="list-disc ml-4 text-slate-700 dark:text-slate-300">$1</li>');
    html = html.replace(/^\s*\*\s+(.*$)/gim, '<li class="list-disc ml-4 text-slate-700 dark:text-slate-300">$1</li>');
    html = html.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="list-decimal ml-4 text-slate-700 dark:text-slate-300">$1</li>');

    // Newlines to breaks (if not enclosed in list tags)
    html = html.split('\n').map(line => {
      if (line.trim().startsWith('<li') || line.trim().startsWith('<h') || line.trim().startsWith('<hr')) {
        return line;
      }
      return line.trim() ? `<p class="mb-2 text-slate-700 dark:text-slate-300">${line}</p>` : '<br/>';
    }).join('\n');

    return html;
  };

  // Build local/absolute URL for PDF iframe
  const getFullPdfUrl = () => {
    if (!activePdfUrl) return '';
    const cleanUrl = activePdfUrl.startsWith('http') 
      ? activePdfUrl 
      : `${wsUrl}${activePdfUrl}`;
    
    // Append page number hash so modern browser PDF viewers scroll directly to it
    return `${cleanUrl}#page=${activePdfPage}`;
  };

  return (
    <div className="flex flex-col gap-4 h-[640px] animate-fade-in text-left">
      
      {/* Workspace Tabs Header */}
      <div className="flex justify-between items-center bg-slate-50/80 dark:bg-slate-900/40 p-2 border border-slate-200 dark:border-slate-800 rounded-2xl shrink-0 gap-4 flex-wrap">
        <div className="flex gap-2">
          <button
            onClick={() => setWorkspaceTab('study')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              workspaceTab === 'study'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Study Lounge</span>
          </button>
          
          <button
            onClick={() => setWorkspaceTab('code')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              workspaceTab === 'code'
                ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-md'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Coding Sandbox</span>
          </button>
        </div>

        {/* Close workspace button */}
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/35 text-rose-600 dark:text-rose-450 hover:text-rose-700 dark:hover:text-rose-400 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1 shrink-0"
            title="Close Study Workspace"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Close Workspace</span>
          </button>
        )}
      </div>

      {workspaceTab === 'study' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1 min-h-0">
          
          {/* LEFT COLUMN: Synced PDF Viewer */}
          <div className="flex flex-col h-full bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* PDF Header Controls */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-900 flex flex-col gap-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Synchronized PDF Reader</h3>
                </div>

                <div className="flex items-center gap-2">
                  {activePdfUrl && (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-650/15 text-indigo-650 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 rounded">
                      Page {activePdfPage}
                    </span>
                  )}

                  {/* Close / clear PDF button — host & co-host only */}
                  {activePdfUrl && isHostOrCoHost && (
                    <button
                      onClick={handleClearPdf}
                      title="Close shared PDF"
                      className="flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Close PDF</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Upload / URL Input (Host/Co-host Only) */}
              {isHostOrCoHost ? (
                <div className="flex flex-col sm:flex-row gap-2.5 items-stretch">
                  {/* File Upload Button */}
                  <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0">
                    {pdfUploadLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                    )}
                    <span>{pdfUploadLoading ? 'Uploading...' : 'Upload PDF'}</span>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePdfUpload}
                      disabled={pdfUploadLoading}
                      className="hidden"
                    />
                  </label>

                  {/* URL Paste Input */}
                  <form onSubmit={handlePdfUrlSubmit} className="flex-1 flex gap-1.5">
                    <input
                      type="url"
                      placeholder="Or paste public PDF URL link..."
                      value={pdfUrlInput}
                      onChange={(e) => setPdfUrlInput(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-750 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      Link
                    </button>
                  </form>
                </div>
              ) : (
                <div className="text-[10px] text-slate-550 italic bg-slate-100 dark:bg-slate-950/20 px-3 py-1.5 border border-slate-200 dark:border-slate-900/60 rounded-xl">
                  Collaborative Reader: PDF file source and synchronization are controlled by the host.
                </div>
              )}

              {/* Sync Page bar (Only for Host/Co-host) */}
              {activePdfUrl && isHostOrCoHost && (
                <div className="flex items-center justify-between pt-1 border-t border-slate-200 dark:border-slate-900/60">
                  <div className="flex gap-1.5 items-center">
                    <button
                      onClick={() => updatePdfPage(activePdfPage - 1)}
                      disabled={activePdfPage <= 1}
                      className="p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition-all disabled:opacity-50"
                      title="Previous Page"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => updatePdfPage(activePdfPage + 1)}
                      className="p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg cursor-pointer transition-all"
                      title="Next Page"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Jump to Page form */}
                  <form onSubmit={handlePageChangeSubmit} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-550 dark:text-slate-500 font-bold">Go to page:</span>
                    <input
                      type="number"
                      min="1"
                      value={pdfPageInput}
                      onChange={(e) => setPdfPageInput(e.target.value)}
                      className="w-12 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-1.5 py-0.5 text-center text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="text-[9px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-850 text-slate-700 dark:text-slate-300 font-bold px-2 py-1 rounded-lg"
                    >
                      Go
                    </button>
                  </form>
                </div>
              )}
            </div>

            {/* PDF Content Area */}
            <div className="flex-1 w-full bg-slate-50 dark:bg-slate-950/80 relative">
              {activePdfUrl ? (
                <iframe
                  key={`${activePdfUrl}-${activePdfPage}`}
                  src={getFullPdfUrl()}
                  className="w-full h-full border-none"
                  title="Shared Room PDF Viewer"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-6 space-y-4">
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-200 dark:border-indigo-500/20 shadow-lg animate-pulse">
                    <BookOpen className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white">No Document Shared Yet</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-450 leading-relaxed">
                      {isHostOrCoHost 
                        ? "Upload a PDF document or paste a public PDF link above to start studying collaboratively with everyone in the room."
                        : "Wait for the room host to upload or link a PDF document to start study sessions."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
     
          {/* RIGHT COLUMN: Shared Notes & Snapshots timeline */}
          <div className="flex flex-col h-full bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Editor Header Toolbar */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-900 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">Shared Study Notes</h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Download Notes */}
                <button
                  onClick={handleDownloadMarkdown}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                  title="Download Notes as Markdown (.md)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export</span>
                </button>

                {/* Preview Toggle */}
                <button
                  onClick={() => setPreviewMode(!previewMode)}
                  className={`p-1.5 border rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    previewMode 
                      ? 'bg-indigo-50 dark:bg-indigo-650/20 border-indigo-200 dark:border-indigo-500/30 text-indigo-650 dark:text-indigo-400' 
                      : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {previewMode ? (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Edit Mode</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Preview</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Status / Errors Banner */}
            {error && (
              <div className="p-2.5 mx-4 mt-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/35 rounded-xl text-[10px] text-rose-600 dark:text-rose-450 font-semibold flex items-center gap-2 animate-fade-in shrink-0">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-405" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-2.5 mx-4 mt-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-250 dark:border-emerald-900/35 rounded-xl text-[10px] text-emerald-650 dark:text-emerald-455 font-semibold flex items-center gap-2 animate-fade-in shrink-0">
                <Save className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>{success}</span>
              </div>
            )}

            {/* Main Editor Canvas Workspace */}
            <div className="flex-1 p-4 flex flex-col min-h-0 overflow-y-auto">
              
              {previewMode ? (
                /* Markdown rendered Preview mode */
                <div 
                  className="flex-1 w-full bg-slate-50 dark:bg-slate-950/30 border border-slate-200 dark:border-slate-900/50 rounded-2xl p-4 overflow-y-auto select-text prose dark:prose-invert max-w-none text-left"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(notesText) }}
                />
              ) : (
                /* Shared Notepad Textarea */
                <textarea
                  ref={notesTextareaRef}
                  value={notesText}
                  onChange={handleNotesChange}
                  disabled={isGuest}
                  placeholder={
                    isGuest 
                      ? "Read-only workspace: Guests do not have permission to write notes."
                      : "Collaborative notepad. Start writing notes... Supports basic Markdown formatting (# Header, ## Header, - List, **Bold**, *Italics*)"
                  }
                  className="flex-1 w-full bg-white dark:bg-slate-950/50 border border-slate-200 dark:border-slate-900 rounded-2xl p-4 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-700 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed h-full overflow-y-auto"
                />
              )}

              {/* Session Snapshot form */}
              {!isGuest && (
                <form onSubmit={handleSaveSnapshot} className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-900/60 shrink-0">
                  <input
                    type="text"
                    placeholder="Save current session note snapshot title..."
                    value={newSnapshotTitle}
                    onChange={(e) => setNewSnapshotTitle(e.target.value)}
                    maxLength={45}
                    className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:border-indigo-500 font-sans"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSavingSnapshot}
                    className="bg-indigo-655 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow cursor-pointer flex items-center gap-1.5 active:scale-[0.98] shrink-0 font-sans"
                  >
                    {isSavingSnapshot ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Save Snapshot</span>
                  </button>
                </form>
              )}

              {/* Snapshots history timeline drawer */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-900/80 text-left shrink-0">
                <h4 className="text-[10px] font-extrabold uppercase text-slate-550 tracking-wider mb-3 px-1">Session notes history</h4>
                
                {sessionNotesLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 text-indigo-550 animate-spin" />
                  </div>
                ) : sessionNotesList.length === 0 ? (
                  <p className="text-[10px] text-slate-500 dark:text-slate-600 italic px-1">No historical session snapshots saved yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1">
                    {sessionNotesList.map((note) => (
                      <div 
                        key={note.id}
                        className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-900/80 rounded-xl hover:border-slate-300 dark:hover:border-slate-800 transition-all gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{note.title}</span>
                            <span className="text-[8px] text-slate-600 dark:text-slate-400 font-bold px-1.5 py-0.5 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded">
                              by: {note.username || 'System'}
                            </span>
                          </div>
                          <span className="text-[8px] text-slate-505 dark:text-slate-600 block mt-0.5 font-mono">
                            {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Load button */}
                          {!isGuest && (
                            <button
                              type="button"
                              onClick={() => handleLoadSnapshot(note)}
                              title="Restore Snapshot into Shared Notes"
                              className="px-2 py-1 bg-slate-200 hover:bg-slate-305 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 hover:border-indigo-300 dark:hover:border-indigo-900/40 text-[9px] text-indigo-600 dark:text-indigo-400 font-bold rounded-lg transition-all cursor-pointer"
                            >
                              Restore
                            </button>
                          )}

                          {/* Delete button */}
                          {(isHostOrCoHost || note.createdById === socket.userId) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSnapshot(note.id)}
                              title="Delete snapshot"
                              className="p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-slate-400 dark:text-slate-550 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      ) : (
        /* CODE SANDBOX VIEW */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 flex-1 min-h-0">
          
          {/* Monaco Editor Container (Spans 2 columns on lg screens) */}
          <div className="lg:col-span-2 flex flex-col h-full bg-white dark:bg-slate-950/40 border border-slate-200 dark:border-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Editor Toolbar */}
            <div className="p-4 bg-slate-50/50 dark:bg-slate-950/20 border-b border-slate-200 dark:border-slate-900 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-650 dark:text-indigo-405" />
                <h3 className="text-xs font-bold text-slate-850 dark:text-white uppercase tracking-wider">Shared Code Editor</h3>
              </div>

              <div className="flex items-center gap-3">
                {/* Language Dropdown Selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Lang:</span>
                  <select
                    value={codeLanguage}
                    onChange={(e) => handleLanguageChange(e.target.value)}
                    disabled={isGuest}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer font-semibold shadow-sm"
                  >
                    <option value="javascript">JavaScript (Worker sandbox)</option>
                    <option value="python">Python 3 (WASM Pyodide)</option>
                  </select>
                </div>

                {/* Run Button */}
                <button
                  onClick={handleRunCode}
                  disabled={isExecuting}
                  className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 disabled:bg-emerald-700/50 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98] shadow-md shadow-emerald-500/10"
                >
                  {isExecuting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  <span>{isExecuting ? 'Running...' : 'Run Code'}</span>
                </button>
              </div>
            </div>

            {/* Monaco Editor Canvas Area */}
            <div className="flex-1 w-full bg-[#1e1e1e] relative min-h-0">
              {isGuest && (
                <div className="absolute top-2 right-2 z-10 px-2 py-0.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[9px] font-bold rounded backdrop-blur-sm pointer-events-none">
                  Read-Only Mode
                </div>
              )}
              <Editor
                height="100%"
                language={codeLanguage}
                value={codeText}
                onChange={handleCodeChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  readOnly: isGuest,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 10, bottom: 10 },
                  fontFamily: 'Fira Code, Consolas, Monaco, monospace',
                  fontLigatures: true,
                }}
                loading={
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Loading Monaco Editor...</span>
                  </div>
                }
              />
            </div>
          </div>

          {/* Execution Console Terminal Output Column */}
          <div className="flex flex-col h-full bg-[#0f141c] border border-slate-900 rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Terminal Title Header */}
            <div className="p-4 bg-[#090d16] border-b border-slate-900 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-green-500 dark:text-green-400" />
                <h3 className="text-xs font-bold text-slate-350 dark:text-slate-400 uppercase tracking-wider">Console Output</h3>
              </div>

              {/* Clear Console button */}
              <button
                onClick={() => setCodeOutput('')}
                className="px-2 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[10px] text-slate-400 hover:text-white rounded-lg transition-all cursor-pointer font-bold"
              >
                Clear Output
              </button>
            </div>

            {/* Console Output Output pane */}
            <div className="flex-1 p-5 overflow-y-auto font-mono text-xs text-green-400 whitespace-pre-wrap select-text text-left leading-relaxed">
              {codeOutput ? (
                codeOutput
              ) : (
                <span className="text-slate-500 italic text-[11px]">No output. Run code to see logs here.</span>
              )}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
