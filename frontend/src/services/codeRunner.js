/**
 * Client-Side WASM and Sandboxed Code Runner Service
 */

// Cache Pyodide promise to avoid loading it multiple times
let pyodidePromise = null;

/**
 * Dynamically loads Pyodide script from CDN if not already loaded
 */
const loadPyodideScript = () => {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(new Error('Failed to load Pyodide from CDN: ' + err.message));
    document.head.appendChild(script);
  });
};

/**
 * Runs Python code using Pyodide WebAssembly client-side
 */
const runPythonCode = async (code) => {
  try {
    await loadPyodideScript();

    if (!pyodidePromise) {
      pyodidePromise = window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/',
      });
    }

    const pyodide = await pyodidePromise;

    // Set up standard output redirect
    pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
`);

    // Run the user's code
    await pyodide.runPythonAsync(code);

    // Retrieve stdout and stderr
    const stdout = pyodide.runPython("sys.stdout.getvalue()");
    const stderr = pyodide.runPython("sys.stderr.getvalue()");

    let output = '';
    if (stdout) output += stdout;
    if (stderr) output += '\n[ERROR] ' + stderr;

    return output || 'Code executed successfully with no output.';
  } catch (err) {
    return `[RUNTIME ERROR] ${err.message}`;
  }
};

/**
 * Runs JavaScript code inside a sandboxed Web Worker with a execution timeout
 */
const runJavaScriptCode = (code, timeoutMs = 4000) => {
  return new Promise((resolve) => {
    // Define code run inside worker
    const workerCode = `
      self.onmessage = function(e) {
        const userCode = e.data;
        const logs = [];
        
        // Intercept console messages
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;
        
        console.log = function(...args) {
          logs.push(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
        };
        console.error = function(...args) {
          logs.push('[ERROR] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
        };
        console.warn = function(...args) {
          logs.push('[WARN] ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' '));
        };
        
        try {
          // Use Function constructor to run in worker global context
          const fn = new Function(userCode);
          fn();
        } catch (err) {
          logs.push('[RUNTIME ERROR] ' + err.message);
        }
        
        // Restore console
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
        
        self.postMessage({ logs: logs.join('\\n') });
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    let isFinished = false;

    // Timeout to terminate execution (infinite loop protection)
    const timeoutId = setTimeout(() => {
      if (!isFinished) {
        isFinished = true;
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve('Execution timed out (Limit: ' + (timeoutMs / 1000) + 's). Your code might contain an infinite loop.');
      }
    }, timeoutMs);

    worker.onmessage = (e) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve(e.data.logs || 'Code executed successfully with no output.');
      }
    };

    worker.onerror = (err) => {
      if (!isFinished) {
        isFinished = true;
        clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve(`[WORKER ERROR] ${err.message}`);
      }
    };

    // Trigger execution
    worker.postMessage(code);
  });
};

/**
 * Execute runner router
 */
export const executeCode = async (code, language) => {
  if (language === 'python') {
    return await runPythonCode(code);
  } else if (language === 'javascript') {
    return await runJavaScriptCode(code);
  } else {
    return `Language "${language}" is not supported for client-side WASM execution.`;
  }
};
