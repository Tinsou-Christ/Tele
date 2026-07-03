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

function ensureDbReady() {
	if (!global.db || !global.db.usersData) {
		throw new Error(
			"MongoDB n'est pas connecté (global.db.usersData indisponible). " +
			"Vérifie que mongoDB.enabled = true dans config.json et que la connexion a réussi au démarrage."
		);
	}
}

/**
 * Récupère TOUTES les données comme un objet { [userId]: { money, ...data } },
 * exactement comme le faisait l'ancien getData()/getDatabase() basé sur fichier JSON.
 */
async function getBalances() {
	ensureDbReady();
	const allUsers = await global.db.usersData.getAll();
	const result = {};
	for (const user of allUsers) {
		result[user.userID] = {
			money: user.money || 0,
			...(user.data || {})
		};
	}
	return result;
}

/**
 * Sauvegarde un objet { [userId]: { money, ...data } } dans MongoDB.
 * Le champ "money" va dans le champ natif du schéma, le reste dans "data".
 */
async function saveBalances(balances) {
	ensureDbReady();
	const userIds = Object.keys(balances);
	for (const userId of userIds) {
		const entry = { ...balances[userId] };
		const money = typeof entry.money === "number" ? entry.money : 0;
		delete entry.money;

		let user = await global.db.userModel.findOne({ userID: String(userId) });
		if (!user) user = new global.db.userModel({ userID: String(userId) });
		user.money = money;
		user.data = { ...(user.data || {}), ...entry };
		user.markModified("data");
		await user.save();
	}
}

/** Raccourci pour lire le solde d'un seul utilisateur. */
async function getUserBalance(userId) {
	ensureDbReady();
	return global.db.usersData.get(String(userId), "money", 0);
}

/** Raccourci pour écrire le solde d'un seul utilisateur. */
async function setUserBalance(userId, money) {
	ensureDbReady();
	return global.db.usersData.set(String(userId), money, "money");
}

/** Raccourci pour ajouter/retirer (négatif) de l'argent atomiquement. */
async function addUserBalance(userId, amount) {
	ensureDbReady();
	return global.db.usersData.addMoney(String(userId), amount);
}

module.exports = {
	getBalances,
	saveBalances,
	getUserBalance,
	setUserBalance,
	addUserBalance
};
      
