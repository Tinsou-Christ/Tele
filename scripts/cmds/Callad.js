// scripts/cmds/callad.js
//
// Portage de scripts/cmds/callad.js (Botbot/Goatbot) vers ce bot Telegram.
//
// Différence importante avec une version "download puis reupload" :
// on utilise bot.copyMessage (comme Noti.js) au lieu de télécharger le
// média sur disque puis le renvoyer. Sur Render le disque est éphémère et
// non nettoyé de façon fiable entre requêtes : copyMessage évite complètement
// l'écriture de fichiers temporaires, c'est plus rapide et plus sûr.

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
    return { admin: [], prefix: "!" };
  }
}

const lang = {
  missingMessage: "Veuillez entrer le message que vous voulez envoyer à l'admin.",
  sendByGroup: "\n- Envoyé depuis le groupe : %1\n- ID du groupe : %2",
  sendByUser: "\n- Envoyé depuis un utilisateur",
  content: "\n\nContenu :\n─────────────────\n%1\n─────────────────\nRépondez à ce message pour envoyer un message à l'utilisateur.",
  success: "Votre message a été envoyé à %1 admin(s) avec succès !\n%2",
  failed: "Une erreur est survenue lors de l'envoi à %1 admin(s)\n%2\nConsultez la console pour plus de détails.",
  reply: "📍 Réponse de l'admin %1 :\n─────────────────\n%2\n─────────────────\nRépondez à ce message pour continuer à échanger avec l'admin.",
  replySuccess: "Votre réponse a été envoyée à l'admin avec succès !",
  feedback: "📝 Retour de l'utilisateur %1 :\n- ID utilisateur : %2%3\n\nContenu :\n─────────────────\n%4\n─────────────────\nRépondez à ce message pour envoyer un message à l'utilisateur.",
  replyUserSuccess: "Votre réponse a été envoyée à l'utilisateur avec succès !",
  noAdmin: "Le bot n'a actuellement aucun admin.",
  invalidReply: "❌ Cette réponse n'est pas reconnue. Veuillez répondre au message contenant le callad original."
};

function getLang(key, ...args) {
  let str = lang[key] || key;
  args.forEach((arg, i) => {
    str = str.replace(new RegExp(`%${i + 1}`, "g"), arg);
  });
  return str;
}

// Copie le message (texte + média éventuel) vers un chat cible, avec un
// texte d'en-tête personnalisé en légende. Retourne l'ID du message envoyé.
async function forwardCalladMessage(bot, targetChatId, headerText, msg, replyToMsgId = null) {
  const hasMedia = !!(msg.photo || msg.video || msg.audio || msg.document || msg.voice || msg.animation);

  if (hasMedia) {
    const sent = await bot.copyMessage(targetChatId, msg.chat.id, msg.message_id, {
      caption: headerText,
      reply_to_message_id: replyToMsgId || undefined
    });
    return sent;
  }

  return bot.sendMessage(targetChatId, headerText, {
    reply_to_message_id: replyToMsgId || undefined
  });
}

const nix = {
  name: "callad",
  aliases: [],
  version: "1.9",
  author: "Christus",
  role: 0,
  description: "Envoyer un rapport, une suggestion ou un bug à l'admin du bot.",
  guide: "{p}callad <message>\nRépondez à un message du bot pour échanger avec l'admin.",
  cooldown: 5,
  category: "contacts admin"
};

if (!global.teamnix) global.teamnix = {};
if (!global.teamnix.replies) global.teamnix.replies = new Map();

async function onStart({ bot, msg, chatId, userId, args }) {
  const config = loadConfig();
  const admins = (config.admin || []).map(String);

  if (!args.length) {
    return bot.sendMessage(chatId, getLang("missingMessage"), { reply_to_message_id: msg.message_id });
  }
  if (admins.length === 0) {
    return bot.sendMessage(chatId, getLang("noAdmin"), { reply_to_message_id: msg.message_id });
  }

  const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");
  const isGroup = chatId < 0;
  let groupName = "";
  if (isGroup) {
    try {
      const chat = await bot.getChat(chatId);
      groupName = chat.title;
    } catch (e) {
      groupName = "Groupe";
    }
  }

  const header =
    "==📨 APPEL ADMIN 📨==" +
    `\n- Nom : ${senderName}` +
    `\n- ID : ${userId}` +
    (isGroup ? getLang("sendByGroup", groupName, chatId) : getLang("sendByUser"));

  const fullText = header + getLang("content", args.join(" "));

  const success = [];
  const failed = [];

  for (const adminId of admins) {
    try {
      const sent = await forwardCalladMessage(bot, adminId, fullText, msg);

      global.teamnix.replies.set(String(sent.message_id), {
        commandName: nix.name,
        type: "userCallAdmin",
        userThreadId: chatId,      // chat d'origine de l'utilisateur
        userMsgId: msg.message_id, // message d'origine à citer en réponse
        adminId
      });

      success.push(adminId);
    } catch (e) {
      failed.push(adminId);
    }
  }

  let resultMsg = "";
  if (success.length) resultMsg += getLang("success", success.length, success.map(id => `- ${id}`).join("\n"));
  if (failed.length) resultMsg += getLang("failed", failed.length, failed.map(id => `- ${id}`).join("\n"));

  await bot.sendMessage(chatId, resultMsg, { reply_to_message_id: msg.message_id });
}

async function onReply({ bot, msg, chatId, userId, data }) {
  if (!data) return;

  const config = loadConfig();
  const admins = (config.admin || []).map(String);
  const isAdmin = admins.includes(String(userId));
  const senderName = msg.from.first_name + (msg.from.last_name ? ` ${msg.from.last_name}` : "");

  const { type, userThreadId, userMsgId, adminId } = data;

  if (type === "userCallAdmin" && isAdmin) {
    // L'admin répond → on transmet à l'utilisateur d'origine
    const replyText = getLang("reply", senderName, msg.text || "📷 Média");
    try {
      const sent = await forwardCalladMessage(bot, userThreadId, replyText, msg, userMsgId);

      global.teamnix.replies.set(String(sent.message_id), {
        commandName: nix.name,
        type: "adminReply",
        userThreadId: chatId, // = chat de l'admin, pour router la prochaine réponse ici
        userMsgId: msg.message_id,
        adminId: userId
      });

      await bot.sendMessage(chatId, getLang("replyUserSuccess"), { reply_to_message_id: msg.message_id });
    } catch (e) {
      await bot.sendMessage(chatId, "❌ Erreur d'envoi.", { reply_to_message_id: msg.message_id });
    }
    return;
  }

  if (type === "adminReply" && !isAdmin) {
    // L'utilisateur répond à l'admin → on transmet en retour à l'admin
    const feedbackText = getLang("feedback", senderName, userId, "", msg.text || "📷 Média");
    try {
      const sent = await forwardCalladMessage(bot, adminId, feedbackText, msg);

      global.teamnix.replies.set(String(sent.message_id), {
        commandName: nix.name,
        type: "userCallAdmin",
        userThreadId: chatId,
        userMsgId: msg.message_id,
        adminId
      });

      await bot.sendMessage(chatId, getLang("replySuccess"), { reply_to_message_id: msg.message_id });
    } catch (e) {
      await bot.sendMessage(chatId, "❌ Erreur d'envoi.", { reply_to_message_id: msg.message_id });
    }
    return;
  }

  // Contexte reconnu mais mauvais rôle (ex: un non-admin répond à un message "userCallAdmin")
  await bot.sendMessage(chatId, getLang("invalidReply"), { reply_to_message_id: msg.message_id });
}

module.exports = { nix, onStart, onReply };
