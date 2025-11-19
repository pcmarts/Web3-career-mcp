import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get absolute path to the compiled server
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.resolve(__dirname, '../dist/index.js');

console.log(`Starting server at: ${serverPath}`);

const server = spawn('node', [serverPath], {
  env: process.env,
  stdio: ['pipe', 'pipe', 'inherit'] // pipe stdin/stdout, inherit stderr
});

// Helper to send JSON-RPC message
function send(message: any) {
  console.log('-> Sending:', JSON.stringify(message, null, 2));
  const str = JSON.stringify(message) + '\n';
  server.stdin.write(str);
}

// Buffer to accumulate data
let buffer = '';

server.stdout.on('data', (data) => {
  buffer += data.toString();
  
  // Split by newlines to handle multiple messages
  const lines = buffer.split('\n');
  buffer = lines.pop() || ''; // Keep incomplete line in buffer

  for (const line of lines) {
    if (!line.trim()) continue;
    
    try {
      const response = JSON.parse(line);
      console.log('<- Received:', JSON.stringify(response, null, 2));

      // Sequence of events
      if (response.id === 1) {
        // Initialized response received, send initialized notification
        send({
          jsonrpc: "2.0",
          method: "notifications/initialized"
        });

        // Then call the tool
        console.log('Calling get_web3_jobs...');
        send({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "get_web3_jobs",
            arguments: {
              limit: 2,
              remote: true
            }
          }
        });
      } else if (response.id === 2) {
        console.log('Tool execution completed successfully!');
        server.kill();
        process.exit(0);
      }
    } catch (e) {
      console.log('Received non-JSON output:', line);
    }
  }
});

// Start conversation
send({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

