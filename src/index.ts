import * as blessed from 'blessed';
import * as fs from 'fs';
import * as crypto from 'crypto';
import axios from 'axios';
const homedir = require('os').homedir() + '/';

const defaultconfig = {
	channels: [
		{
			name: 'main',
			key: undefined
		}
	],
	keybinds: {
		quit: ['C-c'],
		'scroll-up': ['q', 'up'],
		'scroll-down': ['e', 'down'],
		'chat-to-channel': ['tab', 'right', 'left'],
		'channel-to-chat': ['tab', 'escape', 'right', 'left'],
		'channel-to-text': ['enter'],
		'scroll-all': ['escape'],
		'exit-window': ['escape'],
		'add-channel': ['='],
		'remove-channel': ['-'],
		'enter-text': ['enter'],
		'add-history': ['+'],
		'toggle-editor': ['C-e']
	},
	userdata: undefined,
	colors: {
		main: 'blue',
		accent: 'cyan',
		background: 'black',
		foreground: 'white',
		border: 'gray'
	},
	'base-url': 'http://165.227.124.255:3000'
};

const _key = Buffer.alloc(32); // key should be 32 bytes
const _iv = Buffer.alloc(16); // iv should be 16

const channelNameList = [];

const datadir = homedir + '.nallan';
if (!fs.existsSync(datadir)) {
	fs.mkdirSync(datadir);
}

function updateConfig () {
	fs.writeFileSync(
		datadir + '/config.json',
		JSON.stringify(filedata, null, '\t')
	);
}

let filedata = defaultconfig;
if (fs.existsSync(datadir + '/config.json')) {
	filedata = JSON.parse(fs.readFileSync(datadir + '/config.json', 'utf8'));
	Object.keys(defaultconfig.keybinds).forEach((key) => {
		if (filedata.keybinds[key] === undefined) {
			filedata.keybinds[key] = defaultconfig.keybinds[key];
		}
	});
	Object.keys(defaultconfig.colors).forEach((key) => {
		if (filedata.colors[key] === undefined) {
			filedata.colors[key] = defaultconfig.colors[key];
		}
	});
} else {
	updateConfig();
}

filedata.channels.forEach(e => {
	channelNameList.push(e.name);
});

let oldChannel = '';
let scroller = 0;
const buffer = {};
function encrypt (text: string, key: string) {
	const crypkey = Buffer.concat([Buffer.from(key)], _key.length);
	const cipher = crypto.createCipheriv('AES-256-GCM', crypkey, _iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return encrypted.toString('hex');
}

function decrypt (text: string, key: string) {
	try {
		const encryptedText = Buffer.from(text, 'hex');
		const crypkey = Buffer.concat([Buffer.from(key)], _key.length);
		const decipher = crypto.createDecipheriv('AES-256-GCM', crypkey, _iv);
		let decrypted = decipher.update(encryptedText);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		return decrypted.toString();
	} catch (err) {
		return 'ERROR';
	}
}

const screen = blessed.screen({
	title: 'NallanChat CLI',
	smartCSR: true,
	fullUnicode: true,
	forceUnicode: true,
	cursor: {
		artificial: true,
		shape: 'line',
		blink: true,
		color: null // null for default
	}
});

const chatbox = blessed.box({
	scrollable: true,
	alwaysScroll: true,
	label: ' Loading... ',
	top: '0',
	left: '0',
	tags: true,
	width: '100%-20',
	scrollbar: {
		ch: ' ',
		track: {
			bg: filedata.colors.main
		},
		style: {
			inverse: true
		}
	},
	height: '100%-3',
	content: '...',
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const channelwrapper = blessed.box({
	label: '{bold}{' + filedata.colors.accent + '-fg} Channels {/}',
	top: '0',
	left: '100%-20',
	width: 20,
	keys: false,
	height: '100%',
	tags: true,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const channelbox = blessed.list({
	top: '0',
	left: '100%-20',
	width: 18,
	keys: false,
	height: '100%-2',
	tags: true,
	scrollbar: {
		ch: '#',
		track: {
			bg: filedata.colors.main
		},
		style: {
			inverse: true
		}
	},
	style: {
		item: {
			hover: {
				bg: filedata.colors.main
			},
			focus: {
				border: {
					fg: filedata.colors.main
				}
			},
			fg: filedata.colors.foreground,
			bg: filedata.colors.background,
			border: {
				fg: filedata.colors.border
			}
		},
		selected: {
			bg: filedata.colors.foreground,
			fg: filedata.colors.background,
			bold: true
		}
	}
});

channelwrapper.append(channelbox);

const textstuff = blessed.textarea({
	top: '100%-3',
	left: '0',
	width: '100%-20',
	height: 3,
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const enterUrl = blessed.textbox({
	label: '{bold}{' + filedata.colors.accent + '-fg} Enter Chat Url {/}',
	top: 'center',
	left: 'center',
	width: '50%',
	height: 3,
	tags: true,
	content: 'http://165.227.124.255:3000',
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const newchannelform = blessed.box({
	label: '{bold}{' + filedata.colors.accent + '-fg} New Channel {/}',
	top: 'center',
	left: 'center',
	tags: true,
	width: 42,
	height: 8,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const newchannel = blessed.textbox({
	label: ' Name ',
	top: 0,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const newchannelkey = blessed.textbox({
	label: ' Key ',
	top: 3,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

newchannelform.append(newchannel);
newchannelform.append(newchannelkey);

const newuserform = blessed.box({
	label: '{bold}{' + filedata.colors.accent + '-fg} Register {/}',
	top: 'center',
	left: 'center',
	tags: true,
	width: 42,
	height: 11,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const newusername = blessed.textbox({
	label: ' Username ',
	top: 0,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const newuserpassword = blessed.textbox({
	label: ' Password ',
	top: 3,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	censor: true,
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const newusercolor = blessed.textbox({
	label: ' Color Hex ',
	top: 6,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	content: 'ffffff',
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

newuserform.append(newusername);
newuserform.append(newuserpassword);
newuserform.append(newusercolor);

const loginUserForm = blessed.box({
	label: '{bold}{' + filedata.colors.accent + '-fg} Login {/}',
	top: 'center',
	left: 'center',
	tags: true,
	width: 42,
	height: 8,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const loginUsername = blessed.textbox({
	label: ' Username ',
	top: 0,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

const loginPassword = blessed.textbox({
	label: ' Password ',
	top: 3,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	censor: true,
	inputOnFocus: true,
	keys: false,
	border: {
		type: 'line'
	},
	style: {
		focus: {
			border: {
				fg: filedata.colors.main
			}
		},
		fg: filedata.colors.foreground,
		bg: filedata.colors.background,
		border: {
			fg: filedata.colors.border
		}
	}
});

loginUserForm.append(loginUsername);
loginUserForm.append(loginPassword);

function updateChatBoxLabel () {
	chatbox.setLabel(`{bold}{${filedata.colors.accent}-fg} (${scroller + 1}/${
		filedata.channels.length}) ${filedata.channels[scroller].name}${
		filedata.channels[scroller].key !== undefined ? ' : ENCRYPTED' : ''}{/}`
	);
}

function refreshBuffer () {
	channelbox.setItems(channelNameList);
	updateChatBoxLabel();
	if (buffer[filedata.channels[scroller].name] === undefined) {
		buffer[filedata.channels[scroller].name] = {};
	}
	const makeScroll = (chatbox.getScrollPerc() === 100);
	chatbox.setContent(buffer[filedata.channels[scroller].name].content);
	if (makeScroll) { chatbox.setScroll(Infinity); }
	if (
		buffer[filedata.channels[scroller].name].content === undefined ||
		oldChannel !== filedata.channels[scroller].name
	) {
		chatbox.setScroll(Infinity);
	}

	if (chatbox.getScrollHeight() <= chatbox.height) chatbox.setScroll(0);
	oldChannel = filedata.channels[scroller].name;
	screen.render();
}

function sendMessage (
	user: { user: string; password: string; color: string; },
	channel: string, content: object,
	callback: any
	) {
	const packet = encodeURIComponent(JSON.stringify({
		user: user.user,
		password: encrypt(user.password, user.password),
		content: content,
		channel: channel
	}));
	axios(
		{
			url: filedata['base-url'] + '/send',
			headers: {
				data: packet
			}
		}
	).then(
		(res) => {
			callback(res.data);
		}
	);
}

function getMessages (
	channelFull: {
		name: string,
		mode?: string,
		key?: string
	},
	callback: any
) {
	const channel = channelFull.name;
	if (buffer[channel] === undefined) { buffer[channel] = {}; }
	if (buffer[channel].count === undefined) { buffer[channel].count = 100; }
	axios(
		{
			url: filedata['base-url'] + '/read',
			headers: {
				channel: channel,
				count: buffer[channel].count
			}
		}
	).then(
		(res) => {
			callback(JSON.parse(decodeURIComponent(res.data)));
		}
	);
}

function timeConverter (timestamp: number) {
	const a = new Date(timestamp);
	const months = [
		'Jan',
		'Feb',
		'Mar',
		'Apr',
		'May',
		'Jun',
		'Jul',
		'Aug',
		'Sep',
		'Oct',
		'Nov',
		'Dec'
	];
	const year = a.getFullYear();
	const month = months[a.getMonth()];
	const date = a.getDate();
	const hour = a.getHours();
	const min = a.getMinutes();
	const sec = a.getSeconds();
	return {
		day: date + ' ' + month + ' ' + year,
		time:
			(hour < 10 ? '0' + hour : hour) +
			':' +
			(min < 10 ? '0' + min : min) +
			':' +
			(sec < 10 ? '0' + sec : sec)
	};
}

function refreshChat (
	channelFull: { name: string; key?: string; }, callback?: { (): void }
) {
	const channel = channelFull.name;
	getMessages(channelFull, (res: {
		colors: any,
		history: {
			_id: any,
			timestamp: number,
			content: any,
			user: {
				user: string
			}
		}[]
	}) => {
		const s = [];
		res.history.reverse();
		let prev = '';
		res.history.forEach(e => {
			const content = e.content;
			const timeFull = timeConverter(e.timestamp);
			if (prev !== timeFull.day) {
				prev = timeFull.day;
				s.push('{' + filedata.colors.background + '-fg}{' +
				filedata.colors.foreground + '-bg}{bold}\t' + prev);
			}

			switch (content.type) {
			case 'text':
			{
				let message = (!channelFull.key
					? content.text
					: decrypt(content.text, channelFull.key));

				if (message.charAt(message.length - 1) === '\n' ||
				message.charAt(message.length - 1) === '\r') {
					message = message.substr(0, message.length - 1);
				}

				if (message.includes('`')) {
					let prior = '';
					let current = '';
					let mode = true;

					for (let j = 0; j < message.length; j++) {
						if (mode) {
							if (message.charAt(j) === '`') {
								mode = false;
								prior += current;
								current = '';
							} else {
								current += message.charAt(j);
							}
						} else {
							if (message.charAt(j) === '`') {
								mode = true;
								prior += blessed.escape(current);
								current = '';
							} else {
								current += message.charAt(j);
							}
						}
					}
					message = prior + current;
				}

				s.push(
					'{/}' +
						timeFull.time +
						' {bold}{' +
						res.colors[e.user.user] +
						'-fg}' +
						e.user.user +
						'{/} ' +
						message
				);
				break;
			}
			case 'file':
				s.push(
					'{/}' +
						timeFull.time +
						' {bold}{' +
						res.colors[e.user.user] +
						'-fg}' +
						e.user.user +
						`{/} {blue-fg}[${filedata['base-url']}/file?channel=${
							channel}&id=${e._id}]`
				);
				break;
			}
		});
		const text = s.join('\n');
		buffer[channel].content = text;
		if (callback) callback();
	});
}

let sending = false;
// eslint-disable-next-line no-undef
let run: NodeJS.Timeout;
// eslint-disable-next-line no-undef
let runBuffer: NodeJS.Timeout;

function checkUser () {
	if (filedata.userdata === undefined) {
		loginUserForm.show();
		loginUsername.focus();
	} else {
		startWindows();
	}
}

function startWindows () {
	chatbox.show()
	textstuff.show();
	channelwrapper.show();
	channelwrapper.focus();
	channelbox.select(0);

	run = setInterval(function () {
		refreshChat(filedata.channels[scroller]);
	}, 500);
	runBuffer = setInterval(refreshBuffer, 200);

	refreshChat(filedata.channels[scroller], () => {
		refreshBuffer();
		chatbox.setScroll(Infinity);
	});
}

function startClient () {
	screen.append(channelwrapper);
	channelwrapper.hide();
	screen.append(chatbox);
	chatbox.hide();
	screen.append(textstuff);
	textstuff.hide();
	screen.append(enterUrl);
	enterUrl.hide();
	screen.append(newchannelform);
	newchannelform.hide();
	screen.append(loginUserForm);
	loginUserForm.hide();
	screen.append(newuserform);
	newuserform.hide();
	if (filedata['base-url'] === undefined) {
		enterUrl.show();
		enterUrl.focus();
	} else {
		checkUser();
	}

	screen.key(filedata.keybinds.quit, () => {
		clearInterval(run);
		clearInterval(runBuffer);
		updateConfig();
		return process.exit(0);
	});

	enterUrl.key('enter', () => {
		if (enterUrl.getValue().length > 0) {
			filedata['base-url'] = enterUrl.getValue();
			updateConfig();
			enterUrl.hide();
			checkUser();
		} else {
			return process.exit(0);
		}
	});

	enterUrl.key('escape', () => {
		return process.exit(0);
	});

	channelwrapper.key(filedata.keybinds['channel-to-chat'], () => {
		chatbox.focus();
	});

	channelwrapper.key(filedata.keybinds['channel-to-text'], () => {
		textstuff.focus();
	});

	channelwrapper.key(filedata.keybinds['add-channel'], () => {
		newchannelform.show();
	});

	channelwrapper.key(filedata.keybinds['remove-channel'], () => {
		filedata.channels.splice(scroller, 1);
		channelNameList.splice(scroller, 1);
		if (scroller > 0) scroller--;
		refreshBuffer();
	});

	textstuff.key(filedata.keybinds['exit-window'], () => {
		if (big) {
			textstuff.top = '100%-3';
			textstuff.left = 0;
			textstuff.width = '100%-20';
			textstuff.height = 3;
			big = false;
		}
		chatbox.focus();
		screen.render();
	});

	let big = false;

	textstuff.key(filedata.keybinds['toggle-editor'], () => {
		if (big) {
			textstuff.top = '100%-3';
			textstuff.left = 0;
			textstuff.width = '100%-20';
			textstuff.height = 3;
			big = false;
		} else {
			textstuff.top = 'center';
			textstuff.height = '50%';
			textstuff.width = '50%';
			textstuff.left = 'center';
			big = true;
		}
		screen.render();
	});

	chatbox.key(filedata.keybinds['add-history'], () => {
		buffer[filedata.channels[scroller].name].count += chatbox.height;
		refreshChat(filedata.channels[scroller], () => {
			refreshBuffer();
			chatbox.setScroll(chatbox.height as number);
		});
	});

	chatbox.key(filedata.keybinds['chat-to-channel'], () => {
		channelwrapper.focus();
		screen.render();
	});

	chatbox.key(filedata.keybinds['enter-text'], () => {
		if (!sending) {
			textstuff.focus();
			screen.render();
		}
	});

	chatbox.key(filedata.keybinds['scroll-up'], () => {
		chatbox.scroll(-1);
		updateChatBoxLabel();
	});

	chatbox.key(filedata.keybinds['scroll-all'], () => {
		chatbox.setScroll(chatbox.getScrollHeight());
	});

	chatbox.key(filedata.keybinds['scroll-down'], () => {
		chatbox.scroll(1);
	});

	channelwrapper.key(filedata.keybinds['scroll-up'], () => {
		if (scroller > 0) {
			scroller--;
			channelbox.up(1);
			refreshBuffer();
		}
	});

	channelwrapper.key(filedata.keybinds['scroll-down'], () => {
		if (scroller < filedata.channels.length - 1) {
			scroller++;
			channelbox.down(1);
			refreshBuffer();
		}
	});

	channelwrapper.key(filedata.keybinds['add-channel'], () => {
		newchannelform.show();
		screen.render();
		newchannel.focus();
	});

	newusername.key(filedata.keybinds['exit-window'], () => {
		if (!filedata.userdata)
			throw new Error('User required.');
		newuserform.hide();
		screen.render();
	});

	loginUsername.key(filedata.keybinds['exit-window'], () => {
		if (!filedata.userdata)
			throw new Error('User required.');
		loginUserForm.hide();
		screen.render();
	});

	newuserpassword.key('escape', () => {
		newusername.focus();
	});

	loginPassword.key('escape', () => {
		loginUsername.focus();
	});

	newusercolor.key('escape', () => {
		newuserpassword.focus();
	});

	newusername.key(['enter'], () => {
		if (newusername.getValue().length > 0) {
			newuserpassword.focus();
		} else {
			newusername.focus();
		}
	});

	textstuff.key(['C-l'], () => {
		loginUserForm.show();
		loginUsername.focus();
		screen.render();
	});

	chatbox.key(['C-l'], () => {
		loginUserForm.show();
		loginUsername.focus();
		screen.render();
	});

	channelwrapper.key(['C-l'], () => {
		loginUserForm.show();
		loginUsername.focus();
		screen.render();
	});

	loginUsername.key(['C-l'], () => {
		loginUserForm.hide();
		newuserform.show();
		newusername.focus();
		screen.render();
	});

	loginPassword.key(['C-l'], () => {
		loginUserForm.hide();
		newuserform.show();
		newusername.focus();
		screen.render();
	});

	newusername.key(['C-l'], () => {
		newuserform.hide();
		loginUserForm.show();
		loginUsername.focus();
		screen.render();
	});

	newuserpassword.key(['C-l'], () => {
		newuserform.hide();
		loginUserForm.show();
		loginUsername.focus();
		screen.render();
	});

	newusercolor.key(['C-l'], () => {
		newuserform.hide();
		loginUserForm.show();
		loginUsername.focus();
		screen.render();
	});

	loginUsername.key(['enter'], () => {
		if (loginUsername.getValue().length > 0) {
			loginPassword.focus();
		} else {
			loginUsername.focus();
		}
	});

	newuserpassword.key(['enter'], () => {
		if (newuserpassword.getValue().length > 0) {
			newusercolor.focus();
		} else {
			newuserpassword.focus();
		}
	});

	loginPassword.key(['enter'], () => {
		if (loginPassword.getValue().length > 0) {
			loginUserForm.hide();
			filedata.userdata = {
				user: newusername.getValue(),
				password: newuserpassword.getValue()
			};
			updateConfig();
			startWindows();
		} else {
			loginPassword.focus();
		}
	});

	newusercolor.key(['enter'], () => {
		if (newusercolor.getValue().length === 6) {
			axios(
				{
					url: filedata['base-url'] + '/register',
					headers: {
						data: encodeURIComponent(JSON.stringify({
							user: newusername.getValue(),
							password: encrypt(newuserpassword.getValue(), newuserpassword.getValue()),
							color: '#' + newusercolor.getValue()
						}))
					}
				}
			).then(
				(res) => {
					if (res.data) {
						newuserform.hide();
						filedata.userdata = {
							user: newusername.getValue(),
							password: newuserpassword.getValue()
						};
						updateConfig();
						startWindows();
					} else {
						newusername.focus();
					}
				}
			);
		} else {
			newusercolor.focus();
		}
	});

	newchannel.key(filedata.keybinds['exit-window'], () => {
		channelwrapper.focus();
		newchannelform.hide();
		newchannel.clearValue();
		newchannelkey.clearValue();
		screen.render();
	});

	newchannelkey.key('escape', () => {
		newchannel.focus();
	});

	newchannel.key(['enter'], () => {
		if (newchannel.getValue().length > 0) {
			newchannelkey.focus();
		} else {
			newchannel.focus();
		}
	});

	newchannelkey.key('enter', () => {
		if (newchannel.getValue().length > 0) {
			channelwrapper.focus();
			scroller = filedata.channels.length;
			if (newchannelkey.getValue().length > 0) {
				filedata.channels.push({
					name: newchannel.getValue(),
					key: newchannelkey.getValue()
				});
			} else {
				filedata.channels.push({
					name: newchannel.getValue(),
					key: undefined
				});
			}
			channelNameList.push(newchannel.getValue());
			newchannelform.hide();
			refreshBuffer();
			channelbox.select(scroller);
			newchannel.clearValue();
			newchannelkey.clearValue();
			updateConfig();
		} else {
			newchannelform.hide();
			newchannel.clearValue();
			newchannelkey.clearValue();
			channelwrapper.focus();
		}
	});

	textstuff.key('enter', () => {
		if (!big) {
			if (textstuff.getValue() !== '' && !sending) {
				sending = true;
				textstuff.style.bg = 'red';
				textstuff.render();
				let message = textstuff.getValue();
				while (message.charAt(message.length - 1) === '\n' ||
					message.charAt(message.length - 1) === ' ' ||
					message.charAt(message.length - 1) === '\t') {
					message = message.substr(0, message.length - 1);
				}
				if (message.length === 0) {
					textstuff.clearValue();
					sending = false;
					textstuff.style.bg = 'black';
					return;
				}
				let packet: object;
				if (message.length > 5 && message.substr(0, 5) === '/file') {
					const fname = message.substr(6);
					const data = fs.readFileSync(fname, 'utf-8');
					packet = { type: 'file', data: data };
				} else {
					if (filedata.channels[scroller].key !== undefined) {
						message = encrypt(
							message,
							filedata.channels[scroller].key
						);
					}
					packet = { type: 'text', text: message };
				}
				sendMessage(
					filedata.userdata,
					filedata.channels[scroller].name,
					packet,
					() => {
						textstuff.clearValue();
						sending = false;
						textstuff.style.bg = 'black';
						chatbox.setScroll(Infinity);
						refreshChat(filedata.channels[scroller], () => {
							refreshBuffer();
							chatbox.setScroll(Infinity);
						});
					});
			}
		}
	});
}

startClient();
