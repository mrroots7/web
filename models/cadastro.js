// Importe os módulos necessários para trabalhar com o banco de dados, como o Mongoose
const mongoose = require('mongoose');
const User = require('./user'); // Importe o modelo User

// Função para gerar uma chave API no formato especificado (xxxx-xxxx-xxxx-xxxx)
function generateApiKey() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let apiKey = '';

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      apiKey += characters.charAt(randomIndex);
    }
    if (i < 3) {
      apiKey += '-';
    }
  }

  return apiKey;
}

// Função para criar uma conta manualmente
async function createManualAccount(username, password, validity) {
    const apiKey = generateApiKey(); // Gere uma chave API
    try {
      const newUser = new User({
        username,
        password,
        validity: new Date(validity),
        apiKey: apiKey, // Adicione a chave API à conta
      });
  
      const savedUser = await newUser.save();
  
      return {
        success: true,
        message: 'Conta criada com sucesso!',
        username: savedUser.username,
        validity: savedUser.validity,
        apiKey: savedUser.apiKey, // Adicione a chave API à conta
      };
    } catch (error) {
      return {
        success: false,
        error: 'Erro ao criar a conta',
      };
    }
}

// Função para gerar uma senha aleatória com o comprimento especificado
function generateRandomPassword(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    password += characters.charAt(randomIndex);
  }

  return password;
}

// Função para criar um login de teste gratuito com validade de 2 horas e chave API
async function createFreeLogin() {
    const usernameInput = 'teste' + Math.floor(Math.random() * 1000);
    const passwordInput = generateRandomPassword(8);
    const validity = new Date(Date.now() + 2 * 60 * 60 * 1000); // Validade de 2 horas
    const apiKey = generateApiKey(); // Gere uma chave API

    try {
        const newUser = new User({
            username: usernameInput,
            password: passwordInput,
            validity: validity,
            apiKey: apiKey, // Adicione a chave API à conta
            isTestAccount: true,
            testValidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Defina a validade do teste para 7 dias
        });

        const savedUser = await newUser.save();

        return {
            success: true,
            message: 'Teste grátis criado com sucesso!',
            username: savedUser.username,
            password: passwordInput,
            validity: savedUser.validity,
            apiKey: savedUser.apiKey, // Retorne a chave API gerada
            isTestAccount: savedUser.isTestAccount,
            testValidUntil: savedUser.testValidUntil,
        };
    } catch (error) {
        return {
            success: false,
            error: 'Erro ao criar o teste grátis',
        };
    }
}

// Exporte as funções
module.exports = {
  generateApiKey,
  createManualAccount,
  generateRandomPassword,
  createFreeLogin,
};
