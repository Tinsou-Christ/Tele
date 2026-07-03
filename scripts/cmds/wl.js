// scripts/cmds/wl.js
//
// Commande "wl" (whiteListMode) — portage de scripts/cmds/wl.js de
// Botbot/Goatbot vers ce bot Telegram.
//
// Différence importante avec la version Goatbot d'origine :
// Goatbot écrit directement dans config.json (fs.writeFileSync), ce qui ne
// persiste pas sur un hébergeur à disque éphémère (Render, etc.) : après un
// redéploiement/redémarrage, config.json revient à sa version du repo Git et
// tout ce qui a été ajouté en direct est perdu.
//
// Ici, exactement comme telebal.js (voir database/mongoBalance.js), les
// données de la whiteListMode (activée/désactivée + liste des IDs) sont
// lues/écrites dans MongoDB via database/mongoWhitelist.js
// (global.db.globalData), donc elles survivent aux redéploiements.

const { getWhitelist, saveWhitelist } = require("../../database/mongoWhitelist.js");

// ========== LANGUES / MESSAGES ==========
const lang = {
    added: "✅ | Rôle whiteList ajouté pour %1 utilisateur(s) :\n%2",
    alreadyWl: "\n⚠️ | %1 utilisateur(s) ont déjà le rôle whiteList :\n%2",
    missingIdAdd: "⚠️ | Merci de répondre à un message, de mentionner un utilisateur, ou de donner un ID pour l'ajouter à la whiteList.",
    removed: "✅ | Rôle whiteList retiré pour %1 utilisateur(s) :\n%2",
    notWl: "\n⚠️ | %1 utilisateur(s) n'ont pas le rôle whiteList :\n%2",
    missingIdRemove: "⚠️ | Merci de répondre à un message, de mentionner un utilisateur, ou de donner un ID à retirer de la whiteList.",
    emptyList: "📋 | La whiteList est actuellement vide.",
    listAdmin: "👑 | Liste des utilisateurs whiteListés :\n%1",
    enable: "✅ | Le mode whiteList a été activé.\nSeuls les utilisateurs whiteListés (+ les admins du bot) pourront utiliser le bot.",
    disable: "✅ | Le mode whiteList a été désactivé.\nTout le monde peut à nouveau utiliser le bot.",
    guide:
        "📖 | Guide de la commande whiteList :\n\n" +
        "%1wl add <réponse | ID> : Ajouter un utilisateur à la whiteList\n" +
        "%1wl remove <réponse | ID> : Retirer un utilisateur de la whiteList\n" +
        "%1wl list : Voir la liste des utilisateurs whiteListés\n" +
        "%1wl on : Activer le mode whiteList\n" +
        "%1wl off : Désactiver le mode whiteList"
};

function getLang(key, ...args) {
    let text = lang[key] || key;
    args.forEach((arg, i) => {
        text = text.replace(new RegExp(`%${i + 1}`, "g"), arg);
    });
    return text;
}

// ========== UTILITAIRES ==========

// Récupère le nom affichable d'un utilisateur à partir de son ID.
// Essaie d'abord getChat (fonctionne même hors du chat courant si le bot a
// déjà "vu" cet utilisateur), puis se replie sur getChatMember du chat
// courant, puis sur un nom générique.
async function getUserName(bot, chatId, userId) {
    try {
        const chat = await bot.getChat(userId);
        let name = chat.first_name || chat.username || null;
        if (name && chat.last_name) name += ` ${chat.last_name}`;
        if (name) return name;
    } catch (e) {
        // ignore, on essaie la méthode suivante
    }
    try {
        const member = await bot.getChatMember(chatId, userId);
        let name = member.user.first_name;
        if (member.user.last_name) name += ` ${member.user.last_name}`;
        return name;
    } catch (e) {
        return `Utilisateur_${userId}`;
    }
}

// Extrait les IDs cibles d'un message : réponse > mentions (text_mention) > IDs numériques dans les args
function extractTargetIds(msg, args) {
    let uids = [];

    if (msg.reply_to_message && msg.reply_to_message.from) {
        uids.push(msg.reply_to_message.from.id);
    }

    if (msg.entities) {
        for (const entity of msg.entities) {
            if (entity.type === "text_mention" && entity.user) {
                uids.push(entity.user.id);
            }
        }
    }

    if (uids.length === 0) {
        uids = args
            .slice(1)
            .filter(arg => !isNaN(arg) && arg.trim() !== "")
            .map(arg => parseInt(arg, 10));
    }

    return [...new Set(uids.map(String))];
}

// ========== COMMANDE PRINCIPALE ==========
const nix = {
    name: "wl",
    version: "1.0",
    aliases: ["whitelist"],
    author: "Christus x Aesther",
    role: 2,
    category: "ADMIN",
    cooldown: 5,
    description: "Ajouter, retirer, gérer les whiteListIds (accès restreint au bot)",
    guide:
        "{p}wl [add | -a] <réponse | ID> : Ajouter un utilisateur à la whiteList\n" +
        "{p}wl [remove | -r] <réponse | ID> : Retirer un utilisateur de la whiteList\n" +
        "{p}wl [list | -l] : Voir la liste des utilisateurs whiteListés\n" +
        "{p}wl on : Activer le mode whiteList\n" +
        "{p}wl off : Désactiver le mode whiteList"
};

async function onStart({ bot, msg, chatId, args }) {
    const subCmd = (args[0] || "").toLowerCase();
    const prefix = "/"; // affichage indicatif dans le guide

    switch (subCmd) {
        case "add":
        case "-a": {
            const uids = extractTargetIds(msg, args);
            if (uids.length === 0) {
                return bot.sendMessage(chatId, getLang("missingIdAdd"), { reply_to_message_id: msg.message_id });
            }

            const { enable, whiteListIds } = await getWhitelist();

            const alreadyIds = [];
            const newIds = [];
            for (const uid of uids) {
                if (whiteListIds.includes(uid)) alreadyIds.push(uid);
                else newIds.push(uid);
            }

            whiteListIds.push(...newIds);
            await saveWhitelist({ enable, whiteListIds });

            const namesOf = async (list) =>
                Promise.all(list.map(async uid => ({ uid, name: await getUserName(bot, chatId, uid) })));

            const newNames = await namesOf(newIds);
            const alreadyNames = await namesOf(alreadyIds);

            let response = "";
            if (newNames.length > 0) {
                response += getLang("added", newNames.length, newNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n"));
            }
            if (alreadyNames.length > 0) {
                response += getLang("alreadyWl", alreadyNames.length, alreadyNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n"));
            }
            return bot.sendMessage(chatId, response, { reply_to_message_id: msg.message_id });
        }

        case "remove":
        case "-r": {
            const uids = extractTargetIds(msg, args);
            if (uids.length === 0) {
                return bot.sendMessage(chatId, getLang("missingIdRemove"), { reply_to_message_id: msg.message_id });
            }

            const { enable, whiteListIds } = await getWhitelist();

            const removedIds = [];
            const notFoundIds = [];
            for (const uid of uids) {
                if (whiteListIds.includes(uid)) removedIds.push(uid);
                else notFoundIds.push(uid);
            }

            const newList = whiteListIds.filter(id => !removedIds.includes(id));
            await saveWhitelist({ enable, whiteListIds: newList });

            const namesOf = async (list) =>
                Promise.all(list.map(async uid => ({ uid, name: await getUserName(bot, chatId, uid) })));

            const removedNames = await namesOf(removedIds);
            const notFoundNames = await namesOf(notFoundIds);

            let response = "";
            if (removedNames.length > 0) {
                response += getLang("removed", removedNames.length, removedNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n"));
            }
            if (notFoundNames.length > 0) {
                response += getLang("notWl", notFoundNames.length, notFoundNames.map(({ uid, name }) => `• ${name} (${uid})`).join("\n"));
            }
            return bot.sendMessage(chatId, response, { reply_to_message_id: msg.message_id });
        }

        case "list":
        case "-l": {
            const { whiteListIds } = await getWhitelist();
            if (whiteListIds.length === 0) {
                return bot.sendMessage(chatId, getLang("emptyList"), { reply_to_message_id: msg.message_id });
            }
            const names = await Promise.all(
                whiteListIds.map(async uid => ({ uid, name: await getUserName(bot, chatId, uid) }))
            );
            return bot.sendMessage(
                chatId,
                getLang("listAdmin", names.map(({ uid, name }) => `• ${name} (${uid})`).join("\n")),
                { reply_to_message_id: msg.message_id }
            );
        }

        case "on": {
            const { whiteListIds } = await getWhitelist();
            await saveWhitelist({ enable: true, whiteListIds });
            return bot.sendMessage(chatId, getLang("enable"), { reply_to_message_id: msg.message_id });
        }

        case "off": {
            const { whiteListIds } = await getWhitelist();
            await saveWhitelist({ enable: false, whiteListIds });
            return bot.sendMessage(chatId, getLang("disable"), { reply_to_message_id: msg.message_id });
        }

        default:
            return bot.sendMessage(chatId, getLang("guide", prefix), { reply_to_message_id: msg.message_id });
    }
}

module.exports = { nix, onStart };
  
