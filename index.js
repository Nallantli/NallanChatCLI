var blessed = require("blessed");
var request = require("request");
var convert = require("xml-js");

const homedir = require('os').homedir() + "//";

var fs = require('fs');
var datadir = homedir + ".yccdata";

console.log(datadir);

if (!fs.existsSync(datadir)){
	fs.mkdirSync(datadir);
}
if (!fs.existsSync(datadir + "//config.json"))
fs.writeFile(datadir + "//config.json", "Hey there!", function(err) {
	if(err) {
		return console.log(err);
	}
});

var channel = "main";
var username = "Nallantli";
var password = "password";
var color = "0000ff";
var channel_list = ["main", "rainmeter", "new-private"];

var screen = blessed.screen({
	smartCSR: true
});

var scroller = 0;

function refreshChat() {
	channel = channel_list[scroller];
	channelbox.setItems(channel_list);
	channelbox.select(scroller);
	chatbox.setLabel(
		"{bold}{cyan-fg} (" +
			(scroller + 1) +
			"/" +
			channel_list.length +
			") " +
			channel +
			" {/}"
	);
	request(
		{ url: "http://chat.yamajac.com/" + channel + "/read", timeout: 800 },
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

channelbox.key(["tab", "enter", "escape"], function(key) {
	chatbox.focus();
});

channelbox.key("=", function(key) {
	screen.append(newchannel);
	newchannel.focus();
});

newchannel.key("escape", function(ch, key) {
	channelbox.focus();
	screen.remove(newchannel);
	newchannel.clearValue();
	screen.render();
});

newchannel.key("enter", function(ch, key) {
	channelbox.focus();
	scroller = channel_list.push(newchannel.getContent()) - 1;
	channelbox.pushItem(newchannel.getContent());
	screen.remove(newchannel);
	newchannel.clearValue();
	refreshChat();
});

textstuff.key("escape", function(ch, key) {
	chatbox.focus();
});

chatbox.key(["tab", "escape"], function(ch, key) {
	channelbox.focus();
});

chatbox.key("enter", function(ch, key) {
	if (sending == false) textstuff.focus();
});

chatbox.key("q", function(ch, key) {
	chatbox.scroll(-1);
});

chatbox.key("e", function(ch, key) {
	chatbox.scroll(1);
});

channelbox.key("q", function(ch, key) {
	if (scroller > 0) {
		scroller--;
		//channel = channel_list[scroller];
		refreshChat();
	}
});

channelbox.key("e", function(ch, key) {
	if (scroller < channel_list.length - 1) {
		scroller++;
		//channel = channel_list[scroller];
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
				headers: {
					user: username,
					password: password,
					colour: color
				},
				uri:
					"http://chat.yamajac.com/" +
					channel +
					"/send/" +
					textstuff.getContent(),
				method: "POST"
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

screen.key("C-c", function(ch, key) {
	clearInterval(run);
	return process.exit(0);
});

channelbox.focus();
channelbox.select(0);

refreshChat();

var run = setInterval(refreshChat, 1000);
