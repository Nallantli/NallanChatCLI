const blessed = require("neo-blessed");
const request = require("request");
const convert = require("xml-js");
const crypto = require("crypto");
const fs = require("fs");
const homedir = require("os").homedir() + "\\";

const _key = Buffer.alloc(32); // key should be 32 bytes
const _iv = Buffer.alloc(16); // iv should be 16

var old_channel = "";

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
	smartCSR: true,
	fullUnicode: true
});

var enter_url = blessed.textbox({
	label: "{bold}{" + filedata.color.accent + "-fg} Enter Chat Url {/}",
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
				fg: "#" + filedata.color.main
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
	label: " Loading... ",
	top: "0",
	left: "0",
	tags: true,
	width: "100%-20",
	scrollbar: {
		ch: " ",
		track: {
			bg: "#" + filedata.color.main
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
				fg: "#" + filedata.color.main
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		},
		hover: {
			bg: "#" + filedata.color.main
		}
	}
});

var newchannelform = blessed.box({
	label: "{bold}{#" + filedata.color.accent + "-fg} New Channel {/}",
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
				fg: "#" + filedata.color.main
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		},
		hover: {
			bg: "#" + filedata.color.main
		}
	}
});

var channelbox = blessed.list({
	label: "{bold}{#" + filedata.color.accent + "-fg} Channels {/}",
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
			bg: "#" + filedata.color.main
		},
		style: {
			inverse: true
		}
	},
	style: {
		item: {
			hover: {
				bg: "#" + filedata.color.main
			}
		},
		selected: {
			bg: "#" + filedata.color.main,
			fg: "black",
			bold: true
		},
		focus: {
			border: {
				fg: "#" + filedata.color.main
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
	inputOnFocus: true,
	border: {
		type: "line"
	},
	style: {
		focus: {
			border: {
				fg: "#" + filedata.color.main
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
				fg: "#" + filedata.color.main
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
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
				fg: "#" + filedata.color.main
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "white"
		}
	}
});

newchannelform.append(newchannel);
newchannelform.append(newchannelkey);

var channel_name_list = [];

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

//var userdata = filedata.userdata;var channel_name_list = [];

//var channel = filedata.channels[0];

var scroller = 0;

var buffer = {};

function refreshBuffer() {
	channelbox.setItems(channel_name_list);
	chatbox.setLabel(
		"{bold}{#" +
			filedata.color.accent +
			"-fg} (" +
			(scroller + 1) +
			"/" +
			filedata.channels.length +
			") " +
			filedata.channels[scroller].name +
			(filedata.channels[scroller].key != undefined ? " : ENCRYPTED" : "") +
			" {/}"
	);
	chatbox.setContent(buffer[filedata.channels[scroller].name]);
	if (
		buffer[filedata.channels[scroller].name] === undefined ||
		old_channel !== filedata.channels[scroller].name
	) {
		chatbox.setScroll(Infinity);
	}
	chatbox.setScroll(Infinity);
	old_channel = filedata.channels[scroller].name;
	//screen.render();
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
	screen.append(newchannelform);
	newchannel.focus();
});

channelbox.key(keybinds["remove-channel"], function(key) {
	filedata.channels.splice(scroller, 1);
	channel_name_list.splice(scroller, 1);
	if (scroller > 0) scroller--;
	refreshBuffer();
});

newchannel.key(keybinds["exit-window"], function(ch, key) {
	channelbox.focus();
	screen.remove(newchannelform);
	newchannel.clearValue();
	screen.render();
});

newchannel.key("enter", function(ch, key) {
	if (newchannel.getContent().length > 0) {
		newchannelkey.focus();
	} else {
		newchannel.focus();
	}
});

newchannelkey.key("enter", function(ch, key) {
	if (newchannel.getContent().length > 0) {
		channelbox.focus();
		scroller = filedata.channels.length;
		if (newchannelkey.getContent().length > 0) {
			filedata.channels.push({
				name: newchannel.getContent(),
				key: newchannelkey.getContent()
			});
		} else {
			filedata.channels.push({
				name: newchannel.getContent()
			});
		}
		channel_name_list.push(newchannel.getContent());
		screen.remove(newchannelform);
		refreshBuffer();
		channelbox.select(scroller);
		newchannel.clearValue();
		newchannelkey.clearValue();
	} else {
		screen.remove(newchannelform);
		newchannel.clearValue();
		newchannelkey.clearValue();
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

chatbox.key(keybinds["scroll-all"], function(ch, key) {
	chatbox.setScroll(chatbox.getScrollHeight());
});

chatbox.key(keybinds["scroll-down"], function(ch, key) {
	chatbox.scroll(1);
});

channelbox.key(keybinds["scroll-up"], function(ch, key) {
	if (scroller > 0) {
		scroller--;
		//channel = filedata.channels[scroller].name;
		channelbox.up(1);
		refreshBuffer();
		//refreshChat();
	}
});

channelbox.key(keybinds["scroll-down"], function(ch, key) {
	if (scroller < filedata.channels.length - 1) {
		scroller++;
		//channel = filedata.channels[scroller].name;
		channelbox.down(1);
		refreshBuffer();
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
				headers: {
					user: encodeURIComponent(filedata.userdata.user),
					password: filedata.userdata.password,
					colour: filedata.userdata.colour
				},
				uri:
					filedata["base-url"] +
					encodeURIComponent(filedata.channels[scroller].name) +
					"/send/" +
					encodeURIComponent(message),
				method: "POST",
				agent: false,
				pool: {
					maxSockets: Infinity
				},
				timeout: 500
			},
			function(err, res, html) {
				textstuff.clearValue();
				sending = false;
				textstuff.style.bg = "black";
				//refreshChat(filedata.channels[scroller]);
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
	request(
		{
			uri: filedata["base-url"] + channel + "/read",
			pool: {
				maxSockets: Infinity
			},
			json: false,
			timeout: 500,
			agent: false
		},
		(err, res, html) => {
			if (html !== undefined) {
				body_edit = html.split("\r\n");
				s = [];
				var prev = "";
				for (var i = body_edit.length - 2; i >= 0; i--) {
					json = JSON.parse(
						convert.xml2json(body_edit[i], { compact: true, spaces: 4 })
					);
					time = json["div"]["_attributes"]["data-timestamp"].split(" ");
					var mess = json.div._text;

					if (mess === undefined) mess = "";

					if (channel_full.key !== undefined)
						mess = decrypt(mess, channel_full.key);

					mess = mess.replace("[b]", "{bold}");
					mess = mess.replace("[/b]", "{/bold}");
					mess = mess.replace("[u]", "{underline}");
					mess = mess.replace("[/u]", "{/underline}");

					if (prev != time[0]) {
						prev = time[0];
						s.push(
							"{#" + filedata.color.main + "-fg}{underline}{bold}\t" + prev
						);
					}
					s.push(
						"{/}" +
							time[1] +
							" {bold}{" +
							(json["div"]["_attributes"]["data-colour"] == "null"
								? "white"
								: "#" + json["div"]["_attributes"]["data-colour"]) +
							"-fg}" +
							decodeURIComponent(json["div"]["_attributes"]["data-username"]) +
							" {/}" +
							mess
					);
				}
				text = s.join("\n");
				if (text != buffer[channel]) {
					buffer[channel] = text;
				}
			}
		}
	);
}

startClient();
