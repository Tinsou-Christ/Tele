const axios = require("axios");
const fs = require("fs");
const path = require("path");

module.exports = {
  nix: {
    name: "boobs",
    aliases: [],
    version: "1.0.0",
    author: "Christus",
    role: 0, // Limité aux admins ou rôles élevés
    category: "NSFW",
    description: "Envoie une image de fille sexy.",
    cooldown: 5,
    guide: "{p}girls"
  },

  async onStart({ bot, msg, chatId }) {
    // Message de chargement (optionnel mais recommandé pour les APIs lentes)
    // bot.sendMessage(chatId, "🔞 Préparation de l'image...");

    try {
      const url = "https://api.delirius.store/nsfw/boobs";
      
      // 1. Appel de l'API avec réponse en buffer (données brutes)
      const response = await axios.get(url, { 
        responseType: "arraybuffer",
        timeout: 15000 
      });

      if (!response.data) {
        throw new Error("Aucune donnée reçue de l'API.");
      }

      // 2. Création du dossier cache si inexistant
      const cacheDir = path.join(__dirname, "cache");
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      // 3. Sauvegarde temporaire du fichier
      const imgPath = path.join(cacheDir, `girl_${Date.now()}.jpg`);
      fs.writeFileSync(imgPath, Buffer.from(response.data));

      // 4. Envoi sur Telegram
      await bot.sendPhoto(chatId, imgPath, {
        caption: "🔞 Voici une fille pour toi 😏"
      });

      // 5. Suppression immédiate du fichier local
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }

    } catch (err) {
      console.error("Erreur commande Girls:", err.message);
      bot.sendMessage(chatId, "❌ Impossible de récupérer l'image depuis l'API pour le moment.");
    }
  }
};
