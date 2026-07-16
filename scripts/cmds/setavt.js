// scripts/cmds/setavt.js
// Portage GoatBot -> nix (Tele)
// Original GoatBot : changeait l'avatar du BOT lui-même via api.changeAvatar (FCA/Messenger).
// Aucun équivalent Bot API Telegram n'existe pour qu'un bot change sa propre photo de profil.
// Adaptation : change la photo DU GROUPE (setChatPhoto), le bot doit être admin avec
// le droit "Modifier les infos du groupe".

const axios = require("axios");

const nix = {
  name: "setavt",
  aliases: ["changeavt", "setavatar"],
  version: "1.0",
  author: "NTKhang (GoatBot) / portage Christus",
  cooldown: 5,
  role: 1, // admin du groupe (dans l'original GoatBot c'était role 2 = propriétaire du bot,
           // car ça changeait l'avatar du bot ; ici ça change la photo du groupe)
  category: "group",
  description: "Change la photo du groupe (répondre à une image ou fournir une URL).",
  guide:
    "{p}setavt <url image> — change la photo avec une image en ligne\n" +
    "{p}setavt (en répondant à une photo) — change la photo avec l'image citée"
};

async function onStart({ bot, msg, chatId, args }) {
  try {
    // 1. Récupérer l'image : soit une URL en argument, soit une photo en réponse
    let imageBuffer = null;

    const urlArg = args[0] && args[0].startsWith("http") ? args[0] : null;

    if (urlArg) {
      let response;
      try {
        response = await axios.get(urlArg, { responseType: "arraybuffer" });
      } catch (e) {
        return bot.sendMessage(chatId, "❌ Impossible de récupérer l'image depuis cette URL.", {
          reply_to_message_id: msg.message_id
        });
      }
      const contentType = response.headers["content-type"] || "";
      if (!contentType.includes("image")) {
        return bot.sendMessage(chatId, "❌ Le lien fourni ne pointe pas vers une image valide.", {
          reply_to_message_id: msg.message_id
        });
      }
      imageBuffer = Buffer.from(response.data);
    } else if (msg.reply_to_message && msg.reply_to_message.photo) {
      const photoArray = msg.reply_to_message.photo;
      const fileId = photoArray[photoArray.length - 1].file_id; // plus grande résolution
      const fileLink = await bot.getFileLink(fileId);
      const response = await axios.get(fileLink, { responseType: "arraybuffer" });
      imageBuffer = Buffer.from(response.data);
    } else {
      return bot.sendMessage(
        chatId,
        "⚠️ Utilisation :\n{p}setavt <url image>\nou répondez à une photo avec {p}setavt",
        { reply_to_message_id: msg.message_id }
      );
    }

    // 2. Appliquer la photo au groupe
    try {
      await bot.setChatPhoto(chatId, imageBuffer);
    } catch (e) {
      // Cas fréquent : le bot n'est pas admin ou n'a pas le droit "can_change_info"
      return bot.sendMessage(
        chatId,
        "❌ Échec du changement de photo. Vérifiez que le bot est admin du groupe avec le droit \"Modifier les infos du groupe\".",
        { reply_to_message_id: msg.message_id }
      );
    }

    return bot.sendMessage(chatId, "✅ Photo du groupe mise à jour avec succès.", {
      reply_to_message_id: msg.message_id
    });
  } catch (err) {
    console.error("Erreur setavt:", err);
    return bot.sendMessage(chatId, "❌ Une erreur inattendue est survenue.", {
      reply_to_message_id: msg.message_id
    });
  }
}

module.exports = { nix, onStart };
                               
