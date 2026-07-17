// scripts/cmds/tgtowa.js
//
// Convertit un pack de stickers Telegram en pack "WhatsApp-ready" :
//   {p}tgtowa <nom_court_du_pack>
//   {p}tgtowa            (en réponse à un sticker : détecte son pack automatiquement)
//
// IMPORTANT — limite technique à bien comprendre :
// Il n'existe AUCUNE API publique permettant à un bot (Telegram ou autre)
// d'insérer directement un pack dans l'application WhatsApp de quelqu'un.
// L'ajout de stickers à WhatsApp est un mécanisme Android/iOS réservé aux
// applications tierces enregistrées comme "fournisseur de stickers"
// (WhatsApp Stickers Content Provider). Aucun fichier envoyé par un bot ne
// peut déclencher cet ajout tout seul.
//
// Ce que cette commande fait concrètement, et qui est la seule chose
// réellement possible : elle télécharge les stickers du pack Telegram,
// les reconvertit exactement au format attendu par WhatsApp
// (statique : WEBP 512x512 < 100 Ko / animé : WEBP 512x512 < 500 Ko, 8fps, <=6s),
// génère l'icône de plateau (tray, 96x96) et un contents.json conforme au
// schéma officiel WhatsApp/stickers, puis livre le tout en .zip.
// L'utilisateur importe ensuite ce .zip avec une application tierce déjà
// installée sur son téléphone qui sait lire ce format (ex : Sticker Maker,
// Sticker.ly, etc.) — c'est cette appli qui fait l'ajout final à WhatsApp.

const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const {
  tmpPath,
  TMP_DIR,
  downloadTelegramFile,
  getStickerSet,
  compressWebpUnder,
  compressAnimatedWebpUnder,
} = require("../../func/stickerTools.js");

const nix = {
  name: "tgtowa",
  version: "1.0.0",
  aliases: ["tg2wa", "exportwa"],
  description: "Exporte un pack de stickers Telegram au format WhatsApp (.zip prêt à importer)",
  author: "Christus",
  prefix: true,
  category: "media",
  role: 0,
  cooldown: 10,
  guide:
    "{p}tgtowa <nom_court_du_pack> — exporte ce pack au format WhatsApp\n" +
    "{p}tgtowa — en réponse à un sticker, détecte et exporte son pack d'origine\n\n" +
    "Le .zip généré contient les images aux bonnes tailles + un contents.json.\n" +
    "Importez-le ensuite avec une appli tierce (Sticker Maker, Sticker.ly, ...) " +
    "installée sur votre téléphone : aucun bot ne peut ajouter un pack à " +
    "WhatsApp directement, seule une appli Android/iOS enregistrée comme " +
    "fournisseur de stickers en a le droit.",
};

const MAX_STATIC_BYTES = 95 * 1024; // marge sous la limite officielle de 100 Ko
const MAX_ANIMATED_BYTES = 480 * 1024; // marge sous la limite officielle de 500 Ko
const MAX_STICKERS_PER_PACK = 30; // WhatsApp exige entre 3 et 30 stickers par pack

async function onStart({ bot, msg, chatId, args }) {
  let shortName = args[0];

  if (!shortName && msg.reply_to_message && msg.reply_to_message.sticker) {
    shortName = msg.reply_to_message.sticker.set_name;
  }

  if (!shortName) {
    return bot.sendMessage(
      chatId,
      "⚠️ Indiquez le nom court d'un pack (/tgtowa nom_du_pack) ou répondez à un sticker de ce pack.",
      { reply_to_message_id: msg.message_id }
    );
  }

  const waitMsg = await bot.sendMessage(chatId, "⏳ Récupération du pack Telegram...", {
    reply_to_message_id: msg.message_id,
  });

  const workDir = path.join(TMP_DIR, `wa_${Date.now()}`);
  await fs.ensureDir(workDir);

  try {
    const set = await getStickerSet(bot.token, shortName);

    const stickersToExport = set.stickers.slice(0, MAX_STICKERS_PER_PACK);
    if (stickersToExport.length < 3) {
      throw new Error("WhatsApp exige au moins 3 stickers par pack ; ce pack n'en a pas assez d'exportables.");
    }

    await bot.editMessageText(`⏳ Conversion de ${stickersToExport.length} sticker(s) au format WhatsApp...`, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
    });

    const contentsStickers = [];
    let skipped = 0;
    let index = 0;

    for (const sticker of stickersToExport) {
      index++;
      const isAnimatedLottie = sticker.is_animated && !sticker.is_video;
      if (isAnimatedLottie) {
        // Format .tgs (vecteur Lottie) : nécessiterait un rendu image par image
        // (ex. rlottie) non couvert ici. On l'ignore proprement.
        skipped++;
        continue;
      }

      const fileName = `${String(index).padStart(2, "0")}.webp`;
      const outputPath = path.join(workDir, fileName);

      if (sticker.is_video) {
        const rawPath = tmpPath("webm");
        await downloadTelegramFile(bot, sticker.file_id, rawPath);
        try {
          await compressAnimatedWebpUnder(rawPath, outputPath, MAX_ANIMATED_BYTES);
        } finally {
          await fs.remove(rawPath).catch(() => {});
        }
      } else {
        const rawPath = tmpPath("webp");
        await downloadTelegramFile(bot, sticker.file_id, rawPath);
        try {
          await compressWebpUnder(rawPath, outputPath, MAX_STATIC_BYTES);
        } finally {
          await fs.remove(rawPath).catch(() => {});
        }
      }

      contentsStickers.push({
        "image-file": fileName,
        emojis: sticker.emoji ? [sticker.emoji] : ["🎭"],
      });
    }

    if (contentsStickers.length < 3) {
      throw new Error(
        "Après filtrage (stickers .tgs non pris en charge), il ne reste pas assez de stickers exportables (minimum 3)."
      );
    }

    // Icône de plateau (tray) 96x96 générée depuis le premier sticker exporté
    const trayFileName = "tray.webp";
    await compressWebpUnder(path.join(workDir, contentsStickers[0]["image-file"]), path.join(workDir, trayFileName), 50 * 1024, 96);

    const contents = {
      identifier: shortName,
      name: set.title || shortName,
      publisher: "Exported via Telegram Bot",
      tray_image_file: trayFileName,
      publisher_email: "",
      publisher_website: "",
      privacy_policy_website: "",
      license_agreement_website: "",
      stickers: contentsStickers,
    };
    await fs.writeJson(path.join(workDir, "contents.json"), contents, { spaces: 2 });

    const zipPath = path.join(TMP_DIR, `${shortName}_whatsapp.zip`);
    await zipDirectory(workDir, zipPath);

    let caption =
      `✅ Pack "${set.title}" exporté au format WhatsApp.\n` +
      `📦 ${contentsStickers.length} sticker(s)` +
      (skipped ? ` (${skipped} sticker(s) animé(s) .tgs ignoré(s), non pris en charge)` : "") +
      `\n\n📲 Pour l'ajouter à WhatsApp : ouvrez ce .zip avec une appli tierce ` +
      `de stickers déjà installée sur votre téléphone (ex. Sticker Maker, ` +
      `Sticker.ly...). Aucun bot ne peut ajouter un pack à WhatsApp directement.`;

    await bot.sendDocument(chatId, zipPath, { reply_to_message_id: msg.message_id, caption });
    await bot.deleteMessage(chatId, waitMsg.message_id).catch(() => {});

    await fs.remove(zipPath).catch(() => {});
  } catch (err) {
    console.error("Erreur tgtowa:", err);
    await bot.editMessageText(`❌ Erreur : ${err.message}`, {
      chat_id: chatId,
      message_id: waitMsg.message_id,
    }).catch(() => bot.sendMessage(chatId, `❌ Erreur : ${err.message}`));
  } finally {
    await fs.remove(workDir).catch(() => {});
  }
}

function zipDirectory(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

module.exports = { onStart, nix };
