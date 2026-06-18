import { io } from 'socket.io-client';

/**
 * Socket.IO Client Configuration
 * 
 * We fetch the backend WebSocket URL from environment settings.
 * autoConnect is disabled by default so we can control exactly when the socket
 * establishes its handshake (e.g. after the user sets their username).
 */
const SOCKET_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

export default socket;
