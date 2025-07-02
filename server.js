const express = require('express');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

const key = Buffer.from(process.env.KEY, 'base64'); 
const iv = Buffer.from(process.env.IV, 'base64'); 

function encryptWord(word) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(word, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

const palavras = fs
  .readFileSync('palavras_ordenadas_completas.txt', 'utf-8')
  .split('\n')
  .map((linha) => linha.trim())
  .filter((linha) => linha.length > 0);

app.get('/palavra', (req, res) => {
  const aleatoria = palavras[Math.floor(Math.random() * palavras.length)];
  const palavraCriptografada = encryptWord(aleatoria);
  res.json({ palavra: palavraCriptografada });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
