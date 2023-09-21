// db.js

const mongoose = require('mongoose');

const MONGO_URI = 'mongodb+srv://Pietro:morango@cluster0.dduc7g4.mongodb.net/?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Conectado ao MongoDB');
  })
  .catch((err) => {
    console.error('Erro ao conectar ao MongoDB:', err);
});
