import { useEffect } from 'react';
import { socket } from '../services/socket.js';

/**
 * Custom React hook for listening to Socket.IO events.
 * 
 * Safely registers a socket listener when a component mounts and disposes of
 * the subscription when it unmounts to prevent memory leaks.
 */
export const useSocketEvent = (eventName, callback) => {
  useEffect(() => {
    socket.on(eventName, callback);
    return () => {
      socket.off(eventName, callback);
    };
  }, [eventName, callback]);
};

export default useSocketEvent;
