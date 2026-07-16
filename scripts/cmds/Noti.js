// scripts/cmds/notification.js
//
// Portage de scripts/cmds/notification.js (Botbot/Goatbot) vers ce bot Telegram.
//
// Différences avec la version Goatbot d'origine :
// - La confirmation ("répondez oui") est conservée : c'est un envoi de masse
//   à tous les groupes, on ne veut pas qu'un appui accidentel déclenche tout.
// - La liste des groupes vient de global.db.threadsData (MongoDB), pas d'un
//   fichier threads.json qui ne persiste pas sur Render.
// - "-a" (tag all) : l'API Bot Telegram ne permet PAS de lister tous les
//   membres d'un groupe (contrairement à l'API Facebook de Goatbot). On ne
//   peut mentionner que les ADMINISTRATEURS du groupe (bot.getChatAdministrators).
//   C'est indiqué clairement dans le guide pour ne pas induire en erreur.
// - "-p" (pin) épingle le message envoyé dans chaque groupe si le bot a les
//   droits nécessaires.

const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "..", "config.json");

function loadConfig() {
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (!config.admin) config.admin = [];
    return config;
  } catch (e) {
    console.error("Error loading config.json:", e);
    return { admin: [] };
  }
}

const nix = {
  name: "notification",
  aliases: ["notify", "noti"],
  version: "4.0",
  author: "Christus",
  role: 2,
  category: "owner",
  cooldown: 5,
  description: "Envoie une notification à tous les groupes où le bot est présent (admin uniquement).",
  guide:
    "{p}notification <message> [-a] [-p]\n" +
    "  -a : mentionner les administrateurs de chaque groupe (l'API Bot Telegram ne permet pas de mentionner tous les membres)\n" +
    "  -p : épingler le message dans chaque groupe\n\n" +
    "Une confirmation (\"oui\") est demandée avant l'envoi réel (30 secondes)."
};

if (!global.teamnix) global.teamnix = {};
if (!global.teamnix.replies) global.teamnix.replies = new Map();

function parseArgs(args) {
  const options = { tagAdmins: false, pin: false };
  const parts = [];
  for (const a of args) {
    if (a === "-a" || a === "--all") options.tagAdmins = true;
    else if (a === "-p" || a === "--pin") options.pin = true;
    else parts.push(a);
  }
  return { text: parts.join(" "), options };
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function onStart({ bot, msg, chatId, userId, args }) {
  const config = loadConfig();
  const admins = (config.admin || []).map(String);

  if (!admins.includes(String(userId))) {
    return bot.sendMessage(chatId, "❌ Seuls les administrateurs du bot peuvent utiliser cette commande.", {
      reply_to_message_id: msg.message_id
    });
  }

  const { text, options } = parseArgs(args);
  const hasMedia = !!(msg.photo || msg.video || msg.audio || msg.document || msg.animation);

  if (!text && !hasMedia) {
    return bot.sendMessage(chatId, "📢 Veuillez entrer un message ou joindre un média à diffuser.", {
      reply_to_message_id: msg.message_id
    });
  }

  if (!global.db || !global.db.threadsData) {
    return bot.sendMessage(chatId, "❌ Base de données non connectée (MongoDB indisponible).", {
      reply_to_message_id: msg.message_id
    });
  }

  const allThreads = await global.db.threadsData.getAll();
  const groupThreads = allThreads.filter(t => t.threadType === "group" || t.threadType === "supergroup");

  if (!groupThreads.length) {
    return bot.sendMessage(chatId, "❌ Aucun groupe enregistré en base pour le moment.", {
      reply_to_message_id: msg.message_id
    });
  }

  const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");

  const confirmText =
    `📢 Envoi de notification\n━━━━━━━━━━━━━━━━━━\n` +
    `➜ ${groupThreads.length} groupe(s) concerné(s)\n` +
    `➜ Options : ${options.tagAdmins ? "mention admins" : "aucune mention"}${options.pin ? " + épinglage" : ""}\n` +
    `➜ Expéditeur : ${senderName}\n\n` +
    `✅ Répondez "oui" à ce message pour confirmer l'envoi (30 secondes).`;

  const confirmMsg = await bot.sendMessage(chatId, confirmText, { reply_to_message_id: msg.message_id });

  global.teamnix.replies.set(String(confirmMsg.message_id), {
    commandName: nix.name,
    type: "confirm_notification",
    authorId: userId,
    sourceChatId: chatId,
    sourceMsgId: msg.message_id,
    hasMedia,
    groupThreads,
    text,
    options,
    senderName
  });

  setTimeout(() => {
    const pending = global.teamnix.replies.get(String(confirmMsg.message_id));
    if (pending && pending.type === "confirm_notification") {
      global.teamnix.replies.delete(String(confirmMsg.message_id));
      bot.sendMessage(chatId, "⏰ Temps écoulé, envoi annulé.", { reply_to_message_id: confirmMsg.message_id }).catch(() => {});
    }
  }, 30000);
}

async function onReply({ bot, msg, chatId, userId, data }) {
  if (!data || data.type !== "confirm_notification") return;
  if (userId !== data.authorId) return; // seul l'admin qui a lancé la commande peut confirmer

  // Retire l'entrée en attente (par sa clé de message)
  for (const [key, val] of global.teamnix.replies.entries()) {
    if (val === data) { global.teamnix.replies.delete(key); break; }
  }

  const answer = (msg.text || "").trim().toLowerCase();
  if (answer !== "oui") {
    return bot.sendMessage(chatId, "❌ Envoi annulé.", { reply_to_message_id: msg.message_id });
  }

  const { groupThreads, text, options, senderName, sourceChatId, sourceMsgId, hasMedia } = data;

  await bot.sendMessage(chatId, `📢 Début de l'envoi à ${groupThreads.length} groupe(s)...`, {
    reply_to_message_id: msg.message_id
  });

  const results = { success: [], failed: [] };
  const batchSize = 10;
  const delayPerGroup = 300;
  const maxRetries = 2;

  for (let i = 0; i < groupThreads.length; i += batchSize) {
    const batch = groupThreads.slice(i, i + batchSize);

    for (const thread of batch) {
      const targetId = thread.chatId;
      let sent = false;
      let lastErr;

      for (let attempt = 0; attempt <= maxRetries && !sent; attempt++) {
        try {
          let header = `📢 𝗡𝗢𝗧𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗗𝗘 𝗟'𝗔𝗗𝗠𝗜𝗡\n━━━━━━━━━━━━━━━━━━\nDe : ${senderName}\n\n${text}`;

          if (options.tagAdmins) {
            try {
              const chatAdmins = await bot.getChatAdministrators(targetId);
              const mentions = chatAdmins
                .filter(a => !a.user.is_bot)
                .map(a => (a.user.username ? `@${a.user.username}` : a.user.first_name))
                .join(" ");
              if (mentions) header += `\n\n${mentions}`;
            } catch (e) {
              // pas de droits ou groupe introuvable : on ignore silencieusement
            }
          }

          let sentMsg;
          if (hasMedia) {
            sentMsg = await bot.copyMessage(targetId, sourceChatId, sourceMsgId, { caption: header });
          } else {
            sentMsg = await bot.sendMessage(targetId, header);
          }

          if (options.pin) {
            try { await bot.pinChatMessage(targetId, sentMsg.message_id); } catch (e) {}
          }

          sent = true;
        } catch (err) {
          lastErr = err;
          if (attempt < maxRetries) await delay(1000 * (attempt + 1));
        }
      }

      if (sent) results.success.push(targetId);
      else results.failed.push({ id: targetId, error: lastErr?.message });

      await delay(delayPerGroup);
    }

    if (i + batchSize < groupThreads.length) await delay(1000);
  }

  const report =
    `📢 Rapport d'envoi\n━━━━━━━━━━━━━━━━━━\n` +
    `✅ Réussis : ${results.success.length}\n` +
    `❌ Échecs : ${results.failed.length}`;

  await bot.sendMessage(chatId, report, { reply_to_message_id: sourceMsgId });
}

module.exports = { nix, onStart, onReply };
