// database/models/mongodb/thread.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const threadSchema = new Schema({
	chatId: {
		type: String,
		required: true,
		unique: true,
		trim: true
	},
	threadName: {
		type: String,
		default: ""
	},
	threadType: {
		type: String, // "private" | "group" | "supergroup" | "channel"
		default: "private"
	},
	members: {
		type: Array,
		default: []
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
	},
	totalMsg: {
		type: Number,
		default: 0
	}
}, {
	timestamps: true,
	minimize: false
});

module.exports = mongoose.models.threads || mongoose.model("threads", threadSchema);
