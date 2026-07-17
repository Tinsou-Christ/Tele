// func/stickerTools.js
//
// Boîte à outils partagée par scripts/cmds/pack.js et scripts/cmds/tgtowa.js.
//
// Contient :
//  - le téléchargement de fichiers Telegram (photo/vidéo/sticker/document)
//  - la conversion image/vidéo -> sticker (webp statique ou webp animé)
//  - des wrappers pour les endpoints Bot API liés aux packs de stickers
//    (createNewStickerSet / addStickerToSet / getStickerSet / deleteStickerFromSet)
//    appelés directement en HTTP multipart, sans dépendre de la version
//    de node-telegram-bot-api installée.

const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const FormData = require("form-data");
const { exec } = require("child_process");
const { v4: uuidv4 } = require("uuid");

const TMP_DIR = path.join(os.tmpdir(), "tele_sticker_tools");
fs.ensureDirSync(TMP_DIR);

function tmpPath(ext) {
  return path.join(TMP_DIR, `${uuidv4()}.${ext}`);
}

function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 32 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || error.message));
      resolve(stdout);
    });
  });
}

// ---------------------------------------------------------------------------
// Téléchargement de fichiers Telegram
// ---------------------------------------------------------------------------

/**
 * Télécharge un fichier Telegram (par file_id) vers un chemin local.
 */
async function downloadTelegramFile(bot, fileId, destPath) {
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
  const response = await axios({ url: fileUrl, method: "GET", responseType: "stream" });
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  return destPath;
}

/**
 * Extrait le file_id + le type de média (photo/video/sticker/document) d'un message.
 * Retourne null si aucun média utilisable n'est trouvé.
 */
function extractMedia(message) {
  if (!message) return null;

  if (message.sticker) {
    return {
      fileId: message.sticker.file_id,
      kind: message.sticker.is_video ? "video" : message.sticker.is_animated ? "tgs" : "static",
      emoji: message.sticker.emoji || null,
    };
  }
  if (message.photo && message.photo.length) {
    return { fileId: message.photo[message.photo.length - 1].file_id, kind: "static", emoji: null };
  }
  if (message.video) {
    return { fileId: message.video.file_id, kind: "video", emoji: null };
  }
  if (message.animation) {
    return { fileId: message.animation.file_id, kind: "video", emoji: null };
  }
  if (message.document && message.document.mime_type) {
    if (message.document.mime_type.startsWith("image/")) {
      return { fileId: message.document.file_id, kind: "static", emoji: null };
    }
    if (message.document.mime_type.startsWith("video/")) {
      return { fileId: message.document.file_id, kind: "video", emoji: null };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Conversion vers le format sticker Telegram (webp statique 512x512)
// ---------------------------------------------------------------------------

async function convertStaticToWebp(inputPath, outputPath) {
  await run(
    `ffmpeg -y -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -lossless 0 -q:v 90 -preset default -an -vsync 0 "${outputPath}"`
  );
  return outputPath;
}

async function convertVideoToWebm(inputPath, outputPath) {
  await run(
    `ffmpeg -y -i "${inputPath}" -t 3 -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000,fps=30" -c:v libvpx-vp9 -crf 30 -b:v 0 -an "${outputPath}"`
  );
  return outputPath;
}

// ---------------------------------------------------------------------------
// Compression d'une image sous une taille cible (utilisé pour l'export WhatsApp,
// qui impose 512x512 <100 Ko pour les stickers statiques et 96x96 pour le tray)
// ---------------------------------------------------------------------------

async function compressWebpUnder(inputPath, outputPath, maxBytes, size = 512) {
  const qualities = [85, 75, 65, 55, 45, 35, 25, 15];
  for (const q of qualities) {
    await run(
      `ffmpeg -y -i "${inputPath}" -vf "scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -q:v ${q} -preset picture -an -vsync 0 "${outputPath}"`
    );
    const { size: fileSize } = await fs.stat(outputPath);
    if (fileSize <= maxBytes) return outputPath;
  }
  return outputPath; // meilleure tentative, même si toujours au-dessus de la limite
}

async function compressAnimatedWebpUnder(inputPath, outputPath, maxBytes, size = 512) {
  // inputPath : vidéo (webm/mp4) source. Produit un webp animé <=6s, 8fps, <=maxBytes.
  const qualities = [70, 55, 40, 25];
  for (const q of qualities) {
    await run(
      `ffmpeg -y -i "${inputPath}" -t 6 -vf "fps=8,scale=${size}:${size}:force_original_aspect_ratio=decrease,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -q:v ${q} -loop 0 -preset picture -an -vsync 0 "${outputPath}"`
    );
    const { size: fileSize } = await fs.stat(outputPath);
    if (fileSize <= maxBytes) return outputPath;
  }
  return outputPath;
}

// ---------------------------------------------------------------------------
// Appels bruts à l'API Bot Telegram pour les sticker sets
// (form-data manuel, indépendant de node-telegram-bot-api)
// ---------------------------------------------------------------------------

async function callTelegramApi(token, method, fields, files) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields || {})) {
    if (value === undefined || value === null) continue;
    form.append(key, typeof value === "string" ? value : JSON.stringify(value));
  }
  for (const [key, filePath] of Object.entries(files || {})) {
    form.append(key, fs.createReadStream(filePath));
  }

  const { data } = await axios.post(`https://api.telegram.org/bot${token}/${method}`, form, {
    headers: form.getHeaders(),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  if (!data.ok) {
    throw new Error(data.description || `Échec de l'appel ${method}`);
  }
  return data.result;
}

/**
 * Crée un nouveau pack de stickers appartenant à l'utilisateur userId,
 * avec un premier sticker.
 * stickerFile : { path, format: 'static'|'video'|'animated', emojiList: string[] }
 */
async function createNewStickerSet(token, { userId, name, title, stickerFile, stickerType = "regular" }) {
  const attachField = "sticker0";
  const stickersPayload = [
    {
      sticker: `attach://${attachField}`,
      format: stickerFile.format,
      emoji_list: stickerFile.emojiList,
    },
  ];

  return callTelegramApi(
    token,
    "createNewStickerSet",
    {
      user_id: userId,
      name,
      title,
      stickers: stickersPayload,
      sticker_type: stickerType,
    },
    { [attachField]: stickerFile.path }
  );
}

/**
 * Ajoute un sticker à un pack existant (créé par ce bot).
 */
async function addStickerToSet(token, { userId, name, stickerFile }) {
  const attachField = "sticker0";
  const stickerPayload = {
    sticker: `attach://${attachField}`,
    format: stickerFile.format,
    emoji_list: stickerFile.emojiList,
  };

  return callTelegramApi(
    token,
    "addStickerToSet",
    { user_id: userId, name, sticker: stickerPayload },
    { [attachField]: stickerFile.path }
  );
}

async function getStickerSet(token, name) {
  const { data } = await axios.get(`https://api.telegram.org/bot${token}/getStickerSet`, {
    params: { name },
  });
  if (!data.ok) throw new Error(data.description || "Pack introuvable");
  return data.result;
}

async function deleteStickerFromSet(token, fileId) {
  return callTelegramApi(token, "deleteStickerFromSet", { sticker: fileId });
}

async function setStickerSetTitle(token, { name, title }) {
  return callTelegramApi(token, "setStickerSetTitle", { name, title });
}

module.exports = {
  TMP_DIR,
  tmpPath,
  run,
  downloadTelegramFile,
  extractMedia,
  convertStaticToWebp,
  convertVideoToWebm,
  compressWebpUnder,
  compressAnimatedWebpUnder,
  createNewStickerSet,
  addStickerToSet,
  getStickerSet,
  deleteStickerFromSet,
  setStickerSetTitle,
};
