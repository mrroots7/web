const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  validity: { type: Date }, // Removida a obrigatoriedade
  apiKey: { type: String, default: generateApiKey }, // Valor padrão para gerar uma chave API
});

// Função para gerar uma chave API no formato especificado
function generateApiKey() {
  const segments = Array.from({ length: 4 }, () => {
    return Array.from({ length: 4 }, () => {
      const randomChar = Math.floor(Math.random() * 36); // Gere caracteres alfanuméricos (0-9, a-z)
      return randomChar.toString(36);
    }).join('');
  });

  return segments.join('-');
}

module.exports = mongoose.model('User', userSchema); 
