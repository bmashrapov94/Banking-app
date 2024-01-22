const mongoose = require("mongoose");

const ClientSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  chequing: { type: String, default: null },
  savings: { type: String, default: null },
  password: { type: String, required: true },
});

const Client = mongoose.model("Client", ClientSchema);

module.exports = Client;
