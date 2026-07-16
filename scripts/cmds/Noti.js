// scripts/cmds/broadcast.js
//
// Portage GoatBot -> nix (Tele) de scripts/cmds/notification.js (Botbot-main).
// Renommée "broadcast" (et non "notification") car Tele-main a déjà une
// commande nommée "notification" (Noti.js) avec un rôle différent : relais
// de messages admin <-> utilisateur, pas diffusion à tous les groupes.
//
// Différences par rapport à l'original GoatBot :
// - api.getUserInfo / threadsData.getAll() (FCA) -> réutilisation de la même
//   logique multi-source que Noti.js (Mongo Thread model / threads.json /
//   cache global.NixBot.threads / fallback groupe courant) pour lister les
//   groupes.
// - global.GoatBot.onReply -> global.NixBot.replies (Map), même mécanisme
//   que Noti.js dans ce projet.
// - -a (tag all) : Messenger permet de taguer TOUS les membres d'un groupe.
//   Le Bot API Telegram ne donne accès qu'à la liste des ADMINS d'un groupe
//   (pas la liste complète des membres). -a mentionne donc les admins
//   uniquement, via un lien tg://user?id=... (fonctionne même sans @username).
// - -p (pin) : bot.pinChatMessage, nécessite que le bot soit admin avec le
//   droit "Épingler les messages".
// - Pas d'attachments/mentions binaires FCA : les médias joints au message
//   d'origine sont repris avec bot.copyMessage.

const nix = {
  name: "notification",
  aliases: ["noti"],
  version: "1.0",
  author: "Christus (GoatBot) / portage",
  cooldown: 5,
  role: 2, // propriétaire du bot uniquement (role 4 côté GoatBot -> équivalent max ici)
  category: "owner",
  description: "📢 Envoie un message à tous les groupes où le bot est présent.",
  guide:
    "{p}broadcast <message> [-a] [-p]\n" +
    "  -a : mentionner les admins de chaque groupe (Telegram ne permet pas de taguer tous les membres via un bot)\n" +
    "  -p : épingler le message dans chaque groupe (le bot doit être admin avec ce droit)"
};

const DELAY_PER_GROUP = 250;
const MAX_RETRIES = 2;
const CONFIRM_TIMEOUT = 30000;

function parseArgs(args) {
  const options = { tagAdmins: false, pin: false };
  const parts = [];
  for (const arg of args) {
    if (arg === "-a" || arg === "--all") options.tagAdmins = true;
    else if (arg === "-p" || arg === "--pin") options.pin = true;
    else parts.push(arg);
  }
  return { text: parts.join(" "), options };
}

// Même logique multi-source que Noti.js pour rester cohérent avec le reste du projet.
async function getGroupIds(bot, currentChatId) {
  let groupIds = [];

  if (global.mongoDB) {
    try {
      const mongoose = require("mongoose");
      const Thread = mongoose.models.Thread || mongoose.model("Thread");
      const threads = await Thread.find({});
      groupIds = threads.map(t => t.threadID);
      if (groupIds.length > 0) return groupIds;
    } catch (e) {
      console.error("[MONGODB] Erreur récupération threads:", e.message);
    }
  }

  const fs = require("fs");
  const path = require("path");
  const threadsPath = path.join(process.cwd(), "database/data/threads.json");
  if (fs.existsSync(threadsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(threadsPath, "utf8"));
      groupIds = Object.keys(data).filter(id => id.toString().startsWith("-"));
      if (groupIds.length > 0) return groupIds;
    } catch (e) {}
  }

  if (global.NixBot && global.NixBot.threads) {
    groupIds = Array.from(global.NixBot.threads.keys()).filter(id => id.toString().startsWith("-"));
    if (groupIds.length > 0) return groupIds;
  }

  if (currentChatId.toString().startsWith("-")) {
    groupIds = [currentChatId];
  }

  return groupIds;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendWithRetry(bot, tid, srcChatId, srcMsgId, text, options) {
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let sentMsg;

      let finalText = text;
      if (options.tagAdmins) {
        try {
          const admins = await bot.getChatAdministrators(tid);
          const mentions = admins
            .filter(a => !a.user.is_bot)
            .map(a => `[${a.user.first_name}](tg://user?id=${a.user.id})`)
            .join(" ");
          if (mentions) finalText += `\n\n👥 ${mentions}`;
        } catch (e) {
          // Le bot n'est peut-être pas encore membre / pas de droits, on ignore
        }
      }

      if (srcMsgId) {
        sentMsg = await bot.copyMessage(tid, srcChatId, srcMsgId, {
          caption: finalText,
          parse_mode: "Markdown"
        });
      } else {
        sentMsg = await bot.sendMessage(tid, finalText, { parse_mode: "Markdown" });
      }

      if (options.pin && sentMsg?.message_id) {
        try {
          await bot.pinChatMessage(tid, sentMsg.message_id);
        } catch (e) {}
      }

      return { success: true };
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) await delay(1000 * (attempt + 1));
    }
  }
  return { success: false, error: lastError?.message };
}

async function onStart({ bot, msg, chatId, userId, args }) {
  const { text, options } = parseArgs(args);
  const hasMedia = !!(msg.photo || msg.video || msg.audio || msg.document || msg.voice || msg.animation);

  if (!text && !hasMedia) {
    return bot.sendMessage(
      chatId,
      "📢 Broadcast\n━━━━━━━━━━━━━━\n❌ Merci d'entrer un message ou de joindre un média.",
      { reply_to_message_id: msg.message_id }
    );
  }

  const senderName = msg.from.first_name || "Administrateur";
  const groupIds = await getGroupIds(bot, chatId);

  if (groupIds.length === 0) {
    return bot.sendMessage(chatId, "❌ Aucun groupe actif trouvé.", { reply_to_message_id: msg.message_id });
  }

  const notificationText =
    `📢 𝗡𝗢𝗧𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗗𝗘 𝗟'𝗔𝗗𝗠𝗜𝗡𝗜𝗦𝗧𝗥𝗔𝗧𝗘𝗨𝗥\n━━━━━━━━━━━━━━\nFrom : ${senderName}\n\n💬 :\n${text || ""}`;

  const confirmText =
    `📢 Envoi de broadcast\n━━━━━━━━━━━━━━\n➜ ${groupIds.length} groupe(s) concerné(s)\n` +
    `➜ Délai : ${DELAY_PER_GROUP} ms par groupe\n` +
    `➜ Options : ${options.tagAdmins ? "tag admins" : "aucun tag"} ${options.pin ? "+ pin" : ""}\n` +
    `➜ From : ${senderName}\n\n✅ Confirmez l'envoi en répondant "oui" (30 secondes).`;

  const confirmMsg = await bot.sendMessage(chatId, confirmText, { reply_to_message_id: msg.message_id });

  if (!global.NixBot) global.NixBot = {};
  if (!global.NixBot.replies) global.NixBot.replies = new Map();

  const replyKey = confirmMsg.message_id.toString();
  global.NixBot.replies.set(replyKey, {
    type: "confirm_broadcast",
    authorId: userId,
    authorChatId: chatId,
    srcMsgId: hasMedia ? msg.message_id : null,
    notificationText,
    groupIds,
    options
  });

  setTimeout(() => {
    const data = global.NixBot.replies.get(replyKey);
    if (data && data.type === "confirm_broadcast") {
      global.NixBot.replies.delete(replyKey);
      bot.sendMessage(chatId, "⏰ Temps écoulé, envoi annulé.", { reply_to_message_id: confirmMsg.message_id }).catch(() => {});
    }
  }, CONFIRM_TIMEOUT);
}

async function onReply({ bot, msg, chatId, userId, data }) {
  if (!data || data.type !== "confirm_broadcast") return;
  if (userId !== data.authorId) return;

  // On consomme l'entrée tout de suite pour éviter un double-déclenchement
  const replyKey = msg.reply_to_message ? msg.reply_to_message.message_id.toString() : null;
  if (replyKey) global.NixBot.replies.delete(replyKey);

  if ((msg.text || "").trim().toLowerCase() !== "oui") {
    return bot.sendMessage(chatId, "❌ Envoi annulé.", { reply_to_message_id: msg.message_id });
  }

  const { groupIds, notificationText, srcMsgId, authorChatId, options } = data;
  const startTime = Date.now();

  await bot.sendMessage(chatId, `📢 Début de l'envoi à ${groupIds.length} groupe(s)...`, {
    reply_to_message_id: msg.message_id
  });

  const results = { success: [], failed: [] };
  for (const tid of groupIds) {
    const res = await sendWithRetry(bot, tid, authorChatId, srcMsgId, notificationText, options);
    if (res.success) results.success.push(tid);
    else results.failed.push(tid);
    await delay(DELAY_PER_GROUP);
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  const resultMsg =
    `📢 Rapport d'envoi\n━━━━━━━━━━━━━━\n✅ Réussis : ${results.success.length}\n` +
    `❌ Échecs : ${results.failed.length}\n⏱️ Temps : ${totalTime}s`;

  return bot.sendMessage(chatId, resultMsg, { reply_to_message_id: msg.message_id });
}

module.exports = { nix, onStart, onReply };
