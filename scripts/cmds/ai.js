const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");
const { v4: uuidv4 } = require("uuid");
const fonts = require('../../func/fonts.js'); // Import de la police sans-serif

const API_ENDPOINT = "https://shizuai.vercel.app/chat";
const CLEAR_ENDPOINT = "https://shizuai.vercel.app/chat/clear";
const TMP_DIR = path.join(__dirname, "cache");

async function download(url, ext) {
  await fs.ensureDir(TMP_DIR);
  const filePath = path.join(TMP_DIR, `${uuidv4()}.${ext}`);
  const res = await axios.get(url, { responseType: "arraybuffer" });
  await fs.writeFile(filePath, res.data);
  return filePath;
}

function normalizeText(text) {
  if (!text) return text;
  return text
    .replace(/Aryan\s*Chauchan/gi, "Christus")
    .replace(/Aryan\s*Chauhan/gi, "Christus")
    .replace(/A\.?\s*Chauchan/gi, "Christus");
}

const nix = {
  name: "ai",
  version: "3.0.1",
  aliases: ["shizu"],
  description: "Advanced AI (text, image, music, video, lyrics)",
  author: "Christus",
  prefix: true,
  category: "ai",
  type: "anyone",
  cooldown: 3,
  guide: "{p}ai <message | image>\n{p}ai reset",
};

async function onStart({ bot, msg, chatId, args }) {
  const input = args.join(" ").trim();
  const userId = msg.from.id;

  // Reset conversation
  if (["reset", "clear"].includes(input.toLowerCase())) {
    try {
      await axios.delete(`${CLEAR_ENDPOINT}/${encodeURIComponent(userId)}`);
      return bot.sendMessage(chatId, "♻️ Conversation reset successfully.", {
        reply_to_message_id: msg.message_id,
      });
    } catch {
      return bot.sendMessage(chatId, "❌ Failed to reset conversation.", {
        reply_to_message_id: msg.message_id,
      });
    }
  }

  // Check for image in current message or replied message
  let imageUrl = null;
  const getPhotoUrl = async (photo) => {
    if (!photo || !photo.length) return null;
    const fileId = photo[photo.length - 1].file_id; // largest size
    try {
      const fileLink = await bot.getFileLink(fileId);
      return fileLink;
    } catch (e) {
      console.error("Failed to get photo URL:", e);
      return null;
    }
  };

  if (msg.photo && msg.photo.length > 0) {
    imageUrl = await getPhotoUrl(msg.photo);
  } else if (msg.reply_to_message && msg.reply_to_message.photo) {
    imageUrl = await getPhotoUrl(msg.reply_to_message.photo);
  }

  // No text or image? (text can be empty if only image)
  if (!input && !imageUrl) {
    return bot.sendMessage(chatId, "💬 Please provide a message or an image.", {
      reply_to_message_id: msg.message_id,
    });
  }

  const timestamp = moment().tz("Asia/Manila").format("MMMM D, YYYY h:mm A");

  const waitMsg = await bot.sendMessage(
    chatId,
    `🤖 AI is thinking...\n━━━━━━━━━━━━━━━\n📅 ${timestamp}`,
    { reply_to_message_id: msg.message_id }
  );

  const createdFiles = [];

  try {
    const res = await axios.post(API_ENDPOINT, {
      uid: userId,
      message: input || "",
      image_url: imageUrl || null,
    });

    const { reply, image_url, music_data, video_data, shoti_data, lyrics_data } = res.data;

    // Normaliser le texte (supprimer les références à l'auteur original) et enlever les astérisques
    let text = normalizeText(reply || "✅ AI Response").replace(/\*/g, "");
    
    // Appliquer la police sans-serif (𝖺𝖠𝗓𝖹)
    text = fonts.sansSerif(text);

    const attachments = [];

    if (image_url) {
      const file = await download(image_url, "jpg");
      attachments.push({ type: "photo", path: file });
      createdFiles.push(file);
    }

    if (music_data?.downloadUrl) {
      const file = await download(music_data.downloadUrl, "mp3");
      attachments.push({ type: "audio", path: file });
      createdFiles.push(file);
    }

    if (video_data?.downloadUrl || shoti_data?.downloadUrl) {
      const url = video_data?.downloadUrl || shoti_data?.downloadUrl;
      const file = await download(url, "mp4");
      attachments.push({ type: "video", path: file });
      createdFiles.push(file);
    }

    if (lyrics_data?.lyrics) {
      let lyrics = normalizeText(lyrics_data.lyrics.slice(0, 1500)).replace(/\*/g, "");
      lyrics = fonts.sansSerif(lyrics);
      text += `\n\n🎵 ${fonts.sansSerif(lyrics_data.track_name)}\n${lyrics}`;
    }

    await bot.deleteMessage(chatId, waitMsg.message_id);

    if (attachments.length) {
      for (const media of attachments) {
        if (media.type === "photo") {
          await bot.sendPhoto(chatId, fs.createReadStream(media.path), {
            caption: text,
            reply_to_message_id: msg.message_id,
          });
        } else if (media.type === "audio") {
          await bot.sendAudio(chatId, fs.createReadStream(media.path), {
            caption: text,
            reply_to_message_id: msg.message_id,
          });
        } else {
          await bot.sendVideo(chatId, fs.createReadStream(media.path), {
            caption: text,
            reply_to_message_id: msg.message_id,
          });
        }
      }
    } else {
      await bot.sendMessage(chatId, text, { reply_to_message_id: msg.message_id });
    }
  } catch (err) {
    console.error("AI Command Error:", err);
    await bot.editMessageText("❌ An AI error occurred.", {
      chat_id: chatId,
      message_id: waitMsg.message_id,
    });
  } finally {
    for (const file of createdFiles) {
      if (await fs.pathExists(file)) {
        await fs.remove(file);
      }
    }
  }
}

module.exports = { nix, onStart };
