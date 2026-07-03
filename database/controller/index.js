// database/controller/index.js
// Ce fichier n'existait pas du tout dans le projet Telegram : c'est lui qui,
// chez Botbot/Goatbot, connecte réellement Mongo et expose global.db.
// Sans lui, connectMongoDB.js n'était jamais appelé.

module.exports = async function (config) {
	const mongoConfig = config.mongoDB || {};

	if (!mongoConfig.enabled) {
		console.log("[DATABASE] MongoDB désactivé dans config.json (mongoDB.enabled = false).");
		return null;
	}

	if (!mongoConfig.url) {
		console.error("[DATABASE] mongoDB.enabled = true mais mongoDB.url est vide dans config.json.");
		return null;
	}

	try {
		const { threadModel, userModel, dashBoardModel, globalModel } =
			await require("../connectDB/connectMongoDB.js")(mongoConfig.url, mongoConfig.dbName);

		const usersData = require("./usersData.js")(userModel);
		const threadsData = require("./threadsData.js")(threadModel);
		const globalData = require("./globalData.js")(globalModel);

		global.db = {
			threadModel,
			userModel,
			dashBoardModel,
			globalModel,
			usersData,
			threadsData,
			globalData
		};

		console.log("[DATABASE] ✅ Connecté à MongoDB avec succès.");
		return global.db;
	}
	catch (err) {
		console.error("[DATABASE] ❌ Échec de connexion à MongoDB :", err.message);
		// On ne fait pas planter tout le process : le bot peut continuer sans DB
		// si tu préfères un arrêt strict, remplace la ligne suivante par process.exit(1)
		return null;
	}
};
