// scripts/cmds/pack.js
//
// Gestion complète des packs de stickers Telegram :
//   {p}pack create <nom_court> <Titre>   (en réponse à une image/vidéo/sticker)
//   {p}pack add <nom_court>              (en réponse à une image/vidéo/sticker)
//   {p}pack info <nom_court>
//   {p}pack del                          (en réponse à un sticker du pack à retirer)
//   {p}pack rename <nom_court> <Nouveau Titre>
//
// Le "nom_court" doit être unique sur tout Telegram : le bot lui ajoute
// automatiquement le suffixe "_by_<username_du_bot>" comme l'exige l'API.

const fs = require("fs-extra");
const path = require("path");
const {
  tmpPath,
  downloadTelegramFile,
  extractMedia,
  convertStaticToWebp,
  convertVideoToWebm,
  createNewStickerSet,
  addStickerToSet,
  getStickerSet,
  deleteStickerFromSet,
  setStickerSetTitle,
} = require("../../func/stickerTools.js");

const nix = {
  name: "pack",
  version: "1.0.0",
  aliases: ["stickerpack", "spack"],
  description: "Créer et gérer des packs de stickers Telegram",
  author: "Christus",
  prefix: true,
  category: "media",
  role: 0,
  cooldown: 5,
  guide:
    "{p}pack create <nom_court> <Titre> — en réponse à une image/vidéo, crée un nouveau pack\n" +
    "{p}pack add <nom_court> — en réponse à une image/vidéo, ajoute un sticker au pack\n" +
    "{p}pack info <nom_court> — affiche les infos d'un pack\n" +
    "{p}pack del — en réponse à un sticker du pack (créé par ce bot), le retire\n" +
    "{p}pack rename <nom_court> <Nouveau Titre> — renomme un pack\n\n" +
    "Le nom court doit être en anglais/chiffres/underscore uniquement. " +
    "Le suffixe \"_by_<bot>\" est ajouté automatiquement.",
};

let cachedBotUsername = null;
async function getBotUsername(bot) {
  if (cachedBotUsername) return cachedBotUsername;
  const me = await bot.getMe();
  cachedBotUsername = me.username;
  return cachedBotUsername;
}

function sanitizeShortName(raw) {
  return raw.replace(/[^a-zA-Z0-9_]/g, "").replace(/^[^a-zA-Z]+/, "s");
}

async function prepareStickerFile(bot, media) {
  if (media.kind === "tgs") {
    throw new Error("Les stickers animés au format .tgs (Lottie) ne sont pas pris en charge pour l'ajout automatique.");
  }

  const inputExt = media.kind === "video" ? "mp4" : "jpg";
  const inputPath = tmpPath(inputExt);
  await downloadTelegramFile(bot, media.fileId, inputPath);

  let outputPath, format;
  try {
    if (media.kind === "video") {
      outputPath = tmpPath("webm");
      await convertVideoToWebm(inputPath, outputPath);
      format = "video";
    } else {
      outputPath = tmpPath("webp");
      await convertStaticToWebp(inputPath, outputPath);
      format = "static";
    }
  } finally {
    await fs.remove(inputPath).catch(() => {});
  }

  return { path: outputPath, format, emojiList: [media.emoji || "🎭"] };
}

async function onStart({ bot, msg, chatId, args }) {
  const sub = (args[0] || "").toLowerCase();
  const userId = msg.from.id;

  if (!sub || sub === "guide" || sub === "help") {
    return bot.sendMessage(chatId, `📖 Guide de la commande pack :\n\n${nix.guide.replace(/\{p\}/g, "/")}`, {
      reply_to_message_id: msg.message_id,
    });
  }

  try {
    if (sub === "create" || sub === "add") {
      const shortNameRaw = args[1];
      if (!shortNameRaw) {
        return bot.sendMessage(chatId, "⚠️ Merci d'indiquer un nom court : /pack create monpack Mon Titre", {
          reply_to_message_id: msg.message_id,
        });
      }

      const media = extractMedia(msg.reply_to_message);
      if (!media) {
        return bot.sendMessage(chatId, "⚠️ Répondez à une image, une vidéo ou un sticker avec cette commande.", {
          reply_to_message_id: msg.message_id,
        });
      }

      const botUsername = await getBotUsername(bot);
      const shortName = `${sanitizeShortName(shortNameRaw)}_by_${botUsername}`;

      const waitMsg = await bot.sendMessage(chatId, "⏳ Traitement du sticker en cours...", {
        reply_to_message_id: msg.message_id,
      });

      const stickerFile = await prepareStickerFile(bot, media);

      try {
        if (sub === "create") {
          const title = args.slice(2).join(" ") || "Mon Pack";
          await createNewStickerSet(bot.token, { userId, name: shortName, title, stickerFile });
          await bot.editMessageText(
            `✅ Pack créé avec succès !\n📦 Nom : ${shortName}\n🔗 https://t.me/addstickers/${shortName}`,
            { chat_id: chatId, message_id: waitMsg.message_id }
          );
        } else {
          await addStickerToSet(bot.token, { userId, name: shortName, stickerFile });
          await bot.editMessageText(`✅ Sticker ajouté au pack ${shortName} !`, {
            chat_id: chatId,
            message_id: waitMsg.message_id,
          });
        }
      } finally {
        await fs.remove(stickerFile.path).catch(() => {});
      }
      return;
    }

    if (sub === "info") {
      const shortNameRaw = args[1];
      if (!shortNameRaw) {
        return bot.sendMessage(chatId, "⚠️ Merci d'indiquer un nom court : /pack info monpack", {
          reply_to_message_id: msg.message_id,
        });
      }
      const botUsername = await getBotUsername(bot);
      const shortName = shortNameRaw.includes("_by_") ? shortNameRaw : `${sanitizeShortName(shortNameRaw)}_by_${botUsername}`;
      const set = await getStickerSet(bot.token, shortName);
      return bot.sendMessage(
        chatId,
        `📦 ${set.title}\n🔗 https://t.me/addstickers/${set.name}\n🖼️ ${set.stickers.length} sticker(s)\n🎞️ Type : ${set.sticker_type}`,
        { reply_to_message_id: msg.message_id }
      );
    }

    if (sub === "del") {
      const media = extractMedia(msg.reply_to_message);
      if (!media || !msg.reply_to_message.sticker) {
        return bot.sendMessage(chatId, "⚠️ Répondez au sticker (déjà envoyé dans un pack) que vous voulez retirer.", {
          reply_to_message_id: msg.message_id,
        });
      }
      await deleteStickerFromSet(bot.token, media.fileId);
      return bot.sendMessage(chatId, "✅ Sticker retiré du pack.", { reply_to_message_id: msg.message_id });
    }

    if (sub === "rename") {
      const shortNameRaw = args[1];
      const newTitle = args.slice(2).join(" ");
      if (!shortNameRaw || !newTitle) {
        return bot.sendMessage(chatId, "⚠️ Utilisation : /pack rename monpack Nouveau Titre", {
          reply_to_message_id: msg.message_id,
        });
      }
      const botUsername = await getBotUsername(bot);
      const shortName = shortNameRaw.includes("_by_") ? shortNameRaw : `${sanitizeShortName(shortNameRaw)}_by_${botUsername}`;
      await setStickerSetTitle(bot.token, { name: shortName, title: newTitle });
      return bot.sendMessage(chatId, `✅ Pack renommé en "${newTitle}".`, { reply_to_message_id: msg.message_id });
    }

    return bot.sendMessage(chatId, "⚠️ Sous-commande inconnue. Faites /pack guide pour voir l'aide.", {
      reply_to_message_id: msg.message_id,
    });
  } catch (err) {
    console.error("Erreur pack:", err);
    return bot.sendMessage(chatId, `❌ Erreur : ${err.message}`, { reply_to_message_id: msg.message_id });
  }
}

module.exports = { onStart, nix };
