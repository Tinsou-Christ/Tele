const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  nix: {
    name: "x",
    aliases: ["video", "searchvid"],
    version: "1.0.0",
    author: "Christus",
    role: 0,
    category: "media",
    description: "Recherche et télécharge des vidéos.",
    cooldown: 5,
    guide: "{p}x <query>"
  },

  async onStart({ bot, chatId, args, msg }) {
    const query = args.join(" ");

    if (!query) {
      return bot.sendMessage(chatId, "❌ Entrez un texte de recherche.");
    }

    try {
      const waitMsg = await bot.sendMessage(
        chatId,
        "🔎 Recherche des vidéos en cours..."
      );

      const res = await axios.get(
        `https://x-search-api-sagor.vercel.app/sagor?apikey=sagor&q=${encodeURIComponent(query)}`,
        {
          timeout: 30000
        }
      );

      let results = res.data.data || [];

      results = results.filter(item => {
        const title = (item.title || "").toLowerCase();

        if (
          title.includes("sex") ||
          title.includes("porn") ||
          title.includes("xxx")
        ) return false;

        const duration = (item.duration || "").toLowerCase();

        if (duration.includes("min")) {
          const min = parseInt(duration);
          return min <= 10;
        }

        if (duration.includes("sec")) return true;

        return false;
      });

      const list = results.slice(0, 10);

      if (list.length === 0) {
        return bot.editMessageText(
          "❌ Aucun résultat trouvé.",
          {
            chat_id: chatId,
            message_id: waitMsg.message_id
          }
        );
      }

      const cacheDir = path.join(__dirname, "cache");
      fs.ensureDirSync(cacheDir);

      let text = `🔎 Résultats pour : ${query}\n`;
      text += `📹 Vidéos ≤ 10 minutes\n\n`;

      const media = [];

      for (let i = 0; i < list.length; i++) {
        const item = list[i];

        text += `${i + 1}. ${item.title}\n⏱️ ${item.duration}\n\n`;

        if (item.thumbnail) {
          try {
            const thumbPath = path.join(
              cacheDir,
              `thumb_${Date.now()}_${i}.jpg`
            );

            const img = await axios({
              url: item.thumbnail,
              method: "GET",
              responseType: "stream",
              timeout: 30000
            });

            const writer = fs.createWriteStream(thumbPath);

            img.data.pipe(writer);

            await new Promise((resolve, reject) => {
              writer.on("finish", resolve);
              writer.on("error", reject);
            });

            media.push({
              type: "photo",
              media: fs.createReadStream(thumbPath),
              caption:
                i === 0
                  ? text
                  : `${i + 1}. ${item.title}\n⏱️ ${item.duration}`
            });
          } catch {}
        }
      }

      if (media.length > 0) {
        await bot.sendMediaGroup(chatId, media);
      } else {
        await bot.sendMessage(chatId, text);
      }

      await bot.sendMessage(
        chatId,
        `💬 Répondez avec un numéro entre 1 et ${list.length} pour télécharger la vidéo.`
      );

      global.replyMap = global.replyMap || new Map();

      global.replyMap.set(chatId, {
        author: msg.from.id,
        list
      });

      try {
        await bot.deleteMessage(chatId, waitMsg.message_id);
      } catch {}

      setTimeout(() => {
        fs.readdirSync(cacheDir).forEach(file => {
          const filePath = path.join(cacheDir, file);

          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
      }, 5000);

    } catch (error) {
      console.error(error);

      bot.sendMessage(
        chatId,
        "❌ Une erreur est survenue pendant la recherche."
      );
    }
  },

  async onReply({ bot, chatId, msg }) {
    try {
      if (!global.replyMap || !global.replyMap.has(chatId)) return;

      const data = global.replyMap.get(chatId);

      if (msg.from.id !== data.author) return;

      const index = parseInt(msg.text);

      if (
        isNaN(index) ||
        index < 1 ||
        index > data.list.length
      ) {
        return bot.sendMessage(
          chatId,
          "❌ Numéro invalide."
        );
      }

      const selected = data.list[index - 1];

      const wait = await bot.sendMessage(
        chatId,
        `⏳ Téléchargement de la vidéo...\n\n🎬 ${selected.title}`
      );

      const res = await axios.get(
        `https://x-down-api-sagor.vercel.app/sagor?apikey=sagor&q=${encodeURIComponent(selected.url)}`,
        {
          timeout: 30000
        }
      );

      const videoData = res.data.data;

      const videoUrl = videoData?.downloads?.[0]?.url;

      if (!videoUrl) {
        return bot.sendMessage(
          chatId,
          "❌ Impossible de récupérer la vidéo."
        );
      }

      const tempPath = path.join(
        __dirname,
        `x_${Date.now()}.mp4`
      );

      const response = await axios({
        url: videoUrl,
        method: "GET",
        responseType: "stream",
        timeout: 30000
      });

      const writer = fs.createWriteStream(tempPath);

      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      await bot.sendVideo(
        chatId,
        tempPath,
        {
          caption:
            `🎬 ${videoData.title}\n` +
            `⏱️ ${videoData.duration || "Inconnue"}`
        }
      );

      try {
        await bot.deleteMessage(chatId, wait.message_id);
      } catch {}

      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }

      global.replyMap.delete(chatId);

    } catch (error) {
      console.error(error);

      bot.sendMessage(
        chatId,
        "❌ Échec de l'envoi de la vidéo."
      );
    }
  }
};
