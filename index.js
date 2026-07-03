const express = require("express");
const path = require("path");
const app = express();
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard", "index.html"));
});

app.listen(port, () => console.log(`Server running on port ${port}`));

// --- Connexion MongoDB ---
// C'est ce bloc qui manquait : connectMongoDB.js et les modèles existaient
// dans le projet mais n'étaient jamais require() nulle part, donc Mongo
// n'était jamais réellement connecté. On le fait ici, dans le seul fichier
// d'entrée non protégé/obfusqué, puis on expose tout via global.db.
(async () => {
  const config = require("./config.json");

  try {
    await require("./database/controller/index.js")(config);
  } catch (err) {
    console.error("[DATABASE] Erreur inattendue lors de l'initialisation :", err);
  }

  // main.js (et le reste du bot) peut maintenant utiliser global.db.usersData,
  // global.db.threadsData, global.db.globalData, etc.
  require("./main.js");
})();
