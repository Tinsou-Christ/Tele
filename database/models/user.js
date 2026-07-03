// database/models/mongodb/user.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema({
	userID: {
		type: String,
		required: true,
		unique: true,
		trim: true
	},
	username: {
		type: String,
		trim: true,
		default: ""
	},
	first_name: {
		type: String,
		trim: true,
		default: ""
	},
	last_name: {
		type: String,
		trim: true,
		default: ""
	},
	name: {
		type: String,
		trim: true,
		default: ""
	},
	money: {
		type: Number,
		default: 0
	},
	exp: {
		type: Number,
		default: 0
	},
	banned: {
		type: Object,
		default: { status: false, reason: "" }
	},
	settings: {
		type: Object,
		default: {}
	},
	data: {
		type: Object,
		default: {}
	}
}, {
	timestamps: true,
	minimize: false
});

module.exports = mongoose.models.users || mongoose.model("users", userSchema);
