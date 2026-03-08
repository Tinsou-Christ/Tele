const fs = require('fs');
const path = require('path');

module.exports = {
  config: {
    name: "notification",
    aliases: ["notify", "noti"],
    version: "0.0.1",
    author: "ArYAN",
    countDown: 5,
    role: 2,
    description: "Send notification from admin to all groups with reply support",
    category: "owner",
    nixPrefix: false,
    guide: "{pn} <message>"
  },

  onStart: async function ({ bot, msg, args, response }) {
    if (!args[0]) return response.reply("Please enter the message you want to send to all groups.");

    const content = args.join(" ");
    const senderName = msg.from.first_name;
    const senderId = msg.from.id;
    
   
    const adminId = 8294554523;

    let groupIds = [];
    
    if (global.mongoDB) {
        const mongoose = require('mongoose');
        const Thread = mongoose.models.Thread || mongoose.model('Thread');
        try {
            const threads = await Thread.find({});
            groupIds = threads.map(t => t.threadID);
        } catch (e) {
            console.error('[MONGODB] Error fetching threads:', e.message);
        }
    } else {
       
        const threadsPath = path.join(process.cwd(), 'database/data/threads.json');
        if (fs.existsSync(threadsPath)) {
            try {
                const data = fs.readJsonSync(threadsPath);
                groupIds = Object.keys(data).filter(id => id.toString().startsWith('-'));
            } catch (e) {}
        }
    }

    if (groupIds.length === 0 && global.NixBot.threads) {
        groupIds = Array.from(global.NixBot.threads.keys()).filter(id => id.toString().startsWith('-'));
    }

   
    if (groupIds.length === 0 && msg.chat.id.toString().startsWith('-')) {
        groupIds = [msg.chat.id];
    }

    if (groupIds.length === 0) {
        return response.reply("No groups found to send notification.");
    }

    let successCount = 0;
    let failCount = 0;

    const notificationText = `📢 𝗡𝗢𝗧𝗜𝗙𝗜𝗖𝗔𝗧𝗜𝗢𝗡 𝗙𝗥𝗢𝗠 𝗔𝗗𝗠𝗜𝗡\n━━━━━━━━━━━━━━━━━━━━\n👤 Admin: ${senderName}\n💬 Message: ${content}\n━━━━━━━━━━━━━━━━━━━━\nℹ️ You can reply to this message to talk to admin!`;

    for (const tid of groupIds) {
        try {
            let sentMsg;
           
            if (msg.photo || msg.video || msg.audio || msg.document || msg.voice || msg.animation) {
                sentMsg = await bot.copyMessage(tid, msg.chat.id, msg.message_id, {
                    caption: notificationText,
                    parse_mode: "Markdown"
                });
            } else {
                sentMsg = await bot.sendMessage(tid, notificationText, { parse_mode: "Markdown" });
            }
            successCount++;
            
            
            if (!global.NixBot.replies) global.NixBot.replies = new Map();
            global.NixBot.replies.set(sentMsg.message_id.toString(), {
                commandName: "notification",
                targetChatId: msg.chat.id,
                targetMsgId: msg.message_id
            });
        } catch (e) {
            failCount++;
            console.error(`Failed to send notification to ${tid}:`, e.message);
        }
    }

    return response.reply(`✅ Sent notification to ${successCount} groups.\n❌ Failed: ${failCount}`);
  },

  onReply: async function ({ bot, msg, response, Reply }) {
    const adminId = 8538234484; 
    const userName = msg.from.first_name;
    const groupName = msg.chat.title || "Private Chat";
    const userId = msg.from.id;
    const chatId = msg.chat.id;

   
    if (userId == adminId) {
        if (Reply && Reply.senderChatId) {
            try {
                await bot.copyMessage(Reply.senderChatId, chatId, msg.message_id);
                return response.reply("✅ Sent back to user/group!");
            } catch (e) {
                return response.reply("❌ Failed to send back: " + e.message);
            }
        }
    }

    
    const forwardText = `📨 𝗥𝗘𝗣𝗟𝗬 𝗙𝗥𝗢𝗠 𝗨𝗦𝗘𝗥\n━━━━━━━━━━━━━━━━━━━━\n👤 User: ${userName} (${userId})\n👥 Group: ${groupName}\n💬 Message: ${msg.text || "(Media)"}\n━━━━━━━━━━━━━━━━━━━━\nReply to this message to send back!`;

    try {
        const forwarded = await bot.copyMessage(adminId, chatId, msg.message_id, {
            caption: forwardText,
            parse_mode: "Markdown"
        });
        
       
        if (!global.NixBot.replies) global.NixBot.replies = new Map();
        global.NixBot.replies.set(forwarded.message_id.toString(), {
            commandName: "notification",
            senderChatId: chatId,
            senderMsgId: msg.message_id
        });

        await response.reply("✅ Your reply has been sent to the admin!");
    } catch (e) {
        console.error("Error forwarding reply to admin:", e.message);
        await response.reply("❌ Error sending to admin: " + e.message);
    }
  }
};
