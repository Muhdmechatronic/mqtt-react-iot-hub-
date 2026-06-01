import { defineConfig } from 'vite';
import react    from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    port: 5173,
    // basicSsl enables HTTPS automatically — browser will show a cert warning
    // on first visit; click "Proceed anyway" once to allow microphone access.
    proxy: {
      '/api':       { target: 'http://localhost:3000', secure: false },
      '/socket.io': { target: 'http://localhost:3000', ws: true, secure: false },
    },
  },
});
