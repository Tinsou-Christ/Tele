const axios = require('axios');
const fs = require('fs');
const path = require('path');
const yts = require('yt-search');

// Constants from original command
const nc = "aryan";
const API_CONFIG_URL = "https://arychauhann.onrender.com/api/xnxxsearch";

// Cache directory for temporary files
const CACHE_DIR = path.join(__dirname, 'cache');
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

const nix = {
  name: "xvideo",
  version: "0.0.1",
  aliases: ["xv"],
  description: "Download YouTube video interactively",
  author: "Christus",
  prefix: true,
  category: "MUSIC",
  role: 0,
  cooldown: 5,
  guide: "{p}video [video name]"
};

async function onStart({ bot, message, msg, chatId, args, usages }) {
  if (!args.length) {
    return bot.sendMessage(chatId, "❌ Missing video name", { reply_to_message_id: msg.message_id });
  }

  const query = args.join(" ");
  try {
    const searchResult = await yts(query);
    if (!searchResult || !searchResult.videos.length) {
      throw new Error("No video found");
    }

    const videos = searchResult.videos.slice(0, 6);
    let listText = "🔎 Found 6 videos. Reply with the number to download\n\n";
    const thumbPaths = [];

    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const thumbPath = path.join(CACHE_DIR, `thumb_${Date.now()}_${i}.jpg`);

      // Download thumbnail
      const thumbRes = await axios.get(video.thumbnail, { responseType: 'arraybuffer' });
      fs.writeFileSync(thumbPath, Buffer.from(thumbRes.data));
      thumbPaths.push(thumbPath);

      const views = video.views.toLocaleString();
      listText += `${i + 1}. ${video.title}\nTime: ${video.timestamp}\nChannel: ${video.author.name}\n\n`;
    }

    // Send the text list first (this will be the message users reply to)
    const textMsg = await bot.sendMessage(chatId, listText, { reply_to_message_id: msg.message_id });

    // Send thumbnails as a media group (photo album)
    if (thumbPaths.length > 0) {
      const media = thumbPaths.map(p => ({
        type: 'photo',
        media: fs.createReadStream(p)
      }));
      await bot.sendMediaGroup(chatId, media, { reply_to_message_id: textMsg.message_id });
    }

    // Clean up thumbnails after sending
    thumbPaths.forEach(p => {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

    // Store data for reply handling
    global.teamnix.replies.set(textMsg.message_id, {
      type: "video_reply",
      authorId: msg.from.id,
      videos: videos.map(v => ({
        title: v.title,
        url: v.url,
        channel: v.author.name,
        views: v.views
      })),
      listMessageId: textMsg.message_id
    });

  } catch (err) {
    console.error("Video search error:", err);
    bot.sendMessage(chatId, `❌ Error: ${err.message}`, { reply_to_message_id: msg.message_id });
  }
}

async function onReply({ bot, message, msg, chatId, userId, data, replyMsg }) {
  // Validate that this reply belongs to a video selection
  if (data.type !== "video_reply" || userId !== data.authorId) return;

  const selection = parseInt(msg.text.trim());
  if (isNaN(selection) || selection < 1 || selection > data.videos.length) {
    return bot.sendMessage(chatId, "❌ Invalid selection. Choose 1-6.", { reply_to_message_id: msg.message_id });
  }

  // Try to delete the original list message to clean up
  try {
    await bot.deleteMessage(chatId, data.listMessageId);
  } catch (e) {
    // Ignore if already deleted
  }

  const selectedVideo = data.videos[selection - 1];
  const waitMsg = await bot.sendMessage(chatId, `⏳ Downloading: ${selectedVideo.title}...`, { reply_to_message_id: msg.message_id });

  try {
    // Fetch API base URL from config
    const configRes = await axios.get(API_CONFIG_URL);
    const apiBase = configRes.data && configRes.data.aryan;
    if (!apiBase) throw new Error("API Config error.");

    // Request download link
    const downloadUrl = `${apiBase}/${nc}/ytdl?url=${encodeURIComponent(selectedVideo.url)}&type=video`;
    const dlRes = await axios.get(downloadUrl);
    if (!dlRes.data.status || !dlRes.data.downloadUrl) {
      throw new Error("Could not fetch download link.");
    }

    const fileUrl = dlRes.data.downloadUrl;
    const fileName = `${Date.now()}.mp4`;
    const filePath = path.join(CACHE_DIR, fileName);

    // Download video file
    const videoRes = await axios.get(fileUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(filePath, Buffer.from(videoRes.data));

    const msgBody = `• Title: ${selectedVideo.title}\n• Channel: ${selectedVideo.channel}\n• Quality: ${dlRes.data.quality || '720p'}`;

    // Delete waiting message
    await bot.deleteMessage(chatId, waitMsg.message_id);

    // Send video
    await bot.sendVideo(chatId, filePath, {
      caption: msgBody,
      reply_to_message_id: msg.message_id
    });

    // Clean up video file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Remove stored reply data
    global.teamnix.replies.delete(replyMsg.message_id);

  } catch (err) {
    console.error("Video download error:", err);
    await bot.deleteMessage(chatId, waitMsg.message_id);
    bot.sendMessage(chatId, `❌ Error: ${err.message}`, { reply_to_message_id: msg.message_id });
  }
}

module.exports = { onStart, onReply, nix };
