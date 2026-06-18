import http from 'http';
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

// Seed lookup parameters then start listener
seedDatabase().then(() => {
  server.listen(config.PORT, () => {
    console.log(`🚀 Watch2Gether Server is running in "${config.NODE_ENV}" mode`);
    console.log(`👉 REST API Root: http://localhost:${config.PORT}/api/v1`);
    console.log(`👉 WS Origin: http://localhost:${config.PORT}`);
  });
});

// Triggering nodemon reload to pick up new model configuration
