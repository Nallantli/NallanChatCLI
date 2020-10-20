#!/usr/bin/env node

import * as blessed from "blessed";
import * as fs from "fs";
import * as crypto from "crypto";
import axios from "axios";
const homedir = require("os").homedir() + "/";

const defaultconfig = {
	channels: [
		{
			name: "main",
			key: undefined
		}
	],
	keybinds: {
		quit: ["C-c"],
		"scroll-up": ["q", "up"],
		"scroll-down": ["e", "down"],
		"chat-to-channel": ["tab", "right", "left"],
		"channel-to-chat": ["tab", "escape", "right", "left"],
		"channel-to-text": ["enter"],
		"scroll-all": ["escape"],
		"exit-window": ["escape"],
		"add-channel": ["="],
		"remove-channel": ["-"],
		"enter-text": ["enter"],
		"add-history": ["+"],
		"toggle-editor": ["C-e"]
	},
	userdata: undefined,
	colors: { main: "blue", accent: "cyan", background: "black", foreground: "white", border: "gray" },
	"base-url": "http://sonolang.com:3000"
};

const _key = Buffer.alloc(32); // key should be 32 bytes
const _iv = Buffer.alloc(16); // iv should be 16

let channel_name_list = [];

let datadir = homedir + ".nallan";
if (!fs.existsSync(datadir)) {
	fs.mkdirSync(datadir);
}

function updateConfig() {
	fs.writeFileSync(
		datadir + "/config.json",
		JSON.stringify(filedata, null, "\t")
	);
}

let filedata = defaultconfig;
if (fs.existsSync(datadir + "/config.json")) {
	filedata = JSON.parse(fs.readFileSync(datadir + "/config.json", "utf8"));
	Object.keys(defaultconfig.keybinds).forEach((key) => {
		if (filedata.keybinds[key] == undefined)
			filedata.keybinds[key] = defaultconfig.keybinds[key];
	});
	Object.keys(defaultconfig.colors).forEach((key) => {
		if (filedata.colors[key] == undefined)
			filedata.colors[key] = defaultconfig.colors[key];
	});
} else {
	updateConfig();
}

for (let i = 0; i < filedata.channels.length; i++) {
	channel_name_list.push(filedata.channels[i].name);
}

let old_channel = "";
let scroller = 0;
let buffer = {};
function encrypt(text: string, key: string) {
	let crypkey = Buffer.concat([Buffer.from(key)], _key.length);
	let cipher = crypto.createCipheriv("aes-256-cbc", crypkey, _iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return encrypted.toString("hex");
}

function decrypt(text: string, key: string) {
	try {
		let encryptedText = Buffer.from(text, "hex");
		let crypkey = Buffer.concat([Buffer.from(key)], _key.length);
		let decipher = crypto.createDecipheriv("aes-256-cbc", crypkey, _iv);
		let decrypted = decipher.update(encryptedText);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		return decrypted.toString();
	} catch (err) {
		return "ERROR";
	}
}

const screen = blessed.screen({
	title: "NallanChat CLI",
	smartCSR: true,
	fullUnicode: true,
	cursor: {
		artificial: true,
		shape: "line",
		blink: true,
		color: null // null for default
	}
});


let chatbox = blessed.box({
	scrollable: true,
	alwaysScroll: true,
	label: " Loading... ",
	top: "0",
	left: "0",
	tags: true,
	width: "100%-20",
	scrollbar: {
		ch: " ",
		track: {
			bg: filedata.colors.main
		},
		style: {
			inverse: true
		}
	},
	height: "100%-3",
	content: "...",
	border: {
		type: "line"
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

let channelbox = blessed.list({
	label: "{bold}{" + filedata.colors.accent + "-fg} Channels {/}",
	top: "0",
	left: "100%-20",
	width: 20,
	keys: false,
	height: "100%",
	tags: true,
	border: {
		type: "line"
	},
	scrollbar: {
		ch: "#",
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

let textstuff = blessed.textarea({
	top: "100%-3",
	left: "0",
	width: "100%-20",
	height: 3,
	inputOnFocus: true,
	keys: false,
	border: {
		type: "line"
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

let enter_url = blessed.textbox({
	label: "{bold}{" + filedata.colors.accent + "-fg} Enter Chat Url {/}",
	top: "center",
	left: "center",
	width: "50%",
	height: 3,
	tags: true,
	content: "http://157.230.208.158:3000",
	inputOnFocus: true,
	keys: false,
	border: {
		type: "line"
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

let newchannelform = blessed.box({
	label: "{bold}{" + filedata.colors.accent + "-fg} New Channel {/}",
	top: "center",
	left: "center",
	tags: true,
	width: 42,
	height: 8,
	border: {
		type: "line"
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

let newchannel = blessed.textbox({
	label: " Name ",
	top: 0,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	border: {
		type: "line"
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

let newchannelkey = blessed.textbox({
	label: " Key ",
	top: 3,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	border: {
		type: "line"
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

let newuserform = blessed.box({
	label: "{bold}{" + filedata.colors.accent + "-fg} Register/Login {/}",
	top: "center",
	left: "center",
	tags: true,
	width: 42,
	height: 11,
	border: {
		type: "line"
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

let newusername = blessed.textbox({
	label: " Username ",
	top: 0,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	inputOnFocus: true,
	border: {
		type: "line"
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

let newuserpassword = blessed.textbox({
	label: " Password ",
	top: 3,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	censor: true,
	inputOnFocus: true,
	border: {
		type: "line"
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

let newusercolor = blessed.textbox({
	label: " Color Hex ",
	top: 6,
	left: 0,
	width: 40,
	tags: true,
	height: 3,
	content: "ffffff",
	inputOnFocus: true,
	border: {
		type: "line"
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

function updateChatBoxLabel() {
	chatbox.setLabel(
		"{bold}{" +
		filedata.colors.accent +
		"-fg} (" +
		(scroller + 1) +
		"/" +
		filedata.channels.length +
		") " +
		filedata.channels[scroller].name +
		(filedata.channels[scroller].key != undefined ? " : ENCRYPTED" : "") +
		" {/}"
	);
}

function refreshBuffer() {
	channelbox.setItems(channel_name_list);
	updateChatBoxLabel();
	if (buffer[filedata.channels[scroller].name] == undefined)
		buffer[filedata.channels[scroller].name] = {};
	let make_scroll = (chatbox.getScrollPerc() == 100);
	chatbox.setContent(buffer[filedata.channels[scroller].name].content);
	if (make_scroll)
		chatbox.setScroll(Infinity);
	if (
		buffer[filedata.channels[scroller].name].content === undefined ||
		old_channel != filedata.channels[scroller].name
	) {
		chatbox.setScroll(Infinity);
	}

	if (chatbox.getScrollHeight() <= chatbox.height) chatbox.setScroll(0);
	old_channel = filedata.channels[scroller].name;
	screen.render();
}

function sendMessage(user: { user: string; password: string; color: string; }, channel: string | number | boolean, content: string, callback: { (): void; (data: object[]): void; }) {
	while (content.charAt(content.length - 1) == '\n' || content.charAt(content.length - 1) == ' ' || content.charAt(content.length - 1) == '\t')
		content = content.substr(0, content.length - 1);
	if (content.length == 0) {
		if (callback)
			callback(undefined);
	} else {
		axios(
			{
				url: filedata["base-url"] + "/send",
				headers: {
					user: encodeURIComponent(user.user),
					password: encrypt(user.password, user.password),
					content: encodeURIComponent(content),
					color: user.color,
					channel: encodeURIComponent(channel)
				}
			}
		).then(
			(res) => {
				callback(res.data);
			}
		);
	}
}

function getMessages(channel_full: { name: string; mode?: string; key?: string }, callback: { (res: { timestamp: number; content: string, user: { user: string, color: string } }[]): void }) {
	let channel = channel_full.name;
	if (buffer[channel] == undefined)
		buffer[channel] = {};
	if (buffer[channel].count == undefined)
		buffer[channel].count = 100;
	axios(
		{
			url: filedata["base-url"] + "/read",
			headers: {
				channel: channel,
				count: buffer[channel].count
			}
		}
	).then(
		(res) => {
			callback(res.data);
		}
	);
}

function timeConverter(UNIX_timestamp: number) {
	let a = new Date(UNIX_timestamp);
	let months = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec"
	];
	let year = a.getFullYear();
	let month = months[a.getMonth()];
	let date = a.getDate();
	let hour = a.getHours();
	let min = a.getMinutes();
	let sec = a.getSeconds();
	let time = {
		day: date + " " + month + " " + year,
		time:
			(hour < 10 ? "0" + hour : hour) +
			":" +
			(min < 10 ? "0" + min : min) +
			":" +
			(sec < 10 ? "0" + sec : sec)
	};
	return time;
}

function refreshChat(channel_full: { name: string; key?: string; }, callback?: { (): void }) {
	let channel = channel_full.name;
	getMessages(channel_full, (res: { timestamp: number; content: string, user: { user: string, color: string } }[]) => {
		let s = [];
		res = res.reverse();
		let prev = "";
		for (let i = 0; i < res.length; i++) {
			let time_full = timeConverter(res[i].timestamp);
			if (prev != time_full.day) {
				prev = time_full.day;
				s.push("{" + filedata.colors.background + "-fg}{" + filedata.colors.foreground + "-bg}{bold}\t" + prev);
			}

			let message = (channel_full.key == undefined
				? decodeURIComponent(res[i].content)
				: decrypt(decodeURIComponent(res[i].content), channel_full.key));

			if (message.charAt(message.length - 1) == '\n' || message.charAt(message.length - 1) == '\r')
				message = message.substr(0, message.length - 1);

			if (message.includes("`")) {
				let prior = "";
				let current = "";
				let mode = true;

				for (let j = 0; j < message.length; j++) {
					if (mode) {
						if (message.charAt(j) == '`') {
							mode = false;
							prior += current;
							current = "";
						} else {
							current += message.charAt(j);
						}
					} else {
						if (message.charAt(j) == '`') {
							mode = true;
							prior += blessed.escape(current);
							current = "";
						} else {
							current += message.charAt(j);
						}
					}
				}

				message = prior + current;
			}

			s.push(
				"{/}" +
				time_full.time +
				" {bold}{" +
				res[i].user.color +
				"-fg}" +
				decodeURIComponent(res[i].user.user) +
				"{/} " +
				message
			);
		}
		let text = s.join("\n");
		buffer[channel].content = text;
		if (callback) callback();
	});
}

let sending = false;
let run: NodeJS.Timeout;
let run_buffer: NodeJS.Timeout;

function checkUser() {
	if (filedata.userdata == undefined) {
		screen.append(newuserform);
		newusername.focus();
	} else {
		startWindows();
	}
}

function startWindows() {
	screen.append(chatbox);
	screen.append(channelbox);
	screen.append(textstuff);
	channelbox.focus();
	channelbox.select(0);

	run = setInterval(function () {
		refreshChat(filedata.channels[scroller]);
	}, 500);
	run_buffer = setInterval(refreshBuffer, 200);

	refreshChat(filedata.channels[scroller], () => {
		refreshBuffer();
		chatbox.setScroll(Infinity);
	});
}

function startClient() {
	if (filedata["base-url"] == undefined) {
		screen.append(enter_url);
		enter_url.focus();
	} else {
		checkUser();
	}

	screen.key(filedata.keybinds["quit"], () => {
		clearInterval(run);
		clearInterval(run_buffer);
		updateConfig();
		return process.exit(0);
	});

	enter_url.key("enter", () => {
		if (enter_url.getValue().length > 0) {
			filedata["base-url"] = enter_url.getValue();
			updateConfig();
			screen.remove(enter_url);
			checkUser();
		} else {
			return process.exit(0);
		}
	});

	enter_url.key("escape", () => {
		return process.exit(0);
	});

	channelbox.key(filedata.keybinds["channel-to-chat"], () => {
		chatbox.focus();
	});

	channelbox.key(filedata.keybinds["channel-to-text"], () => {
		textstuff.focus();
	});

	channelbox.key(filedata.keybinds["add-channel"], () => {
		screen.append(newchannelform);
	});

	channelbox.key(filedata.keybinds["remove-channel"], () => {
		filedata.channels.splice(scroller, 1);
		channel_name_list.splice(scroller, 1);
		if (scroller > 0) scroller--;
		refreshBuffer();
	});

	textstuff.key(filedata.keybinds["exit-window"], () => {
		if (big) {
			textstuff.top = "100%-3";
			textstuff.left = 0;
			textstuff.width = "100%-20";
			textstuff.height = 3;
			big = false;
		}
		chatbox.focus();
		screen.render();
	});

	let big = false;

	textstuff.key(filedata.keybinds["toggle-editor"], () => {
		if (big) {
			textstuff.top = "100%-3";
			textstuff.left = 0;
			textstuff.width = "100%-20";
			textstuff.height = 3;
			big = false;
		} else {
			textstuff.top = "center";
			textstuff.height = "50%";
			textstuff.width = "50%";
			textstuff.left = "center";
			big = true;
		}
		screen.render();
	});

	chatbox.key(filedata.keybinds["add-history"], () => {
		buffer[filedata.channels[scroller].name].count += chatbox.height;
		refreshChat(filedata.channels[scroller], () => {
			refreshBuffer();
			chatbox.setScroll(chatbox.height as number);
		});
	});

	chatbox.key(filedata.keybinds["chat-to-channel"], () => {
		channelbox.focus();
		screen.render();
	});

	chatbox.key(filedata.keybinds["enter-text"], () => {
		if (sending == false) {
			textstuff.focus();
			screen.render();
		}
	});

	chatbox.key(filedata.keybinds["scroll-up"], () => {
		chatbox.scroll(-1);
		updateChatBoxLabel();
	});

	chatbox.key(filedata.keybinds["scroll-all"], () => {
		chatbox.setScroll(chatbox.getScrollHeight());
	});

	chatbox.key(filedata.keybinds["scroll-down"], () => {
		chatbox.scroll(1);
	});

	channelbox.key(filedata.keybinds["scroll-up"], () => {
		if (scroller > 0) {
			scroller--;
			channelbox.up(1);
			refreshBuffer();
		}
	});

	channelbox.key(filedata.keybinds["scroll-down"], () => {
		if (scroller < filedata.channels.length - 1) {
			scroller++;
			channelbox.down(1);
			refreshBuffer();
		}
	});

	channelbox.key(filedata.keybinds["add-channel"], () => {
		screen.append(newchannelform);
		newchannel.focus();
	});

	newusername.key(filedata.keybinds["exit-window"], () => {
		throw "User required.";
	});

	newuserpassword.key("escape", () => {
		newusername.focus();
	});

	newusercolor.key("escape", () => {
		newuserpassword.focus();
	});

	newusername.key(["enter"], () => {
		if (newusername.getValue().length > 0) {
			newuserpassword.focus();
		} else {
			newusername.focus();
		}
	});

	newuserpassword.key(["enter"], () => {
		if (newuserpassword.getValue().length > 0) {
			newusercolor.focus();
		} else {
			newuserpassword.focus();
		}
	});

	newusercolor.key(["enter"], () => {
		if (newusercolor.getValue().length == 6) {
			screen.remove(newuserform);
			filedata.userdata = {
				user: newusername.getValue(),
				password: newuserpassword.getValue(),
				color: "#" + newusercolor.getValue()
			};
			updateConfig();
			startWindows();
		} else {
			newusercolor.focus();
		}
	});

	newchannel.key(filedata.keybinds["exit-window"], () => {
		channelbox.focus();
		screen.remove(newchannelform);
		newchannel.clearValue();
		newchannelkey.clearValue();
		screen.render();
	});

	newchannelkey.key("escape", () => {
		newchannel.focus();
	});

	newchannel.key(["enter"], () => {
		if (newchannel.getValue().length > 0) {
			newchannelkey.focus();
		} else {
			newchannel.focus();
		}
	});

	newchannelkey.key("enter", () => {
		if (newchannel.getValue().length > 0) {
			channelbox.focus();
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
			channel_name_list.push(newchannel.getValue());
			screen.remove(newchannelform);
			refreshBuffer();
			channelbox.select(scroller);
			newchannel.clearValue();
			newchannelkey.clearValue();
			updateConfig();
		} else {
			screen.remove(newchannelform);
			newchannel.clearValue();
			newchannelkey.clearValue();
			channelbox.focus();
		}
	});

	textstuff.key("enter", () => {
		if (!big) {
			if (textstuff.getValue() != "" && sending == false) {
				sending = true;
				textstuff.style.bg = "red";
				textstuff.render();
				let message = textstuff.getValue();
				if (filedata.channels[scroller].key !== undefined)
					message = encrypt(message, filedata.channels[scroller].key);
				sendMessage(
					filedata.userdata,
					filedata.channels[scroller].name,
					message,
					() => {
						textstuff.clearValue();
						sending = false;
						textstuff.style.bg = "black";
						chatbox.setScroll(Infinity);
						refreshChat(filedata.channels[scroller], () => {
							refreshBuffer();
							chatbox.setScroll(Infinity);
							//textstuff.focus();
						});
					}
				);
			} else {
				//textstuff.focus();
			}
		}
	});
}

startClient();
