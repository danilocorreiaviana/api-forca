const express = require('express');
const fs = require('fs');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
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

function carregarUsuarios() {
  try {
    if (!fs.existsSync(USUARIOS_PATH)) {
      fs.writeFileSync(USUARIOS_PATH, '[]');
      return [];
    }

    const data = fs.readFileSync(USUARIOS_PATH);
    const usuarios = JSON.parse(data);

    // Garante que o retorno seja sempre um array
    if (!Array.isArray(usuarios)) {
      throw new Error('usuarios.json não é um array');
    }

    return usuarios;

  } catch (err) {
    return [];
  }
}


function salvarUsuarios(usuarios) {
  fs.writeFileSync(USUARIOS_PATH, JSON.stringify(usuarios, null, 2));
}

const USUARIOS_PATH = './usuarios.json';

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

app.post('/usuarios', async (req, res) => {
  const { nome, senha } = req.body;
  const usuarios = carregarUsuarios();

  if (usuarios.find(u => u.nome === nome)) {
    return res.status(400).json({ erro: 'Usuário já existe' });
  }

  const senhaCriptografada = await bcrypt.hash(senha, 10);

  usuarios.push({ nome, senha: senhaCriptografada, pontuacao: 0 });
  salvarUsuarios(usuarios);
  res.json({ mensagem: 'Usuário criado com sucesso' });
});

app.post('/login', async (req, res) => {
  const { nome, senha } = req.body;
  const usuarios = carregarUsuarios();

  const usuario = usuarios.find(u => u.nome === nome);
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
  const { senha, pontuacao } = req.body;
  const usuarios = carregarUsuarios();

  const usuario = usuarios.find(u => u.nome === nome);
  if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

  const isAdmin = senha === process.env.ADMIN_SECRET;

  let senhaValida = false;

  if (isAdmin) {
    senhaValida = true;
  } else {
    senhaValida = await bcrypt.compare(senha, usuario.senha);
  }

  if (!senhaValida) return res.status(401).json({ erro: 'Senha incorreta' });

  usuario.pontuacao = pontuacao;
  salvarUsuarios(usuarios);
  res.json({ mensagem: 'Pontuação atualizada' });
});

app.get('/ranking/:top', (req, res) => {
  const top = parseInt(req.params.top);

  if (isNaN(top) || top <= 0) {
    return res.status(400).json({ erro: 'Parâmetro "top" inválido' });
  }

  const usuarios = carregarUsuarios();
  const ranking = usuarios
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, top);

  const resultado = ranking.map(u => ({
    nome: u.nome,
    pontuacao: u.pontuacao
  }));

  res.json(resultado);
});


app.get('/usuarios', (req, res) => {
  const usuarios = carregarUsuarios();
  res.json(usuarios);
});

app.delete('/usuarios/:nome', (req, res) => {
  const { nome } = req.params;
  const senha = req.query.senha;

  if (!senha || senha !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ erro: 'Acesso negado: senha inválida' });
  }

  let usuarios = carregarUsuarios();

  const usuarioIndex = usuarios.findIndex(u => u.nome === nome);
  if (usuarioIndex === -1) {
    return res.status(404).json({ erro: 'Usuário não encontrado' });
  }

  usuarios.splice(usuarioIndex, 1);
  salvarUsuarios(usuarios);

  res.json({ mensagem: `Usuário "${nome}" removido com sucesso` });
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
