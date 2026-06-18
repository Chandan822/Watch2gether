import { useState, useEffect, useRef } from 'react';
import { 
  Paintbrush, 
  Eraser, 
  Square, 
  Circle as CircleIcon, 
  Minus, 
  Type, 
  Trash2, 
  Eye, 
  Info
} from 'lucide-react';

// Curated modern color palette
const PALETTE = [
  { name: 'White', value: '#ffffff' },
  { name: 'Slate', value: '#94a3b8' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Emerald', value: '#10b981' }
];

export default function Whiteboard({ roomId, socket, userRole = 'member' }) {
  const isGuest = userRole === 'guest';

  // Refs
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const actionsRef = useRef([]); // Holds drawing actions history

  // Whiteboard States
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text'
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(4);
  const [fontSize, setFontSize] = useState(16);

  // Drawing Internal Tracking Refs
  const isDrawingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const strokeIdRef = useRef(null);

  // Text insertion state
  const [textInput, setTextInput] = useState(null); // { x, y, value: '' }
  const textInputRef = useRef(null);

  // Helper: Draw subtle grid background
  const drawGrid = (ctx, width, height) => {
    ctx.save();
    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 0.5;
    const gridSize = 30;

    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  };

  // Draw a single action onto a canvas context
  const drawAction = (ctx, action, w, h) => {
    ctx.save();
    ctx.lineWidth = action.width || 4;
    ctx.strokeStyle = action.color;
    ctx.fillStyle = action.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (action.type === 'segment') {
      if (action.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = (action.width || 4) * 2.5; // Eraser is wider
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.beginPath();
      ctx.moveTo(action.x0 * w, action.y0 * h);
      ctx.lineTo(action.x1 * w, action.y1 * h);
      ctx.stroke();
    } else if (action.type === 'shape') {
      ctx.globalCompositeOperation = 'source-over';
      const sx = action.startX * w;
      const sy = action.startY * h;
      const ex = action.endX * w;
      const ey = action.endY * h;

      ctx.beginPath();
      if (action.shapeType === 'rect') {
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      } else if (action.shapeType === 'circle') {
        const radius = Math.sqrt(Math.pow(ex - sx, 2) + Math.pow(ey - sy, 2));
        ctx.arc(sx, sy, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (action.shapeType === 'line') {
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
      }
    } else if (action.type === 'text') {
      ctx.globalCompositeOperation = 'source-over';
      const tx = action.x * w;
      const ty = action.y * h;
      ctx.font = `${action.fontSize || 16}px "Plus Jakarta Sans", "Outfit", system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      ctx.fillText(action.text, tx, ty);
    }
    ctx.restore();
  };

  // Redraw the entire canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h);

    actionsRef.current.forEach((action) => {
      drawAction(ctx, action, w, h);
    });
  };

  // Adjust canvas layout sizes to standard 16:9 ratio
  const handleResize = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!container || !canvas || !previewCanvas) return;

    // Calculate dimensions maintaining 16:9 aspect ratio
    const width = container.clientWidth;
    const height = width * (9 / 16);

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    previewCanvas.width = width;
    previewCanvas.height = height;

    redrawCanvas();
  };

  // Initialize socket listeners and canvas sizing
  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);

    // Socket listeners
    socket.on('whiteboard-init', (history) => {
      actionsRef.current = history;
      redrawCanvas();
    });

    socket.on('whiteboard-action', (action) => {
      actionsRef.current.push(action);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        drawAction(ctx, action, canvas.width, canvas.height);
      }
    });

    socket.on('whiteboard-clear', () => {
      actionsRef.current = [];
      redrawCanvas();
    });

    // Request full whiteboard init history update
    socket.emit('whiteboard-init', { roomId });

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('whiteboard-init');
      socket.off('whiteboard-action');
      socket.off('whiteboard-clear');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket]);

  // Handle Text inputs commit
  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }

    const action = {
      type: 'text',
      text: textInput.value.trim(),
      x: textInput.x,
      y: textInput.y,
      color,
      fontSize
    };

    // Commit locally
    actionsRef.current.push(action);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      drawAction(ctx, action, canvas.width, canvas.height);
    }

    // Broadcast
    socket.emit('whiteboard-action', action);
    setTextInput(null);
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitText();
    } else if (e.key === 'Escape') {
      setTextInput(null);
    }
  };

  // Helper: Get local coords relative to client viewport
  const getCoordinates = (e) => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return { x: 0, y: 0 };

    const rect = previewCanvas.getBoundingClientRect();
    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  // Mouse / Touch handlers for drawing interaction
  const handleStart = (e) => {
    if (isGuest) return;
    if (textInput) {
      commitText();
      return;
    }

    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const normX = coords.x / canvas.width;
    const normY = coords.y / canvas.height;

    if (tool === 'text') {
      setTextInput({ x: normX, y: normY, value: '' });
      setTimeout(() => textInputRef.current?.focus(), 50);
      return;
    }

    isDrawingRef.current = true;
    lastXRef.current = coords.x;
    lastYRef.current = coords.y;
    startXRef.current = coords.x;
    startYRef.current = coords.y;
    strokeIdRef.current = Math.random().toString(36).substring(2, 9);
  };

  const handleMove = (e) => {
    if (!isDrawingRef.current || isGuest) return;

    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!canvas || !previewCanvas) return;

    const ctx = canvas.getContext('2d');
    const pCtx = previewCanvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;

    const x0 = lastXRef.current / w;
    const y0 = lastYRef.current / h;
    const x1 = coords.x / w;
    const y1 = coords.y / h;

    if (tool === 'pen' || tool === 'eraser') {
      const segmentAction = {
        type: 'segment',
        tool,
        x0,
        y0,
        x1,
        y1,
        color: tool === 'eraser' ? '#000000' : color,
        width: lineWidth,
        strokeId: strokeIdRef.current
      };

      // Draw locally on main canvas
      drawAction(ctx, segmentAction, w, h);

      // Emit to server
      socket.emit('whiteboard-action', segmentAction);

      // Append locally
      actionsRef.current.push(segmentAction);

      // Update pointer
      lastXRef.current = coords.x;
      lastYRef.current = coords.y;
    } else {
      // It's a shape preview
      pCtx.clearRect(0, 0, w, h);
      pCtx.save();
      pCtx.lineWidth = lineWidth;
      pCtx.strokeStyle = color;
      pCtx.lineCap = 'round';
      pCtx.lineJoin = 'round';
      pCtx.beginPath();

      const sx = startXRef.current;
      const sy = startYRef.current;
      const cx = coords.x;
      const cy = coords.y;

      if (tool === 'rect') {
        pCtx.strokeRect(sx, sy, cx - sx, cy - sy);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(cx - sx, 2) + Math.pow(cy - sy, 2));
        pCtx.arc(sx, sy, radius, 0, 2 * Math.PI);
        pCtx.stroke();
      } else if (tool === 'line') {
        pCtx.moveTo(sx, sy);
        pCtx.lineTo(cx, cy);
        pCtx.stroke();
      }
      pCtx.restore();
    }
  };

  const handleEnd = (e) => {
    if (!isDrawingRef.current || isGuest) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!canvas || !previewCanvas) return;

    const ctx = canvas.getContext('2d');
    const pCtx = previewCanvas.getContext('2d');

    const w = canvas.width;
    const h = canvas.height;

    // Clear shape preview overlay
    pCtx.clearRect(0, 0, w, h);

    if (tool !== 'pen' && tool !== 'eraser') {
      const coords = getCoordinates(e);

      // Don't commit tiny clicks as zero-width shapes
      const dx = Math.abs(coords.x - startXRef.current);
      const dy = Math.abs(coords.y - startYRef.current);
      if (dx < 3 && dy < 3) return;

      const shapeAction = {
        type: 'shape',
        shapeType: tool,
        startX: startXRef.current / w,
        startY: startYRef.current / h,
        endX: coords.x / w,
        endY: coords.y / h,
        color,
        width: lineWidth
      };

      // Draw locally on main canvas
      drawAction(ctx, shapeAction, w, h);

      // Emit to server
      socket.emit('whiteboard-action', shapeAction);

      // Append locally
      actionsRef.current.push(shapeAction);
    }
  };

  // Clear canvas handler
  const handleClear = () => {
    if (isGuest) return;
    if (confirm('Are you sure you want to clear the collaborative whiteboard? This will erase all drawing actions for everyone.')) {
      socket.emit('whiteboard-clear');
    }
  };

  return (
    <div className="flex flex-col space-y-4 w-full">
      {/* Upper info panel / Guest notification */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 px-4 py-3 rounded-2xl">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {isGuest 
              ? 'Viewing collaborative whiteboard. Guests do not have edit rights.' 
              : 'Collaborate in real-time. Use tools, geometric shapes, and add text.'}
          </span>
        </div>
        {isGuest ? (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
            <Eye className="w-3.5 h-3.5" />
            Read Only
          </span>
        ) : (
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-900/30 text-rose-500 dark:text-rose-400 hover:text-rose-700 dark:hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Board
          </button>
        )}
      </div>

      {/* Main Canvas Workstation Container */}
      <div 
        ref={containerRef} 
        className="relative aspect-video rounded-3xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 shadow-2xl flex items-center justify-center w-full group/canvas select-none"
      >
        {/* Main Drawings Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0 bg-slate-100 dark:bg-slate-950"
        />

        {/* Temporary Overlays / Shapes Preview Canvas */}
        <canvas
          ref={previewCanvasRef}
          className={`absolute inset-0 z-10 ${isGuest ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />

        {/* Text Area Overlay Input */}
        {textInput && (
          <div 
            className="absolute z-20"
            style={{ 
              top: `${textInput.y * 100}%`, 
              left: `${textInput.x * 100}%`,
              transform: 'translateY(-2px)' 
            }}
          >
            <input
              ref={textInputRef}
              type="text"
              value={textInput.value}
              onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
              onKeyDown={handleTextKeyDown}
              onBlur={commitText}
              placeholder="Press Enter to save..."
              style={{ color, fontSize: `${fontSize}px` }}
              className="bg-slate-900/90 border border-indigo-500 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xl text-xs min-w-[150px] font-medium"
            />
          </div>
        )}
      </div>

      {/* Floating Toolbar Panel (Only visible for non-guests) */}
      {!isGuest && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 rounded-3xl backdrop-blur-sm">
          {/* Tool selector buttons */}
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-900">
            <button
              type="button"
              onClick={() => setTool('pen')}
              title="Pen/Draw Tool"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                tool === 'pen' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Paintbrush className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              title="Eraser Tool"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                tool === 'eraser' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Eraser className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool('line')}
              title="Line Shape"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                tool === 'line' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Minus className="w-4 h-4 rotate-45" />
            </button>
            <button
              type="button"
              onClick={() => setTool('rect')}
              title="Rectangle Shape"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                tool === 'rect' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool('circle')}
              title="Circle Shape"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                tool === 'circle' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <CircleIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool('text')}
              title="Add Text overlay"
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                tool === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
              }`}
            >
              <Type className="w-4 h-4" />
            </button>
          </div>

          {/* Color palette selector */}
          {tool !== 'eraser' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-extrabold uppercase tracking-wide">Color:</span>
              <div className="flex items-center gap-1.5">
                {PALETTE.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                    className={`w-6 h-6 rounded-full border transition-all cursor-pointer hover:scale-110 active:scale-95 ${
                      color === c.value 
                        ? 'border-indigo-500 ring-2 ring-indigo-500/30' 
                        : 'border-slate-300 dark:border-slate-700'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Width / FontSize Adjustments controls */}
          <div className="flex items-center gap-4">
            {/* Stroke Width Slider */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 dark:text-slate-500 font-extrabold uppercase tracking-wide">
                {tool === 'text' ? 'Size' : 'Thickness'}:
              </span>
              {tool === 'text' ? (
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value))}
                  className="w-24 accent-indigo-500 cursor-pointer h-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 focus:outline-none"
                />
              ) : (
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={lineWidth}
                  onChange={(e) => setLineWidth(parseInt(e.target.value))}
                  className="w-24 accent-indigo-500 cursor-pointer h-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 focus:outline-none"
                />
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono w-6 text-right">
                {tool === 'text' ? `${fontSize}px` : `${lineWidth}px`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
