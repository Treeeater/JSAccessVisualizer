var mapXPathToCSS = {};
var hd = "";
var tpd = "";
var policy;		//data
var extWindow;
var phase;
var eleIDToPolicyMap = {};
var policyID = 0;

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
	phase = data.type;
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
	document.getElementById("hd").innerHTML = data.hd;
	document.getElementById("tpd").innerHTML = data.tpd;
	document.getElementById("mn").innerHTML = data.matches;
	document.getElementById("rvn").innerHTML = policy.totalViolatingEntries;
	switch (data.type){
		case "base":
			console.log("base UI phase");
			for (i = 0; i < policy.base.length; i++){
				policyID++;
				eleIDToPolicyMap[policyID.toString()] = policy.base[i].p;
				var toAppend = document.createElement("li");
				toAppend.innerHTML = "<span class='output' policyID='" + policyID + "'>" + escapeHTML(policy.base[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.base[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Gen'>move2Gen</button><button class='move2Others'>move2Others</button><input class='check' type='checkbox' checked>";
				$(toAppend).addClass("policyEntry");
				document.getElementById("base").appendChild(toAppend);
			}
			if (policy.base.length > 0) {
				$("#base").parent().removeClass("gray");
				$("#base").parent().children("span.categoryTitle").addClass("blue");
				$("#base").parent().children("ul").toggleClass("hidden");
			}
			break;
		case "existing":
			console.log("existing policy UI phase");
			var ep = data.ep;
			ep = ep.split("\n");
			for (var i = 0; i < ep.length; i++){
				if (ep[i] == "") continue;
				var toAppend = document.createElement("li");
				toAppend.innerHTML = "<span>" + escapeHTML(ep[i]) + "</span>";
				$(toAppend).addClass("policyEntry");
				document.getElementById("existing").appendChild(toAppend);
			}
			if (ep.length > 0) {
				$("#existing").parent().removeClass("gray");
				$("#existing").parent().children("ul").removeClass("hidden");
			}
			if ($("#base").parent().children("span.categoryTitle").hasClass("blue")) {
				$("#base").parent().children("span.categoryTitle").removeClass("blue");
				$("#base").parent().children("span.categoryTitle").addClass("green");
				$("#base").parent().children("ul").addClass("hidden");
			}
			next();			//call next right away, no need to wait here.
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
			policy.base = [];
			$("input:checked").parents().children("span.output").each(function (){
				policy.base.push({p:$(this).text(), n:"?"});
			});
			sendMessage(phase);
			break;
		case "existing":
			//no policy could possibly change here, send message right away.
			sendMessage(phase);
			break;
		default:
			break;
	}
}

$("span.categoryTitle").on("click", function(){
	$(this).parent().children("ul").toggleClass("hidden");
});

window.addEventListener("message", receiveMessage, false);