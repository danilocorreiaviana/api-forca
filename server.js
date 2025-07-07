const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const fs = require('fs');
const crypto = require('crypto');
const Usuario = require('./models/Usuario');
const { Types } = mongoose;

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
    id: usuario._id,
    nome: usuario.nome
  });
});

app.put('/usuarios/pontuacao/:id', async (req, res) => {
  const { id } = req.params;
  const { pontuacao } = req.body;
  const senha = req.query.senha;

  if (!Types.ObjectId.isValid(id)) {
    return res.status(400).json({ erro: 'ID inválido' });
  }

  if (!senha || senha !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ erro: 'Acesso negado: senha de admin inválida' });
  }

  try {
    const usuario = await Usuario.findById(id);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado' });

    usuario.pontuacao = pontuacao;
    await usuario.save();

    res.json({ mensagem: 'Pontuação atualizada com sucesso', pontuacao: usuario.pontuacao });
  } catch (error) {
    console.error('Erro ao atualizar pontuação:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
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

app.get('/usuarios/pontuacao/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const usuario = await Usuario.findById(id, 'pontuacao');

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({ pontuacao: usuario.pontuacao });
  } catch (error) {
    console.error('Erro ao buscar pontuação:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});


app.delete('/usuarios/del/:id', async (req, res) => {
  const { id } = req.params;
  const senha = req.query.senha;

  if (!senha || senha !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ erro: 'Acesso negado: senha inválida' });
  }

  try {
    const resultado = await Usuario.deleteOne({ _id: id });

    if (resultado.deletedCount === 0) {
      return res.status(404).json({ erro: 'Usuário não encontrado' });
    }

    res.json({ mensagem: `Usuário com ID "${id}" removido com sucesso` });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
