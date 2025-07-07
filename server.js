const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const Usuario = require('./models/Usuario');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Função de criptografia
const key = Buffer.from(process.env.KEY, 'base64');
const iv = Buffer.from(process.env.IV, 'base64');

function encryptWord(word) {
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(word, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

// Carregar palavras
const palavras = fs
  .readFileSync('palavras_ordenadas_completas.txt', 'utf-8')
  .split('\n')
  .map(l => l.trim())
  .filter(l => l.length > 0);

// Rotas
app.get('/palavra', (req, res) => {
  const aleatoria = palavras[Math.floor(Math.random() * palavras.length)];
  const palavraCriptografada = encryptWord(aleatoria);
  res.json({ palavra: palavraCriptografada });
});

app.post('/usuarios', async (req, res) => {
  const { nome, senha } = req.body;

  const existente = await Usuario.findOne({ nome });
  if (existente) return res.status(400).json({ erro: 'Usuário já existe' });

  const senhaCriptografada = await bcrypt.hash(senha, 10);
  const novo = new Usuario({ nome, senha: senhaCriptografada });
  await novo.save();

  res.json({ mensagem: 'Usuário criado com sucesso' });
});

app.post('/login', async (req, res) => {
  const { nome, senha } = req.body;
  const usuario = await Usuario.findOne({ nome });
  if (!usuario) return res.status(401).json({ erro: 'Usuário não encontrado' });

  const senhaValida = await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta' });

  res.json({
    mensagem: 'Login bem-sucedido',
    nome: usuario.nome,
    pontuacao: usuario.pontuacao
  });
});

app.put('/pontuacao/:nome', async (req, res) => {
  const { nome } = req.params;
  const { pontuacao } = req.body;
  const senha = req.query.senha; // <-- senha agora vem da query

  const usuario = await Usuario.findOne({ nome });
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

  const isAdmin = senha === process.env.ADMIN_SECRET;
  const senhaValida = isAdmin || await bcrypt.compare(senha, usuario.senha);
  if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta' });

  usuario.pontuacao = pontuacao;
  await usuario.save();

  res.json({ mensagem: 'Pontuação atualizada' });
});


app.get('/ranking/:top', async (req, res) => {
  const top = parseInt(req.params.top);
  if (isNaN(top) || top <= 0) {
    return res.status(400).json({ erro: 'Parâmetro "top" inválido' });
  }

  const ranking = await Usuario.find({}, 'nome pontuacao')
    .sort({ pontuacao: -1 })
    .limit(top);

  res.json(ranking);
});

app.get('/usuarios', async (req, res) => {
  const usuarios = await Usuario.find({}, '-senha');
  res.json(usuarios);
});

app.delete('/usuarios/:nome', async (req, res) => {
  const { nome } = req.params;
  const senha = req.query.senha;

  if (!senha || senha !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ erro: 'Acesso negado: senha inválida' });
  }

  const resultado = await Usuario.deleteOne({ nome });
  if (resultado.deletedCount === 0) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }

  res.json({ mensagem: `Usuário "${nome}" removido com sucesso` });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
