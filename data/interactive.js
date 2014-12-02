var mapXPathToCSS = {};
var hd = "";
var tpd = "";
var policy;		//data
var extWindow;
var phase;
var eleIDToPolicyMap = {};
var policyToMatchedNumbersMap = {};
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

function collapse(category){
	if ($("#"+category).parent().children("span.categoryTitle").hasClass("blue")) {
		$("#"+category).parent().children("span.categoryTitle").removeClass("blue");
		$("#"+category).parent().children("span.categoryTitle").addClass("green");
		$("#"+category).parent().children("ul").addClass("hidden");
	}
}
function receiveMessage(event){
	var data = event.data;
	extWindow = event.source;
	policy = data.p;
	phase = data.type;
	var i = 0;
	console.log(policy);
	for (var ptype in policy){
		for (i = 0; i < policy[ptype].length; i++) {
			var p = policy[ptype][i].p.split(">")[0];
			var a = policy[ptype][i].p.split(">")[1];
			if (!!a && a.indexOf("#text")==0 && ptype != "tag") {
				p = p + "/#text[*]";
				a = a.substr(5);
				policy[ptype][i].p = p + ">" + a;
			}
		}
	}
	document.getElementById("hd").innerHTML = data.hd;
	document.getElementById("tpd").innerHTML = data.tpd;
	document.getElementById("mn").innerHTML = data.matches;
	document.getElementById("rvn").innerHTML = data.tve;
	switch (data.type){
		case "base":
			console.log("base UI phase");
			for (i = 0; i < policy.base.length; i++){
				policyID++;
				eleIDToPolicyMap[policyID.toString()] = policy.base[i].p;
				policyToMatchedNumbersMap[policy.base[i].p] = policy.base[i].n;
				var toAppend = document.createElement("li");
				toAppend.innerHTML = "<span class='output' policyID='" + policyID + "'>" + escapeHTML(policy.base[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.base[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked>";
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
				$("#existing").parent().children("span.categoryTitle").addClass("blue");
				$("#existing").parent().children("ul").removeClass("hidden");
			}
			collapse("base");
			break;
		case "tag":
			console.log("tag UI phase");
			for (i = 0; i < policy.tag.length; i++){
				policyID++;
				eleIDToPolicyMap[policyID.toString()] = policy.tag[i].p;
				policyToMatchedNumbersMap[policy.tag[i].p] = policy.tag[i].n;
				var toAppend = document.createElement("li");
				var percentage = parseFloat(policy.tag[i].n)*100;
				toAppend.innerHTML = "<span class='output' policyID='" + policyID + "'>" + escapeHTML(policy.tag[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + percentage.toString().substr(0,4) + "% of all entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked>";
				$(toAppend).addClass("policyEntry");
				document.getElementById("tag").appendChild(toAppend);
			}
			if (policy.tag.length > 0) {
				$("#tag").parent().removeClass("gray");
				$("#tag").parent().children("span.categoryTitle").addClass("blue");
				$("#tag").parent().children("ul").toggleClass("hidden");
			}
			collapse("base");
			collapse("existing");
			break;
		case "insertionOtherDeeps":
			console.log("insertionOtherDeeps UI phase");
			for (i = 0; i < policy.adWidget.length; i++){
				policyID++;
				eleIDToPolicyMap[policyID.toString()] = policy.adWidget[i].p;
				policyToMatchedNumbersMap[policy.adWidget[i].p] = policy.adWidget[i].n;
				var toAppend = document.createElement("li");
				toAppend.innerHTML = "<span class='output clickable' policyID='" + policyID + "'>" + escapeHTML(policy.adWidget[i].p) + "</span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked>";
				$(toAppend).addClass("policyEntry");
				document.getElementById("adWidget").appendChild(toAppend);
				if (!!policy.adWidget[i].sp) mapXPathToCSS[policy.adWidget[i].p] = policy.adWidget[i].sp;
			}
			for (i = 0; i < policy.otherDeeps.length; i++){
				policyID++;
				eleIDToPolicyMap[policyID.toString()] = policy.otherDeeps[i].p;
				policyToMatchedNumbersMap[policy.otherDeeps[i].p] = policy.otherDeeps[i].n;
				var toAppend = document.createElement("li");
				toAppend.innerHTML = "<span class='output clickable' policyID='" + policyID + "'>" + escapeHTML(policy.otherDeeps[i].p) + "</span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked>";
				$(toAppend).addClass("policyEntry");
				document.getElementById("otherDeeps").appendChild(toAppend);
				if (!!policy.otherDeeps[i].sp) mapXPathToCSS[policy.otherDeeps[i].p] = policy.otherDeeps[i].sp;
			}
			if (policy.adWidget.length > 0) {
				$("#adWidget").parent().removeClass("gray");
				$("#adWidget").parent().children("span.categoryTitle").addClass("blue");
				$("#adWidget").parent().children("ul").toggleClass("hidden");
			}
			if (policy.otherDeeps.length > 0) {
				$("#otherDeeps").parent().removeClass("gray");
				$("#otherDeeps").parent().children("span.categoryTitle").addClass("blue");
				$("#otherDeeps").parent().children("ul").toggleClass("hidden");
			}
			collapse("base");
			collapse("existing");
			collapse("tag");
			break;
		default:
			break;
	}
}

function sendMessage(msg){
	extWindow.postMessage({type:"fromInteractive", p:policy, phase:msg}, "*");
}

function convertPolicyFormat(p){
	//This converts a //DIV[@id='c']>getAttribute:src to data structure used in contentScript.js: 
	//{p:"//DIV[@id='c']>getAttribute", sp:"DIV[id='c']", xp:"", a:"getAttribute", n:"src"}
	var pp = p;
	var sp = "";
	var xp = "";
	var a = "";
	var n = "";
	if (p.indexOf("sub:") == 0) p = p.substr(4);
	if (p.indexOf(">") > -1) {
		a = p.substr(p.indexOf(">")+1);
		if (a.indexOf(":")>-1){
			n = a.substr(a.indexOf(":")+1);
			a = a.substr(0, a.indexOf(":"));
		}
		p = p.substr(0, p.indexOf(">"));
	}
	if (p.indexOf("//") == 0){
		sp = p.substr(2, p.indexOf("[") - 2);
		p = p.substr(p.indexOf("[")+1);
		var classes = "";
		while (p.length > 0 && p[0]!="]"){
			p = p.substr(1);		//get rid of @
			var attrName = p.substr(0, p.indexOf("="));
			p = p.substr(attrName.length + 2);		//get rid of ='
			var attrValue = p.substr(0, p.indexOf("'"));
			if (attrName == "class") {
				//class names cannot have .* in them.  If forced to have, cannot visualize correctly.
				classes += "." + attrValue;
			}
			else {
				sp += "[";
				sp += attrName;
				if (attrValue.substr(0,2) ==".*") {sp += "$"; attrValue = attrValue.substr(2);}
				if (attrValue.substr(-2,2) == ".*") {sp += "^"; attrValue = attrValue.substr(0, attrValue.length - 2);}
				sp += "='" + attrValue + "']"
			}
			p = p.substr(p.indexOf("'")+1);
		}
		sp += classes;
	}
	else {
		xp = p;
	}
	return {p:pp, sp:sp, xp:xp, a:a, n:n};
}

function next(){
	switch (phase){
		case "base":
			policy.base = [];
			$("#base input:checked").parents().children("span.output").each(function (){
				policy.base.push({p:$(this).text(), n:(policyToMatchedNumbersMap.hasOwnProperty($(this).text())) ? policyToMatchedNumbersMap[$(this).text()] : "unknown"});
			});
			sendMessage(phase);
			break;
		case "existing":
			//no policy could possibly change here, send message right away.
			sendMessage(phase);
			break;
		case "tag":
			policy.tag = [];
			$("#tag input:checked").parents().children("span.output").each(function (){
				policy.tag.push({p:$(this).text(), n:(policyToMatchedNumbersMap.hasOwnProperty($(this).text())) ? policyToMatchedNumbersMap[$(this).text()] : "unknown"});
			});
			sendMessage(phase);
			break;
		case "insertionOtherDeeps":
			policy.adWidget = [];
			$("#adWidget input:checked").parents().children("span.output").each(function (){
				policy.adWidget.push(convertPolicyFormat($(this).text()));
			});
			$("#adWidget input:checked").parents().children("span.output").each(function (){
				policy.otherDeeps.push(convertPolicyFormat($(this).text()));
			});
			sendMessage(phase);
			break;
		default:
			break;
	}
}

$("span.categoryTitle").on("click", function(){
	$(this).parent().children("ul").toggleClass("hidden");
});

$(document).on("click", "button.delete", null, function(){
	$(this).parent().remove();
});

$(document).on("click", "span.clickable", null, function(){
	var xpath = $(this).text();
	xpath = xpath.substr(0, xpath.indexOf('>'));
	if (xpath.indexOf("#text[") > -1) xpath = xpath.substr(0, xpath.indexOf("#text["));
	if (xpath.indexOf("sub:")==0) xpath = xpath.substr(4);
	if ($(this).hasClass("clicked")){
		extWindow.postMessage({type:"remove", selector: mapXPathToCSS[$(this).text()], XPath:xpath}, "*");
	}
	else{
		if (!mapXPathToCSS.hasOwnProperty($(this).text()) || mapXPathToCSS[$(this).text()] == "") {
			alert("not a valid selector!");
			return;
		}
		extWindow.postMessage({type:"clicked", selector: mapXPathToCSS[$(this).text()], XPath:xpath}, "*");
	}
	$(this).toggleClass("clicked");
});		//affects future elements.

function constructCSSFromXPath(p){
	var retVal = "";
	if (p.indexOf("sub:") == 0) p = p.substr(4);
	if (p.indexOf(">") > -1) p = p.substr(0, p.indexOf(">"));
	if (p.indexOf("//") == 0){
		retVal = p.substr(2, p.indexOf("[") - 2);
		p = p.substr(p.indexOf("[")+1);
		var classes = "";
		while (p.length > 0 && p[0]!="]"){
			p = p.substr(1);		//get rid of @
			var attrName = p.substr(0, p.indexOf("="));
			p = p.substr(attrName.length + 2);		//get rid of ='
			var attrValue = p.substr(0, p.indexOf("'"));
			if (attrName == "class") {
				//class names cannot have .* in them.  If forced to have, cannot visualize correctly.
				classes += "." + attrValue;
			}
			else {
				retVal += "[";
				retVal += attrName;
				if (attrValue.substr(0,2) ==".*") {retVal += "$"; attrValue = attrValue.substr(2);}
				if (attrValue.substr(-2,2) == ".*") {retVal += "^"; attrValue = attrValue.substr(0, attrValue.length - 2);}
				retVal += "='" + attrValue + "']"
			}
			p = p.substr(p.indexOf("'")+1);
		}
		retVal += classes;
	}
	else if (p.indexOf("/HTML[1]") == 0){
		p = p.substr(9);
		var nodes = p.split("/");
		var name = nodes[0].substr(0, nodes[0].indexOf('['));
		retVal += name;
		for (var i = 1; i < nodes.length; i++){
			name = nodes[i].substr(0, nodes[i].indexOf('['));
			retVal += ">" + name + ":nth-of-type(";
			var index = nodes[i].substr(nodes[i].indexOf('[') + 1, nodes[i].indexOf(']') - nodes[i].indexOf('[') - 1);
			retVal += index;
			retVal += ")";
		}
	}
	return retVal;
}

$(document).on("click", "button.edit", null, function(){
	var span = $(this).parent().children("span.output");
	var p = window.prompt("type your policy here:", span.text());
	if (!!p){
		mapXPathToCSS[p] = constructCSSFromXPath(p);
		$(this).parent().children("span.output").html(escapeHTML(p));
		$(this).parent().children("span.matchCount").remove();
	}
});

$(document).on("click", "div.typeHeader>input:checkbox", null, function(){
	$(this).parent().children("ul").children().children("input:checkbox").prop('checked', $(this).prop('checked'));
});

window.addEventListener("message", receiveMessage, false);