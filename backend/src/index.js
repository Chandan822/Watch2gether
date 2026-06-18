import http from 'http';
import https from 'https';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import app from './app.js';
import { config } from './config/index.js';
import { initSocketService } from './services/socketService.js';
import { seedDatabase } from './db/seed.js';

/**
 * Server Bootstrapper
 *
 * We create a native Node http server around our Express application.
 * This is required to attach the Socket.IO WebSocket server onto the same port.
 */
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Handshake Token Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token is required'));
  }
  try {
    const decoded = jwt.verify(token, config.JWT_ACCESS_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Initialize Socket event listeners
initSocketService(io);

/**
 * Keeps the server active by pinging its own health route.
 * Render free tier services spin down after 15 minutes of inactivity.
 * A ping every 5 minutes prevents this.
 */
function startKeepAlive() {
  const backendUrl = config.BACKEND_URL;
  if (!backendUrl) {
    console.log('ℹ️ BACKEND_URL not set. Self-ping keep-alive is disabled.');
    return;
  }

  const pingUrl = `${backendUrl.replace(/\/$/, '')}/api/v1/health`;
  console.log(
    `⏱️ Keep-alive self-ping configured for: ${pingUrl} (every 5 minutes)`
  );

  // Ping every 5 minutes
  setInterval(
    () => {
      const lib = pingUrl.startsWith('https') ? https : http;
      lib
        .get(pingUrl, (res) => {
          console.log(`📡 Keep-alive self-ping response: ${res.statusCode}`);
        })
        .on('error', (err) => {
          console.error(`❌ Keep-alive self-ping failed:`, err.message);
        });
    },
    5 * 60 * 1000
  );
}

// Seed lookup parameters then start listener
seedDatabase().then(() => {
  server.listen(config.PORT, () => {
    console.log(
      `🚀 Watch2Gether Server is running in "${config.NODE_ENV}" mode`
    );
    console.log(`👉 REST API Root: http://localhost:${config.PORT}/api/v1`);
    console.log(`👉 WS Origin: http://localhost:${config.PORT}`);

    // Start the keep-alive self-ping routine
    startKeepAlive();
  });
});
