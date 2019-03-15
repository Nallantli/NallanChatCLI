#!/usr/bin/env node

const blessed = require("blessed");
const request = require("request");
const convert = require("xml-js");
const fs = require("fs");
const crypto = require("crypto");
const homedir = require("os").homedir() + "/";

const defaultconfig = {
	channels: [
		{
			name: "main"
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
	colors: { main: "blue", accent: "cyan", background: "black", foreground: "white", border: "gray" },
	"base-url": "http://157.230.208.158:3000"
};

const _key = Buffer.alloc(32); // key should be 32 bytes
const _iv = Buffer.alloc(16); // iv should be 16

var channel_name_list = [];

var datadir = homedir + ".nallan";
if (!fs.existsSync(datadir)) {
	fs.mkdirSync(datadir);
}

function updateConfig() {
	fs.writeFileSync(
		datadir + "/config.json",
		JSON.stringify(filedata, null, "\t"),
		(err) => {
			if (err)
				throw err;
		}
	);
}

var filedata = defaultconfig;
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

for (var i = 0; i < filedata.channels.length; i++) {
	channel_name_list.push(
		filedata.channels[i].name +
		(filedata.channels[i].mode == "yamachat" ? "@yamac" : "")
	);
}

var old_channel = "";
var scroller = 0;
var buffer = {};
function encrypt(text, key) {
	var crypkey = Buffer.concat([Buffer.from(key)], _key.length);
	var cipher = crypto.createCipheriv("aes-256-cbc", crypkey, _iv);
	var encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return encrypted.toString("hex");
}

function decrypt(text, key) {
	try {
		var encryptedText = Buffer.from(text, "hex");
		var crypkey = Buffer.concat([Buffer.from(key)], _key.length);
		var decipher = crypto.createDecipheriv("aes-256-cbc", crypkey, _iv);
		var decrypted = decipher.update(encryptedText);
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


var chatbox = blessed.box({
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

var channelbox = blessed.list({
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
			}
		},
		selected: {
			bg: filedata.colors.foreground,
			fg: filedata.colors.background,
			bold: true
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
	}
});

var textstuff = blessed.textarea({
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

var enter_url = blessed.textbox({
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

var newchannelform = blessed.box({
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

var newchannel = blessed.textbox({
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

var newchannelkey = blessed.textbox({
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

var newuserform = blessed.box({
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

var newusername = blessed.textbox({
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

var newuserpassword = blessed.textbox({
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

var newusercolor = blessed.textbox({
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

function refreshBuffer() {
	channelbox.setItems(channel_name_list);
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
	if (buffer[
		filedata.channels[scroller].name +
		(filedata.channels[scroller].mode == "yamachat" ? ".yc" : "")
	] == undefined)
		buffer[
			filedata.channels[scroller].name +
			(filedata.channels[scroller].mode == "yamachat" ? ".yc" : "")
		] = {};
	chatbox.setContent(
		buffer[
			filedata.channels[scroller].name +
			(filedata.channels[scroller].mode == "yamachat" ? ".yc" : "")
		].content
	);
	if (
		buffer[
			filedata.channels[scroller].name +
			(filedata.channels[scroller].mode == "yamachat" ? ".yc" : "")
		].content === undefined ||
		old_channel !=
		filedata.channels[scroller].name +
		(filedata.channels[scroller].mode == "yamachat" ? ".yc" : "")
	) {
		chatbox.setScroll(Infinity);
	}

	if (chatbox.getScrollHeight() <= chatbox.height) chatbox.setScroll(0);
	old_channel =
		filedata.channels[scroller].name +
		(filedata.channels[scroller].mode == "yamachat" ? ".yc" : "");
	screen.render();
}

function sendMessage(user, channel, yama, content, callback) {
	while (content.charAt(content.length - 1) == '\n' || content.charAt(content.length - 1) == ' ' || content.charAt(content.length - 1) == '\t')
		content = content.substr(0, content.length - 1);
	if (content.length == 0) {
		if (callback)
			callback(undefined);
	} else {
		if (!yama) {
			request(
				{
					uri: filedata["base-url"] + "/send",
					headers: {
						user: encodeURIComponent(user.user),
						password: user.password,
						content: encodeURIComponent(content),
						color: user.color,
						channel: encodeURIComponent(channel)
					},
					agent: false,
					pool: {
						maxSockets: Infinity
					},
					method: "GET"
				},
				(err, req, res) => {
					if (err) throw err;
					callback(res);
				}
			);
		} else {
			request(
				{
					headers: {
						user: encodeURIComponent(user.user),
						password: user.password,
						colour: user.color.substr(1)
					},
					uri:
						filedata["yama-url"] +
						encodeURIComponent(filedata.channels[scroller].name) +
						"/send/" +
						encodeURIComponent(content),
					method: "POST",
					agent: false,
					pool: {
						maxSockets: Infinity
					},
					timeout: 500,
					method: "GET"
				},
				(err, req, res) => {
					if (err) throw err;
					callback(res);
				}
			);
		}
	}
}

function getMessages(channel_full, callback) {
	var channel = channel_full.name;
	if (channel_full.mode == undefined) {
		if (buffer[channel] == undefined)
			buffer[channel] = {};
		if (buffer[channel].count == undefined)
			buffer[channel].count = 100;
		request(
			{
				uri: filedata["base-url"] + "/read",
				headers: {
					channel: channel,
					count: buffer[channel].count
				},
				agent: false,
				pool: {
					maxSockets: Infinity
				},
				method: "GET"
			},
			(err, req, res) => {
				if (err) throw err;
				callback(res);
			}
		);
	} else {
		request(
			{
				uri: filedata["yama-url"] + channel + "/read",
				pool: {
					maxSockets: Infinity
				},
				json: false,
				timeout: 1000,
				agent: false
			},
			(err, res, html) => {
				if (err) {
					/*todo*/
				}
				if (html !== undefined) {
					body_edit = html.split("\r\n");
					s = [];
					var prev = "";
					for (var i = 0; i < body_edit.length - 1; i++) {
						try {
							json = JSON.parse(
								convert.xml2json(body_edit[i], { compact: true, spaces: 4 })
							);
						} catch {
							throw body_edit[i];
						}
						s.push({
							user: {
								user: json["div"]["_attributes"]["data-username"],
								color: "#" + json["div"]["_attributes"]["data-colour"]
							},
							content: json.div._text,
							timestamp: json["div"]["_attributes"]["data-timestamp"]
						});
					}
					callback(JSON.stringify(s));
				}
			}
		);
	}
}

function timeConverter(UNIX_timestamp) {
	var a = new Date(UNIX_timestamp);
	var months = [
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
	var year = a.getFullYear();
	var month = months[a.getMonth()];
	var date = a.getDate();
	var hour = a.getHours();
	var min = a.getMinutes();
	var sec = a.getSeconds();
	var time = {
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

var count = 0;
function refreshChat(channel_full, callback) {
	if (channel_full.mode == "yamachat" && count < 5) {
		count++;
		if (callback) callback();
		return;
	}
	count = 0;
	var channel = channel_full.name;
	getMessages(channel_full, res => {
		var s = [];
		res = JSON.parse(res);
		res = res.reverse();
		var prev = "";
		for (var i = 0; i < res.length; i++) {
			time_full = timeConverter(res[i].timestamp);
			if (prev != time_full.day) {
				prev = time_full.day;
				s.push("{" + filedata.colors.background + "-fg}{" + filedata.colors.foreground + "-bg}{bold}\t" + prev);
			}

			var message = (channel_full.key == undefined
				? decodeURIComponent(res[i].content)
				: decrypt(decodeURIComponent(res[i].content), channel_full.key));

			if (message.includes("`")) {
				var prior = "";
				var current = "";
				var mode = true;

				for (var j = 0; j < message.length; j++) {
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
		text = s.join("\n");
		buffer[channel + (channel_full.mode == "yamachat" ? ".yc" : "")].content = text;
		if (callback) callback();
	});
}

var sending = false;
var run;
var run_buffer;

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

	screen.key(filedata.keybinds["quit"], function (ch, key) {
		clearInterval(run);
		clearInterval(run_buffer);
		updateConfig();
		return process.exit(0);
	});

	enter_url.key("enter", function (ch, key) {
		if (enter_url.getValue().length > 0) {
			filedata["base-url"] = enter_url.getValue();
			updateConfig();
			screen.remove(enter_url);
			checkUser();
		} else {
			return process.exit(0);
		}
	});

	enter_url.key("escape", function (ch, key) {
		return process.exit(0);
	});

	channelbox.key(filedata.keybinds["channel-to-chat"], function (key) {
		chatbox.focus();
	});

	channelbox.key(filedata.keybinds["channel-to-text"], function (key) {
		textstuff.focus();
	});

	channelbox.key(filedata.keybinds["add-channel"], function (key) {
		screen.append(newchannelform);
	});

	channelbox.key(filedata.keybinds["remove-channel"], function (key) {
		filedata.channels.splice(scroller, 1);
		channel_name_list.splice(scroller, 1);
		if (scroller > 0) scroller--;
		refreshBuffer();
	});

	textstuff.key(filedata.keybinds["exit-window"], function (ch, key) {
		chatbox.focus();
		screen.render();
	});

	var big = false;

	textstuff.key(filedata.keybinds["toggle-editor"], function (ch, key) {
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

	chatbox.key(filedata.keybinds["add-history"], function (ch, key) {
		buffer[filedata.channels[scroller].name + (filedata.channels[scroller].mode == "yamachat" ? ".yc" : "")].count += chatbox.height;
		refreshChat(filedata.channels[scroller], () => {
			refreshBuffer();
			chatbox.setScroll(chatbox.height);
		});
	});

	chatbox.key(filedata.keybinds["chat-to-channel"], function (ch, key) {
		channelbox.focus();
		screen.render();
	});

	chatbox.key(filedata.keybinds["enter-text"], function (ch, key) {
		if (sending == false) {
			textstuff.focus();
			screen.render();
		}
	});

	chatbox.key(filedata.keybinds["scroll-up"], function (ch, key) {
		chatbox.scroll(-1);
	});

	chatbox.key(filedata.keybinds["scroll-all"], function (ch, key) {
		chatbox.setScroll(chatbox.getScrollHeight());
	});

	chatbox.key(filedata.keybinds["scroll-down"], function (ch, key) {
		chatbox.scroll(1);
	});

	channelbox.key(filedata.keybinds["scroll-up"], function (ch, key) {
		if (scroller > 0) {
			scroller--;
			channelbox.up(1);
			refreshBuffer();
		}
	});

	channelbox.key(filedata.keybinds["scroll-down"], function (ch, key) {
		if (scroller < filedata.channels.length - 1) {
			scroller++;
			channelbox.down(1);
			refreshBuffer();
		}
	});

	channelbox.key(filedata.keybinds["add-channel"], function (key) {
		screen.append(newchannelform);
		newchannel.focus();
	});

	newusername.key(filedata.keybinds["exit-window"], function (ch, key) {
		throw "User required.";
	});

	newuserpassword.key("escape", function (ch, key) {
		newusername.focus();
	});

	newusercolor.key("escape", function (ch, key) {
		newuserpassword.focus();
	});

	newusername.key(["enter"], function (ch, key) {
		if (newusername.getValue().length > 0) {
			newuserpassword.focus();
		} else {
			newusername.focus();
		}
	});

	newuserpassword.key(["enter"], function (ch, key) {
		if (newuserpassword.getValue().length > 0) {
			newusercolor.focus();
		} else {
			newuserpassword.focus();
		}
	});

	newusercolor.key(["enter"], function (ch, key) {
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

	newchannel.key(filedata.keybinds["exit-window"], function (ch, key) {
		channelbox.focus();
		screen.remove(newchannelform);
		newchannel.clearValue();
		newchannelkey.clearValue();
		screen.render();
	});

	newchannelkey.key("escape", function (ch, key) {
		newchannel.focus();
	});

	newchannel.key(["enter"], function (ch, key) {
		if (newchannel.getValue().length > 0) {
			newchannelkey.focus();
		} else {
			newchannel.focus();
		}
	});

	newchannelkey.key("enter", function (ch, key) {
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
					name: newchannel.getValue()
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

	textstuff.key("enter", function (ch, key) {
		if (!big) {
			if (textstuff.getValue() != "" && sending == false) {
				sending = true;
				textstuff.style.bg = "red";
				textstuff.render();
				var message = textstuff.getValue();
				if (filedata.channels[scroller].key !== undefined)
					message = encrypt(message, filedata.channels[scroller].key);
				sendMessage(
					filedata.userdata,
					filedata.channels[scroller].name,
					filedata.channels[scroller].mode == "yamachat",
					message,
					res => {
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
