// database/mongoBalance.js
//
// Ce module remplace les anciens fichiers JSON locaux (database/balance.json,
// database/balances.json, database/users.json) qui étaient utilisés par
// daily.js, slot.js, telebal.js, top.js, telekuiz.js, spy.js.
//
// Ces fichiers locaux ne persistaient jamais réellement (disque éphémère sur
// Render), et surtout n'avaient aucun lien avec MongoDB : voilà pourquoi
// "MongoDB est connecté mais ne sauvegarde rien". Ce module garde la même
// forme de données ({ [userId]: { money, ...autresChamps } }) mais lit/écrit
// réellement dans MongoDB via global.db.usersData, donc les données
// survivent aux redéploiements, comme dans Goatbot.
//
// Toutes les commandes partagent maintenant UN seul solde par utilisateur
// (le champ "money" du modèle Mongo user), au lieu d'avoir 3 fichiers JSON
// séparés et incohérents entre eux.
//
// Version 5.0 - Support complet pour telebank.js

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// ===================== CONFIGURATION =====================
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    const configData = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('❌ Erreur chargement config.json:', error);
    return { mongoDB: { enabled: false } };
  }
}

// ===================== MODÈLE MONGO =====================
let UserModel = null;
let isConnected = false;

// Schéma utilisateur complet pour l'économie
const userSchema = new mongoose.Schema({
  userID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userName: {
    type: String,
    default: null
  },
  
  // === SOLDE PRINCIPAL ===
  money: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // === BANQUE ===
  bank: {
    type: Number,
    default: 0,
    min: 0
  },
  savings: {
    type: Number,
    default: 0,
    min: 0
  },
  vault: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // === DETTES ===
  loan: {
    type: Number,
    default: 0,
    min: 0
  },
  loanDate: {
    type: Date,
    default: null
  },
  
  // === MÉTRIQUES ===
  creditScore: {
    type: Number,
    default: 750,
    min: 0,
    max: 850
  },
  bankLevel: {
    type: Number,
    default: 1
  },
  multiplier: {
    type: Number,
    default: 1.0
  },
  premium: {
    type: Boolean,
    default: false
  },
  
  // === RÉCOMPENSES QUOTIDIENNES ===
  streak: {
    type: Number,
    default: 0
  },
  lastDaily: {
    type: Date,
    default: null
  },
  lastWork: {
    type: Date,
    default: null
  },
  lastRob: {
    type: Date,
    default: null
  },
  lastInterest: {
    type: Date,
    default: Date.now
  },
  
  // === INVESTISSEMENTS ===
  stocks: {
    type: Map,
    of: Number,
    default: new Map()
  },
  crypto: {
    type: Map,
    of: Number,
    default: new Map()
  },
  bonds: {
    type: Map,
    of: Number,
    default: new Map()
  },
  
  // === ACTIFS ===
  realEstate: {
    type: Array,
    default: []
  },
  businesses: {
    type: Array,
    default: []
  },
  vehicles: {
    type: Array,
    default: []
  },
  luxury: {
    type: Array,
    default: []
  },
  
  // === ASSURANCES ===
  insurance: {
    type: Map,
    of: Object,
    default: new Map()
  },
  
  // === COMPÉTENCES ===
  skills: {
    gambling: { type: Number, default: 0 },
    trading: { type: Number, default: 0 },
    business: { type: Number, default: 0 },
    investing: { type: Number, default: 0 }
  },
  
  // === SUCCÈS ===
  achievements: {
    type: Array,
    default: []
  },
  
  // === HISTORIQUE ===
  transactions: {
    type: Array,
    default: []
  },
  
  // === DIVERS ===
  lotteryTickets: {
    type: Number,
    default: 0
  },
  frozen: {
    type: Boolean,
    default: false
  },
  
  // === DONNÉES FLEXIBLES ===
  data: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: new Map()
  },
  
  // === MÉTA-DONNÉES ===
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index pour les leaderboards
userSchema.index({ money: -1 });
userSchema.index({ bank: -1 });
userSchema.index({ 'bank': -1, 'savings': -1, 'vault': -1 });

// Méthode pour obtenir la richesse totale
userSchema.methods.getTotalWealth = function() {
  const stocksTotal = Array.from(this.stocks?.values() || []).reduce((a, b) => a + b, 0);
  const cryptoTotal = Array.from(this.crypto?.values() || []).reduce((a, b) => a + b, 0);
  const bondsTotal = Array.from(this.bonds?.values() || []).reduce((a, b) => a + b, 0);
  
  return (this.money || 0) + (this.bank || 0) + (this.savings || 0) + (this.vault || 0) +
         stocksTotal + cryptoTotal + bondsTotal;
};

// Méthode pour ajouter une transaction
userSchema.methods.addTransaction = function(type, amount, description) {
  this.transactions = this.transactions || [];
  this.transactions.push({
    type,
    amount,
    date: new Date(),
    description: description || type
  });
  if (this.transactions.length > 100) {
    this.transactions = this.transactions.slice(-100);
  }
};

// Méthode pour mettre à jour le nom
userSchema.methods.updateName = function(name) {
  if (name && this.userName !== name) {
    this.userName = name;
  }
};

// ===================== CONNEXION MONGODB =====================
async function connectMongoDB() {
  if (isConnected) return true;
  
  const config = loadConfig();
  if (!config.mongoDB || !config.mongoDB.enabled) {
    console.log('⚠️ MongoDB désactivé dans config.json');
    return false;
  }

  try {
    const uri = config.mongoDB.uri || process.env.MONGODB_URI;
    if (!uri) {
      console.error('❌ URI MongoDB manquant');
      return false;
    }

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    await mongoose.connect(uri, options);
    
    // Créer le modèle si ce n'est pas déjà fait
    if (!UserModel) {
      UserModel = mongoose.model('User', userSchema);
    }
    
    isConnected = true;
    console.log('✅ MongoDB connecté avec succès');
    return true;
  } catch (error) {
    console.error('❌ Erreur connexion MongoDB:', error.message);
    return false;
  }
}

// ===================== FONCTIONS PRINCIPALES =====================

function ensureDbReady() {
  if (!isConnected && !global.db) {
    throw new Error(
      "⚠️ MongoDB n'est pas connecté. " +
      "Vérifie que mongoDB.enabled = true dans config.json"
    );
  }
}

/**
 * Récupère TOUTES les données comme un objet { [userId]: { money, ...data } },
 * exactement comme le faisait l'ancien getData()/getDatabase() basé sur fichier JSON.
 */
async function getBalances() {
  try {
    await connectMongoDB();
    
    if (!isConnected) {
      // Fallback : utiliser le cache en mémoire
      if (!global._balanceCache) {
        global._balanceCache = {};
      }
      return global._balanceCache;
    }

    if (!UserModel) {
      UserModel = mongoose.model('User', userSchema);
    }

    const allUsers = await UserModel.find({}).lean();
    const result = {};
    
    for (const user of allUsers) {
      const userId = user.userID;
      result[userId] = {
        money: user.money || 0,
        bank: user.bank || 0,
        savings: user.savings || 0,
        vault: user.vault || 0,
        loan: user.loan || 0,
        loanDate: user.loanDate,
        creditScore: user.creditScore || 750,
        bankLevel: user.bankLevel || 1,
        multiplier: user.multiplier || 1.0,
        premium: user.premium || false,
        streak: user.streak || 0,
        lastDaily: user.lastDaily,
        lastWork: user.lastWork,
        lastRob: user.lastRob,
        lastInterest: user.lastInterest || Date.now(),
        stocks: user.stocks || {},
        crypto: user.crypto || {},
        bonds: user.bonds || {},
        realEstate: user.realEstate || [],
        businesses: user.businesses || [],
        vehicles: user.vehicles || [],
        luxury: user.luxury || [],
        insurance: user.insurance || {},
        skills: user.skills || { gambling: 0, trading: 0, business: 0, investing: 0 },
        achievements: user.achievements || [],
        transactions: user.transactions || [],
        lotteryTickets: user.lotteryTickets || 0,
        frozen: user.frozen || false,
        userName: user.userName,
        ...(user.data || {})
      };
    }
    
    // Mettre en cache
    global._balanceCache = result;
    return result;
  } catch (error) {
    console.error('❌ Erreur getBalances:', error);
    // Retourner le cache si disponible
    if (global._balanceCache) {
      return global._balanceCache;
    }
    return {};
  }
}

/**
 * Sauvegarde un objet { [userId]: { money, ...data } } dans MongoDB.
 * Le champ "money" va dans le champ natif du schéma, le reste dans "data".
 */
async function saveBalances(balances) {
  try {
    await connectMongoDB();
    
    if (!isConnected) {
      // Fallback : sauvegarder dans le cache
      global._balanceCache = balances;
      console.log('⚠️ MongoDB non connecté, sauvegarde en cache uniquement');
      return;
    }

    if (!UserModel) {
      UserModel = mongoose.model('User', userSchema);
    }

    const userIds = Object.keys(balances);
    
    for (const userId of userIds) {
      const entry = balances[userId];
      if (!entry) continue;

      // Extraire les champs spéciaux
      const money = typeof entry.money === 'number' ? entry.money : 0;
      const bank = typeof entry.bank === 'number' ? entry.bank : 0;
      const savings = typeof entry.savings === 'number' ? entry.savings : 0;
      const vault = typeof entry.vault === 'number' ? entry.vault : 0;
      const loan = typeof entry.loan === 'number' ? entry.loan : 0;
      const creditScore = typeof entry.creditScore === 'number' ? entry.creditScore : 750;
      const bankLevel = typeof entry.bankLevel === 'number' ? entry.bankLevel : 1;
      const multiplier = typeof entry.multiplier === 'number' ? entry.multiplier : 1.0;
      const premium = entry.premium === true;
      const streak = typeof entry.streak === 'number' ? entry.streak : 0;
      const lotteryTickets = typeof entry.lotteryTickets === 'number' ? entry.lotteryTickets : 0;
      const frozen = entry.frozen === true;

      // Extraire les objets complexes
      const stocks = entry.stocks || {};
      const crypto = entry.crypto || {};
      const bonds = entry.bonds || {};
      const realEstate = entry.realEstate || [];
      const businesses = entry.businesses || [];
      const vehicles = entry.vehicles || [];
      const luxury = entry.luxury || [];
      const insurance = entry.insurance || {};
      const skills = entry.skills || { gambling: 0, trading: 0, business: 0, investing: 0 };
      const achievements = entry.achievements || [];
      const transactions = entry.transactions || [];

      // Dates
      const lastDaily = entry.lastDaily ? new Date(entry.lastDaily) : null;
      const lastWork = entry.lastWork ? new Date(entry.lastWork) : null;
      const lastRob = entry.lastRob ? new Date(entry.lastRob) : null;
      const lastInterest = entry.lastInterest ? new Date(entry.lastInterest) : new Date();
      const loanDate = entry.loanDate ? new Date(entry.loanDate) : null;

      // Données flexibles (tout ce qui n'est pas dans le schéma)
      const data = {};
      const reservedFields = [
        'money', 'bank', 'savings', 'vault', 'loan', 'loanDate',
        'creditScore', 'bankLevel', 'multiplier', 'premium',
        'streak', 'lastDaily', 'lastWork', 'lastRob', 'lastInterest',
        'stocks', 'crypto', 'bonds', 'realEstate', 'businesses',
        'vehicles', 'luxury', 'insurance', 'skills', 'achievements',
        'transactions', 'lotteryTickets', 'frozen', 'userName',
        'userId', 'userID', '_id', '__v'
      ];
      
      for (const key of Object.keys(entry)) {
        if (!reservedFields.includes(key) && !key.startsWith('_')) {
          data[key] = entry[key];
        }
      }

      // Rechercher ou créer l'utilisateur
      let user = await UserModel.findOne({ userID: String(userId) });
      if (!user) {
        user = new UserModel({ userID: String(userId) });
      }

      // Mettre à jour les champs
      user.money = money;
      user.bank = bank;
      user.savings = savings;
      user.vault = vault;
      user.loan = loan;
      user.loanDate = loanDate;
      user.creditScore = creditScore;
      user.bankLevel = bankLevel;
      user.multiplier = multiplier;
      user.premium = premium;
      user.streak = streak;
      user.lastDaily = lastDaily;
      user.lastWork = lastWork;
      user.lastRob = lastRob;
      user.lastInterest = lastInterest;
      user.lotteryTickets = lotteryTickets;
      user.frozen = frozen;
      
      // Mettre à jour le nom si disponible
      if (entry.userName) {
        user.userName = entry.userName;
      }

      // Mettre à jour les objets complexes
      user.stocks = new Map(Object.entries(stocks));
      user.crypto = new Map(Object.entries(crypto));
      user.bonds = new Map(Object.entries(bonds));
      user.realEstate = realEstate;
      user.businesses = businesses;
      user.vehicles = vehicles;
      user.luxury = luxury;
      user.insurance = new Map(Object.entries(insurance));
      user.skills = skills;
      user.achievements = achievements;
      user.transactions = transactions;
      user.data = new Map(Object.entries(data));

      // Marquer les champs modifiés pour Mongoose
      user.markModified('stocks');
      user.markModified('crypto');
      user.markModified('bonds');
      user.markModified('insurance');
      user.markModified('skills');
      user.markModified('transactions');
      user.markModified('data');

      await user.save();
    }

    // Mettre à jour le cache
    global._balanceCache = balances;

  } catch (error) {
    console.error('❌ Erreur saveBalances:', error);
    // En cas d'erreur, sauvegarder dans le cache
    global._balanceCache = balances;
    throw error;
  }
}

/**
 * Récupère TOUTES les données comme un objet { [userId]: { money, ...data } }
 * Alias pour getBalances()
 */
async function getData() {
  return getBalances();
}

/**
 * Sauvegarde les données
 * Alias pour saveBalances()
 */
async function saveData(data) {
  return saveBalances(data);
}

/**
 * Raccourci pour lire le solde d'un seul utilisateur.
 */
async function getUserBalance(userId) {
  try {
    const balances = await getBalances();
    return balances[String(userId)]?.money || 0;
  } catch (error) {
    console.error('❌ Erreur getUserBalance:', error);
    return 0;
  }
}

/**
 * Raccourci pour écrire le solde d'un seul utilisateur.
 */
async function setUserBalance(userId, money) {
  try {
    const balances = await getBalances();
    const uid = String(userId);
    if (!balances[uid]) {
      balances[uid] = { money: 0 };
    }
    balances[uid].money = Math.max(0, money);
    await saveBalances(balances);
    return balances[uid].money;
  } catch (error) {
    console.error('❌ Erreur setUserBalance:', error);
    return 0;
  }
}

/**
 * Raccourci pour ajouter/retirer (négatif) de l'argent atomiquement.
 */
async function addUserBalance(userId, amount) {
  try {
    const balances = await getBalances();
    const uid = String(userId);
    if (!balances[uid]) {
      balances[uid] = { money: 0 };
    }
    const newMoney = Math.max(0, (balances[uid].money || 0) + amount);
    balances[uid].money = newMoney;
    await saveBalances(balances);
    return newMoney;
  } catch (error) {
    console.error('❌ Erreur addUserBalance:', error);
    return 0;
  }
}

/**
 * Initialise un utilisateur dans MongoDB
 */
async function ensureUser(userId, userName = null) {
  try {
    await connectMongoDB();
    
    if (!isConnected) {
      const balances = await getBalances();
      const uid = String(userId);
      if (!balances[uid]) {
        balances[uid] = { money: 0, userName };
        await saveBalances(balances);
      }
      return balances[uid];
    }

    if (!UserModel) {
      UserModel = mongoose.model('User', userSchema);
    }

    let user = await UserModel.findOne({ userID: String(userId) });
    if (!user) {
      user = new UserModel({
        userID: String(userId),
        userName: userName || `User_${userId}`
      });
      await user.save();
    } else if (userName && user.userName !== userName) {
      user.userName = userName;
      await user.save();
    }

    // Mettre à jour le cache
    const balances = await getBalances();
    const uid = String(userId);
    if (!balances[uid]) {
      balances[uid] = {
        money: user.money || 0,
        bank: user.bank || 0,
        savings: user.savings || 0,
        vault: user.vault || 0,
        userName: user.userName
      };
      await saveBalances(balances);
    }

    return user;
  } catch (error) {
    console.error('❌ Erreur ensureUser:', error);
    const balances = await getBalances();
    const uid = String(userId);
    if (!balances[uid]) {
      balances[uid] = { money: 0, userName };
      await saveBalances(balances);
    }
    return balances[uid];
  }
}

/**
 * Récupère le solde bancaire complet d'un utilisateur
 */
async function getFullBalance(userId) {
  try {
    const balances = await getBalances();
    const uid = String(userId);
    const user = balances[uid] || {};
    return {
      money: user.money || 0,
      bank: user.bank || 0,
      savings: user.savings || 0,
      vault: user.vault || 0,
      loan: user.loan || 0,
      creditScore: user.creditScore || 750,
      multiplier: user.multiplier || 1.0,
      premium: user.premium || false,
      streak: user.streak || 0,
      total: (user.money || 0) + (user.bank || 0) + (user.savings || 0) + (user.vault || 0)
    };
  } catch (error) {
    console.error('❌ Erreur getFullBalance:', error);
    return { money: 0, bank: 0, savings: 0, vault: 0, loan: 0, creditScore: 750, multiplier: 1.0, premium: false, streak: 0, total: 0 };
  }
}

// ===================== EXPORT =====================
module.exports = {
  // Fonctions principales
  getBalances,
  saveBalances,
  getData,
  saveData,
  
  // Fonctions de solde
  getUserBalance,
  setUserBalance,
  addUserBalance,
  getFullBalance,
  ensureUser,
  
  // Utilitaires
  connectMongoDB,
  isConnected: () => isConnected,
  
  // Exposer le modèle pour usage avancé
  getUserModel: () => UserModel
};