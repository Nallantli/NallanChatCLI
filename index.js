var blessed = require("blessed");
var request = require("request");
var convert = require("xml-js");
var fs = require("fs");

const homedir = require("os").homedir() + "\\";

var datadir = homedir + ".yccdata";

if (!fs.existsSync(datadir)) {
	fs.mkdirSync(datadir);
}
if (!fs.existsSync(datadir + "\\config.json")) {
	var def = fs.readFileSync("defaultconfig.json", "utf8");
	fs.writeFileSync(datadir + "\\config.json", def, function(err) {
		if (err) {
			return console.log(err);
		}
	});
}
var filedata = JSON.parse(fs.readFileSync(datadir + "\\config.json", "utf8"));
//var userdata = filedata.userdata;
//var channel_list = filedata.channels;
var keybinds = filedata.keybinds;
var channel = filedata.channels[0];

var screen = blessed.screen({
	smartCSR: true
});

var scroller = 0;

function refreshChat() {
	channel = filedata.channels[scroller];
	channelbox.setItems(filedata.channels);
	channelbox.select(scroller);
	chatbox.setLabel(
		"{bold}{cyan-fg} (" +
			(scroller + 1) +
			"/" +
			filedata.channels.length +
			") " +
			channel +
			" {/}"
	);
	request(
		{ url: "http://chat.yamajac.com/" + channel + "/read", timeout: 1000 },
		function(error, response, body) {
			if (body !== undefined) {
				body_edit = body.split("\r\n");
				s = "";
				for (var i = 0; i < body_edit.length - 1; i++) {
					json = JSON.parse(
						convert.xml2json(body_edit[i], { compact: true, spaces: 4 })
					);
					s =
						s +
						"\n" +
						json["div"]["_attributes"]["data-timestamp"] +
						" " +
						"{bold}{#" +
						json["div"]["_attributes"]["data-colour"] +
						"-fg}" +
						json["div"]["_attributes"]["data-username"] +
						" {/}" +
						json.div._text;
				}
				s = s.substr(1);
				chatbox.setContent(s);
				screen.render();
			}
		}
	);
}

screen.title = "YamaChat";

var chatbox = blessed.box({
	scrollable: true,
	alwaysScroll: true,
	label: "{bold}{cyan-fg} Loeading... {/cyan-fg}{/bold}",
	top: "0",
	left: "0",
	width: "100%-20",
	scrollbar: {
		ch: " ",
		track: {
			bg: "cyan"
		},
		style: {
			inverse: true
		}
	},
	height: "100%-3",
	content: "...",
	tags: true,
	border: {
		type: "line"
	},
	style: {
		focus: {
			border: {
				fg: "red"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "#f0f0f0"
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
		ch: " ",
		track: {
			bg: "cyan"
		},
		style: {
			inverse: true
		}
	},
	style: {
		item: {
			hover: {
				bg: "blue"
			}
		},
		selected: {
			bg: "blue",
			bold: true
		},
		focus: {
			border: {
				fg: "red"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "#f0f0f0"
		},
		hover: {
			bg: "green"
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
				fg: "red"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "#f0f0f0"
		},
		hover: {
			bg: "green"
		}
	}
});

var newchannel = blessed.textbox({
	label: " Enter New Channel ",
	top: "center",
	left: "center",
	width: 40,
	height: 3,
	inputOnFocus: true,
	border: {
		type: "line"
	},
	style: {
		focus: {
			border: {
				fg: "red"
			}
		},
		fg: "white",
		bg: "black",
		border: {
			fg: "#f0f0f0"
		},
		hover: {
			bg: "green"
		}
	}
});

screen.append(chatbox);
screen.append(channelbox);
screen.append(textstuff);

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
	if (scroller > 0)
		scroller--;
	refreshChat();
});

newchannel.key(keybinds["exit-window"], function(ch, key) {
	channelbox.focus();
	screen.remove(newchannel);
	newchannel.clearValue();
	screen.render();
});

newchannel.key("enter", function(ch, key) {
	if(newchannel.getContent().length > 0)
	{
		channelbox.focus();
		scroller = channel_list.push(newchannel.getContent()) - 1;
		channelbox.pushItem(newchannel.getContent());
		screen.remove(newchannel);
		newchannel.clearValue();
		refreshChat();
	}
	else
	{
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
		//channel = filedata.channels[scroller];
		refreshChat();
	}
});

channelbox.key(keybinds["scroll-down"], function(ch, key) {
	if (scroller < filedata.channels.length - 1) {
		scroller++;
		//channel = filedata.channels[scroller];
		refreshChat();
	}
});

var sending = false;

textstuff.key("enter", function(ch, key) {
	if (textstuff.getContent() != "" && sending === false) {
		sending = true;
		textstuff.style.bg = "red";
		screen.render();
		request(
			{
				headers: filedata.userdata,
				uri:
					"http://chat.yamajac.com/" +
					channel +
					"/send/" +
					textstuff.getContent(),
				method: "POST",
				timeout: 1000
			},
			function(err, res, body) {
				textstuff.clearValue();
				sending = false;
				textstuff.style.bg = "black";
				refreshChat();
			}
		);
	}
});

screen.key(keybinds["quit"], function(ch, key) {
	clearInterval(run);
	fs.writeFileSync(datadir + "\\config.json", JSON.stringify(filedata), function(err) {
		if (err) {
			return console.log(err);
		}
	});
	return process.exit(0);
});

channelbox.focus();
channelbox.select(0);

refreshChat();

var run = setInterval(refreshChat, 1500);
