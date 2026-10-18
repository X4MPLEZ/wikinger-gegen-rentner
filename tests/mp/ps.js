// Local PeerJS signalling server for the online tests (mp_net.py): http://127.0.0.1:9000/myapp   Start: node tests/mp/ps.js
const express = require('express');
const { ExpressPeerServer } = require('peer');
const http = require('http');
const app = express();
const server = http.createServer(app);
app.use('/myapp', ExpressPeerServer(server, { path: '/' }));
server.listen(9000, '127.0.0.1', () => console.log('peer up'));
