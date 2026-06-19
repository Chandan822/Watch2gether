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
  Info,
  Undo2,
  Redo2,
  MousePointer,
  Move,
  Check,
  X
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
  const gridCanvasRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const actionsRef = useRef([]); // Holds drawing actions history

  // Whiteboard States
  const [tool, setTool] = useState('pen'); // 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'select'
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(4);
  const [fontSize, setFontSize] = useState(16);
  const [showGrid, setShowGrid] = useState(true);

  // Selection state
  const [selectedActionId, setSelectedActionId] = useState(null);
  const selectedActionRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const initialActionPosRef = useRef({ x: 0, y: 0 });

  // Undo / Redo Local Stacks (using refs to avoid stale state in handlers)
  const undoStackRef = useRef([]); // Array of { strokeId, actions }
  const redoStackRef = useRef([]); // Array of { strokeId, actions }
  const currentStrokeActionsRef = useRef([]); // Array of segments for current stroke
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Text insertion state
  const [textInput, setTextInput] = useState(null); // { x, y, value: '' }
  const textInputRef = useRef(null);
  const isDraggingActiveInputRef = useRef(false);
  const activeInputStartOffsetRef = useRef({ x: 0, y: 0 });
  const editingActionRef = useRef(null); // Holds the text action currently being edited

  // Drawing Internal Tracking Refs
  const isDrawingRef = useRef(false);
  const lastXRef = useRef(0);
  const lastYRef = useRef(0);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const strokeIdRef = useRef(null);

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

  // Redraw grid background canvas
  const redrawGrid = () => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (showGrid) {
      drawGrid(ctx, w, h);
    }
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

  // Redraw the entire drawing canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    actionsRef.current.forEach((action) => {
      drawAction(ctx, action, w, h);

      // Draw dashed selection border if selected
      if (action.type === 'text' && action.strokeId === selectedActionId) {
        ctx.save();
        ctx.strokeStyle = '#6366f1'; // indigo-500
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);

        const tx = action.x * w;
        const ty = action.y * h;
        const height = action.fontSize || 16;
        const width = action.text.length * (height * 0.6);

        ctx.strokeRect(tx - 6, ty - 6, width + 12, height + 12);
        ctx.restore();
      }
    });
  };

  // Adjust canvas layout sizes to standard 16:9 ratio
  const handleResize = () => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    const gridCanvas = gridCanvasRef.current;
    if (!container || !canvas || !previewCanvas || !gridCanvas) return;

    // Calculate dimensions maintaining 16:9 aspect ratio
    const width = container.clientWidth;
    const height = width * (9 / 16);

    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    previewCanvas.width = width;
    previewCanvas.height = height;
    gridCanvas.width = width;
    gridCanvas.height = height;

    redrawGrid();
    redrawCanvas();
  };

  // Re-draw grid when showGrid state changes
  useEffect(() => {
    redrawGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showGrid]);

  // Re-draw canvas when selectedActionId changes
  useEffect(() => {
    redrawCanvas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedActionId]);

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
      // If action is updated text (moves existing action), replace it in registry
      const existingIdx = actionsRef.current.findIndex((act) => act.strokeId === action.strokeId);
      if (existingIdx !== -1) {
        actionsRef.current[existingIdx] = action;
      } else {
        actionsRef.current.push(action);
      }
      redrawCanvas();
    });

    socket.on('whiteboard-undo', ({ strokeId }) => {
      actionsRef.current = actionsRef.current.filter((act) => act.strokeId !== strokeId);
      // Remove from local undo stack if it came from us
      undoStackRef.current = undoStackRef.current.filter((item) => item.strokeId !== strokeId);
      setCanUndo(undoStackRef.current.length > 0);
      if (selectedActionId === strokeId) {
        setSelectedActionId(null);
        selectedActionRef.current = null;
      }
      redrawCanvas();
    });

    socket.on('whiteboard-redo', (actions) => {
      actionsRef.current.push(...actions);
      redrawCanvas();
    });

    socket.on('whiteboard-clear', () => {
      actionsRef.current = [];
      undoStackRef.current = [];
      redoStackRef.current = [];
      setSelectedActionId(null);
      selectedActionRef.current = null;
      setCanUndo(false);
      setCanRedo(false);
      redrawCanvas();
    });

    // Request full whiteboard init history update
    socket.emit('whiteboard-init', { roomId });

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('whiteboard-init');
      socket.off('whiteboard-action');
      socket.off('whiteboard-clear');
      socket.off('whiteboard-undo');
      socket.off('whiteboard-redo');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, socket, selectedActionId]);

  // Undo / Redo Handlers
  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;

    const item = undoStackRef.current.pop();
    redoStackRef.current.push(item);

    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);

    // Emit undo event
    socket.emit('whiteboard-undo', { strokeId: item.strokeId });

    // Update local canvas
    actionsRef.current = actionsRef.current.filter((act) => act.strokeId !== item.strokeId);
    redrawCanvas();
  };

  const handleRedo = () => {
    if (redoStackRef.current.length === 0) return;

    const item = redoStackRef.current.pop();
    undoStackRef.current.push(item);

    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);

    // Emit redo event to server (which broadcasts and appends to room history)
    socket.emit('whiteboard-redo', item.actions);

    // Update local canvas
    actionsRef.current.push(...item.actions);
    redrawCanvas();
  };

  // Handle Keyboard Shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isGuest) return;
      if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGuest]);

  // Handle Text inputs commit
  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      handleCancelText();
      return;
    }

    const action = {
      type: 'text',
      text: textInput.value.trim(),
      x: textInput.x,
      y: textInput.y,
      color,
      fontSize,
      strokeId: strokeIdRef.current || Math.random().toString(36).substring(2, 9)
    };

    // If we are saving an edit to an existing text action, clear the old one first
    if (editingActionRef.current) {
      socket.emit('whiteboard-undo', { strokeId: editingActionRef.current.strokeId });
      undoStackRef.current = undoStackRef.current.filter((item) => item.strokeId !== editingActionRef.current.strokeId);
    }

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
    editingActionRef.current = null;

    // Push to undo stack
    undoStackRef.current.push({
      strokeId: action.strokeId,
      actions: [action]
    });
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  const handleCancelText = () => {
    if (editingActionRef.current) {
      // Restore original action
      actionsRef.current.push(editingActionRef.current);
      editingActionRef.current = null;
      redrawCanvas();
    }
    setTextInput(null);
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitText();
    } else if (e.key === 'Escape') {
      handleCancelText();
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

  // Hit testing for text actions
  const findTextActionAt = (x, y, w, h) => {
    for (let i = actionsRef.current.length - 1; i >= 0; i--) {
      const action = actionsRef.current[i];
      if (action.type === 'text') {
        const tx = action.x * w;
        const ty = action.y * h;
        const height = action.fontSize || 16;
        const width = action.text.length * (height * 0.6);

        if (
          x >= tx - 6 &&
          x <= tx + width + 6 &&
          y >= ty - 6 &&
          y <= ty + height + 6
        ) {
          return { action, index: i };
        }
      }
    }
    return null;
  };

  // Active Input Dragging handler
  const handleActiveInputDragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const currentAbsX = textInput.x * canvas.width;
    const currentAbsY = textInput.y * canvas.height;

    activeInputStartOffsetRef.current = {
      x: clickX - currentAbsX,
      y: clickY - currentAbsY
    };

    isDraggingActiveInputRef.current = true;

    const handleWindowMouseMove = (moveEv) => {
      if (!isDraggingActiveInputRef.current) return;
      const currentRect = canvas.getBoundingClientRect();
      const curX = moveEv.clientX - currentRect.left;
      const curY = moveEv.clientY - currentRect.top;

      const newAbsX = curX - activeInputStartOffsetRef.current.x;
      const newAbsY = curY - activeInputStartOffsetRef.current.y;

      setTextInput((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          x: Math.max(0, Math.min(1, newAbsX / canvas.width)),
          y: Math.max(0, Math.min(1, newAbsY / canvas.height))
        };
      });
    };

    const handleWindowMouseUp = () => {
      isDraggingActiveInputRef.current = false;
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
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

    if (tool === 'select') {
      const hit = findTextActionAt(coords.x, coords.y, canvas.width, canvas.height);
      if (hit) {
        selectedActionRef.current = hit.action;
        setSelectedActionId(hit.action.strokeId);

        const currentAbsX = hit.action.x * canvas.width;
        const currentAbsY = hit.action.y * canvas.height;
        dragOffsetRef.current = {
          x: coords.x - currentAbsX,
          y: coords.y - currentAbsY
        };

        initialActionPosRef.current = {
          x: hit.action.x,
          y: hit.action.y
        };

        isDrawingRef.current = true;
      } else {
        setSelectedActionId(null);
        selectedActionRef.current = null;
      }
      return;
    }

    if (tool === 'text') {
      strokeIdRef.current = Math.random().toString(36).substring(2, 9);
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
    currentStrokeActionsRef.current = [];
  };

  const handleDoubleClick = (e) => {
    if (isGuest) return;
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const hit = findTextActionAt(coords.x, coords.y, canvas.width, canvas.height);
    if (hit) {
      // Commit any active text if open
      if (textInput) {
        commitText();
      }

      // Enter edit mode for existing text
      editingActionRef.current = hit.action;
      strokeIdRef.current = hit.action.strokeId;
      setTextInput({ x: hit.action.x, y: hit.action.y, value: hit.action.text });

      // Temporarily remove the text from rendering
      actionsRef.current = actionsRef.current.filter((act) => act.strokeId !== hit.action.strokeId);
      setSelectedActionId(null);
      selectedActionRef.current = null;
      redrawCanvas();

      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus();
          textInputRef.current.select();
        }
      }, 50);
    }
  };

  const handleMove = (e) => {
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    const previewCanvas = previewCanvasRef.current;
    if (!canvas || !previewCanvas) return;

    if (tool === 'select') {
      if (isDrawingRef.current && selectedActionRef.current) {
        const newAbsX = coords.x - dragOffsetRef.current.x;
        const newAbsY = coords.y - dragOffsetRef.current.y;

        selectedActionRef.current.x = Math.max(0, Math.min(1, newAbsX / canvas.width));
        selectedActionRef.current.y = Math.max(0, Math.min(1, newAbsY / canvas.height));

        redrawCanvas();
      } else {
        const hit = findTextActionAt(coords.x, coords.y, canvas.width, canvas.height);
        if (hit) {
          previewCanvas.style.cursor = 'pointer';
        } else {
          previewCanvas.style.cursor = 'default';
        }
      }
      return;
    }

    if (!isDrawingRef.current || isGuest) return;

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
      currentStrokeActionsRef.current.push(segmentAction);

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
    if (tool === 'select') {
      if (isDrawingRef.current && selectedActionRef.current) {
        isDrawingRef.current = false;
        const action = selectedActionRef.current;
        const initialPos = initialActionPosRef.current;

        if (action.x !== initialPos.x || action.y !== initialPos.y) {
          // Sync with everyone by undoing old stroke and emitting updated position
          socket.emit('whiteboard-undo', { strokeId: action.strokeId });
          socket.emit('whiteboard-action', action);

          // Update reference inside local undo stack
          const undoItem = undoStackRef.current.find((item) => item.strokeId === action.strokeId);
          if (undoItem) {
            undoItem.actions = [action];
          }
        }
      }
      return;
    }

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
        width: lineWidth,
        strokeId: strokeIdRef.current
      };

      // Draw locally on main canvas
      drawAction(ctx, shapeAction, w, h);

      // Emit to server
      socket.emit('whiteboard-action', shapeAction);

      // Append locally
      actionsRef.current.push(shapeAction);

      // Save to undo stack
      undoStackRef.current.push({
        strokeId: shapeAction.strokeId,
        actions: [shapeAction]
      });
      redoStackRef.current = [];
      setCanUndo(true);
      setCanRedo(false);
    } else {
      // Freehand drawing stroke ended
      if (currentStrokeActionsRef.current.length > 0) {
        undoStackRef.current.push({
          strokeId: strokeIdRef.current,
          actions: [...currentStrokeActionsRef.current]
        });
        redoStackRef.current = [];
        setCanUndo(true);
        setCanRedo(false);
      }
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
      {/* Upper info panel / Guest notification & Grid Options */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900/30 border border-slate-200 dark:border-slate-900 px-4 py-3 rounded-2xl gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-500 dark:text-indigo-400 shrink-0" />
          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {isGuest 
              ? 'Viewing collaborative whiteboard. Guests do not have edit rights.' 
              : 'Collaborate in real-time. Use tools, select / double-click text to edit.'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Grid vs Plain Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setShowGrid(false)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                !showGrid
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Plain
            </button>
            <button
              type="button"
              onClick={() => setShowGrid(true)}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                showGrid
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Grid
            </button>
          </div>

          {isGuest ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-lg text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
              <Eye className="w-3.5 h-3.5" />
              Read Only
            </span>
          ) : (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-200 dark:border-rose-900/30 text-rose-500 dark:text-rose-455 hover:text-rose-700 dark:hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Board
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Workstation Container */}
      <div 
        ref={containerRef} 
        className="relative aspect-video rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center w-full group/canvas select-none"
      >
        {/* Grid Canvas Background Layer */}
        <canvas
          ref={gridCanvasRef}
          className="absolute inset-0 z-0 bg-slate-100 dark:bg-slate-950"
        />

        {/* Main Drawings Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-10 bg-transparent"
        />

        {/* Temporary Overlays / Shapes Preview Canvas */}
        <canvas
          ref={previewCanvasRef}
          className={`absolute inset-0 z-20 ${isGuest ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
          onMouseDown={handleStart}
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onDoubleClick={handleDoubleClick}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        />

        {/* Text Area Overlay Input */}
        {textInput && (
          <div 
            className="absolute z-30 flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-2xl gap-1.5"
            style={{ 
              top: `${textInput.y * 100}%`, 
              left: `${textInput.x * 100}%`,
              transform: 'translateY(-2px)' 
            }}
          >
            {/* Drag Handle */}
            <div 
              className="cursor-move text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-350 p-0.5 shrink-0"
              onMouseDown={handleActiveInputDragStart}
              title="Drag to Move"
            >
              <Move className="w-3.5 h-3.5" />
            </div>
            <input
              ref={textInputRef}
              type="text"
              value={textInput.value}
              onChange={(e) => setTextInput({ ...textInput, value: e.target.value })}
              onKeyDown={handleTextKeyDown}
              placeholder="Type something..."
              style={{ color, fontSize: `${fontSize}px` }}
              className="bg-transparent border-none outline-none focus:ring-0 text-xs text-slate-850 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-650 min-w-[120px] font-medium p-0"
            />
            {/* Action Buttons */}
            <button
              type="button"
              onClick={commitText}
              className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-500 dark:hover:text-emerald-400 p-0.5 cursor-pointer shrink-0"
              title="Save (Enter)"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleCancelText}
              className="text-rose-600 hover:text-rose-500 dark:text-rose-500 dark:hover:text-rose-455 p-0.5 cursor-pointer shrink-0"
              title="Cancel (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Floating Toolbar Panel (Only visible for non-guests) */}
      {!isGuest && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900/20 border border-slate-200 dark:border-slate-900 rounded-3xl backdrop-blur-sm">
          {/* Tool selector & Undo/Redo buttons */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-900">
              <button
                type="button"
                onClick={() => {
                  setTool('select');
                  setSelectedActionId(null);
                  selectedActionRef.current = null;
                }}
                title="Select & Move Tool"
                className={`p-2 rounded-lg transition-all cursor-pointer ${
                  tool === 'select' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-900'
                }`}
              >
                <MousePointer className="w-4 h-4" />
              </button>
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

            {/* Undo / Redo Group */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                  canUndo
                    ? 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                    : 'text-slate-300 dark:text-slate-850 border-transparent cursor-not-allowed'
                }`}
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                className={`p-2 rounded-xl transition-all cursor-pointer border ${
                  canRedo
                    ? 'text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                    : 'text-slate-300 dark:text-slate-850 border-transparent cursor-not-allowed'
                }`}
              >
                <Redo2 className="w-4 h-4" />
              </button>
            </div>
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
