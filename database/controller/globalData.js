// database/controller/globalData.js

module.exports = function (globalModel) {
	async function get(key, defaultValue) {
		const row = await globalModel.findOne({ key }).lean();
		return row ? row.data : defaultValue;
	}

	async function set(key, data) {
		const row = await globalModel.findOneAndUpdate(
			{ key },
			{ key, data },
			{ new: true, upsert: true }
		).lean();
		return row.data;
	}

	async function remove(key) {
		return globalModel.deleteOne({ key });
	}

	return { get, set, remove };
};

