'use strict';

const express = require('express');
const cookieParser = require('cookie-parser');
const https = require('https');
const opn = require('opn');
const fs = require('fs');
const process = require('process');

const app = express();
app.use(express.json());
app.use(cookieParser());

const USERS = {
	'beta': { username: 'beta', password: 'beta' },
};
let origin;

const cors = (req, res, next) => {
	res.set({
		'Access-Control-Allow-Origin': origin,
		'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Allow-Credentials': 'true',
	});
	if (req.method === 'OPTIONS') {
		res.end();
		return;
	}
	next();
};

const cookieOptions = path => ({
	httpOnly: 'true',
	sameSite: 'none',
	secure: 'true',
	path,
});

const login = path => (req, res, next) => {
	const user = USERS[req.body.username]
	if (user && user.password === req.body.password) {
		res.cookie(
			'authorization',
			Buffer.from(`${req.body.username}:${req.body.password}`, 'ascii').toString('base64'),
			cookieOptions(path)
		);
		res.end();
		return;
	}
	res.status(401);
	res.end();
};

const logout = path => (req, res, next) => {
	res.clearCookie('authorization', cookieOptions(path));
	res.end();
};

const auth = (req, res, next) => {
	const auth = req.cookies.authorization;
	const credentials = auth && Buffer.from(auth, 'base64').toString('ascii').split(':');
	const user = USERS[credentials?.[0]];
	const access = user && user.password === credentials?.[1];
	if (!access) {
		res.status(401);
		res.end();
		return;
	}
	next();
};

const ok = (req, res) => {
	res.end();
};

app.use(express.static('../proto'));
app.use(cors);

app.use('/media-pub/api/login', ok);
app.use('/media-pub/api/logout', ok);
app.use('/media-pub', express.static('media'));

app.use('/media-priv/api/login', login('/media-priv/'));
app.use('/media-priv/api/logout', logout('/media-priv/'));
app.use('/media-priv', auth, express.static('media'));

const port = parseInt(process.argv[2], 10) || 0;
const server = https.createServer({
	key: fs.readFileSync('cert/key.pem'),
	cert: fs.readFileSync('cert/cert.pem'),
}, app).listen(port, () => {
	origin = `https://127.0.0.1:${server.address().port}`;
	console.log(`Listening at ${origin} ...`);
	if (port === 0) opn(url);
});
