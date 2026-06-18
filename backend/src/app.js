import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import healthRouter from './routes/v1/health.js';
import roomsRouter from './routes/v1/rooms.js';
import authRouter from './routes/v1/auth.js';
import usersRouter from './routes/v1/users.js';
import friendsRouter from './routes/v1/friends.js';
import notificationsRouter from './routes/v1/notifications.js';
import requireAuth from './middleware/auth.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

/**
 * Express Middleware Chain
 *
 * 1. CORS Configuration: restricts requests to valid clients.
 * 2. Static Assets: serves local file uploads.
 * 3. Body Parsers: reads incoming json/urlencoded streams.
 * 4. Routing Engine: mounts resource router endpoints.
 * 5. Error Handler: collects internal errors and formats responses.
 */

app.use(
  cors({
    origin: config.CLIENT_URL,
    credentials: true,
  })
);

// Serve avatar image files statically
app.use('/uploads', express.static('public/uploads'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Versioned Endpoint Routing
app.use('/api/v1/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/rooms', requireAuth, roomsRouter);
app.use('/api/v1/friends', requireAuth, friendsRouter);
app.use('/api/v1/notifications', requireAuth, notificationsRouter);

// Handle unknown route endpoints
app.all('*', (req, res, next) => {
  const err = new Error(
    `Route handler for ${req.method} ${req.originalUrl} not found`
  );
  err.statusCode = 404;
  next(err);
});

// Mount the global error handler
app.use(errorHandler);

export default app;
