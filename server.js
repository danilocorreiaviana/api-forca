const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());

// Lê as palavras uma vez ao iniciar
const palavras = fs
  .readFileSync('palavras_ordenadas_completas.txt', 'utf-8')
  .split('\n')
  .map((linha) => linha.trim())
  .filter((linha) => linha.length > 0);

app.get('/palavra', (req, res) => {
  const aleatoria = palavras[Math.floor(Math.random() * palavras.length)];
  res.json({ palavra: aleatoria });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
