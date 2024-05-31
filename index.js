const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Establish the connection
mongoose
	.connect(process.env.DB_URL)
	.then(() => {
		console.log('Connected to MongoDB');
	})
	.catch((error) => {
		console.error('Error connecting to MongoDB:', error.message);
		// Handle specific error conditions
		if (error.name === 'MongoNetworkError') {
			console.error('Network error occurred. Check your MongoDB server.');
		} else if (error.name === 'MongooseServerSelectionError') {
			console.error('Server selection error. Ensure' + ' MongoDB is running and accessible.');
		} else {
			// Handle other types of errors
			console.error('An unexpected error occurred:', error);
		}
	});
// Handling connection events
const db = mongoose.connection;
db.on('error', (error) => {
	console.error('MongoDB connection error:', error);
});
db.once('open', () => {
	console.log('Connected to MongoDB');
});
db.on('disconnected', () => {
	console.log('Disconnected from MongoDB');
});
// Gracefully close the connection when the application exits
process.on('SIGINT', () => {
	mongoose.connection.close(() => {
		console.log('Mongoose connection is disconnected' + ' due to application termination');
		process.exit(0);
	});
});

const UserSchema = new Schema({
	username: String,
});
const User = mongoose.model('User', UserSchema);

const ExerciseSchema = new Schema({
	user_id: { type: String, required: true },
	description: String,
	duration: Number,
	date: Date,
});
const Exercise = mongoose.model('Exercise', ExerciseSchema);

app.use(cors());
app.use(express.static('public'));
app.get('/', (req, res) => {
	res.sendFile(__dirname + '/views/index.html');
});

app.get('/api/users', async (req, res) => {
	const users = await User.find({}).select('_id username');
	if (!users) {
		res.send('No users');
	} else {
		res.json(users);
	}
});

app.get('/api/users/:_id/logs', async (req, res) => {
	const { from, to, limit } = req.query;
	const id = req.params._id;
	const user = await User.findById(id);
	if (!user) {
		res.send('Could not find user');
		return;
	}
	let dateObj = {};
	if (from) {
		dateObj['$gte'] = new Date(from);
	}
	if (to) {
		dateObj['$lte'] = new Date(to);
	}
	let filter = {
		user_id: id,
	};
	if (from || to) {
		filter.date = dateObj;
	}

	const exercises = await Exercise.find(filter).limit(+limit ?? 500);

	const log = exercises.map((e) => ({
		description: e.description,
		duration: e.duration,
		date: e.date.toDateString(),
	}));

	res.json({
		username: user.username,
		count: exercises.length,
		_id: user._id,
		log,
	});
});

app.use(express.urlencoded({ extended: true }));
app.post('/api/users', async (req, res) => {
	console.log(req.body);
	const userObj = new User({
		username: req.body.username,
	});

	try {
		const user = await userObj.save();
		console.log(user);
		res.json(user);
	} catch (error) {
		console.error(error);
	}
});

app.post('/api/users/:_id/exercises', async (req, res) => {
	const id = req.params._id;
	const { description, duration, date } = req.body;
	try {
		const user = await User.findById(id);

		if (!user) {
			res.send('Could not find user');
		} else {
			const exerciseObj = new Exercise({
				user_id: user._id,
				description,
				duration,
				date: date ? new Date(date) : new Date(),
			});
			const exercise = await exerciseObj.save();
			res.json({
				_id: user._id,
				username: user.username,
				description: exercise.description,
				duration: exercise.duration,
				date: new Date(exercise.date).toDateString(),
			});
		}
	} catch (error) {
		console.error(error);
		res.send('There was an error saving the exercise');
	}
});

const listener = app.listen(process.env.PORT || 3000, () => {
	console.log('Your app is listening on port ' + listener.address().port);
});
