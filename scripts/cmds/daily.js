// Stockage MongoDB (remplace l'ancien fichier local database/balance.json,
// qui ne persistait pas entre les redéploiements sur Render).
const { getBalances, saveBalances } = require('../../database/mongoBalance.js');
const getData = () => getBalances();
const saveData = (data) => saveBalances(data);

const nix = {
    nix: {
        name: "daily",
        aliases: ["claim"],
        author: "ArYAN",
        version: "1.0",
        cooldowns: 5,
        role: 0,
        description: "Claim your daily money",
        category: "GAMES",
        guide: "Use: {pn}"
    },
    onStart: async function ({ message, userId }) {
        try {
            const balances = await getData();
            
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;

            let user = balances[userId] || { money: 0, lastClaim: 0 };
            
            if (now - user.lastClaim < oneDay) {
                const waitTime = oneDay - (now - user.lastClaim);
                const hours = Math.floor(waitTime / (1000 * 60 * 60));
                const minutes = Math.floor((waitTime % (1000 * 60 * 60)) / (1000 * 60));
                return await message.reply(`⏳ You already claimed your daily reward.\nTry again in ${hours}h ${minutes}m.`);
            }

            const reward = Math.floor(Math.random() * (500 - 100 + 1)) + 100;
            user.money += reward;
            user.lastClaim = now;
            
            balances[userId] = user;
            await saveData(balances);

            await message.reply(`💰 You claimed ${reward} BDT!\nYour total balance: ${user.money} BDT`);
        } catch (err) {
            console.error('❌ Error in daily command:', err);
            await message.reply('❌ Something went wrong. Please try again later.');
        }
    }
};

module.exports = nix;
                
