// database/controller/threadsData.js

function getPath(obj, path, defaultValue) {
	if (!path) return obj;
	const keys = path.split(".");
	let current = obj;
	for (const key of keys) {
		if (current == null) return defaultValue;
		current = current[key];
	}
	return current === undefined ? defaultValue : current;
}

function setPath(obj, path, value) {
	const keys = path.split(".");
	let current = obj;
	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];
		if (typeof current[key] !== "object" || current[key] === null)
			current[key] = {};
		current = current[key];
	}
	current[keys[keys.length - 1]] = value;
	return obj;
}

module.exports = function (threadModel) {
	async function create(chatId, threadInfo = {}) {
		const exists = await threadModel.findOne({ chatId }).lean();
		if (exists) return exists;
		const created = await threadModel.create({ chatId, ...threadInfo });
		return created.toObject();
	}

	async function getAll() {
		return (await threadModel.find({}).lean());
	}

	async function get(chatId, path, defaultValue) {
		let thread = await threadModel.findOne({ chatId }).lean();
		if (!thread) thread = await create(chatId);
		return path ? getPath(thread, path, defaultValue) : thread;
	}

	async function set(chatId, value, path) {
		let thread = await threadModel.findOne({ chatId });
		if (!thread) thread = new threadModel({ chatId });
		if (path) {
			const plain = thread.toObject();
			setPath(plain, path, value);
			thread.set(plain);
		}
		else {
			thread.set(value);
		}
		await thread.save();
		return thread.toObject();
	}

	async function remove(chatId) {
		return threadModel.deleteOne({ chatId });
	}

	return {
		create,
		getAll,
		get,
		set,
		remove
	};
};
  
