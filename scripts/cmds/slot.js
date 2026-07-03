const nix = {
  name: "slots",
  version: "1.5",
  aliases: ["slot", "machine"],
  description: "Machine à sous ultra-stylée sans limites de mise ni de jeu.",
  author: "Christus",
  role: 0,
  category: "game",
  cooldown: 5, // Cooldown réduit à 5s pour plus de fluidité
  guide: "{p}slots [montant de la mise]"
};

/* ================= UTILS (BASE DE DONNÉES) ================= */
// Stockage MongoDB (remplace l'ancien fichier local database/balance.json,
// qui ne persistait pas entre les redéploiements sur Render).
const { getBalances, saveBalances } = require('../../database/mongoBalance.js');
const getBalanceData = () => getBalances();
const saveData = (data) => saveBalances(data);

const formatMoney = (amount) => {
  if (isNaN(amount)) return "0 💰";
  amount = Number(amount);
  const scales = [
    { value: 1e15, suffix: 'Q', color: '🌈' }, // Quadrillions
    { value: 1e12, suffix: 'T', color: '✨' }, // Trillions
    { value: 1e9, suffix: 'B', color: '💎' },  // Billions
    { value: 1e6, suffix: 'M', color: '💰' },  // Millions
    { value: 1e3, suffix: 'k', color: '💵' }
  ];
  const scale = scales.find(s => amount >= s.value);
  if (scale) {
    const scaledValue = amount / scale.value;
    return `${scale.color}${scaledValue.toFixed(2)}${scale.suffix}`;
  }
  return `${amount.toLocaleString()} 💰`;
};

/* ================= ENTRY ================= */

async function onStart({ bot, message, msg, chatId, args }) {
  const userId = msg.from.id;
  const bet = parseInt(args[0]);

  // 1. VÉRIFICATION DE LA MISE
  if (isNaN(bet) || bet <= 0) {
    return bot.sendMessage(chatId, "🔴 ERREUR : Veuillez entrer une mise valide !");
  }

  let balances = await getBalanceData();
  let user = balances[userId] || { money: 0 };

  // Vérification du solde
  if (user.money < bet) {
    return bot.sendMessage(chatId, `🔴 FONDS INSUFFISANTS : Il vous manque ${formatMoney(bet - user.money)} pour jouer !`);
  }

  // 2. LOGIQUE DU SLOT (Probabilités)
  const symbols = [
    { emoji: "🍒", weight: 30 },
    { emoji: "🍋", weight: 25 },
    { emoji: "🍇", weight: 20 },
    { emoji: "🍉", weight: 15 },
    { emoji: "⭐", weight: 7 },
    { emoji: "7️⃣", weight: 3 }
  ];

  const roll = () => {
    const totalWeight = symbols.reduce((sum, s) => sum + s.weight, 0);
    let random = Math.random() * totalWeight;
    for (const s of symbols) {
      if (random < s.weight) return s.emoji;
      random -= s.weight;
    }
    return symbols[0].emoji;
  };

  const slot1 = roll();
  const slot2 = roll();
  const slot3 = roll();

  let winnings = 0;
  let outcome = "";
  let winType = "";
  let bonusMsg = "";

  // 3. CALCUL DES GAINS
  if (slot1 === "7️⃣" && slot2 === "7️⃣" && slot3 === "7️⃣") {
    winnings = bet * 10;
    outcome = "🔥 MEGA JACKPOT ! TRIPLE 7️⃣ !";
    winType = "💎 VICTOIRE MAX";
    bonusMsg = "🎆 BONUS : +3% sur votre solde total !";
    user.money = Math.round(user.money * 1.03);
  } else if (slot1 === slot2 && slot2 === slot3) {
    winnings = bet * 5;
    outcome = "💰 JACKPOT ! 3 symboles identiques !";
    winType = "💫 GROS GAIN";
  } else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
    winnings = bet * 2;
    outcome = "✨ BIEN ! 2 symboles identiques !";
    winType = "🌟 GAGNÉ";
  } else if (Math.random() < 0.5) {
    winnings = Math.round(bet * 1.5);
    outcome = "🎯 COUP DE CHANCE ! Petit bonus !";
    winType = "🍀 PETIT GAIN";
  } else {
    winnings = -bet;
    outcome = "💸 PLUS DE CHANCE LA PROCHAINE FOIS !";
    winType = "☠️ PERDU";
  }

  // 4. MISE À JOUR DU SOLDE
  user.money += winnings;
  balances[userId] = user;
  await saveData(balances);

  // 5. AFFICHAGE VISUEL
  const slotBox =
    "╔═════════════════════╗\n" +
    "║  🎰 MACHINE À SOUS 🎰  ║\n" +
    "╠═════════════════════╣\n" +
    `║     [ ${slot1} | ${slot2} | ${slot3} ]     ║\n` +
    "╚═════════════════════╝";

  const resultEmoji = winnings >= 0 ? "🟢" : "🔴";
  const resultText = winnings >= 0
    ? `🏆 GAGNÉ : ${formatMoney(winnings)}`
    : `💸 PERDU : ${formatMoney(bet)}`;

  const finalMessage =
    `${slotBox}\n\n` +
    `🎯 RÉSULTAT : ${outcome}\n` +
    `${winType ? `${winType}\n` : ""}` +
    `${bonusMsg ? `${bonusMsg}\n` : ""}` +
    `\n${resultEmoji} ${resultText}` +
    `\n💰 NOUVEAU SOLDE : ${formatMoney(user.money)}\n\n` +
    `💡 INFO : Parties illimitées & Mise sans limite !`;

  return bot.sendMessage(chatId, finalMessage);
}

module.exports = {
  nix,
  onStart
};
             
