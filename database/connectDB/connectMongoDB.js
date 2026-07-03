// database/connectDB/connectMongoDB.js
module.exports = async function (uriConnect, dbName) {
	const mongoose = require("mongoose");
	mongoose.set("strictQuery", false);

	// ⚠️ Ces require pointaient vers "../models/mongodb/*.js" qui n'existait pas.
	// Les modèles sont maintenant bien présents dans database/models/mongodb/
	const threadModel = require("../models/mongodb/thread.js");
	const userModel = require("../models/mongodb/user.js");
	const dashBoardModel = require("../models/mongodb/userDashBoard.js");
	const globalModel = require("../models/mongodb/global.js");

	// Les options useNewUrlParser / useUnifiedTopology sont dépréciées
	// et n'existent plus dans les versions récentes de mongoose (>=6).
	await mongoose.connect(uriConnect, dbName ? { dbName } : undefined);

	return {
		threadModel,
		userModel,
		dashBoardModel,
		globalModel
	};
};
