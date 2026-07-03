// commands/telebank.js
// Système bancaire complet - Version 5.0.0
// Sauvegarde via MongoDB (mongoBalance.js)
// Utilise fonts.js pour le stylage

const fonts = require('../../func/fonts.js');
const { getBalances, saveBalances } = require('../../database/mongoBalance.js');

const nix = {
  name: "bank",
  version: "5.0.0",
  aliases: ["bk", "banque", "eco"],
  description: "Système bancaire complet avec investissements, immobilier, jeux et plus.",
  author: "Christus",
  prefix: true,
  category: "economy",
  role: 0,
  cooldown: 3,
  guide: "{p}bank help"
};

// ===================== CONFIGURATION =====================
const CONFIG = {
  currency: { symbol: "$", name: "Dollar", decimalPlaces: 2 },
  loan: {
    minAmount: 100,
    maxMultiplier: 1000,
    interestRate: 0.05,
  },
  savings: {
    interestRate: 0.03,
  },
  vault: {
    interestRate: 0.01,
  },
  work: {
    cooldown: 4 * 60 * 60 * 1000,
  },
  rob: {
    cooldown: 6 * 60 * 60 * 1000,
    successRate: 0.5,
    minTarget: 100,
  },
  daily: {
    baseAmount: 1000,
    streakMultiplier: 0.1,
    maxStreak: 30,
  },
  lottery: {
    ticketPrice: 100,
    winChanceMultiplier: 0.01,
    minPrize: 50000,
    maxPrize: 1000000,
  }
};

// ===================== DONNÉES DE MARCHÉ =====================
const MARKET_DATA = {
  stocks: {
    "AAPL": { price: 150.25, change: 2.1, name: "Apple Inc." },
    "GOOGL": { price: 2800.50, change: 1.8, name: "Alphabet Inc." },
    "TSLA": { price: 800.75, change: -0.5, name: "Tesla Inc." },
    "MSFT": { price: 320.40, change: 1.2, name: "Microsoft Corp." },
    "AMZN": { price: 3200.00, change: 0.8, name: "Amazon.com Inc." },
    "META": { price: 330.00, change: 2.5, name: "Meta Platforms Inc." },
    "NVDA": { price: 450.00, change: 3.2, name: "NVIDIA Corp." },
    "NFLX": { price: 380.00, change: -1.1, name: "Netflix Inc." },
    "ORCL": { price: 120.00, change: 0.5, name: "Oracle Corp." },
    "IBM": { price: 145.00, change: 0.3, name: "IBM Corp." }
  },
  crypto: {
    "BTC": { price: 45000, change: 3.2, name: "Bitcoin" },
    "ETH": { price: 3200, change: 2.8, name: "Ethereum" },
    "BNB": { price: 400, change: 1.5, name: "Binance Coin" },
    "ADA": { price: 1.20, change: 4.1, name: "Cardano" },
    "DOT": { price: 25.50, change: 2.3, name: "Polkadot" },
    "LINK": { price: 28.00, change: 1.9, name: "Chainlink" },
    "MATIC": { price: 0.85, change: 5.1, name: "Polygon" },
    "SOL": { price: 120.00, change: 3.8, name: "Solana" },
    "AVAX": { price: 35.00, change: 4.5, name: "Avalanche" },
    "ATOM": { price: 12.00, change: 2.0, name: "Cosmos" }
  },
  bonds: {
    "US_TREASURY": { yield: 2.5, risk: "Faible", term: "10 Ans" },
    "CORPORATE": { yield: 3.8, risk: "Moyen", term: "5 Ans" },
    "MUNICIPAL": { yield: 2.1, risk: "Faible", term: "7 Ans" },
    "HIGH_YIELD": { yield: 6.2, risk: "Élevé", term: "3 Ans" },
    "GOVERNMENT": { yield: 3.0, risk: "Faible", term: "15 Ans" },
    "GREEN_BOND": { yield: 4.0, risk: "Moyen", term: "8 Ans" }
  },
  properties: {
    "APARTMENT": { price: 250000, income: 2500, name: "Appartement" },
    "HOUSE": { price: 500000, income: 4000, name: "Maison" },
    "MANSION": { price: 2000000, income: 15000, name: "Manoir" },
    "OFFICE": { price: 1000000, income: 8000, name: "Bureau" },
    "WAREHOUSE": { price: 750000, income: 6000, name: "Entrepôt" },
    "MALL": { price: 5000000, income: 40000, name: "Centre Commercial" },
    "HOTEL": { price: 8000000, income: 60000, name: "Hôtel" },
    "RESORT": { price: 15000000, income: 100000, name: "Station Balnéaire" }
  },
  businesses: {
    "COFFEE_SHOP": { cost: 50000, income: 5000, employees: 3, name: "Café" },
    "RESTAURANT": { cost: 150000, income: 12000, employees: 8, name: "Restaurant" },
    "TECH_STARTUP": { cost: 500000, income: 50000, employees: 20, name: "Startup Tech" },
    "HOTEL_CHAIN": { cost: 2000000, income: 150000, employees: 50, name: "Chaîne Hôtelière" },
    "BANK": { cost: 10000000, income: 800000, employees: 200, name: "Banque Régionale" },
    "AIRLINE": { cost: 50000000, income: 3000000, employees: 1000, name: "Compagnie Aérienne" },
    "FACTORY": { cost: 3000000, income: 200000, employees: 100, name: "Usine" },
    "STUDIO": { cost: 1000000, income: 75000, employees: 30, name: "Studio de Production" }
  },
  vehicles: {
    "TOYOTA": { price: 25000, depreciation: 0.85, name: "Toyota Camry" },
    "BMW": { price: 60000, depreciation: 0.70, name: "BMW M3" },
    "FERRARI": { price: 300000, depreciation: 0.90, name: "Ferrari 488" },
    "LAMBORGHINI": { price: 400000, depreciation: 0.85, name: "Lamborghini Huracan" },
    "ROLLS_ROYCE": { price: 500000, depreciation: 0.80, name: "Rolls-Royce Phantom" },
    "BUGATTI": { price: 3000000, depreciation: 0.75, name: "Bugatti Chiron" },
    "TESLA": { price: 80000, depreciation: 0.80, name: "Tesla Model S" },
    "PORSCHE": { price: 150000, depreciation: 0.75, name: "Porsche 911" }
  },
  luxury: {
    "ROLEX": { price: 15000, name: "Rolex Submariner" },
    "PAINTING": { price: 100000, name: "Tableau de Maître" },
    "DIAMOND": { price: 50000, name: "Diamant 5 Carats" },
    "YACHT": { price: 2000000, name: "Yacht de Luxe" },
    "PRIVATE_JET": { price: 25000000, name: "Jet Privé" },
    "ISLAND": { price: 100000000, name: "Île Privée" },
    "WATCH": { price: 25000, name: "Montre de Luxe" },
    "SCULPTURE": { price: 75000, name: "Sculpture d'Art" }
  }
};

// ===================== TIERS =====================
const TIERS = [
  { name: "Starter", min: 0, max: 999, badge: "🥉", color: "#cd7f32", multiplier: 1.0 },
  { name: "Rookie", min: 1000, max: 4999, badge: "🥈", color: "#c0c0c0", multiplier: 1.1 },
  { name: "Pro", min: 5000, max: 19999, badge: "🥇", color: "#ffd700", multiplier: 1.2 },
  { name: "Elite", min: 20000, max: 49999, badge: "💎", color: "#e5e4e2", multiplier: 1.3 },
  { name: "Master", min: 50000, max: 99999, badge: "👑", color: "#0ff", multiplier: 1.5 },
  { name: "Legend", min: 100000, max: 499999, badge: "🌟", color: "#ff00ff", multiplier: 2.0 },
  { name: "God", min: 500000, max: Infinity, badge: "⚡", color: "#ff0000", multiplier: 3.0 }
];

// ===================== FONCTIONS UTILITAIRES =====================
function formatMoney(amount) {
  if (isNaN(amount) || amount === null || amount === undefined) return `${CONFIG.currency.symbol}0`;
  amount = Number(amount);
  if (amount === Infinity) return `${CONFIG.currency.symbol}∞`;
  if (amount === -Infinity) return `${CONFIG.currency.symbol}-∞`;
  if (!isFinite(amount)) return `${CONFIG.currency.symbol}NaN`;

  const scales = [
    { value: 1e18, suffix: "Qi" },
    { value: 1e15, suffix: "Qa" },
    { value: 1e12, suffix: "T" },
    { value: 1e9, suffix: "B" },
    { value: 1e6, suffix: "M" },
    { value: 1e3, suffix: "K" }
  ];
  
  const scale = scales.find(s => Math.abs(amount) >= s.value);
  if (scale) {
    const scaled = amount / scale.value;
    const formatted = Math.abs(scaled).toFixed(CONFIG.currency.decimalPlaces);
    const clean = formatted.endsWith(".00") ? formatted.slice(0, -3) : formatted;
    return `${amount < 0 ? "-" : ""}${CONFIG.currency.symbol}${clean}${scale.suffix}`;
  }
  
  const parts = Math.abs(amount).toFixed(CONFIG.currency.decimalPlaces).split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${amount < 0 ? "-" : ""}${CONFIG.currency.symbol}${parts.join(".")}`;
}

function getTierInfo(balance) {
  const valid = Number(balance) || 0;
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    if (valid >= tier.min && valid <= tier.max) {
      const next = TIERS[i + 1] || null;
      const progress = tier.max === Infinity ? 100 : Math.min(100, ((valid - tier.min) / (tier.max - tier.min)) * 100);
      return { ...tier, nextTier: next, progress };
    }
  }
  return { name: "Inconnu", color: "#888", badge: "❓", multiplier: 1, progress: 0, nextTier: null };
}

function getDefaultBank(userId) {
  return {
    userId: String(userId),
    money: 0,
    bank: 0,
    savings: 0,
    vault: 0,
    loan: 0,
    loanDate: null,
    creditScore: 750,
    bankLevel: 1,
    multiplier: 1.0,
    premium: false,
    streak: 0,
    lastDaily: null,
    lastWork: null,
    lastRob: null,
    lastInterest: Date.now(),
    stocks: {},
    crypto: {},
    bonds: {},
    realEstate: [],
    businesses: [],
    vehicles: [],
    luxury: [],
    insurance: {},
    skills: { gambling: 0, trading: 0, business: 0, investing: 0 },
    achievements: [],
    transactions: [],
    lotteryTickets: 0,
    frozen: false,
    userName: null
  };
}

function progressBar(progress) {
  const filled = Math.round(progress / 10);
  const empty = 10 - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

// ===================== SERVICE BANCAIRE =====================
class BankService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 60000;
  }

  async getUser(userId, userName = null) {
    const balances = await getBalances();
    if (!balances[userId]) {
      balances[userId] = getDefaultBank(userId);
      await saveBalances(balances);
    }
    
    if (userName && balances[userId].userName !== userName) {
      balances[userId].userName = userName;
      await saveBalances(balances);
    }
    
    return balances[userId];
  }

  async saveUser(userId, data) {
    const balances = await getBalances();
    balances[userId] = data;
    await saveBalances(balances);
  }

  async getBalance(userId) {
    const user = await this.getUser(userId);
    const totalStocks = Object.values(user.stocks || {}).reduce((a, b) => a + b, 0);
    const totalCrypto = Object.values(user.crypto || {}).reduce((a, b) => a + b, 0);
    const totalBonds = Object.values(user.bonds || {}).reduce((a, b) => a + b, 0);
    
    return {
      money: user.money || 0,
      bank: user.bank || 0,
      savings: user.savings || 0,
      vault: user.vault || 0,
      total: (user.money || 0) + (user.bank || 0) + (user.savings || 0) + (user.vault || 0),
      totalInvestments: totalStocks + totalCrypto + totalBonds,
      wealth: (user.money || 0) + (user.bank || 0) + (user.savings || 0) + (user.vault || 0) + totalStocks + totalCrypto + totalBonds
    };
  }

  async addMoney(userId, amount, source = 'unknown') {
    const user = await this.getUser(userId);
    if (amount < 0 && user.money < Math.abs(amount)) {
      throw new Error('Fonds insuffisants');
    }
    user.money = (user.money || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: amount > 0 ? 'income' : 'expense',
      amount: Math.abs(amount),
      date: Date.now(),
      description: source
    });
    await this.saveUser(userId, user);
    return user.money;
  }

  async deposit(userId, amount) {
    const user = await this.getUser(userId);
    if (amount > (user.money || 0)) {
      throw new Error('Fonds insuffisants');
    }
    user.money = (user.money || 0) - amount;
    user.bank = (user.bank || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'deposit',
      amount: amount,
      date: Date.now(),
      description: 'Dépôt bancaire'
    });
    await this.saveUser(userId, user);
    return { newMoney: user.money, newBank: user.bank };
  }

  async withdraw(userId, amount) {
    const user = await this.getUser(userId);
    if (amount > (user.bank || 0)) {
      throw new Error('Solde bancaire insuffisant');
    }
    user.bank = (user.bank || 0) - amount;
    user.money = (user.money || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'withdraw',
      amount: amount,
      date: Date.now(),
      description: 'Retrait bancaire'
    });
    await this.saveUser(userId, user);
    return { newMoney: user.money, newBank: user.bank };
  }

  async transfer(fromUserId, toUserId, amount) {
    if (String(fromUserId) === String(toUserId)) {
      throw new Error('Impossible de se transférer à soi-même');
    }

    const fromUser = await this.getUser(fromUserId);
    const toUser = await this.getUser(toUserId);

    if (amount > (fromUser.money || 0)) {
      throw new Error('Fonds insuffisants');
    }

    fromUser.money = (fromUser.money || 0) - amount;
    toUser.money = (toUser.money || 0) + amount;

    fromUser.transactions = fromUser.transactions || [];
    toUser.transactions = toUser.transactions || [];

    fromUser.transactions.push({
      type: 'transfer_out',
      amount: amount,
      date: Date.now(),
      description: `Transfert vers ${toUser.userName || toUserId}`
    });
    toUser.transactions.push({
      type: 'transfer_in',
      amount: amount,
      date: Date.now(),
      description: `Transfert de ${fromUser.userName || fromUserId}`
    });

    await this.saveUser(fromUserId, fromUser);
    await this.saveUser(toUserId, toUser);
    
    return { fromBalance: fromUser.money, toBalance: toUser.money };
  }

  async takeLoan(userId, amount) {
    const user = await this.getUser(userId);
    const maxLoan = user.creditScore * CONFIG.loan.maxMultiplier;

    if (amount < CONFIG.loan.minAmount || amount > maxLoan) {
      throw new Error(`Montant invalide. Minimum: ${CONFIG.loan.minAmount}, Maximum: ${maxLoan}`);
    }

    if ((user.loan || 0) > 0) {
      throw new Error('Vous avez déjà un prêt en cours');
    }

    user.bank = (user.bank || 0) + amount;
    user.loan = amount;
    user.loanDate = Date.now();
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'loan',
      amount: amount,
      date: Date.now(),
      description: 'Prêt bancaire'
    });
    await this.saveUser(userId, user);
    return { loanAmount: user.loan, newBank: user.bank };
  }

  async repayLoan(userId, amount) {
    const user = await this.getUser(userId);
    if ((user.loan || 0) <= 0) {
      throw new Error('Aucun prêt en cours');
    }

    const repayAmount = Math.min(amount, user.loan);
    if (repayAmount > (user.bank || 0)) {
      throw new Error('Solde bancaire insuffisant');
    }

    user.bank = (user.bank || 0) - repayAmount;
    user.loan = (user.loan || 0) - repayAmount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'loan_repayment',
      amount: repayAmount,
      date: Date.now(),
      description: 'Remboursement prêt'
    });

    if (user.loan === 0) {
      user.loanDate = null;
      user.creditScore = Math.min(850, (user.creditScore || 0) + 10);
    }

    await this.saveUser(userId, user);
    return { remainingLoan: user.loan, newBank: user.bank };
  }

  async collectInterest(userId) {
    const user = await this.getUser(userId);
    const now = Date.now();
    const hoursSince = (now - (user.lastInterest || now)) / (1000 * 60 * 60);

    if (hoursSince < 1) {
      throw new Error('Attendez au moins 1 heure');
    }

    const savingsInterest = Math.floor((user.savings || 0) * CONFIG.savings.interestRate / (30 * 24) * hoursSince);
    const vaultInterest = Math.floor((user.vault || 0) * CONFIG.vault.interestRate / (30 * 24) * hoursSince);
    const loanInterest = Math.floor((user.loan || 0) * CONFIG.loan.interestRate / (7 * 24) * hoursSince);

    user.savings = (user.savings || 0) + savingsInterest;
    user.vault = (user.vault || 0) + vaultInterest;
    user.loan = (user.loan || 0) + loanInterest;
    user.lastInterest = now;

    user.transactions = user.transactions || [];
    if (savingsInterest > 0) {
      user.transactions.push({
        type: 'interest',
        amount: savingsInterest,
        date: now,
        description: 'Intérêts épargne'
      });
    }
    if (vaultInterest > 0) {
      user.transactions.push({
        type: 'interest',
        amount: vaultInterest,
        date: now,
        description: 'Intérêts coffre'
      });
    }

    await this.saveUser(userId, user);
    return {
      savingsInterest,
      vaultInterest,
      loanInterest,
      netInterest: savingsInterest + vaultInterest - loanInterest,
      newSavings: user.savings,
      newVault: user.vault,
      newLoan: user.loan
    };
  }

  async dailyReward(userId) {
    const user = await this.getUser(userId);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (user.lastDaily && (now - user.lastDaily) < oneDay) {
      const remaining = oneDay - (now - user.lastDaily);
      throw new Error(`Prochain bonus dans ${Math.ceil(remaining / (60 * 60 * 1000))}h`);
    }

    const base = CONFIG.daily.baseAmount;
    const streakMultiplier = Math.min((user.streak || 0), CONFIG.daily.maxStreak) * CONFIG.daily.streakMultiplier;
    const levelMultiplier = (user.bankLevel || 1) * 0.05;
    const totalBonus = Math.floor(base * (1 + streakMultiplier + levelMultiplier) * (user.multiplier || 1));

    if (user.lastDaily && (now - user.lastDaily) < oneDay * 2) {
      user.streak = (user.streak || 0) + 1;
    } else {
      user.streak = 1;
    }

    user.bank = (user.bank || 0) + totalBonus;
    user.lastDaily = now;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'daily',
      amount: totalBonus,
      date: now,
      description: `Bonus quotidien (série ${user.streak})`
    });

    if (user.streak === 7 && !user.achievements.includes('7 jours de suite')) {
      user.achievements.push('7 jours de suite');
      user.multiplier = Math.min(2.0, (user.multiplier || 1) + 0.1);
    }
    if (user.streak === 30 && !user.achievements.includes('30 jours de suite !')) {
      user.achievements.push('30 jours de suite !');
      user.multiplier = Math.min(2.0, (user.multiplier || 1) + 0.2);
    }

    await this.saveUser(userId, user);
    return {
      bonus: totalBonus,
      streak: user.streak,
      newBank: user.bank,
      multiplier: user.multiplier
    };
  }

  async work(userId) {
    const user = await this.getUser(userId);
    const cooldown = CONFIG.work.cooldown;

    if (user.lastWork && (Date.now() - user.lastWork) < cooldown) {
      const remaining = cooldown - (Date.now() - user.lastWork);
      throw new Error(`Prochain travail dans ${Math.ceil(remaining / (60 * 60 * 1000))}h`);
    }

    const jobs = [
      { name: '🧑‍💻 Développeur', min: 800, max: 2000 },
      { name: '👨‍🏫 Professeur', min: 500, max: 1200 },
      { name: '👨‍⚕️ Médecin', min: 1500, max: 3500 },
      { name: '👨‍🍳 Chef Cuisinier', min: 600, max: 1500 },
      { name: '🧑‍🎨 Artiste', min: 400, max: 3000 },
      { name: '👨‍🔬 Chercheur', min: 1000, max: 2500 },
      { name: '🧑‍✈️ Pilote', min: 1200, max: 2800 },
      { name: '👨‍🏭 Ingénieur', min: 900, max: 2200 }
    ];

    const job = jobs[Math.floor(Math.random() * jobs.length)];
    const salary = Math.floor(Math.random() * (job.max - job.min + 1)) + job.min;
    const bonus = (user.skills?.business || 0) * 50;
    const total = Math.floor((salary + bonus) * (user.multiplier || 1));

    user.money = (user.money || 0) + total;
    user.lastWork = Date.now();
    user.skills = user.skills || {};
    user.skills.business = (user.skills.business || 0) + 1;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'work',
      amount: total,
      date: Date.now(),
      description: `Travail: ${job.name}`
    });

    await this.saveUser(userId, user);
    return {
      job: job.name,
      salary: total,
      bonus: bonus,
      newMoney: user.money,
      skillLevel: user.skills.business
    };
  }

  async rob(userId, targetId, targetName) {
    if (String(userId) === String(targetId)) {
      throw new Error('Vous ne pouvez pas vous voler vous-même');
    }

    const user = await this.getUser(userId);
    const target = await this.getUser(targetId);

    const now = Date.now();
    if (user.lastRob && (now - user.lastRob) < CONFIG.rob.cooldown) {
      const remaining = CONFIG.rob.cooldown - (now - user.lastRob);
      throw new Error(`Prochain vol dans ${Math.ceil(remaining / (60 * 60 * 1000))}h`);
    }

    const robbable = target.money || 0;
    if (robbable < CONFIG.rob.minTarget) {
      throw new Error("Cette personne n'a pas assez d'argent");
    }

    if (target.insurance?.THEFT) {
      throw new Error('🛡️ Cette personne a une assurance vol !');
    }

    const success = Math.random() < CONFIG.rob.successRate;
    let result;

    if (success) {
      const stolen = Math.floor(robbable * (Math.random() * 0.3 + 0.1));
      user.money = (user.money || 0) + stolen;
      target.money = (target.money || 0) - stolen;
      user.lastRob = now;
      
      user.transactions = user.transactions || [];
      target.transactions = target.transactions || [];
      
      user.transactions.push({
        type: 'robbery_success',
        amount: stolen,
        date: now,
        description: `Vol réussi sur ${targetName || targetId}`
      });
      target.transactions.push({
        type: 'robbed',
        amount: stolen,
        date: now,
        description: `Volé par ${user.userName || userId}`
      });
      
      result = { success: true, stolen, newMoney: user.money };
    } else {
      const fine = Math.min((user.money || 0) * 0.1, 10000);
      user.money = (user.money || 0) - fine;
      user.lastRob = now;
      
      user.transactions = user.transactions || [];
      user.transactions.push({
        type: 'robbery_failed',
        amount: fine,
        date: now,
        description: 'Amende pour vol raté'
      });
      
      result = { success: false, fine, newMoney: user.money };
    }

    await this.saveUser(userId, user);
    await this.saveUser(targetId, target);
    return result;
  }
}

// ===================== SERVICE DE JEUX =====================
class GameService {
  constructor() {
    this.SLOT_SYMBOLS = [
      { emoji: '🍒', weight: 30 },
      { emoji: '🍋', weight: 25 },
      { emoji: '🍇', weight: 20 },
      { emoji: '🍉', weight: 15 },
      { emoji: '⭐', weight: 7 },
      { emoji: '7️⃣', weight: 3 }
    ];
  }

  async slots(userId, bet) {
    const bankService = new BankService();
    const user = await bankService.getUser(userId);
    
    if (bet > (user.money || 0)) {
      throw new Error('Fonds insuffisants');
    }

    const roll = () => {
      const totalWeight = this.SLOT_SYMBOLS.reduce((s, sym) => s + sym.weight, 0);
      let random = Math.random() * totalWeight;
      for (const sym of this.SLOT_SYMBOLS) {
        if (random < sym.weight) return sym.emoji;
        random -= sym.weight;
      }
      return this.SLOT_SYMBOLS[0].emoji;
    };

    const s1 = roll();
    const s2 = roll();
    const s3 = roll();

    let winnings = 0;
    let multiplier = 0;

    if (s1 === '7️⃣' && s2 === '7️⃣' && s3 === '7️⃣') {
      multiplier = 10;
      winnings = bet * multiplier;
    } else if (s1 === s2 && s2 === s3) {
      multiplier = 5;
      winnings = bet * multiplier;
    } else if (s1 === s2 || s2 === s3 || s1 === s3) {
      multiplier = 2;
      winnings = bet * multiplier;
    } else if (Math.random() < 0.1) {
      multiplier = 1.5;
      winnings = Math.round(bet * 1.5);
    }

    const netWinnings = winnings - bet;
    user.money = (user.money || 0) + netWinnings;
    user.skills = user.skills || {};
    user.skills.gambling = (user.skills.gambling || 0) + 1;
    user.transactions = user.transactions || [];

    if (netWinnings > 0) {
      user.transactions.push({
        type: 'slots_win',
        amount: netWinnings,
        date: Date.now(),
        description: `Slots x${multiplier}`
      });
    } else {
      user.transactions.push({
        type: 'slots_loss',
        amount: bet,
        date: Date.now(),
        description: 'Slots perdu'
      });
    }

    await bankService.saveUser(userId, user);

    return {
      symbols: [s1, s2, s3],
      bet,
      winnings,
      netWinnings,
      multiplier,
      win: netWinnings > 0,
      newMoney: user.money,
      skillLevel: user.skills.gambling
    };
  }

  async blackjack(userId, bet) {
    const bankService = new BankService();
    const user = await bankService.getUser(userId);
    
    if (bet > (user.money || 0)) {
      throw new Error('Fonds insuffisants');
    }

    const getCard = () => Math.min(Math.floor(Math.random() * 13) + 1, 10);
    const playerCards = [getCard(), getCard()];
    const dealerCards = [getCard(), getCard()];
    const playerTotal = playerCards.reduce((a, b) => a + b, 0);
    const dealerTotal = dealerCards.reduce((a, b) => a + b, 0);

    let result, netWinnings = 0;
    let multiplier = 0;

    if (playerTotal > 21) {
      result = 'BUST';
      netWinnings = -bet;
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
      result = 'WIN';
      multiplier = 2;
      netWinnings = bet;
    } else if (playerTotal === dealerTotal) {
      result = 'PUSH';
      netWinnings = 0;
    } else {
      result = 'LOSE';
      netWinnings = -bet;
    }

    user.money = (user.money || 0) + netWinnings;
    user.skills = user.skills || {};
    user.skills.gambling = (user.skills.gambling || 0) + 1;
    user.transactions = user.transactions || [];

    if (netWinnings > 0) {
      user.transactions.push({
        type: 'blackjack_win',
        amount: netWinnings,
        date: Date.now(),
        description: `Blackjack ${result}`
      });
    } else if (netWinnings < 0) {
      user.transactions.push({
        type: 'blackjack_loss',
        amount: Math.abs(netWinnings),
        date: Date.now(),
        description: `Blackjack ${result}`
      });
    }

    await bankService.saveUser(userId, user);

    return {
      playerCards,
      dealerCards,
      playerTotal,
      dealerTotal,
      result,
      bet,
      netWinnings,
      multiplier,
      newMoney: user.money,
      skillLevel: user.skills.gambling
    };
  }

  async roulette(userId, bet, choice) {
    const bankService = new BankService();
    const user = await bankService.getUser(userId);
    
    if (bet > (user.money || 0)) {
      throw new Error('Fonds insuffisants');
    }

    const number = Math.floor(Math.random() * 37);
    const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number);
    const isBlack = number !== 0 && !isRed;
    const isOdd = number > 0 && number % 2 === 1;
    const isEven = number > 0 && number % 2 === 0;
    const isLow = number >= 1 && number <= 18;
    const isHigh = number >= 19 && number <= 36;

    let win = false;
    let multiplier = 0;

    const choiceLower = choice.toLowerCase();
    if (choiceLower === 'rouge' && isRed) { win = true; multiplier = 2; }
    else if (choiceLower === 'noir' && isBlack) { win = true; multiplier = 2; }
    else if (choiceLower === 'pair' && isEven) { win = true; multiplier = 2; }
    else if (choiceLower === 'impair' && isOdd) { win = true; multiplier = 2; }
    else if (choiceLower === 'manque' && isLow) { win = true; multiplier = 2; }
    else if (choiceLower === 'passe' && isHigh) { win = true; multiplier = 2; }
    else if (parseInt(choice) === number && choice >= 0 && choice <= 36) {
      win = true;
      multiplier = 36;
    }

    const netWinnings = win ? bet * multiplier - bet : -bet;
    user.money = (user.money || 0) + netWinnings;
    user.skills = user.skills || {};
    user.skills.gambling = (user.skills.gambling || 0) + 1;
    user.transactions = user.transactions || [];

    if (netWinnings > 0) {
      user.transactions.push({
        type: 'roulette_win',
        amount: netWinnings,
        date: Date.now(),
        description: `Roulette ${number}`
      });
    } else if (netWinnings < 0) {
      user.transactions.push({
        type: 'roulette_loss',
        amount: Math.abs(netWinnings),
        date: Date.now(),
        description: `Roulette ${number}`
      });
    }

    await bankService.saveUser(userId, user);

    return {
      number,
      isRed,
      isBlack,
      win,
      multiplier,
      bet,
      netWinnings,
      newMoney: user.money,
      skillLevel: user.skills.gambling
    };
  }
}

// ===================== INSTANCIATION DES SERVICES =====================
const bankService = new BankService();
const gameService = new GameService();

// ===================== FONCTIONS DE CALCUL =====================
function calculatePortfolioValue(user) {
  let total = 0;
  for (const [sym, shares] of Object.entries(user.stocks || {})) {
    total += shares * (MARKET_DATA.stocks[sym]?.price || 0);
  }
  for (const [sym, amount] of Object.entries(user.crypto || {})) {
    total += amount * (MARKET_DATA.crypto[sym]?.price || 0);
  }
  for (const [type, amount] of Object.entries(user.bonds || {})) {
    total += amount;
  }
  return total;
}

function calculateRealEstateValue(user) {
  return (user.realEstate || []).reduce((sum, p) => sum + (p.value || 0), 0);
}

function calculateBusinessValue(user) {
  return (user.businesses || []).reduce((sum, b) => {
    const cost = MARKET_DATA.businesses[b.type]?.cost || 100000;
    return sum + cost * (b.level || 1);
  }, 0);
}

function calculateVehicleValue(user) {
  return (user.vehicles || []).reduce((sum, v) => sum + (v.currentValue || 0), 0);
}

function calculateLuxuryValue(user) {
  return (user.luxury || []).reduce((sum, l) => sum + (l.value || 0), 0);
}

// ===================== COMMANDE PRINCIPALE =====================
async function onStart({ bot, msg, chatId, args }) {
  const userId = String(msg.from.id);
  const userName = msg.from.first_name || "Utilisateur";
  const sub = args[0]?.toLowerCase();

  if (!sub || sub === "help") {
    return showHelp(chatId, bot, msg);
  }

  try {
    const user = await bankService.getUser(userId);
    if (user.frozen && sub !== "unfreeze") {
      return bot.sendMessage(chatId, "🔒 Votre compte est gelé. Contactez un administrateur.", {
        reply_to_message_id: msg.message_id
      });
    }

    switch (sub) {
      case "balance":
      case "bal":
        return showBalance(chatId, bot, msg, userId, userName);
      
      case "deposit":
      case "dep":
        return handleDeposit(chatId, bot, msg, userId, args);
      
      case "withdraw":
      case "wd":
        return handleWithdraw(chatId, bot, msg, userId, args);
      
      case "transfer":
      case "send":
        return handleTransfer(chatId, bot, msg, userId, args);
      
      case "loan":
        return handleLoan(chatId, bot, msg, userId, args);
      
      case "repay":
        return handleRepay(chatId, bot, msg, userId, args);
      
      case "savings":
      case "save":
        return handleSavings(chatId, bot, msg, userId, args);
      
      case "interest":
        return handleInterest(chatId, bot, msg, userId);
      
      case "collect":
        return handleCollect(chatId, bot, msg, userId);
      
      case "history":
        return showHistory(chatId, bot, msg, userId);
      
      case "daily":
        return handleDaily(chatId, bot, msg, userId);
      
      case "work":
        return handleWork(chatId, bot, msg, userId);
      
      case "invest":
        return showInvest(chatId, bot, msg);
      
      case "stocks":
        return handleStocks(chatId, bot, msg, userId, args);
      
      case "crypto":
        return handleCrypto(chatId, bot, msg, userId, args);
      
      case "bonds":
        return handleBonds(chatId, bot, msg, userId, args);
      
      case "portfolio":
        return showPortfolio(chatId, bot, msg, userId);
      
      case "market":
        return showMarket(chatId, bot, msg);
      
      case "dividend":
        return handleDividend(chatId, bot, msg, userId);
      
      case "business":
        return handleBusiness(chatId, bot, msg, userId, args);
      
      case "shop":
        return handleShop(chatId, bot, msg, userId, args);
      
      case "property":
      case "realestate":
        return handleProperty(chatId, bot, msg, userId, args);
      
      case "rent":
        return handleRent(chatId, bot, msg, userId);
      
      case "luxury":
        return handleLuxury(chatId, bot, msg, userId, args);
      
      case "car":
        return handleCar(chatId, bot, msg, userId, args);
      
      case "gamble":
        return handleGamble(chatId, bot, msg, userId, args);
      
      case "slots":
        return handleSlots(chatId, bot, msg, userId, args);
      
      case "blackjack":
        return handleBlackjack(chatId, bot, msg, userId, args);
      
      case "roulette":
        return handleRoulette(chatId, bot, msg, userId, args);
      
      case "lottery":
        return handleLottery(chatId, bot, msg, userId, args);
      
      case "premium":
        return handlePremium(chatId, bot, msg, userId, args);
      
      case "vault":
        return handleVault(chatId, bot, msg, userId, args);
      
      case "insurance":
        return handleInsurance(chatId, bot, msg, userId, args);
      
      case "credit":
        return showCredit(chatId, bot, msg, userId);
      
      case "achievements":
        return showAchievements(chatId, bot, msg, userId);
      
      case "leaderboard":
      case "lb":
        return showLeaderboard(chatId, bot, msg);
      
      case "rob":
        return handleRob(chatId, bot, msg, userId);
      
      case "unfreeze":
        return handleUnfreeze(chatId, bot, msg, userId);
      
      default:
        return bot.sendMessage(chatId, `❌ Sous-commande inconnue: ${sub}\nUtilisez /bank help`, {
          reply_to_message_id: msg.message_id
        });
    }
  } catch (error) {
    console.error("Bank error:", error);
    return bot.sendMessage(chatId, `❌ ${error.message}`, {
      reply_to_message_id: msg.message_id
    });
  }
}

// ===================== GESTIONNAIRES DE COMMANDES =====================

async function showHelp(chatId, bot, msg) {
  const helpText = fonts.sansSerif(
`🏦 SYSTEME BANCAIRE
━━━━━━━━━━━━━━

📊 COMPTE
• /bank balance - Votre solde
• /bank deposit <montant|all> - Deposer
• /bank withdraw <montant|all> - Retirer
• /bank transfer <montant> - Transferer (repondre)
• /bank history - Historique

💳 CREDIT
• /bank loan <montant> - Emprunter
• /bank repay <montant> - Rembourser
• /bank credit - Score de credit

💰 REVENUS
• /bank daily - Bonus quotidien
• /bank work - Travailler
• /bank interest - Interets
• /bank collect - Collecter

📈 INVESTISSEMENTS
• /bank market - Marche
• /bank stocks [list|buy|sell] - Actions
• /bank crypto [list|buy|sell] - Crypto
• /bank bonds [list|buy] - Obligations
• /bank portfolio - Portefeuille
• /bank dividend - Dividendes

🏢 ENTREPRISES
• /bank business [list|buy|collect] - Entreprises
• /bank shop [list|buy] - Boutique

🏠 IMMOBILIER
• /bank property [list|buy] - Proprietes
• /bank rent - Loyers
• /bank luxury [list|buy] - Luxe
• /bank car [list|buy] - Vehicules

🎰 JEUX
• /bank gamble <montant> - Jeu simple
• /bank slots <montant> - Machine a sous
• /bank blackjack <montant> - Blackjack
• /bank roulette <montant> <mise> - Roulette
• /bank lottery [buy|check] - Loterie

⭐ SPECIAL
• /bank premium [buy] - Premium
• /bank vault [deposit|withdraw] - Coffre
• /bank insurance [list|buy] - Assurances
• /bank achievements - Succes
• /bank leaderboard - Classement
• /bank rob - Voler (repondre)`);

  return bot.sendMessage(chatId, helpText, {
    reply_to_message_id: msg.message_id
  });
}

async function showBalance(chatId, bot, msg, userId, userName) {
  const user = await bankService.getUser(userId);
  const balance = await bankService.getBalance(userId);
  const tier = getTierInfo(balance.total);

  const totalLiquid = balance.total;
  const totalInvestments = calculatePortfolioValue(user);
  const totalRealEstate = calculateRealEstateValue(user);
  const totalBusiness = calculateBusinessValue(user);
  const totalVehicles = calculateVehicleValue(user);
  const totalLuxury = calculateLuxuryValue(user);
  const totalAssets = totalInvestments + totalRealEstate + totalBusiness + totalVehicles + totalLuxury;
  const netWorth = totalLiquid + totalAssets;

  const message = fonts.sansSerif(
`💳 ${userName}
━━━━━━━━━━━━━━

💰 LIQUIDITES
• Portefeuille: ${formatMoney(user.money)}
• Banque: ${formatMoney(user.bank)}
• Epargne: ${formatMoney(user.savings)}
• Coffre: ${formatMoney(user.vault)}
• Total: ${formatMoney(totalLiquid)}

📊 ACTIFS
• Investissements: ${formatMoney(totalInvestments)}
• Immobilier: ${formatMoney(totalRealEstate)}
• Entreprises: ${formatMoney(totalBusiness)}
• Vehicules: ${formatMoney(totalVehicles)}
• Luxe: ${formatMoney(totalLuxury)}

💰 PATRIMOINE TOTAL: ${formatMoney(netWorth)}

🏆 TIER: ${tier.badge} ${tier.name}
${tier.nextTier ? `📈 Progression: ${progressBar(tier.progress)} ${tier.progress.toFixed(1)}%\n🎯 Prochain: ${tier.nextTier.name} (${formatMoney(tier.nextTier.min - balance.total)} requis)` : '🏆 Tier maximum atteint !'}

${user.loan > 0 ? `💳 DETTE: ${formatMoney(user.loan)}\n` : ''}
🔰 NIVEAU: ${user.bankLevel} | ⚡ MULTIPLICATEUR: ${user.multiplier}x
🔥 SERIE: ${user.streak || 0} jours | 🏅 SUCCES: ${user.achievements?.length || 0}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleDeposit(chatId, bot, msg, userId, args) {
  const balance = await bankService.getBalance(userId);
  const amount = args[1] === 'all' ? balance.money : parseInt(args[1]);
  
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide. Utilisez /bank deposit <montant|all>', {
      reply_to_message_id: msg.message_id
    });
  }

  const result = await bankService.deposit(userId, amount);
  const message = fonts.sansSerif(
`✅ DEPOT REUSSI
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
🏦 Nouveau solde bancaire: ${formatMoney(result.newBank)}
💵 Solde liquide restant: ${formatMoney(result.newMoney)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleWithdraw(chatId, bot, msg, userId, args) {
  const balance = await bankService.getBalance(userId);
  const amount = args[1] === 'all' ? balance.bank : parseInt(args[1]);
  
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide. Utilisez /bank withdraw <montant|all>', {
      reply_to_message_id: msg.message_id
    });
  }

  const result = await bankService.withdraw(userId, amount);
  const message = fonts.sansSerif(
`✅ RETRAIT REUSSI
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
💵 Nouveau solde liquide: ${formatMoney(result.newMoney)}
🏦 Solde bancaire restant: ${formatMoney(result.newBank)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleTransfer(chatId, bot, msg, userId, args) {
  const targetMsg = msg.reply_to_message;
  if (!targetMsg) {
    return bot.sendMessage(chatId, '❌ Répondez au message du destinataire.\nExemple: /bank transfer 5000', {
      reply_to_message_id: msg.message_id
    });
  }

  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide.', {
      reply_to_message_id: msg.message_id
    });
  }

  const targetId = String(targetMsg.from.id);
  const targetName = targetMsg.from.first_name || "Utilisateur";
  const result = await bankService.transfer(userId, targetId, amount);

  const message = fonts.sansSerif(
`✅ TRANSFERT REUSSI
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
👤 Destinataire: ${targetName}
💵 Nouveau solde: ${formatMoney(result.fromBalance)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleLoan(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    const user = await bankService.getUser(userId);
    const maxLoan = user.creditScore * CONFIG.loan.maxMultiplier;
    const message = fonts.sansSerif(
`💳 PRET BANCAIRE
━━━━━━━━━━━━━━
📊 Score de credit: ${user.creditScore}/850
💰 Montant maximum: ${formatMoney(maxLoan)}
📈 Taux: ${CONFIG.loan.interestRate * 100}% par semaine
💳 Dette actuelle: ${user.loan > 0 ? formatMoney(user.loan) : 'Aucune'}

Utilisation: /bank loan <montant>`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  const result = await bankService.takeLoan(userId, amount);
  const message = fonts.sansSerif(
`✅ PRET ACCORDE
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
🏦 Nouveau solde bancaire: ${formatMoney(result.newBank)}
💳 Dette: ${formatMoney(result.loanAmount)}
📈 Taux: ${CONFIG.loan.interestRate * 100}% par semaine`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleRepay(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide. Utilisez /bank repay <montant>', {
      reply_to_message_id: msg.message_id
    });
  }

  const result = await bankService.repayLoan(userId, amount);
  const message = fonts.sansSerif(
`✅ REMBOURSEMENT REUSSI
━━━━━━━━━━━━━━
💰 Montant rembourse: ${formatMoney(amount)}
💳 Dette restante: ${result.remainingLoan > 0 ? formatMoney(result.remainingLoan) : '✅ Aucune'}
🏦 Nouveau solde bancaire: ${formatMoney(result.newBank)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleSavings(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    const user = await bankService.getUser(userId);
    const message = fonts.sansSerif(
`🏦 EPARGNE
━━━━━━━━━━━━━━
💰 Solde actuel: ${formatMoney(user.savings || 0)}
📈 Taux: ${CONFIG.savings.interestRate * 100}% par mois

Utilisation: /bank savings <montant>`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  const user = await bankService.getUser(userId);
  if (amount > (user.money || 0)) {
    throw new Error('Fonds insuffisants');
  }

  user.money = (user.money || 0) - amount;
  user.savings = (user.savings || 0) + amount;
  user.transactions = user.transactions || [];
  user.transactions.push({
    type: 'savings_deposit',
    amount: amount,
    date: Date.now(),
    description: 'Dépôt épargne'
  });
  await bankService.saveUser(userId, user);

  const message = fonts.sansSerif(
`✅ DEPOT EPARGNE REUSSI
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
🏦 Nouvelle epargne: ${formatMoney(user.savings)}
💵 Solde liquide: ${formatMoney(user.money)}
📈 Taux: ${CONFIG.savings.interestRate * 100}% par mois`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleInterest(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  const now = Date.now();
  const hoursSince = (now - (user.lastInterest || now)) / (1000 * 60 * 60);

  if (hoursSince < 1) {
    return bot.sendMessage(chatId,
      `⏳ INTERETS\n━━━━━━━━━━━━━━\nProchain calcul dans ${Math.ceil(60 - hoursSince * 60)} minutes.\n\nUtilisez /bank collect pour recolter les interets.`, {
        reply_to_message_id: msg.message_id
      }
    );
  }

  const savingsInterest = Math.floor((user.savings || 0) * CONFIG.savings.interestRate / (30 * 24) * hoursSince);
  const vaultInterest = Math.floor((user.vault || 0) * CONFIG.vault.interestRate / (30 * 24) * hoursSince);
  const loanInterest = Math.floor((user.loan || 0) * CONFIG.loan.interestRate / (7 * 24) * hoursSince);

  const message = fonts.sansSerif(
`📈 INTERETS CALCULES
━━━━━━━━━━━━━━
⏰ Periode: ${Math.floor(hoursSince)} heures
🏦 Epargne: +${formatMoney(savingsInterest)}
🔐 Coffre: +${formatMoney(vaultInterest)}
💳 Pret: -${formatMoney(loanInterest)}
📊 Net: ${formatMoney(savingsInterest + vaultInterest - loanInterest)}

Utilisez /bank collect pour les recolter`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleCollect(chatId, bot, msg, userId) {
  const result = await bankService.collectInterest(userId);
  const message = fonts.sansSerif(
`💰 INTERETS COLLECTES
━━━━━━━━━━━━━━
🏦 Epargne: +${formatMoney(result.savingsInterest)}
🔐 Coffre: +${formatMoney(result.vaultInterest)}
💳 Pret: -${formatMoney(result.loanInterest)}
📊 Net: ${formatMoney(result.netInterest)}

Nouveaux soldes:
🏦 Epargne: ${formatMoney(result.newSavings)}
🔐 Coffre: ${formatMoney(result.newVault)}
💳 Dette: ${formatMoney(result.newLoan)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function showHistory(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  const transactions = user.transactions?.slice(-15).reverse() || [];

  if (transactions.length === 0) {
    return bot.sendMessage(chatId, '📋 Aucune transaction.', {
      reply_to_message_id: msg.message_id
    });
  }

  let text = fonts.sansSerif(`📋 HISTORIQUE (15 dernieres)\n━━━━━━━━━━━━━━\n\n`);
  transactions.forEach((tx, i) => {
    const date = new Date(tx.date).toLocaleString('fr-FR');
    const emoji = tx.type.includes('win') ? '🎉' : tx.type.includes('loss') ? '💸' : '💰';
    text += `${emoji} ${tx.type.toUpperCase()}: ${formatMoney(tx.amount)} (${date})\n`;
  });

  return bot.sendMessage(chatId, text, {
    reply_to_message_id: msg.message_id
  });
}

async function handleDaily(chatId, bot, msg, userId) {
  try {
    const result = await bankService.dailyReward(userId);
    const message = fonts.sansSerif(
`🎉 BONUS QUOTIDIEN
━━━━━━━━━━━━━━
💰 Bonus: ${formatMoney(result.bonus)}
🔥 Serie: ${result.streak} jours
🎯 Multiplicateur: ${result.multiplier}x
━━━━━━━━━━━━━━
🏦 Nouveau solde: ${formatMoney(result.newBank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    return bot.sendMessage(chatId, error.message, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function handleWork(chatId, bot, msg, userId) {
  try {
    const result = await bankService.work(userId);
    const message = fonts.sansSerif(
`💼 TRAVAIL
━━━━━━━━━━━━━━
📋 Poste: ${result.job}
💰 Salaire: ${formatMoney(result.salary)}
🎯 Bonus competence: ${formatMoney(result.bonus)}
💰 Nouveau solde: ${formatMoney(result.newMoney)}
📈 Niveau competence: ${result.skillLevel}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    return bot.sendMessage(chatId, error.message, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function showInvest(chatId, bot, msg) {
  const message = fonts.sansSerif(
`📊 INVESTISSEMENTS
━━━━━━━━━━━━━━

• /bank stocks [list|buy|sell] - Actions
• /bank crypto [list|buy|sell] - Crypto
• /bank bonds [list|buy] - Obligations
• /bank portfolio - Portefeuille
• /bank market - Marche
• /bank dividend - Dividendes`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleStocks(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`📈 ACTIONS\n━━━━━━━━━━━━━━\n\n`);
    for (const [sym, data] of Object.entries(MARKET_DATA.stocks)) {
      const changeEmoji = data.change >= 0 ? '📈' : '📉';
      text += `${changeEmoji} ${sym} - $${data.price.toLocaleString()} (${data.change > 0 ? '+' : ''}${data.change}%)\n   ${data.name}\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOTRE PORTEFEUILLE:\n`;
    if (Object.keys(user.stocks || {}).length === 0) {
      text += 'Aucune action\n\n';
    } else {
      for (const [sym, shares] of Object.entries(user.stocks || {})) {
        const price = MARKET_DATA.stocks[sym]?.price || 0;
        text += `• ${sym}: ${shares} actions (${formatMoney(shares * price)})\n`;
      }
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank stocks buy <symbole> <quantite>\n• /bank stocks sell <symbole> <quantite>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  const symbol = args[2]?.toUpperCase();
  const qty = parseInt(args[3]);
  
  if (!symbol || !MARKET_DATA.stocks[symbol]) {
    return bot.sendMessage(chatId, '❌ Symbole invalide.', {
      reply_to_message_id: msg.message_id
    });
  }

  const user = await bankService.getUser(userId);
  const price = MARKET_DATA.stocks[symbol].price;

  if (action === "buy") {
    if (!qty || qty <= 0) return bot.sendMessage(chatId, '❌ Quantité invalide.', { reply_to_message_id: msg.message_id });
    const cost = price * qty;
    if (user.bank < cost) {
      return bot.sendMessage(chatId, `❌ Fonds insuffisants. Besoin de ${formatMoney(cost)}`, {
        reply_to_message_id: msg.message_id
      });
    }
    user.bank = (user.bank || 0) - cost;
    user.stocks = user.stocks || {};
    user.stocks[symbol] = (user.stocks[symbol] || 0) + qty;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'stock_purchase',
      amount: cost,
      date: Date.now(),
      description: `Achat ${qty} ${symbol}`
    });
    await bankService.saveUser(userId, user);

    const message = fonts.sansSerif(
`✅ ACHAT EFFECTUE
━━━━━━━━━━━━━━
📈 ${qty} ${symbol} pour ${formatMoney(cost)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "sell") {
    if (!qty || qty <= 0) return bot.sendMessage(chatId, '❌ Quantité invalide.', { reply_to_message_id: msg.message_id });
    if (!user.stocks[symbol] || user.stocks[symbol] < qty) {
      return bot.sendMessage(chatId, '❌ Vous ne possédez pas assez d\'actions.', {
        reply_to_message_id: msg.message_id
      });
    }
    const value = price * qty;
    user.bank = (user.bank || 0) + value;
    user.stocks[symbol] = (user.stocks[symbol] || 0) - qty;
    if (user.stocks[symbol] === 0) delete user.stocks[symbol];
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'stock_sale',
      amount: value,
      date: Date.now(),
      description: `Vente ${qty} ${symbol}`
    });
    await bankService.saveUser(userId, user);

    const message = fonts.sansSerif(
`✅ VENTE EFFECTUEE
━━━━━━━━━━━━━━
📈 ${qty} ${symbol} pour ${formatMoney(value)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue. Utilisez list, buy ou sell.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleCrypto(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`₿ CRYPTO\n━━━━━━━━━━━━━━\n\n`);
    for (const [sym, data] of Object.entries(MARKET_DATA.crypto)) {
      const changeEmoji = data.change >= 0 ? '📈' : '📉';
      text += `${changeEmoji} ${sym} - $${data.price.toLocaleString()} (${data.change > 0 ? '+' : ''}${data.change}%)\n   ${data.name}\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOTRE PORTEFEUILLE:\n`;
    if (Object.keys(user.crypto || {}).length === 0) {
      text += 'Aucune crypto\n\n';
    } else {
      for (const [sym, amount] of Object.entries(user.crypto || {})) {
        const price = MARKET_DATA.crypto[sym]?.price || 0;
        text += `• ${sym}: ${amount} (${formatMoney(amount * price)})\n`;
      }
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank crypto buy <symbole> <quantite>\n• /bank crypto sell <symbole> <quantite>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  const symbol = args[2]?.toUpperCase();
  const amount = parseFloat(args[3]);
  
  if (!symbol || !MARKET_DATA.crypto[symbol]) {
    return bot.sendMessage(chatId, '❌ Symbole invalide.', {
      reply_to_message_id: msg.message_id
    });
  }

  const user = await bankService.getUser(userId);
  const price = MARKET_DATA.crypto[symbol].price;

  if (action === "buy") {
    if (!amount || amount <= 0) return bot.sendMessage(chatId, '❌ Quantité invalide.', { reply_to_message_id: msg.message_id });
    const cost = price * amount;
    if (user.bank < cost) {
      return bot.sendMessage(chatId, `❌ Fonds insuffisants. Besoin de ${formatMoney(cost)}`, {
        reply_to_message_id: msg.message_id
      });
    }
    user.bank = (user.bank || 0) - cost;
    user.crypto = user.crypto || {};
    user.crypto[symbol] = (user.crypto[symbol] || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'crypto_purchase',
      amount: cost,
      date: Date.now(),
      description: `Achat ${amount} ${symbol}`
    });
    await bankService.saveUser(userId, user);

    const message = fonts.sansSerif(
`✅ ACHAT EFFECTUE
━━━━━━━━━━━━━━
₿ ${amount} ${symbol} pour ${formatMoney(cost)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "sell") {
    if (!amount || amount <= 0) return bot.sendMessage(chatId, '❌ Quantité invalide.', { reply_to_message_id: msg.message_id });
    if (!user.crypto[symbol] || user.crypto[symbol] < amount) {
      return bot.sendMessage(chatId, '❌ Vous ne possédez pas assez.', {
        reply_to_message_id: msg.message_id
      });
    }
    const value = price * amount;
    user.bank = (user.bank || 0) + value;
    user.crypto[symbol] = (user.crypto[symbol] || 0) - amount;
    if (user.crypto[symbol] === 0) delete user.crypto[symbol];
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'crypto_sale',
      amount: value,
      date: Date.now(),
      description: `Vente ${amount} ${symbol}`
    });
    await bankService.saveUser(userId, user);

    const message = fonts.sansSerif(
`✅ VENTE EFFECTUEE
━━━━━━━━━━━━━━
₿ ${amount} ${symbol} pour ${formatMoney(value)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue. Utilisez list, buy ou sell.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleBonds(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`🏛️ OBLIGATIONS\n━━━━━━━━━━━━━━\n\n`);
    for (const [type, data] of Object.entries(MARKET_DATA.bonds)) {
      text += `📊 ${type.replace(/_/g, ' ')}\n   Rendement: ${data.yield}% annuel\n   Risque: ${data.risk}\n   Duree: ${data.term}\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOTRE PORTEFEUILLE:\n`;
    if (Object.keys(user.bonds || {}).length === 0) {
      text += 'Aucune obligation\n\n';
    } else {
      for (const [type, amount] of Object.entries(user.bonds || {})) {
        text += `• ${type.replace(/_/g, ' ')}: ${formatMoney(amount)}\n`;
      }
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank bonds buy <type> <montant>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const bondType = args[2]?.toUpperCase();
    const amount = parseInt(args[3]);
    if (!bondType || !MARKET_DATA.bonds[bondType] || !amount || amount <= 0) {
      return bot.sendMessage(chatId, '❌ Type ou montant invalide.', {
        reply_to_message_id: msg.message_id
      });
    }

    const user = await bankService.getUser(userId);
    if (user.bank < amount) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }

    user.bank = (user.bank || 0) - amount;
    user.bonds = user.bonds || {};
    user.bonds[bondType] = (user.bonds[bondType] || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'bond_purchase',
      amount: amount,
      date: Date.now(),
      description: `Achat obligation ${bondType}`
    });
    await bankService.saveUser(userId, user);

    const message = fonts.sansSerif(
`✅ ACHAT OBLIGATION
━━━━━━━━━━━━━━
🏛️ ${bondType.replace(/_/g, ' ')}: ${formatMoney(amount)}
💰 Nouveau solde: ${formatMoney(user.bank)}
📈 Rendement: ${MARKET_DATA.bonds[bondType].yield}%`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function showPortfolio(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  const total = calculatePortfolioValue(user);
  
  let text = fonts.sansSerif(`📊 PORTEFEUILLE D'INVESTISSEMENTS\n━━━━━━━━━━━━━━\n\n`);
  
  if (Object.keys(user.stocks || {}).length) {
    text += `📈 ACTIONS:\n`;
    for (const [sym, shares] of Object.entries(user.stocks || {})) {
      const price = MARKET_DATA.stocks[sym]?.price || 0;
      text += `• ${sym}: ${shares} actions (${formatMoney(shares * price)})\n`;
    }
    text += `\n`;
  }
  
  if (Object.keys(user.crypto || {}).length) {
    text += `₿ CRYPTO:\n`;
    for (const [sym, amount] of Object.entries(user.crypto || {})) {
      const price = MARKET_DATA.crypto[sym]?.price || 0;
      text += `• ${sym}: ${amount} (${formatMoney(amount * price)})\n`;
    }
    text += `\n`;
  }
  
  if (Object.keys(user.bonds || {}).length) {
    text += `🏛️ OBLIGATIONS:\n`;
    for (const [type, amount] of Object.entries(user.bonds || {})) {
      text += `• ${type.replace(/_/g, ' ')}: ${formatMoney(amount)}\n`;
    }
    text += `\n`;
  }
  
  if (total === 0) {
    text = '📊 Aucun investissement. Commencez avec /bank stocks list';
  } else {
    text += `💰 TOTAL INVESTI: ${formatMoney(total)}`;
  }
  
  return bot.sendMessage(chatId, text, {
    reply_to_message_id: msg.message_id
  });
}

async function showMarket(chatId, bot, msg) {
  let text = fonts.sansSerif(`📊 MARCHE FINANCIER\n━━━━━━━━━━━━━━\n\n`);
  
  text += `📈 ACTIONS:\n`;
  for (const [sym, data] of Object.entries(MARKET_DATA.stocks).slice(0, 4)) {
    text += `• ${sym}: $${data.price} (${data.change > 0 ? '+' : ''}${data.change}%)\n`;
  }
  
  text += `\n₿ CRYPTO:\n`;
  for (const [sym, data] of Object.entries(MARKET_DATA.crypto).slice(0, 4)) {
    text += `• ${sym}: $${data.price} (${data.change > 0 ? '+' : ''}${data.change}%)\n`;
  }
  
  text += `\n🏛️ OBLIGATIONS:\n`;
  for (const [type, data] of Object.entries(MARKET_DATA.bonds).slice(0, 3)) {
    text += `• ${type.replace(/_/g, ' ')}: ${data.yield}% (${data.risk})\n`;
  }
  
  return bot.sendMessage(chatId, text, {
    reply_to_message_id: msg.message_id
  });
}

async function handleDividend(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  let total = 0;
  
  for (const [sym, shares] of Object.entries(user.stocks || {})) {
    total += shares * 5;
  }
  
  for (const [type, amount] of Object.entries(user.bonds || {})) {
    const yieldRate = MARKET_DATA.bonds[type]?.yield || 2.5;
    total += amount * (yieldRate / 100) / 12;
  }
  
  if (total === 0) {
    return bot.sendMessage(chatId, '💰 Aucun dividende. Investissez dans des actions ou obligations.', {
      reply_to_message_id: msg.message_id
    });
  }
  
  total = Math.floor(total);
  user.bank = (user.bank || 0) + total;
  user.transactions = user.transactions || [];
  user.transactions.push({
    type: 'dividend',
    amount: total,
    date: Date.now(),
    description: 'Dividendes percus'
  });
  await bankService.saveUser(userId, user);
  
  const message = fonts.sansSerif(
`💰 DIVIDENDES PERCUS
━━━━━━━━━━━━━━
Montant: ${formatMoney(total)}
🏦 Nouveau solde: ${formatMoney(user.bank)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleBusiness(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`🏢 ENTREPRISES\n━━━━━━━━━━━━━━\n\n`);
    for (const [type, data] of Object.entries(MARKET_DATA.businesses)) {
      text += `🏢 ${data.name}\n   Cout: ${formatMoney(data.cost)}\n   Revenu mensuel: ${formatMoney(data.income)}\n   Employes: ${data.employees}\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOS ENTREPRISES:\n`;
    if (user.businesses?.length === 0) {
      text += 'Aucune\n\n';
    } else {
      user.businesses.forEach((b, i) => {
        text += `${i+1}. ${b.name} (Niv.${b.level})\n`;
      });
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank business buy <type>\n• /bank business collect`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const type = args[2]?.toUpperCase();
    if (!type || !MARKET_DATA.businesses[type]) {
      return bot.sendMessage(chatId, '❌ Type invalide.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const data = MARKET_DATA.businesses[type];
    const user = await bankService.getUser(userId);
    if (user.bank < data.cost) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - data.cost;
    user.businesses = user.businesses || [];
    user.businesses.push({
      type,
      name: data.name,
      level: 1,
      revenue: data.income,
      employees: data.employees,
      established: Date.now(),
      lastCollected: Date.now()
    });
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'business_purchase',
      amount: data.cost,
      date: Date.now(),
      description: `Achat ${data.name}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`✅ ENTREPRISE ACHETEE
━━━━━━━━━━━━━━
🏢 ${data.name} pour ${formatMoney(data.cost)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "collect") {
    const user = await bankService.getUser(userId);
    if (user.businesses?.length === 0) {
      return bot.sendMessage(chatId, '❌ Vous n\'avez pas d\'entreprise.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    let total = 0;
    const now = Date.now();
    user.businesses.forEach(b => {
      const elapsed = now - (b.lastCollected || b.established);
      const hours = elapsed / (1000 * 60 * 60);
      const income = Math.floor((b.revenue / 30 / 24) * hours * b.level);
      if (income > 0) {
        total += income;
        b.lastCollected = now;
      }
    });
    
    if (total === 0) {
      return bot.sendMessage(chatId, '💼 Pas de revenu à collecter pour l\'instant.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) + total;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'business_income',
      amount: total,
      date: now,
      description: 'Revenus entreprises'
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`💼 REVENUS D'ENTREPRISE
━━━━━━━━━━━━━━
Total: ${formatMoney(total)}
🏦 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleShop(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    const items = {
      "CREDIT_BOOST": { price: 50000, name: "Boost de credit (+50 points)", desc: "Augmente votre score de credit de 50 points" },
      "MULTIPLIER": { price: 1000000, name: "Multiplicateur 1.5x (7 jours)", desc: "Augmente tous vos gains de 50% pendant 7 jours" },
      "INSURANCE_BUNDLE": { price: 100000, name: "Pack assurance complet", desc: "Toutes les assurances à prix reduit" },
      "LOTTERY_PACK": { price: 5000, name: "Pack loterie (100 tickets)", desc: "100 tickets de loterie" },
      "SKILL_BOOST": { price: 25000, name: "Boost competences (+10)", desc: "Augmente toutes vos competences de 10 niveaux" },
      "PREMIUM_TRIAL": { price: 100000, name: "Essai Premium (30 jours)", desc: "Debloque les fonctionnalites premium pour 30 jours" }
    };
    
    let text = fonts.sansSerif(`🛒 BOUTIQUE\n━━━━━━━━━━━━━━\n\n`);
    for (const [id, it] of Object.entries(items)) {
      text += `🛍️ ${it.name}\n   Prix: ${formatMoney(it.price)}\n   ${it.desc}\n\n`;
    }
    text += `Utilisation: /bank shop buy <ID>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const itemId = args[2]?.toUpperCase();
    const items = {
      "CREDIT_BOOST": { price: 50000, name: "Boost de credit (+50 points)" },
      "MULTIPLIER": { price: 1000000, name: "Multiplicateur 1.5x (7 jours)" },
      "INSURANCE_BUNDLE": { price: 100000, name: "Pack assurance complet" },
      "LOTTERY_PACK": { price: 5000, name: "Pack loterie (100 tickets)" },
      "SKILL_BOOST": { price: 25000, name: "Boost competences (+10)" },
      "PREMIUM_TRIAL": { price: 100000, name: "Essai Premium (30 jours)" }
    };
    
    if (!itemId || !items[itemId]) {
      return bot.sendMessage(chatId, '❌ Article invalide.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const item = items[itemId];
    const user = await bankService.getUser(userId);
    if (user.bank < item.price) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - item.price;
    
    switch (itemId) {
      case "CREDIT_BOOST":
        user.creditScore = Math.min(850, (user.creditScore || 0) + 50);
        break;
      case "MULTIPLIER":
        user.multiplier = 1.5;
        break;
      case "INSURANCE_BUNDLE":
        user.insurance = {
          LIFE: { active: true, coverage: 100000, purchased: Date.now() },
          HEALTH: { active: true, coverage: 50000, purchased: Date.now() },
          PROPERTY: { active: true, coverage: 200000, purchased: Date.now() },
          BUSINESS: { active: true, coverage: 500000, purchased: Date.now() },
          THEFT: { active: true, coverage: 75000, purchased: Date.now() }
        };
        break;
      case "LOTTERY_PACK":
        user.lotteryTickets = (user.lotteryTickets || 0) + 100;
        break;
      case "SKILL_BOOST":
        user.skills = user.skills || {};
        user.skills.trading = (user.skills.trading || 0) + 10;
        user.skills.business = (user.skills.business || 0) + 10;
        user.skills.investing = (user.skills.investing || 0) + 10;
        user.skills.gambling = (user.skills.gambling || 0) + 10;
        break;
      case "PREMIUM_TRIAL":
        user.premium = true;
        user.multiplier = 2.0;
        break;
    }
    
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'shop_purchase',
      amount: item.price,
      date: Date.now(),
      description: `Achat ${item.name}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`✅ ACHAT EFFECTUE
━━━━━━━━━━━━━━
🛍️ ${item.name} pour ${formatMoney(item.price)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleProperty(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`🏠 IMMOBILIER\n━━━━━━━━━━━━━━\n\n`);
    for (const [type, data] of Object.entries(MARKET_DATA.properties)) {
      text += `🏠 ${data.name}\n   Prix: ${formatMoney(data.price)}\n   Loyer mensuel: ${formatMoney(data.income)}\n   ROI annuel: ${Math.round((data.income * 12 / data.price) * 100)}%\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOS BIENS:\n`;
    if (user.realEstate?.length === 0) {
      text += 'Aucun\n\n';
    } else {
      user.realEstate.forEach((p, i) => {
        text += `${i+1}. ${p.name} - ${formatMoney(p.value)}\n`;
      });
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank property buy <type>\n• /bank rent`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const type = args[2]?.toUpperCase();
    if (!type || !MARKET_DATA.properties[type]) {
      return bot.sendMessage(chatId, '❌ Type invalide.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const data = MARKET_DATA.properties[type];
    const user = await bankService.getUser(userId);
    if (user.bank < data.price) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - data.price;
    user.realEstate = user.realEstate || [];
    user.realEstate.push({
      type,
      name: data.name,
      value: data.price,
      income: data.income,
      purchased: Date.now(),
      lastRentCollected: Date.now()
    });
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'property_purchase',
      amount: data.price,
      date: Date.now(),
      description: `Achat ${data.name}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`✅ PROPRIETE ACHETEE
━━━━━━━━━━━━━━
🏠 ${data.name} pour ${formatMoney(data.price)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleRent(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  if (user.realEstate?.length === 0) {
    return bot.sendMessage(chatId, '❌ Vous n\'avez pas de propriété.', {
      reply_to_message_id: msg.message_id
    });
  }
  
  let total = 0;
  const now = Date.now();
  user.realEstate.forEach(p => {
    const elapsed = now - (p.lastRentCollected || p.purchased);
    const hours = elapsed / (1000 * 60 * 60);
    const rent = Math.floor((p.income / 30 / 24) * hours);
    if (rent > 0) {
      total += rent;
      p.lastRentCollected = now;
    }
  });
  
  if (total === 0) {
    return bot.sendMessage(chatId, '🏠 Pas de loyer à collecter pour l\'instant.', {
      reply_to_message_id: msg.message_id
    });
  }
  
  user.bank = (user.bank || 0) + total;
  user.transactions = user.transactions || [];
  user.transactions.push({
    type: 'rental_income',
    amount: total,
    date: now,
    description: 'Loyers percus'
  });
  await bankService.saveUser(userId, user);
  
  const message = fonts.sansSerif(
`🏠 LOYERS PERCUS
━━━━━━━━━━━━━━
Total: ${formatMoney(total)}
🏦 Nouveau solde: ${formatMoney(user.bank)}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleLuxury(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`💎 LUXE\n━━━━━━━━━━━━━━\n\n`);
    for (const [type, data] of Object.entries(MARKET_DATA.luxury)) {
      text += `💎 ${data.name}\n   Prix: ${formatMoney(data.price)}\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOS OBJETS:\n`;
    if (user.luxury?.length === 0) {
      text += 'Aucun\n\n';
    } else {
      user.luxury.forEach((l, i) => {
        text += `${i+1}. ${l.name} - ${formatMoney(l.value)}\n`;
      });
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank luxury buy <type>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const type = args[2]?.toUpperCase();
    if (!type || !MARKET_DATA.luxury[type]) {
      return bot.sendMessage(chatId, '❌ Type invalide.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const data = MARKET_DATA.luxury[type];
    const user = await bankService.getUser(userId);
    if (user.bank < data.price) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - data.price;
    user.luxury = user.luxury || [];
    user.luxury.push({
      type,
      name: data.name,
      value: data.price,
      purchased: Date.now()
    });
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'luxury_purchase',
      amount: data.price,
      date: Date.now(),
      description: `Achat ${data.name}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`✅ OBJET ACHETE
━━━━━━━━━━━━━━
💎 ${data.name} pour ${formatMoney(data.price)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleCar(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    let text = fonts.sansSerif(`🚗 VEHICULES\n━━━━━━━━━━━━━━\n\n`);
    for (const [type, data] of Object.entries(MARKET_DATA.vehicles)) {
      text += `🚗 ${data.name}\n   Prix: ${formatMoney(data.price)}\n   Depreciation annuelle: ${Math.round((1 - data.depreciation) * 100)}%\n\n`;
    }
    
    const user = await bankService.getUser(userId);
    text += `📦 VOS VEHICULES:\n`;
    if (user.vehicles?.length === 0) {
      text += 'Aucun\n\n';
    } else {
      user.vehicles.forEach((v, i) => {
        text += `${i+1}. ${v.name} - ${formatMoney(v.currentValue)}\n`;
      });
      text += '\n';
    }
    
    text += `Utilisation:\n• /bank car buy <type>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const type = args[2]?.toUpperCase();
    if (!type || !MARKET_DATA.vehicles[type]) {
      return bot.sendMessage(chatId, '❌ Type invalide.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const data = MARKET_DATA.vehicles[type];
    const user = await bankService.getUser(userId);
    if (user.bank < data.price) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - data.price;
    user.vehicles = user.vehicles || [];
    user.vehicles.push({
      type,
      name: data.name,
      purchasePrice: data.price,
      currentValue: data.price,
      depreciation: data.depreciation,
      purchased: Date.now()
    });
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'vehicle_purchase',
      amount: data.price,
      date: Date.now(),
      description: `Achat ${data.name}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`✅ VEHICULE ACHETE
━━━━━━━━━━━━━━
🚗 ${data.name} pour ${formatMoney(data.price)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleGamble(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide. Utilisez /bank gamble <montant>', {
      reply_to_message_id: msg.message_id
    });
  }

  const user = await bankService.getUser(userId);
  if (amount > (user.money || 0)) {
    return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
      reply_to_message_id: msg.message_id
    });
  }

  const win = Math.random() < 0.45 + (user.skills?.gambling || 0) * 0.01;
  
  if (win) {
    const multiplier = Math.random() < 0.1 ? 3 : 2;
    const winnings = amount * multiplier;
    const net = winnings - amount;
    user.money = (user.money || 0) + net;
    user.skills = user.skills || {};
    user.skills.gambling = (user.skills.gambling || 0) + 1;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'gambling_win',
      amount: net,
      date: Date.now(),
      description: `Gain jeu x${multiplier}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`🎉 GAGNE !
━━━━━━━━━━━━━━
💰 Gain: ${formatMoney(net)} (x${multiplier})
💵 Nouveau solde: ${formatMoney(user.money)}
🎯 Niveau jeu: ${user.skills.gambling}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  } else {
    user.money = (user.money || 0) - amount;
    user.skills = user.skills || {};
    user.skills.gambling = (user.skills.gambling || 0) + 1;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'gambling_loss',
      amount: amount,
      date: Date.now(),
      description: 'Perte jeu'
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`💸 PERDU !
━━━━━━━━━━━━━━
💰 Perte: ${formatMoney(amount)}
💵 Nouveau solde: ${formatMoney(user.money)}
🎯 Niveau jeu: ${user.skills.gambling}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function handleSlots(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide. Utilisez /bank slots <montant>', {
      reply_to_message_id: msg.message_id
    });
  }

  try {
    const result = await gameService.slots(userId, amount);
    
    const symbolDisplay = result.symbols.join(' | ');
    const resultEmoji = result.win ? '🎉' : '💸';
    const resultText = result.win ? 'GAGNE !' : 'PERDU';
    
    const message = fonts.sansSerif(
`🎰 MACHINE A SOUS
━━━━━━━━━━━━━━
[ ${symbolDisplay} ]
━━━━━━━━━━━━━━
${resultEmoji} ${resultText}
${result.win ? `💰 Gain: ${formatMoney(result.netWinnings)} (x${result.multiplier})` : `💸 Perte: ${formatMoney(amount)}`}
━━━━━━━━━━━━━━
💰 Nouveau solde: ${formatMoney(result.newMoney)}
🎯 Niveau jeu: ${result.skillLevel}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    return bot.sendMessage(chatId, `❌ ${error.message}`, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function handleBlackjack(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide. Utilisez /bank blackjack <montant>', {
      reply_to_message_id: msg.message_id
    });
  }

  try {
    const result = await gameService.blackjack(userId, amount);
    
    const resultEmoji = result.result === 'WIN' ? '🎉' : result.result === 'PUSH' ? '🤝' : '💸';
    const resultText = result.result === 'WIN' ? 'GAGNE !' : result.result === 'PUSH' ? 'EGALITE' : 'PERDU';
    
    const message = fonts.sansSerif(
`🃏 BLACKJACK
━━━━━━━━━━━━━━
Vous: ${result.playerCards.join(' + ')} = ${result.playerTotal}
Croupier: ${result.dealerCards.join(' + ')} = ${result.dealerTotal}
━━━━━━━━━━━━━━
${resultEmoji} ${resultText}
${result.netWinnings > 0 ? `💰 Gain: ${formatMoney(result.netWinnings)}` : result.netWinnings < 0 ? `💸 Perte: ${formatMoney(Math.abs(result.netWinnings))}` : '🔄 Egalite'}
━━━━━━━━━━━━━━
💰 Nouveau solde: ${formatMoney(result.newMoney)}
🎯 Niveau jeu: ${result.skillLevel}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    return bot.sendMessage(chatId, `❌ ${error.message}`, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function handleRoulette(chatId, bot, msg, userId, args) {
  const amount = parseInt(args[1]);
  const choice = args[2]?.toLowerCase();
  
  if (isNaN(amount) || amount <= 0 || !choice) {
    return bot.sendMessage(chatId, '❌ Utilisation: /bank roulette <montant> <rouge/noir/pair/impair/manque/passe/numero>', {
      reply_to_message_id: msg.message_id
    });
  }

  try {
    const result = await gameService.roulette(userId, amount, choice);
    
    const color = result.number === 0 ? '🟢' : result.isRed ? '🔴' : '⚫';
    const resultEmoji = result.win ? '🎉' : '💸';
    const resultText = result.win ? 'GAGNE !' : 'PERDU';
    
    const message = fonts.sansSerif(
`🎯 ROULETTE
━━━━━━━━━━━━━━
Numero: ${color} ${result.number}
Mise: ${choice}
━━━━━━━━━━━━━━
${resultEmoji} ${resultText}
${result.win ? `💰 Gain: ${formatMoney(result.netWinnings)} (x${result.multiplier})` : `💸 Perte: ${formatMoney(amount)}`}
━━━━━━━━━━━━━━
💰 Nouveau solde: ${formatMoney(result.newMoney)}
🎯 Niveau jeu: ${result.skillLevel}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    return bot.sendMessage(chatId, `❌ ${error.message}`, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function handleLottery(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "buy") {
    const tickets = parseInt(args[2]) || 1;
    const price = CONFIG.lottery.ticketPrice * tickets;
    const user = await bankService.getUser(userId);
    
    if (user.bank < price) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - price;
    user.lotteryTickets = (user.lotteryTickets || 0) + tickets;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'lottery_buy',
      amount: price,
      date: Date.now(),
      description: `Achat ${tickets} tickets de loterie`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`🎫 LOTERIE
━━━━━━━━━━━━━━
${tickets} tickets achetés pour ${formatMoney(price)}
📦 Total tickets: ${user.lotteryTickets}
🎯 Tirage: /bank lottery check`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "check") {
    const user = await bankService.getUser(userId);
    if (!user.lotteryTickets || user.lotteryTickets === 0) {
      return bot.sendMessage(chatId, '❌ Vous n\'avez pas de tickets.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const winChance = Math.min(user.lotteryTickets * CONFIG.lottery.winChanceMultiplier, 0.5);
    
    if (Math.random() < winChance) {
      const prize = Math.floor(Math.random() * (CONFIG.lottery.maxPrize - CONFIG.lottery.minPrize + 1)) + CONFIG.lottery.minPrize;
      user.bank = (user.bank || 0) + prize;
      user.lotteryTickets = 0;
      user.transactions = user.transactions || [];
      user.transactions.push({
        type: 'lottery_win',
        amount: prize,
        date: Date.now(),
        description: 'Gros lot de loterie'
      });
      await bankService.saveUser(userId, user);
      
      const message = fonts.sansSerif(
`🎊 GROS LOT !
━━━━━━━━━━━━━━
💰 Vous gagnez ${formatMoney(prize)} !
🏦 Nouveau solde: ${formatMoney(user.bank)}`);

      return bot.sendMessage(chatId, message, {
        reply_to_message_id: msg.message_id
      });
    } else {
      user.lotteryTickets = 0;
      await bankService.saveUser(userId, user);
      
      return bot.sendMessage(chatId, '😞 Pas de chance cette fois. Tickets épuisés.', {
        reply_to_message_id: msg.message_id
      });
    }
  }

  return bot.sendMessage(chatId, '❌ Action inconnue. Utilisez /bank lottery [buy|check]', {
    reply_to_message_id: msg.message_id
  });
}

async function handlePremium(chatId, bot, msg, userId, args) {
  const user = await bankService.getUser(userId);
  
  if (args[1]?.toLowerCase() === "buy") {
    const cost = 1000000;
    if (user.bank < cost) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - cost;
    user.premium = true;
    user.multiplier = 2.0;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'premium_purchase',
      amount: cost,
      date: Date.now(),
      description: 'Achat premium'
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`💎 PREMIUM ACTIVE
━━━━━━━━━━━━━━
✅ Vous bénéficiez désormais du multiplicateur x2.
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }
  
  const message = fonts.sansSerif(
`💎 PREMIUM
━━━━━━━━━━━━━━
📊 Statut: ${user.premium ? '✅ Actif' : '❌ Inactif'}
⚡ Multiplicateur: ${user.multiplier}x
💰 Cout: 1 000 000

Utilisez /bank premium buy pour acheter.`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function handleVault(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  const amount = parseInt(args[2]);
  
  if (!action) {
    const user = await bankService.getUser(userId);
    const message = fonts.sansSerif(
`🔐 COFFRE
━━━━━━━━━━━━━━
💰 Solde coffre: ${formatMoney(user.vault || 0)}
📈 Taux: ${CONFIG.vault.interestRate * 100}% par mois

Utilisation:
• /bank vault deposit <montant>
• /bank vault withdraw <montant>`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }
  
  if (isNaN(amount) || amount <= 0) {
    return bot.sendMessage(chatId, '❌ Montant invalide.', {
      reply_to_message_id: msg.message_id
    });
  }
  
  const user = await bankService.getUser(userId);
  
  if (action === "deposit") {
    if (user.bank < amount) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    user.bank = (user.bank || 0) - amount;
    user.vault = (user.vault || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'vault_deposit',
      amount: amount,
      date: Date.now(),
      description: 'Dépôt coffre'
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`🔐 DEPOT COFFRE REUSSI
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
🔐 Nouveau coffre: ${formatMoney(user.vault)}
🏦 Solde banque: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }
  
  if (action === "withdraw") {
    if (user.vault < amount) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants dans le coffre.', {
        reply_to_message_id: msg.message_id
      });
    }
    user.vault = (user.vault || 0) - amount;
    user.bank = (user.bank || 0) + amount;
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'vault_withdrawal',
      amount: amount,
      date: Date.now(),
      description: 'Retrait coffre'
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`🔐 RETRAIT COFFRE REUSSI
━━━━━━━━━━━━━━
💰 Montant: ${formatMoney(amount)}
🔐 Nouveau coffre: ${formatMoney(user.vault)}
🏦 Solde banque: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }
  
  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function handleInsurance(chatId, bot, msg, userId, args) {
  const action = args[1]?.toLowerCase();
  
  if (!action || action === "list") {
    const types = {
      "LIFE": { cost: 10000, coverage: 100000, name: "Vie" },
      "HEALTH": { cost: 5000, coverage: 50000, name: "Santé" },
      "PROPERTY": { cost: 15000, coverage: 200000, name: "Propriété" },
      "BUSINESS": { cost: 25000, coverage: 500000, name: "Entreprise" },
      "THEFT": { cost: 8000, coverage: 75000, name: "Vol" }
    };
    
    const user = await bankService.getUser(userId);
    let text = fonts.sansSerif(`🛡️ ASSURANCES\n━━━━━━━━━━━━━━\n\n`);
    
    for (const [id, data] of Object.entries(types)) {
      const owned = user.insurance?.[id] ? '✅' : '❌';
      text += `🛡️ ${data.name}\n   Prix: ${formatMoney(data.cost)}\n   Couverture: ${formatMoney(data.coverage)}\n   Possedee: ${owned}\n\n`;
    }
    
    text += `Utilisation:\n/bank insurance buy <type>`;
    
    return bot.sendMessage(chatId, text, {
      reply_to_message_id: msg.message_id
    });
  }

  if (action === "buy") {
    const type = args[2]?.toUpperCase();
    const types = {
      "LIFE": { cost: 10000, coverage: 100000, name: "Vie" },
      "HEALTH": { cost: 5000, coverage: 50000, name: "Santé" },
      "PROPERTY": { cost: 15000, coverage: 200000, name: "Propriété" },
      "BUSINESS": { cost: 25000, coverage: 500000, name: "Entreprise" },
      "THEFT": { cost: 8000, coverage: 75000, name: "Vol" }
    };
    
    if (!type || !types[type]) {
      return bot.sendMessage(chatId, '❌ Type invalide.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const user = await bankService.getUser(userId);
    if (user.insurance?.[type]) {
      return bot.sendMessage(chatId, '❌ Vous possédez déjà cette assurance.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    const data = types[type];
    if (user.bank < data.cost) {
      return bot.sendMessage(chatId, '❌ Fonds insuffisants.', {
        reply_to_message_id: msg.message_id
      });
    }
    
    user.bank = (user.bank || 0) - data.cost;
    user.insurance = user.insurance || {};
    user.insurance[type] = { active: true, coverage: data.coverage, purchased: Date.now() };
    user.transactions = user.transactions || [];
    user.transactions.push({
      type: 'insurance_purchase',
      amount: data.cost,
      date: Date.now(),
      description: `Achat assurance ${data.name}`
    });
    await bankService.saveUser(userId, user);
    
    const message = fonts.sansSerif(
`🛡️ ASSURANCE ACHETEE
━━━━━━━━━━━━━━
${data.name} pour ${formatMoney(data.cost)}
💰 Nouveau solde: ${formatMoney(user.bank)}`);

    return bot.sendMessage(chatId, message, {
      reply_to_message_id: msg.message_id
    });
  }

  return bot.sendMessage(chatId, '❌ Action inconnue.', {
    reply_to_message_id: msg.message_id
  });
}

async function showCredit(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  const score = user.creditScore || 750;
  
  let rating = '🔴 Mauvais';
  if (score >= 800) rating = '🟢 Excellent';
  else if (score >= 740) rating = '🟢 Très bon';
  else if (score >= 670) rating = '🟡 Bon';
  else if (score >= 580) rating = '🟠 Correct';
  
  const message = fonts.sansSerif(
`📊 SCORE DE CREDIT
━━━━━━━━━━━━━━
📈 Score: ${score}/850 (${rating})
💰 Pret max: ${formatMoney(Math.floor(score * CONFIG.loan.maxMultiplier))}
🏦 Taux pret: ${score >= 750 ? '5%' : score >= 650 ? '7%' : '10%'}`);

  return bot.sendMessage(chatId, message, {
    reply_to_message_id: msg.message_id
  });
}

async function showAchievements(chatId, bot, msg, userId) {
  const user = await bankService.getUser(userId);
  const list = user.achievements || [];
  
  let text = fonts.sansSerif(`🏅 SUCCES\n━━━━━━━━━━━━━━\n\n`);
  if (list.length === 0) {
    text += 'Aucun succès pour l\'instant. Continuez à jouer !';
  } else {
    list.forEach((ach, i) => {
      text += `${i+1}. ${ach}\n`;
    });
  }
  
  return bot.sendMessage(chatId, text, {
    reply_to_message_id: msg.message_id
  });
}

async function showLeaderboard(chatId, bot, msg) {
  const balances = await getBalances();
  const sorted = Object.entries(balances)
    .filter(([uid, b]) => b && ((b.bank || 0) + (b.savings || 0) + (b.vault || 0)) > 0)
    .map(([uid, b]) => ({
      uid,
      wealth: (b.bank || 0) + (b.savings || 0) + (b.vault || 0),
      name: b.userName || uid.slice(0, 5)
    }))
    .sort((a, b) => b.wealth - a.wealth)
    .slice(0, 10);

  if (sorted.length === 0) {
    return bot.sendMessage(chatId, '🏆 Aucun joueur riche pour l\'instant.', {
      reply_to_message_id: msg.message_id
    });
  }

  let text = fonts.sansSerif(`🏆 CLASSEMENT\n━━━━━━━━━━━━━━\n\n`);
  sorted.forEach((user, idx) => {
    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx+1}.`;
    const tier = getTierInfo(user.wealth);
    text += `${medal} ${user.name} - ${formatMoney(user.wealth)} ${tier.badge}\n`;
  });

  return bot.sendMessage(chatId, text, {
    reply_to_message_id: msg.message_id
  });
}

async function handleRob(chatId, bot, msg, userId) {
  const targetMsg = msg.reply_to_message;
  if (!targetMsg) {
    return bot.sendMessage(chatId, '❌ Répondez au message de la personne que vous voulez voler.\nExemple: /bank rob', {
      reply_to_message_id: msg.message_id
    });
  }

  const targetId = String(targetMsg.from.id);
  const targetName = targetMsg.from.first_name || "Utilisateur";

  try {
    const result = await bankService.rob(userId, targetId, targetName);
    
    if (result.success) {
      const message = fonts.sansSerif(
`💰 VOL REUSSI !
━━━━━━━━━━━━━━
Vous avez vole ${formatMoney(result.stolen)} à ${targetName}
💰 Nouveau solde: ${formatMoney(result.newMoney)}`);

      return bot.sendMessage(chatId, message, {
        reply_to_message_id: msg.message_id
      });
    } else {
      const message = fonts.sansSerif(
`🚔 VOL RATE !
━━━━━━━━━━━━━━
Vous avez ete attrape et payez une amende de ${formatMoney(result.fine)}
💰 Nouveau solde: ${formatMoney(result.newMoney)}`);

      return bot.sendMessage(chatId, message, {
        reply_to_message_id: msg.message_id
      });
    }
  } catch (error) {
    return bot.sendMessage(chatId, `❌ ${error.message}`, {
      reply_to_message_id: msg.message_id
    });
  }
}

async function handleUnfreeze(chatId, bot, msg, userId) {
  // Seul un administrateur du bot peut dégeler un compte
  const config = require('../../config.json');
  const isAdmin = config.admin?.includes(String(userId)) || false;
  
  if (!isAdmin) {
    return bot.sendMessage(chatId, '❌ Seul un administrateur peut dégeler un compte.', {
      reply_to_message_id: msg.message_id
    });
  }

  const targetMsg = msg.reply_to_message;
  if (!targetMsg) {
    return bot.sendMessage(chatId, '❌ Répondez au message de l\'utilisateur à dégeler.', {
      reply_to_message_id: msg.message_id
    });
  }

  const targetId = String(targetMsg.from.id);
  const user = await bankService.getUser(targetId);
  user.frozen = false;
  await bankService.saveUser(targetId, user);

  return bot.sendMessage(chatId, `✅ Compte de ${targetMsg.from.first_name} dégelé.`, {
    reply_to_message_id: msg.message_id
  });
}

// ===================== EXPORT =====================
module.exports = { onStart, nix };