var mapXPathToCSS = {};
var hd = "";
var tpd = "";
var policy;		//data
var extWindow;
var phase;

var entityMap = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"\'": "&#39;",
	"/": "&#x2F;"
}

function escapeHTML(string){
	return String(string).replace(/[&<>"'\/]/g, function(s){return entityMap[s];});
}

function receiveMessage(event){
	var data = event.data;
	extWindow = event.source;
	policy = data.p;
	var i = 0;
	for (var ptype in policy){
		for (i = 0; i < policy[ptype].length; i++) {
			var p = policy[ptype][i].p.split(">")[0];
			var a = policy[ptype][i].p.split(">")[1];
			if (!!a && a.indexOf("#text")==0) {
				p = p + "/#text[*]";
				a = a.substr(5);
				policy[ptype][i].p = p + ">" + a;
			}
		}
	}
	switch (data.type){
		case "base":
			document.getElementById("hd").innerHTML = data.hd;
			document.getElementById("tpd").innerHTML = data.tpd;
			document.getElementById("mn").innerHTML = data.matches;
			document.getElementById("rvn").innerHTML = policy.totalViolatingEntries;
			for (i = 0; i < policy.base.length; i++){
				var toAppend = document.createElement("li");
				toAppend.innerHTML = "<span class='output'>" + escapeHTML(policy.base[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.base[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Gen'>move2Gen</button><button class='move2Others'>move2Others</button><input class='check' type='checkbox' checked>";
				$(toAppend).addClass("policyEntry");
				document.getElementById("base").appendChild(toAppend);
			}
			if (policy.base.length > 0) $("#base").parent().toggleClass("hidden");
			policy = data.p;
			phase = data.type;
			break;
		default:
			break;
	}
}

function sendMessage(msg){
	extWindow.postMessage({type:"fromInteractive", p:policy, phase:msg}, "*");
}

function next(){
	switch (phase){
		case "base":
			sendMessage(phase);
			window.close();
			break;
		default:
			break;
	}
}

window.addEventListener("message", receiveMessage, false);