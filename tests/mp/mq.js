// Local MQTT broker over WebSocket for the online tests (relay transport): ws://127.0.0.1:9001   Start: node tests/mp/mq.js
const aedes = require('aedes')();
const http = require('http');
const ws = require('websocket-stream');
const server = http.createServer();
ws.createServer({ server }, aedes.handle);
server.listen(9001, '127.0.0.1', () => console.log('mqtt up'));
