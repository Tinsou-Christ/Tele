const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const moment = require("moment-timezone");

const nix = {
  name: "x",
  version: "12.0.0",
  aliases: ["xvideo", "xsearch"],
  description: "Recherche et téléchargement vidéo",
  author: "Christus",
  prefix: true,
  category: "media",
  role: 0,
  cooldown: 10,
  guide: "{p}x <recherche>"
};

async function streamFromURL(url) {
  const response = await axios({
    url,
    responseType: "stream"
  });
  return response.data;
}

function isValidVideo(item) {
  const title = (item.title || "").toLowerCase();
  const duration = (item.duration || "").toLowerCase();

  if (
    title.includes("sex") ||
    title.includes("porn") ||
    title.includes("xxx")
  ) {
    return false;
  }

  if (duration.includes("min")) {
    const min = parseInt(duration);
    return min <= 10;
  }

  if (duration.includes("sec")) {
    return true;
  }

  return false;
}

function buildMessage(list, userName) {
  const time = moment()
    .tz("Africa/Abidjan")
    .format("DD/MM/YYYY HH:mm:ss");

  let text =
`🔎 𝗩𝗶𝗱𝗲𝗼 𝗦𝗲𝗮𝗿𝗰𝗵
━━━━━━━━━━━━━━

👤 ${userName}
🕒 ${time}

🎬 Résultats disponibles :

`;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];

    text +=
`${i + 1}. ${item.title}
⏱️ ${item.duration}

`;
  }

  text +=
`━━━━━━━━━━━━━━
💬 Répondez avec un nombre entre 1 et ${list.length}`;

  return text;
}

async function onStart({
  bot,
  msg,
  chatId,
  args,
  usages
}) {
  const query = args.join(" ").trim();

  if (!query) {
    return usages();
  }

  const userId = msg.from.id;
  const userName =
    msg.from.first_name ||
    msg.from.username ||
    "Utilisateur";

  let loadingMsg;

  try {
    loadingMsg = await bot.sendMessage(
      chatId,
      "🔍 Recherche des vidéos en cours...",
      {
        reply_to_message_id: msg.message_id
      }
    );

    const res = await axios.get(
      `https://x-search-api-sagor.vercel.app/sagor?apikey=sagor&q=${encodeURIComponent(query)}`
    );

    let results = res.data.data || [];

    results = results.filter(isValidVideo);

    const list = results.slice(0, 10);

    if (list.length === 0) {
      await bot.deleteMessage(chatId, loadingMsg.message_id);

      return bot.sendMessage(
        chatId,
        "❌ Aucun résultat trouvé.",
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    const cacheDir = path.join(__dirname, "cache");
    await fs.ensureDir(cacheDir);

    const mediaGroup = [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];

      if (!item.thumbnail) continue;

      try {
        const imgPath = path.join(
          cacheDir,
          `thumb_${Date.now()}_${i}.jpg`
        );

        const stream = await streamFromURL(item.thumbnail);

        const writer = fs.createWriteStream(imgPath);

        stream.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on("finish", resolve);
          writer.on("error", reject);
        });

        mediaGroup.push({
          type: "photo",
          media: imgPath
        });

      } catch (e) {
        console.error("Thumbnail Error:", e.message);
      }
    }

    await bot.deleteMessage(chatId, loadingMsg.message_id);

    if (mediaGroup.length > 0) {
      await bot.sendMediaGroup(chatId, mediaGroup, {
        reply_to_message_id: msg.message_id
      });
    }

    const sentMsg = await bot.sendMessage(
      chatId,
      buildMessage(list, userName),
      {
        reply_to_message_id: msg.message_id
      }
    );

    mediaGroup.forEach(media => {
      try {
        if (fs.existsSync(media.media)) {
          fs.unlinkSync(media.media);
        }
      } catch {}
    });

    global.teamnix.replies.set(sentMsg.message_id, {
      nix,
      type: "x_reply",
      authorId: userId,
      list
    });

    setTimeout(() => {
      if (
        global.teamnix.replies.has(sentMsg.message_id)
      ) {
        global.teamnix.replies.delete(
          sentMsg.message_id
        );

        bot.sendMessage(
          chatId,
          "⏰ Temps écoulé. Veuillez refaire la commande.",
          {
            reply_to_message_id: sentMsg.message_id
          }
        );
      }
    }, 60000);

  } catch (error) {
    console.error("X Search Error:", error);

    if (loadingMsg) {
      await bot
        .deleteMessage(chatId, loadingMsg.message_id)
        .catch(() => {});
    }

    return bot.sendMessage(
      chatId,
      "❌ Une erreur est survenue avec l'API.",
      {
        reply_to_message_id: msg.message_id
      }
    );
  }
}

async function onReply({
  bot,
  msg,
  chatId,
  userId,
  data,
  replyMsg
}) {
  if (data.type !== "x_reply") return;

  if (userId !== data.authorId) return;

  const index = parseInt(msg.text);

  if (
    isNaN(index) ||
    index < 1 ||
    index > data.list.length
  ) {
    return bot.sendMessage(
      chatId,
      `❌ Choisissez un nombre entre 1 et ${data.list.length}.`,
      {
        reply_to_message_id: msg.message_id
      }
    );
  }

  const selected = data.list[index - 1];

  const loadingMsg = await bot.sendMessage(
    chatId,
    `⏳ Téléchargement de "${selected.title}"...`,
    {
      reply_to_message_id: msg.message_id
    }
  );

  try {
    const res = await axios.get(
      `https://x-down-api-sagor.vercel.app/sagor?apikey=sagor&q=${encodeURIComponent(selected.url)}`
    );

    const downloadData = res.data.data;

    const videoUrl =
      downloadData?.downloads?.[0]?.url;

    if (!videoUrl) {
      await bot.deleteMessage(
        chatId,
        loadingMsg.message_id
      );

      return bot.sendMessage(
        chatId,
        "❌ Impossible de récupérer la vidéo.",
        {
          reply_to_message_id: msg.message_id
        }
      );
    }

    const filePath = path.join(
      __dirname,
      `xvideo_${Date.now()}.mp4`
    );

    const writer = fs.createWriteStream(filePath);

    const videoStream = await axios({
      url: videoUrl,
      method: "GET",
      responseType: "stream"
    });

    videoStream.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    await bot.sendVideo(chatId, filePath, {
      caption:
`🎬 ${downloadData.title}

⏱️ ${downloadData.duration || "Inconnue"}`,
      reply_to_message_id: msg.message_id
    });

    await bot.deleteMessage(
      chatId,
      loadingMsg.message_id
    );

    global.teamnix.replies.delete(
      replyMsg.message_id
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

  } catch (error) {
    console.error("Download Error:", error);

    await bot
      .deleteMessage(chatId, loadingMsg.message_id)
      .catch(() => {});

    return bot.sendMessage(
      chatId,
      "❌ Échec du téléchargement.",
      {
        reply_to_message_id: msg.message_id
      }
    );
  }
}

module.exports = {
  nix,
  onStart,
  onReply
};
