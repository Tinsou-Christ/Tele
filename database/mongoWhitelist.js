// database/mongoWhitelist.js
//
// Stockage MongoDB pour le whiteListMode (utilisé par scripts/cmds/wl.js),
// sur le même principe que database/mongoBalance.js (utilisé par telebal.js).
//
// Dans Goatbot, la commande wl.js écrit directement dans config.json via
// fs.writeFileSync (config.whiteListMode.whiteListIds / .enable). Ça marche
// en local, mais PAS sur un hébergeur comme Render : le disque est éphémère,
// donc à chaque redéploiement/redémarrage le fichier config.json repart de
// sa version d'origine (celle du repo Git) et tout ce qui avait été
// ajouté/modifié en direct est perdu.
//
// Ce module fait la même chose que mongoBalance.js : au lieu d'écrire dans
// un fichier local, il lit/écrit dans MongoDB via global.db.globalData
// (database/controller/globalData.js), donc les données survivent aux
// redéploiements, exactement comme le solde de telebal.js.
//
// La donnée est stockée sous une seule clé globale ("whiteListMode") avec
// la forme : { enable: false, whiteListIds: [] }

const KEY = "whiteListMode";
const DEFAULT_DATA = { enable: false, whiteListIds: [] };

function ensureDbReady() {
	if (!global.db || !global.db.globalData) {
		throw new Error(
			"MongoDB n'est pas connecté (global.db.globalData indisponible). " +
			"Vérifie que mongoDB.enabled = true dans config.json et que la connexion a réussi au démarrage."
		);
	}
}

/**
 * Récupère { enable, whiteListIds } depuis MongoDB.
 * Si rien n'existe encore, retourne (et initialise) la valeur par défaut.
 */
async function getWhitelist() {
	ensureDbReady();
	const data = await global.db.globalData.get(KEY, null);
	if (!data) {
		await global.db.globalData.set(KEY, { ...DEFAULT_DATA });
		return { ...DEFAULT_DATA };
	}
	return {
		enable: !!data.enable,
		whiteListIds: Array.isArray(data.whiteListIds) ? data.whiteListIds : []
	};
}

/**
 * Sauvegarde { enable, whiteListIds } dans MongoDB.
 */
async function saveWhitelist(data) {
	ensureDbReady();
	const toSave = {
		enable: !!data.enable,
		whiteListIds: Array.isArray(data.whiteListIds) ? [...new Set(data.whiteListIds.map(String))] : []
	};
	await global.db.globalData.set(KEY, toSave);
	return toSave;
}

module.exports = {
	getWhitelist,
	saveWhitelist
};
