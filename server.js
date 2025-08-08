import https from 'https';
import fs from 'fs';
import { handler } from './build/handler.js';

const port = process.env.PORT || 3002;

// SSL証明書の読み込み
const options = {
  key: fs.readFileSync('./certs/key.pem'),
  cert: fs.readFileSync('./certs/cert.pem')
};

// HTTPSサーバーの作成
const server = https.createServer(options, (req, res) => {
  handler(req, res);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`HTTPS Server listening on https://0.0.0.0:${port}`);
});