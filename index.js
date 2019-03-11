var blessed = require("neo-blessed");
var request = require("request");
var convert = require("xml-js");
var crypto = require("crypto");
var fs = require("fs");
var homedir = require("os").homedir() + "\\";

const _key = Buffer.alloc(32); // key should be 32 bytes
const _iv = Buffer.alloc(16); // iv should be 16

var run;
var run_buffer;
var datadir = homedir + ".yccdata";
if (!fs.existsSync(datadir)) {
	fs.mkdirSync(datadir);
}
if (!fs.existsSync(datadir + "\\config.json")) {
	var def = fs.readFileSync("defaultconfig.json", "utf8");
	fs.writeFileSync(datadir + "\\config.json", def, function(err) {
		if (err) {
			console.log(err);
			return process.exit(0);
		}
	});
}

var filedata = JSON.parse(fs.readFileSync(datadir + "\\config.json", "utf8"));
var keybinds = filedata.keybinds;

const screen = blessed.screen({
	title: "YamaChatCLI",
	smartCSR: true
});

var enter_url = blessed.textbox({
	label: " Enter Chat Url ",
	top: "center",
	left: "center",
	width: "50%",
	height: 3,
	inputOnFocus: true,
	keys: false,
	border: {
		type: "line"
	},
	style: {
		focus: {
			border: {
				fg: "green"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		}
	}
});
var chatbox = blessed.box({
	scrollable: true,
	alwaysScroll: true,
	label: " Loeading... ",
	top: "0",
	left: "0",
	tags: true,
	width: "100%-20",
	scrollbar: {
		ch: " ",
		track: {
			bg: "green"
		},
		style: {
			inverse: true
		}
	},
	height: "100%-2",
	content: "...",
	border: {
		type: "line"
	},
	style: {
		focus: {
			border: {
				fg: "green"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		},
		hover: {
			bg: "green"
		}
	}
});

var channelbox = blessed.list({
	label: "{bold}{cyan-fg} Channels {/cyan-fg}{/bold}",
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
			bg: "green"
		},
		style: {
			inverse: true
		}
	},
	style: {
		item: {
			hover: {
				bg: "green"
			}
		},
		selected: {
			bg: "green",
			fg: "black",
			bold: true
		},
		focus: {
			border: {
				fg: "green"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		}
	}
});

var textstuff = blessed.textbox({
	top: "100%-3",
	left: "0",
	width: "100%-20",
	height: 3,
	tags: true,
	inputOnFocus: true,
	border: {
		type: "line"
	},
	style: {
		focus: {
			border: {
				fg: "green"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		}
	}
});

var newchannel = blessed.textbox({
	label: " Enter New Channel ",
	top: "center",
	left: "center",
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
				fg: "green"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		}
	}
});

var channel_name_list = [];

function encrypt(text, key) {
	let crypkey = Buffer.concat([Buffer.from(key)], _key.length);
	let cipher = crypto.createCipheriv("aes-256-cbc", crypkey, _iv);
	let encrypted = cipher.update(text);
	encrypted = Buffer.concat([encrypted, cipher.final()]);
	return encrypted.toString("hex");
}

function decrypt(text, key) {
	try {
		let encryptedText = Buffer.from(text, "hex");
		let crypkey = Buffer.concat([Buffer.from(key)], _key.length);
		let decipher = crypto.createDecipheriv("aes-256-cbc", crypkey, _iv);
		let decrypted = decipher.update(encryptedText);
		decrypted = Buffer.concat([decrypted, decipher.final()]);
		return decrypted.toString();
	} catch {
		return "ERROR";
	}
}

//var userdata = filedata.userdata;var channel_name_list = [];

//var channel = filedata.channels[0];

var scroller = 0;

var buffer = {};

function refreshBuffer() {
	channelbox.setItems(channel_name_list);
	chatbox.setLabel(
		"{bold}{cyan-fg} (" +
			(scroller + 1) +
			"/" +
			filedata.channels.length +
			") " +
			filedata.channels[scroller].name +
			(filedata.channels[scroller].key != undefined ? " : ENCRYPTED" : "") +
			" {/}"
	);
	if (buffer[filedata.channels[scroller].name] == undefined) {
		chatbox.setContent("Loading...");
		refreshChat(filedata.channels[scroller]);
	} else {
		chatbox.setContent(buffer[filedata.channels[scroller].name]);
	}
	screen.render();
}

enter_url.key("enter", function(ch, key) {
	if (enter_url.getContent().length > 0) {
		filedata["base-url"] = enter_url.getContent();
		screen.remove(enter_url);
	} else {
		return process.exit(0);
	}
});

enter_url.key("escape", function(ch, key) {
	return process.exit(0);
});

channelbox.key(keybinds["channel-to-chat"], function(key) {
	chatbox.focus();
});

channelbox.key(keybinds["channel-to-text"], function(key) {
	textstuff.focus();
});

channelbox.key(keybinds["add-channel"], function(key) {
	screen.append(newchannel);
	newchannel.focus();
});

channelbox.key(keybinds["remove-channel"], function(key) {
	filedata.channels.splice(scroller, 1);
	if (scroller > 0) scroller--;
	//refreshChat();
});

newchannel.key(keybinds["exit-window"], function(ch, key) {
	channelbox.focus();
	screen.remove(newchannel);
	newchannel.clearValue();
	screen.render();
});

newchannel.key("enter", function(ch, key) {
	if (newchannel.getContent().length > 0) {
		channelbox.focus();
		scroller = filedata.channels.push(newchannel.getContent()) - 1;
		channelbox.pushItem(newchannel.getContent());
		screen.remove(newchannel);
		newchannel.clearValue();
		//refreshChat();
	} else {
		screen.remove(newchannel);
		newchannel.clearValue();
		channelbox.focus();
	}
});

textstuff.key(keybinds["exit-window"], function(ch, key) {
	chatbox.focus();
});

chatbox.key(keybinds["chat-to-channel"], function(ch, key) {
	channelbox.focus();
});

chatbox.key(keybinds["enter-text"], function(ch, key) {
	if (sending == false) textstuff.focus();
});

chatbox.key(keybinds["scroll-up"], function(ch, key) {
	chatbox.scroll(-1);
});

chatbox.key(keybinds["scroll-down"], function(ch, key) {
	chatbox.scroll(1);
});

channelbox.key(keybinds["scroll-up"], function(ch, key) {
	if (scroller > 0) {
		scroller--;
		//channel = filedata.channels[scroller].name;
		channelbox.up(1);
		//refreshChat();
	}
});

channelbox.key(keybinds["scroll-down"], function(ch, key) {
	if (scroller < filedata.channels.length - 1) {
		scroller++;
		//channel = filedata.channels[scroller].name;
		channelbox.down(1);
		//refreshChat();
	}
});

screen.key(keybinds["quit"], function(ch, key) {
	clearInterval(run);
	clearInterval(run_buffer);
	fs.writeFileSync(
		datadir + "\\config.json",
		JSON.stringify(filedata),
		function(err) {
			if (err) {
				console.log(err);
				return process.exit(0);
			}
		}
	);
	return process.exit(0);
});

textstuff.key("enter", function(ch, key) {
	if (textstuff.getContent() != "" && sending == false) {
		sending = true;
		textstuff.style.bg = "red";
		textstuff.render();
		var message = textstuff.getContent();
		if (filedata.channels[scroller].key !== undefined)
			message = encrypt(message, filedata.channels[scroller].key);
		request(
			{
				headers: filedata.userdata,
				uri:
					filedata["base-url"] +
					filedata.channels[scroller].name +
					"/send/" +
					message,
				method: "POST",
				agent: false,
				pool: {
					maxSockets: Infinity
				},
				timeout: 1000
			},
			function(err, res, html) {
				textstuff.clearValue();
				sending = false;
				textstuff.style.bg = "black";
				refreshChat(filedata.channels[scroller]);
			}
		);
	}
});

function startClient() {
	for (var i = 0; i < filedata.channels.length; i++) {
		channel_name_list.push(filedata.channels[i].name);
	}

	if (filedata["base-url"] == undefined) {
		screen.append(enter_url);
		enter_url.focus();
	} else {
		screen.remove(enter_url);
		screen.append(chatbox);
		screen.append(channelbox);
		screen.append(textstuff);
	}

	channelbox.focus();
	channelbox.select(0);
	run = setInterval(function() {
		refreshChat(filedata.channels[scroller]);
	}, 1000);

	run_buffer = setInterval(refreshBuffer, 200);

	refreshBuffer();
}

var sending = false;

function refreshChat(channel_full) {
	var channel = channel_full.name;
	//if (refreshing == false) {
	//	refreshing = true;
	request({
			uri: filedata["base-url"] + channel + "/read",
			pool: {
				maxSockets: Infinity
			},
			json: false,
			timeout: 1000,
			agent: false
		},
		(err, res, html) => {
			if (html !== undefined) {
				body_edit = html.split("\r\n");
				s = "";
				var prev = "";
				for (var i = 0; i < body_edit.length - 1; i++) {
					json = JSON.parse(
						convert.xml2json(body_edit[i], { compact: true, spaces: 4 })
					);
					time = json["div"]["_attributes"]["data-timestamp"].split(" ");
					if (prev != time[0]) {
						prev = time[0];
						s += "\n{green-bg}{black-fg} - " + prev + " - ";
					}
					var mess = json.div._text;
					if (channel_full.key !== undefined && mess !== undefined)
						mess = decrypt(mess, channel_full.key);
					s =
						s +
						"\n{/}" +
						time[1] +
						" {bold}{#" +
						json["div"]["_attributes"]["data-colour"] +
						"-fg}" +
						json["div"]["_attributes"]["data-username"] +
						" {/}" +
						mess;
				}
				s = s.substr(1);
				if (s != buffer[channel]) {
					buffer[channel] = s;
				}
				channelbox.render();
			}
		});
	//}
}

startClient();
