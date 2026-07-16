const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');

const execP = promisify(exec);

const tmpDir = path.join(os.tmpdir(), 'telegram_stickers');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

const storeDir = path.join(__dirname, 'cache');
if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
const storeFile = path.join(storeDir, 'tele_packs.json');

const nix = {
  name: 'tele',
  version: '1.0.0',
  aliases: ['telesticker', 'tpack'],
  description: 'Gestion de packs de stickers Telegram + export WhatsApp',
  author: 'Christus',
  prefix: true,
  category: 'media',
  role: 0,
  cooldown: 5,
  guide:
    '{p}tele new <nom>       – crée un nouveau pack\n' +
    '{p}tele use <nom>       – change de pack actif\n' +
    '{p}tele list            – liste tes packs\n' +
    '{p}tele import <lien>   – importe un pack t.me/addstickers/...\n' +
    '{p}tele add             – (reply média) ajoute au pack actif\n' +
    '{p}tele whatsapp        – exporte le pack actif en .wastickers\n' +
    '{p}tele help            – aide'
};

// ---------- Store ----------
function loadStore() {
  try { return JSON.parse(fs.readFileSync(storeFile, 'utf8')); } catch { return {}; }
}
function saveStore(data) {
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2));
}
function getUser(store, userId) {
  if (!store[userId]) store[userId] = { active: null, packs: {} };
  return store[userId];
}
function slugify(name, userId) {
  const s = String(name).toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 40) || 'pack';
  return `${s}_${userId}_by_${process.env.BOT_USERNAME || 'bot'}`;
}

// ---------- FS helpers ----------
function cleanup(filePath) {
  fs.unlink(filePath, () => {});
}

async function downloadTelegramFile(bot, fileId, destPath) {
  const file = await bot.getFile(fileId);
  const fileUrl = `https://api.telegram.org/file/bot${bot.token}/${file.file_path}`;
  const response = await axios({ url: fileUrl, method: 'GET', responseType: 'stream' });
  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);
  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
  return destPath;
}

function getVideoDuration(inputPath) {
  return new Promise((resolve, reject) => {
    exec(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputPath}"`, (error, stdout) => {
      if (error) return reject(error);
      const duration = parseFloat(stdout);
      if (isNaN(duration)) return reject(new Error('Impossible de lire la durée de la vidéo'));
      resolve(duration);
    });
  });
}

function convertImageToSticker(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512" -vcodec libwebp -lossless 1 -q:v 80 -preset default -loop 0 -an -vsync 0 "${outputPath}" -y`;
    exec(cmd, (error, _stdout, stderr) => {
      if (error) { console.error('Erreur conversion image:', stderr); reject(error); } else resolve();
    });
  });
}

function convertVideoToSticker(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15" -vcodec libvpx-vp9 -crf 32 -b:v 0 -an -t 3 "${outputPath}" -y`;
    exec(cmd, (error, _stdout, stderr) => {
      if (error) { console.error('Erreur conversion vidéo:', stderr); reject(error); } else resolve();
    });
  });
}

function convertToWhatsappWebp(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const cmd = `ffmpeg -i "${inputPath}" -vf "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000" -vcodec libwebp -lossless 0 -q:v 75 -preset default -an -vsync 0 "${outputPath}" -y`;
    exec(cmd, (error, _stdout, stderr) => {
      if (error) { console.error('Erreur conversion whatsapp:', stderr); reject(error); } else resolve();
    });
  });
}

// ---------- Media resolution ----------
function extractMedia(targetMsg) {
  if (!targetMsg) return null;
  if (targetMsg.sticker) {
    return { type: 'sticker', fileId: targetMsg.sticker.file_id, isVideo: !!targetMsg.sticker.is_video, isAnimated: !!targetMsg.sticker.is_animated, emoji: targetMsg.sticker.emoji || '🎨' };
  }
  if (targetMsg.photo) {
    return { type: 'photo', fileId: targetMsg.photo[targetMsg.photo.length - 1].file_id, isVideo: false };
  }
  if (targetMsg.video || targetMsg.animation) {
    const v = targetMsg.video || targetMsg.animation;
    return { type: 'video', fileId: v.file_id, isVideo: true };
  }
  if (targetMsg.document && targetMsg.document.mime_type) {
    const mt = targetMsg.document.mime_type;
    if (mt.startsWith('image/')) return { type: 'photo', fileId: targetMsg.document.file_id, isVideo: false };
    if (mt.startsWith('video/')) return { type: 'video', fileId: targetMsg.document.file_id, isVideo: true };
  }
  return null;
}

// ---------- Sticker set ops ----------
async function ensurePackExists(bot, ownerId, packName, title, firstStickerPath, isVideo, emoji) {
  try {
    await bot.getStickerSet(packName);
    return { created: false };
  } catch {
    const payload = {
      user_id: ownerId,
      name: packName,
      title,
      emojis: emoji || '🎨'
    };
    if (isVideo) payload.webm_sticker = fs.createReadStream(firstStickerPath);
    else payload.png_sticker = fs.createReadStream(firstStickerPath);
    await bot.createNewStickerSet(ownerId, packName, title, payload);
    return { created: true };
  }
}

async function addStickerToPack(bot, ownerId, packName, stickerPath, isVideo, emoji) {
  const payload = { user_id: ownerId, name: packName, emojis: emoji || '🎨' };
  if (isVideo) payload.webm_sticker = fs.createReadStream(stickerPath);
  else payload.png_sticker = fs.createReadStream(stickerPath);
  await bot.addStickerToSet(ownerId, packName, payload);
}

async function processMediaToStickerFile(bot, media) {
  const ts = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const isVideo = media.isVideo;
  const ext = isVideo ? 'mp4' : 'jpg';
  const inputPath = path.join(tmpDir, `in_${ts}.${ext}`);
  const outputPath = path.join(tmpDir, `out_${ts}.${isVideo ? 'webm' : 'webp'}`);

  if (media.type === 'sticker') {
    // sticker déjà au format : téléchargement direct
    const rawExt = isVideo ? 'webm' : 'webp';
    const rawPath = path.join(tmpDir, `raw_${ts}.${rawExt}`);
    await downloadTelegramFile(bot, media.fileId, rawPath);
    return { filePath: rawPath, isVideo, cleanupPaths: [rawPath] };
  }

  await downloadTelegramFile(bot, media.fileId, inputPath);
  if (isVideo) {
    const duration = await getVideoDuration(inputPath);
    if (duration > 30) { cleanup(inputPath); throw new Error('Vidéo > 30 secondes'); }
    await convertVideoToSticker(inputPath, outputPath);
  } else {
    await convertImageToSticker(inputPath, outputPath);
  }
  return { filePath: outputPath, isVideo, cleanupPaths: [inputPath, outputPath] };
}

// ---------- Subcommand handlers ----------
async function cmdHelp(bot, chatId, msg) {
  await bot.sendMessage(chatId,
    `🎨 Commande Tele – gestion de packs de stickers\n━━━━━━━━━━━━━━\n\n` +
    nix.guide.replace(/\{p\}/g, '/'),
    { reply_to_message_id: msg.message_id }
  );
}

async function cmdNew(bot, msg, chatId, userId, args) {
  const name = args.slice(1).join(' ').trim();
  if (!name) return bot.sendMessage(chatId, '❌ Usage : /tele new <nom du pack>', { reply_to_message_id: msg.message_id });
  const store = loadStore();
  const user = getUser(store, userId);
  const packName = slugify(name, userId);
  if (user.packs[packName]) {
    user.active = packName;
    saveStore(store);
    return bot.sendMessage(chatId, `✅ Pack déjà existant, activé : ${name}`, { reply_to_message_id: msg.message_id });
  }
  user.packs[packName] = { title: name, createdAt: Date.now(), count: 0, initialized: false };
  user.active = packName;
  saveStore(store);
  await bot.sendMessage(chatId,
    `✅ Pack créé : ${name}\n` +
    `📦 ID : ${packName}\n\n` +
    `👉 Envoie une photo / vidéo / sticker (ou fais /tele add en reply)\n` +
    `   Le premier média finalisera la création du pack sur Telegram.`,
    { reply_to_message_id: msg.message_id }
  );
}

async function cmdUse(bot, msg, chatId, userId, args) {
  const name = args.slice(1).join(' ').trim();
  if (!name) return bot.sendMessage(chatId, '❌ Usage : /tele use <nom>', { reply_to_message_id: msg.message_id });
  const store = loadStore();
  const user = getUser(store, userId);
  const packName = slugify(name, userId);
  if (!user.packs[packName]) return bot.sendMessage(chatId, `❌ Pack introuvable : ${name}`, { reply_to_message_id: msg.message_id });
  user.active = packName;
  saveStore(store);
  await bot.sendMessage(chatId, `✅ Pack actif : ${user.packs[packName].title}`, { reply_to_message_id: msg.message_id });
}

async function cmdList(bot, msg, chatId, userId) {
  const store = loadStore();
  const user = getUser(store, userId);
  const entries = Object.entries(user.packs);
  if (!entries.length) return bot.sendMessage(chatId, '📭 Aucun pack. Crée-en un avec /tele new <nom>', { reply_to_message_id: msg.message_id });
  const lines = entries.map(([id, p]) => `${user.active === id ? '➡️' : '  '} ${p.title} — ${p.count || 0} stickers\n     https://t.me/addstickers/${id}`);
  await bot.sendMessage(chatId, `📦 Tes packs :\n\n${lines.join('\n\n')}`, { reply_to_message_id: msg.message_id, disable_web_page_preview: true });
}

async function cmdAdd(bot, msg, chatId, userId) {
  const store = loadStore();
  const user = getUser(store, userId);
  if (!user.active) return bot.sendMessage(chatId, '❌ Aucun pack actif. Fais /tele new <nom> d\'abord.', { reply_to_message_id: msg.message_id });
  const target = msg.reply_to_message || msg;
  const media = extractMedia(target);
  if (!media) return bot.sendMessage(chatId, '❌ Réponds à une photo / vidéo / sticker.', { reply_to_message_id: msg.message_id });

  const notice = await bot.sendMessage(chatId, '⏳ Traitement...', { reply_to_message_id: msg.message_id });
  try {
    const { filePath, isVideo, cleanupPaths } = await processMediaToStickerFile(bot, media);
    const pack = user.packs[user.active];
    const emoji = media.emoji || '🎨';

    if (!pack.initialized) {
      await ensurePackExists(bot, userId, user.active, pack.title, filePath, isVideo, emoji);
      pack.initialized = true;
      pack.isVideo = isVideo;
    } else {
      await addStickerToPack(bot, userId, user.active, filePath, isVideo, emoji);
    }
    pack.count = (pack.count || 0) + 1;
    saveStore(store);
    cleanupPaths.forEach(cleanup);

    await bot.editMessageText(
      `✅ Ajouté à ${pack.title} (${pack.count})\nhttps://t.me/addstickers/${user.active}`,
      { chat_id: chatId, message_id: notice.message_id, disable_web_page_preview: true }
    );
  } catch (err) {
    console.error('Erreur add:', err);
    await bot.editMessageText(`❌ Erreur : ${err.message}`, { chat_id: chatId, message_id: notice.message_id });
  }
}

async function cmdImport(bot, msg, chatId, userId, args) {
  const store = loadStore();
  const user = getUser(store, userId);
  if (!user.active) return bot.sendMessage(chatId, '❌ Aucun pack actif. Fais /tele new <nom> d\'abord.', { reply_to_message_id: msg.message_id });

  const link = args[1];
  const m = link && link.match(/(?:t\.me\/addstickers\/|^)([A-Za-z0-9_]+)$/);
  if (!m) return bot.sendMessage(chatId, '❌ Usage : /tele import <lien t.me/addstickers/...>', { reply_to_message_id: msg.message_id });
  const sourceName = m[1];

  const notice = await bot.sendMessage(chatId, `⏳ Import de ${sourceName}...`, { reply_to_message_id: msg.message_id });
  let set;
  try { set = await bot.getStickerSet(sourceName); }
  catch { return bot.editMessageText('❌ Pack Telegram introuvable.', { chat_id: chatId, message_id: notice.message_id }); }

  const pack = user.packs[user.active];
  let ok = 0, fail = 0;
  const BATCH = 5;

  for (let i = 0; i < set.stickers.length; i += BATCH) {
    const batch = set.stickers.slice(i, i + BATCH);
    await Promise.all(batch.map(async (st) => {
      try {
        const media = { type: 'sticker', fileId: st.file_id, isVideo: !!st.is_video, emoji: st.emoji || '🎨' };
        const { filePath, isVideo, cleanupPaths } = await processMediaToStickerFile(bot, media);
        if (!pack.initialized) {
          await ensurePackExists(bot, userId, user.active, pack.title, filePath, isVideo, media.emoji);
          pack.initialized = true;
          pack.isVideo = isVideo;
        } else {
          await addStickerToPack(bot, userId, user.active, filePath, isVideo, media.emoji);
        }
        pack.count = (pack.count || 0) + 1;
        cleanupPaths.forEach(cleanup);
        ok++;
      } catch (e) {
        console.error('Import sticker fail:', e.message);
        fail++;
      }
    }));
    saveStore(store);
    try {
      await bot.editMessageText(`⏳ Import ${ok + fail}/${set.stickers.length} (${ok} OK, ${fail} échec)`, { chat_id: chatId, message_id: notice.message_id });
    } catch {}
  }

  await bot.editMessageText(
    `✅ Import terminé : ${ok} stickers ajoutés, ${fail} échecs\nhttps://t.me/addstickers/${user.active}`,
    { chat_id: chatId, message_id: notice.message_id, disable_web_page_preview: true }
  );
}

async function cmdWhatsapp(bot, msg, chatId, userId) {
  const store = loadStore();
  const user = getUser(store, userId);
  if (!user.active) return bot.sendMessage(chatId, '❌ Aucun pack actif.', { reply_to_message_id: msg.message_id });
  const pack = user.packs[user.active];
  const notice = await bot.sendMessage(chatId, '⏳ Export WhatsApp...', { reply_to_message_id: msg.message_id });

  let set;
  try { set = await bot.getStickerSet(user.active); }
  catch { return bot.editMessageText('❌ Le pack n\'existe pas encore côté Telegram. Ajoute au moins un sticker.', { chat_id: chatId, message_id: notice.message_id }); }

  const ts = Date.now();
  const workDir = path.join(tmpDir, `wa_${ts}`);
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const stickers = set.stickers.slice(0, 30);
    const paths = [];
    const BATCH = 5;
    for (let i = 0; i < stickers.length; i += BATCH) {
      const batch = stickers.slice(i, i + BATCH);
      await Promise.all(batch.map(async (st, idx) => {
        const rawPath = path.join(workDir, `raw_${i + idx}.webp`);
        const outPath = path.join(workDir, `${i + idx}.webp`);
        try {
          await downloadTelegramFile(bot, st.file_id, rawPath);
          await convertToWhatsappWebp(rawPath, outPath);
          paths.push(outPath);
          cleanup(rawPath);
        } catch (e) { console.error('WA convert fail:', e.message); }
      }));
    }

    // tray icon = premier sticker en 96x96
    const trayPath = path.join(workDir, 'tray.png');
    if (paths.length) {
      await execP(`ffmpeg -i "${paths[0]}" -vf "scale=96:96:force_original_aspect_ratio=decrease,pad=96:96:(ow-iw)/2:(oh-ih)/2:color=0x00000000" "${trayPath}" -y`);
    }

    const zipPath = path.join(tmpDir, `${user.active}_${ts}.wastickers`);
    await execP(`cd "${workDir}" && zip -r "${zipPath}" .`);

    await bot.sendDocument(chatId, zipPath, {
      reply_to_message_id: msg.message_id,
      caption: `📦 ${pack.title} — ${paths.length} stickers\n💡 Ouvre avec Sticker Maker pour WhatsApp`
    }, { filename: `${pack.title}.wastickers`, contentType: 'application/zip' });

    await bot.deleteMessage(chatId, notice.message_id).catch(() => {});
    cleanup(zipPath);
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  } catch (err) {
    console.error('Erreur whatsapp:', err);
    await bot.editMessageText(`❌ Erreur : ${err.message}`, { chat_id: chatId, message_id: notice.message_id });
    fs.rm(workDir, { recursive: true, force: true }, () => {});
  }
}

// ---------- Entry ----------
async function onStart({ bot, msg, chatId, args }) {
  const userId = msg.from.id;
  const sub = (args[0] || '').toLowerCase();

  switch (sub) {
    case 'new':      return cmdNew(bot, msg, chatId, userId, args);
    case 'use':      return cmdUse(bot, msg, chatId, userId, args);
    case 'list':     return cmdList(bot, msg, chatId, userId);
    case 'add':      return cmdAdd(bot, msg, chatId, userId);
    case 'import':   return cmdImport(bot, msg, chatId, userId, args);
    case 'whatsapp':
    case 'wa':       return cmdWhatsapp(bot, msg, chatId, userId);
    case 'help':
    case '':         return cmdHelp(bot, chatId, msg);
    default:         return cmdHelp(bot, chatId, msg);
  }
}

module.exports = { onStart, nix };