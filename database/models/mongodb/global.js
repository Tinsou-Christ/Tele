// database/models/mongodb/global.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const globalSchema = new Schema({
	key: {
		type: String,
		required: true,
		unique: true
	},
	data: {
		type: Object,
		default: {}
	}
}, {
	timestamps: true,
	minimize: false
});

module.exports = mongoose.models.globals || mongoose.model("globals", globalSchema);

