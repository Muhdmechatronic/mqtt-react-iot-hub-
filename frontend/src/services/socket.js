import { io } from 'socket.io-client';
import { v4 as uuidv4 } from 'uuid';

let socket;

// The originId identifies this browser session across all pin:write events.
// It is stable for the duration of the page session and is used by the server
// to suppress echo delivery back to the socket that sent the event.
// Stored in sessionStorage so it survives soft re-renders but resets on new tabs.
function getOriginId() {
  let id = sessionStorage.getItem('iot_origin_id');
  if (!id) {
    id = uuidv4();
    sessionStorage.setItem('iot_origin_id', id);
  }
  return id;
}

export const ORIGIN_ID = getOriginId();

export function getSocket(token) {
  if (!socket) {
    socket = io('/', { auth: { token }, transports: ['websocket'] });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}
