// database/models/mongodb/userDashBoard.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const userDashBoardSchema = new Schema({
	email: {
		type: String,
		trim: true
	},
	name: {
		type: String,
		trim: true
	},
	password: {
		type: String
	},
	telegramUserID: {
		type: String,
		default: ""
	},
	isAdmin: {
		type: Boolean,
		default: false
	}
}, {
	timestamps: true,
	minimize: false
});

module.exports = mongoose.models.usersDashboard || mongoose.model("usersDashboard", userDashBoardSchema);

