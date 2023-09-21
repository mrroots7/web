const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const session = require('express-session');
const requestIp = require('request-ip');
const useragent = require('express-useragent');
const axios = require('axios');
const ms = require('ms');
const User = require('./models/user');
const { generateApiKey, generateRandomPassword, createManualAccount, createFreeLogin } = require('./models/cadastro');
const config = require('./config'); // Importe o arquivo de configuração

// Configuração do MongoDB
require('./db');

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(bodyParser.json());

// Configuração do express-session
app.use(session({
  secret: 'secretpassword', // Use uma chave secreta mais segura em um ambiente de produção
  resave: false,
  saveUninitialized: true,
}));

// Função para verificar a autenticação do administrador
function isAdminAuthenticated(req) {
  return req.session.username === config.adminUsername;
}

// Rota de login
app.get('/', (req, res) => {
  // Verifique se há um parâmetro de consulta 'login' na URL
  const loginSuccess = req.query.login === 'success';

  res.render('login', { loginSuccess }); // Passe a variável loginSuccess para a página de login
});

// Rota de login
app.get('/login', (req, res) => {
  // Verifique se há um parâmetro de consulta 'login' na URL
  const loginSuccess = req.query.login === 'success';

  res.render('login', { loginSuccess }); // Passe a variável loginSuccess para a página de login
});

// Rota de autenticação (login)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Verifique se o usuário é o dono do site (administrador) usando as configurações em config.js
    if (username === config.adminUsername && password === config.adminPassword) {
      req.session.username = username;
      res.redirect('/admin');
      return;
    }

    // Consulte o banco de dados para obter informações da conta do usuário
    const user = await User.findOne({ username });

    if (!user) {
      // Tratamento de erro ou usuário não encontrado
      res.render('login', { loginError: true });
      return;
    }

    // Verifique a senha usando bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Senha incorreta
      res.render('login', { loginError: true });
      return;
    }

    req.session.username = username;
    res.redirect('/account');
  } catch (err) {
    console.error(err);
    res.status(500).send('Erro ao fazer login.');
  }
});

// Rota de admin
app.get('/create-users', (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  // Verifique se o usuário é o administrador
  if (req.session.username === config.adminUsername) {
    res.render('create-users', { username: req.session.username });
  } else {
    // Caso contrário, redirecione para a página de dashboard
    res.redirect('/dashboard');
  }
});

app.post('/create-users', async (req, res) => {
  if (!isAdminAuthenticated(req)) {
    return res.status(403).send('Acesso negado: apenas o administrador pode criar usuários.');
  }

  try {
    const { username, password, validity } = req.body;

    // Chame a função createManualAccount para criar um usuário manualmente
    const contaCriadaComSucesso = await createManualAccount(username, password, validity);

    if (contaCriadaComSucesso) {
      // Se a conta for criada com sucesso, renderize a página com a mensagem de sucesso
      res.render('create-users', { successMessage: 'Conta criada com sucesso' });
    } else {
      // Se houver um erro ao criar a conta, renderize a página com uma mensagem de erro
      res.render('create-users', { errorMessage: 'Erro ao criar a conta' });
    }
  } catch (error) {
    console.error('Erro ao criar a conta:', error);
    // Em caso de erro interno no servidor, você pode renderizar a página com uma mensagem de erro
    res.render('create-users', { errorMessage: 'Erro interno ao criar a conta' });
  }
});


// Rota para criar um teste gratuito
app.post('/create-free-login', async (req, res) => {
  if (!isAdminAuthenticated(req)) {
    res.status(403).send('Acesso negado: apenas o administrador pode criar testes gratuitos.');
    return;
  }

  try {
    const { generateTest } = req.body;

    // Chame a função createFreeLogin para criar um teste gratuito
    const freeLoginResult = await createFreeLogin();

    if (freeLoginResult.success) {
      // Se a criação for bem-sucedida, retorne os dados em sua resposta
      res.status(200).json(freeLoginResult);
    } else {
      // Se houver um erro ao criar o teste gratuito, retorne uma resposta de erro
      res.status(500).json(freeLoginResult);
    }
  } catch (error) {
    console.error('Erro ao criar o teste gratuito:', error);
    res.status(500).json({ success: false, error: 'Erro ao criar o teste gratuito.' });
  }
});


// Rota de conta
app.get('/account', async (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  try {
    // Consulte o banco de dados para obter informações da conta do usuário
    const user = await User.findOne({ username: req.session.username });

    if (!user) {
      // Trate o caso em que o usuário não foi encontrado no banco de dados
      req.session.destroy();
      return res.redirect('/?login=expired'); // Redirecione para a página de login com uma mensagem
    }

    // Renderize a página de conta com as informações do usuário
    res.render('account', {
      username: req.session.username,
      apiKey: user.apiKey,
      validity: user.validity ? user.validity.toDateString() : 'Indefinida',
    });
  } catch (error) {
    console.error('Erro ao obter informações da conta:', error);
    res.status(500).send('Erro ao obter informações da conta.');
  }
});


// Rota de logout
app.get('/logout', (req, res) => {
  // Remova o nome de usuário da sessão para efetuar o logout
  req.session.username = null;
  
  // Redirecione para a página de login com a mensagem de sucesso
  res.redirect('/?logout=success');
});

app.get('/dashboard', async (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  try {
    // Use a API "ipify" para obter o IP do usuário
    const ipResponse = await axios.get('https://api.ipify.org?format=json');
    const clientIp = ipResponse.data.ip;

    // Use a API "ip-api.com" para obter informações de localização com base no IP
    const locationResponse = await axios.get(`http://ip-api.com/json/${clientIp}`);
    const location = `${locationResponse.data.city}, ${locationResponse.data.regionName}, ${locationResponse.data.country}`;

    // Obtenha informações do dispositivo usando express-useragent
    const userAgentInfo = req.useragent;

    // Verifique se o usuário é o administrador
    const isAdmin = req.session.username === config.adminUsername;

    res.render('dashboard', {
      username: req.session.username,
      userIp: clientIp, // Passa o IP do usuário para a página
      userLocation: location,
      userAgentInfo: userAgentInfo,
      isAdmin: isAdmin,
    });
  } catch (error) {
    console.error('Erro ao obter informações de IP e localização:', error);
    // Em caso de erro, você pode definir mensagens de erro ou lidar com o erro de outra forma
    res.render('dashboard', {
      username: req.session.username,
      userIp: 'Erro ao obter o IP',
      userLocation: 'Erro.',
      userAgentInfo: 'Erro.',
      isAdmin: false,
    });
  }
});

// Rota de admin
app.get('/admin', (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  // Verifique se o usuário é o administrador
  if (req.session.username === config.adminUsername) {
    res.render('admin', { username: req.session.username });
  } else {
    // Caso contrário, redirecione para a página de dashboard
    res.redirect('/dashboard');
  }
});

// Rota para listar todos os usuários
app.get('/users', async (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  // Verifique se o usuário é o administrador
  if (req.session.username === config.adminUsername) {
    try {
      // Recupere todos os usuários do banco de dados
      const users = await User.find();

      // Calcule os dias restantes para cada usuário com base na data de validade
      const today = new Date();
      users.forEach((user) => {
        user.daysRemaining = calculateTimeRemainingInMilliseconds(user.validity);
      });

      // Renderize a página com as informações dos usuários e passe a variável 'users'
      res.render('users', { users, username: req.session.username });
    } catch (error) {
      console.error('Erro ao obter informações dos usuários:', error);
      res.render('users', { error: 'Erro ao obter informações dos usuários.', username: req.session.username });
    }
  } else {
    res.redirect('/dashboard');
  }
});

// Rota de Edição de Usuário
app.get('/edit-user', async (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  const usernameToEdit = req.query.username;

  try {
    // Consulte o banco de dados para obter informações do usuário a ser editado
    const user = await User.findOne({ username: usernameToEdit });

    if (!user) {
      // Trate o caso em que o usuário não foi encontrado no banco de dados
      return res.status(404).send('Usuário não encontrado.');
    }

    // Defina successMessage como uma string vazia para garantir que esteja definido
    const successMessage = '';

    // Verifique se o usuário autenticado é o administrador ou o proprietário da conta
    if (req.session.username === config.adminUsername || req.session.username === user.username) {
      // Renderize a página de edição de usuário com as informações do usuário e successMessage
      res.render('edit-user', { user, username: req.session.username, successMessage });
    } else {
      // Se o usuário não for o administrador nem o proprietário da conta, redirecione para o dashboard ou faça outra ação adequada
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Erro ao obter informações do usuário para edição:', error);
    // Em caso de erro, você pode definir mensagens de erro ou lidar com o erro de outra forma
    res.status(500).send('Erro ao obter informações do usuário para edição.');
  }
});

app.post('/update-user', async (req, res) => {
  const { username, currentPassword, newPassword, apiKey, originalApiKey } = req.body;

  try {
    // Consulte o banco de dados para obter informações do usuário a ser editado
    const user = await User.findOne({ username });

    if (!user) {
      // Trate o caso em que o usuário não foi encontrado no banco de dados
      return res.status(404).send('Usuário não encontrado.');
    }

    // Verifique se a senha atual corresponde à senha no banco de dados
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      throw new Error('Senha atual incorreta');
    }

    // Atualize apenas os campos que foram editados
    if (newPassword) {
      // Verifique se newPassword está definido
      const saltRounds = 10; // Defina o número de salt rounds
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      user.password = hashedPassword;
    }

    if (apiKey && apiKey !== originalApiKey) {
      // Verifique se apiKey está definido e é diferente do original
      user.apiKey = apiKey;
    }

    // Salve as alterações no banco de dados
    await user.save();

    // Defina successMessage com a mensagem de sucesso
    const successMessage = 'Salvo com sucesso.';

    // Renderize a página de edição de usuário com a mensagem de sucesso e as informações do usuário
    res.render('edit-user', { successMessage, user, username: req.session.username });
  } catch (error) {
    // Renderize a página de edição com uma mensagem de erro, passando user como um objeto vazio para evitar o erro
    const user = {}; // Defina user como um objeto vazio
    res.render('edit-user', { errorMessage: error.message, user, username: req.session.username, successMessage: '' });
  }
});

app.post('/delete-user', async (req, res) => {
  // Verifique se o usuário está autenticado e é o administrador (ou implemente as verificações necessárias)
  if (!req.session.username || req.session.username !== config.adminUsername) {
    return res.status(403).send('Acesso negado');
  }

  const usernameToDelete = req.body.usernameToDelete;

  try {
    // Exclua o usuário do banco de dados
    await User.deleteOne({ username: usernameToDelete });
    res.sendStatus(200); // Envie uma resposta de sucesso
  } catch (error) {
    console.error('Erro ao excluir o usuário:', error);
    res.status(500).send('Erro ao excluir o usuário.');
  }
});

// Rota para exibir a página de exclusão de usuário
app.get('/delete-user', async (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  const usernameToDelete = req.query.username;

  try {
    // Consulte o banco de dados para obter informações do usuário a ser excluído
    const user = await User.findOne({ username: usernameToDelete });

    if (!user) {
      // Trate o caso em que o usuário não foi encontrado no banco de dados
      return res.status(404).send('Usuário não encontrado.');
    }

    // Verifique se o usuário autenticado é o mesmo que está tentando excluir a conta
    if (req.session.username === user.username) {
      // Renderize a página de exclusão de usuário com as informações do usuário
      res.render('delete-user', { user, username: req.session.username });
    } else {
      // Caso o usuário não seja o dono da conta, redirecione para o dashboard ou faça outra ação adequada
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Erro ao obter informações do usuário para exclusão:', error);
    // Em caso de erro, você pode definir mensagens de erro ou lidar com o erro de outra forma
    res.status(500).send('Erro ao obter informações do usuário para exclusão.');
  }
});

// Rota para confirmar a exclusão de usuário
app.post('/confirm-delete-user', async (req, res) => {
  // Verifique se o usuário está autenticado (se existe um nome de usuário na sessão)
  if (!req.session.username) {
    // Se não estiver autenticado, redirecione para a página de login
    return res.redirect('/');
  }

  const usernameToDelete = req.body.usernameToDelete;

  try {
    // Consulte o banco de dados para obter informações do usuário a ser excluído
    const user = await User.findOne({ username: usernameToDelete });

    if (!user) {
      // Trate o caso em que o usuário não foi encontrado no banco de dados
      return res.status(404).send('Usuário não encontrado.');
    }

    // Verifique se o usuário autenticado é o mesmo que está tentando excluir a conta
    if (req.session.username === user.username) {
      // Exclua o usuário do banco de dados
      await User.deleteOne({ username: usernameToDelete });

      // Redirecione para a página de logout após a exclusão
      res.redirect('/logout');
    } else {
      // Caso o usuário não seja o dono da conta, redirecione para o dashboard ou faça outra ação adequada
      res.redirect('/dashboard');
    }
  } catch (error) {
    console.error('Erro ao excluir o usuário:', error);
    // Em caso de erro, você pode definir mensagens de erro ou lidar com o erro de outra forma
    res.status(500).send('Erro ao excluir o usuário.');
  }
});

// Função para calcular o tempo restante em milissegundos
function calculateTimeRemainingInMilliseconds(validity) {
  if (!validity) {
    return 0;
  }

  const validityDate = new Date(validity);
  const currentDate = new Date();

  if (validityDate <= currentDate) {
    return 0;
  }

  const timeDifference = validityDate - currentDate;
  return timeDifference;
}

// Inicie o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
