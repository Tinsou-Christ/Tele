// database/controller/usersData.js
// API inspirée de Goatbot/Botbot mais simplifiée pour ce projet Telegram.

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

module.exports = function (userModel) {
	async function create(userID, userInfo = {}) {
		const exists = await userModel.findOne({ userID }).lean();
		if (exists) return exists;
		const created = await userModel.create({ userID, ...userInfo });
		return created.toObject();
	}

	async function getAll() {
		return (await userModel.find({}).lean());
	}

	async function get(userID, path, defaultValue) {
		let user = await userModel.findOne({ userID }).lean();
		if (!user) user = await create(userID);
		return path ? getPath(user, path, defaultValue) : user;
	}

	async function set(userID, value, path) {
		let user = await userModel.findOne({ userID });
		if (!user) user = new userModel({ userID });
		if (path) {
			const plain = user.toObject();
			setPath(plain, path, value);
			user.set(plain);
		}
		else {
			user.set(value);
		}
		await user.save();
		return user.toObject();
	}

	async function remove(userID) {
		return userModel.deleteOne({ userID });
	}

	async function addMoney(userID, amount) {
		const user = await userModel.findOneAndUpdate(
			{ userID },
			{ $inc: { money: amount } },
			{ new: true, upsert: true }
		).lean();
		return user.money;
	}

	async function subtractMoney(userID, amount) {
		return addMoney(userID, -Math.abs(amount));
	}

	async function getMoney(userID) {
		return get(userID, "money", 0);
	}

	return {
		create,
		getAll,
		get,
		set,
		remove,
		addMoney,
		subtractMoney,
		getMoney
	};
};
