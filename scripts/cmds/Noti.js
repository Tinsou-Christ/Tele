const fs = require('fs');
const path = require('path');

// Métadonnées de la commande
const nix = {
  name: "notification",
  aliases: ["notify", "noti"],
  version: "0.0.1",
  author: "ArYAN",
  description: "Send notification from admin to all groups with reply support",
  guide: ["/notification <message>", "Répondez à une notification pour contacter l'admin"],
  cooldown: 5,
  type: "admin",
  category: "owner",
  prefix: false,
};

// ID de l'admin (fixe, comme dans l'original)
const ADMIN_ID = 8294554523;

// Fonction utilitaire pour charger les IDs des groupes depuis différentes sources
async function getGroupIds(bot, currentChatId) {
  let groupIds = [];

  // 1. MongoDB (si activé)
  if (global.mongoDB) {
    try {
      const mongoose = require('mongoose');
      const Thread = mongoose.models.Thread || mongoose.model('Thread');
      const threads = await Thread.find({});
      groupIds = threads.map(t => t.threadID);
      if (groupIds.length > 0) return groupIds;
    } catch (e) {
      console.error('[MONGODB] Error fetching threads:', e.message);
    }
  }

  // 2. Fichier threads.json (format GoatBot)
  const threadsPath = path.join(process.cwd(), 'database/data/threads.json');
  if (fs.existsSync(threadsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(threadsPath, 'utf8'));
      groupIds = Object.keys(data).filter(id => id.toString().startsWith('-'));
      if (groupIds.length > 0) return groupIds;
    } catch (e) {
      // Ignorer
    }
  }

  // 3. Cache global NixBot.threads
  if (global.NixBot && global.NixBot.threads) {
    groupIds = Array.from(global.NixBot.threads.keys()).filter(id => id.toString().startsWith('-'));
    if (groupIds.length > 0) return groupIds;
  }

  // 4. Fallback : si la commande est exécutée dans un groupe, utiliser ce groupe
  if (currentChatId.toString().startsWith('-')) {
    groupIds = [currentChatId];
  }

  return groupIds;
}

// Fonction principale (appelée quand la commande est exécutée)
async function onStart({ bot, msg, chatId, userId, args }) {
  // Vérifier que l'utilisateur est l'admin
  if (userId !== ADMIN_ID) {
    return bot.sendMessage(chatId, "❌ Seuls les administrateurs peuvent utiliser cette commande.", {
      reply_to_message_id: msg.message_id
    });
  }

  // Vérifier qu'un message est fourni
  if (!args.length) {
    return bot.sendMessage(chatId, "Veuillez entrer le message à envoyer à tous les groupes.", {
      reply_to_message_id: msg.message_id
    });
  }

  const content = args.join(" ");
  const senderName = msg.from.first_name || "Admin";

  // Récupérer la liste des groupes
  const groupIds = await getGroupIds(bot, chatId);
  if (groupIds.length === 0) {
    return bot.sendMessage(chatId, "Aucun groupe trouvé pour envoyer la notification.", {
      reply_to_message_id: msg.message_id
    });
  }

  // Texte de la notification
  const notificationText = `📢 𝗡𝗢𝗧𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗙𝗥𝗢𝗠 𝗔𝗗𝗠𝗜𝗡\n━━━━━━━━━━━━━━━━━━━━\n👤 Admin: ${senderName}\n💬 Message: ${content}\n━━━━━━━━━━━━━━━━━━━━\nℹ️ Vous pouvez répondre à ce message pour parler à l'admin !`;

  let successCount = 0;
  let failCount = 0;

  // Envoyer la notification à chaque groupe
  for (const tid of groupIds) {
    try {
      let sentMsg;
      // Si le message original contient des médias, on les copie
      if (msg.photo || msg.video || msg.audio || msg.document || msg.voice || msg.animation) {
        sentMsg = await bot.copyMessage(tid, chatId, msg.message_id, {
          caption: notificationText,
          parse_mode: "Markdown"
        });
      } else {
        sentMsg = await bot.sendMessage(tid, notificationText, { parse_mode: "Markdown" });
      }

      // Stocker le contexte pour permettre les réponses
      const context = {
        type: "notification_admin",
        senderChatId: chatId,          // Le chat où l'admin a exécuté la commande
        senderMsgId: msg.message_id,   // Le message original de l'admin
      };
      if (!global.NixBot) global.NixBot = {};
      if (!global.NixBot.replies) global.NixBot.replies = new Map();
      global.NixBot.replies.set(sentMsg.message_id.toString(), context);

      successCount++;
    } catch (e) {
      failCount++;
      console.error(`Échec d'envoi à ${tid}:`, e.message);
    }
  }

  // Réponse à l'admin
  const resultMsg = `✅ Notification envoyée à ${successCount} groupe(s).\n❌ Échec : ${failCount}`;
  await bot.sendMessage(chatId, resultMsg, { reply_to_message_id: msg.message_id });
}

// Fonction appelée lorsqu'un utilisateur répond à un message du bot
async function onReply({ bot, msg, chatId, userId, data }) {
  // data est le contexte stocké pour le message auquel l'utilisateur répond
  if (!data) return;

  // Si l'utilisateur est l'admin, on traite comme une réponse de l'admin
  if (userId === ADMIN_ID && data.type === "notification_admin") {
    // L'admin répond à une notification → forward à l'utilisateur/chat d'origine
    const targetChatId = data.senderChatId;
    try {
      await bot.copyMessage(targetChatId, chatId, msg.message_id);
      await bot.sendMessage(chatId, "✅ Message transféré à l'utilisateur/chat d'origine.", {
        reply_to_message_id: msg.message_id
      });
    } catch (e) {
      await bot.sendMessage(chatId, `❌ Erreur lors du transfert : ${e.message}`, {
        reply_to_message_id: msg.message_id
      });
    }
    return;
  }

  // Si l'utilisateur n'est pas l'admin, c'est un utilisateur répondant à une notification
  // On forward à l'admin
  const userName = msg.from.first_name || "Utilisateur";
  const groupName = msg.chat.title || "Chat privé";
  const forwardText = `📨 𝗥𝗘𝗣𝗟𝗬 𝗙𝗥𝗢𝗠 𝗨𝗦𝗘𝗥\n━━━━━━━━━━━━━━━━━━━━\n👤 User: ${userName} (${userId})\n👥 Group: ${groupName}\n💬 Message: ${msg.text || "(Média)"}\n━━━━━━━━━━━━━━━━━━━━\nRépondez à ce message pour répondre à l'utilisateur.`;

  try {
    const forwarded = await bot.copyMessage(ADMIN_ID, chatId, msg.message_id, {
      caption: forwardText,
      parse_mode: "Markdown"
    });

    // Stocker le contexte pour que l'admin puisse répondre
    const context = {
      type: "notification_user",
      senderChatId: chatId,
      senderMsgId: msg.message_id,
    };
    if (!global.NixBot) global.NixBot = {};
    if (!global.NixBot.replies) global.NixBot.replies = new Map();
    global.NixBot.replies.set(forwarded.message_id.toString(), context);

    await bot.sendMessage(chatId, "✅ Votre réponse a été envoyée à l'admin !", {
      reply_to_message_id: msg.message_id
    });
  } catch (e) {
    console.error("Erreur envoi à l'admin:", e.message);
    await bot.sendMessage(chatId, "❌ Erreur lors de l'envoi à l'admin.", {
      reply_to_message_id: msg.message_id
    });
  }
}

module.exports = {
  nix,
  onStart,
  onReply,
};
