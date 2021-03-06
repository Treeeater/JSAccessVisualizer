var extWindow;
var mapXPathToCSS = {};
var hd = "";
var tpd = "";
var policy = "";		//data

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

function receiveMessage(event)
{
  policy = event.data.policy;
  hd = event.data.domain;
  tpd = event.data.thirdPDomain;
  document.getElementById("hd").innerHTML = hd;
  document.getElementById("tpd").innerHTML = tpd;
  document.getElementById("vn").innerHTML = policy.totalViolatingEntries;
  extWindow = event.source;
  var i = 0;
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
  for (i = 0; i < policy.base.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + escapeHTML(policy.base[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.base[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Gen'>move2Gen</button><button class='move2Others'>move2Others</button><input class='check' type='checkbox' checked>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("base").appendChild(toAppend);
  }
  for (i = 0; i < policy.adWidget.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output'>" + escapeHTML(policy.adWidget[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.adWidget[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("adWidget").appendChild(toAppend);
	mapXPathToCSS[policy.adWidget[i].p] = policy.adWidget[i].sp;
  }
  for (i = 0; i < policy.otherDeeps.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output'>" + escapeHTML(policy.otherDeeps[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.otherDeeps[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("otherDeeps").appendChild(toAppend);
	mapXPathToCSS[policy.otherDeeps[i].p] = policy.otherDeeps[i].sp;
  }
  for (i = 0; i < policy.root.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + escapeHTML(policy.root[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.root[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("root").appendChild(toAppend);
  }
  for (i = 0; i < policy.tag.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + escapeHTML(policy.tag[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.tag[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("tag").appendChild(toAppend);
  }
  for (i = 0; i < policy.parent.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + escapeHTML(policy.parent[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.parent[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("parent").appendChild(toAppend);
  }
  for (i = 0; i < policy.unclassified.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output clickable'>" + escapeHTML(policy.unclassified[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.unclassified[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("unclassified").appendChild(toAppend);
  }
}

function collectPolicies(){
	var extraPolicies = "";
	var basePolicies = "";
	var genericPolicies = "";
	var index = 0;
	var id;
	$("input:checked").parents().children("span.output").each(function (){
		id = $(this).parent().parent().attr("id");
		if (id == "base") {
			basePolicies += $(this).text() + "\n";
		}
		else if (id == "generic"){
			genericPolicies += $(this).text() + "\n";
		}
		else {
			if (id == "root") extraPolicies+="root:";
			if (id == "parent") extraPolicies+="^";
			extraPolicies += $(this).text() + "\n";
		}
	});
	return [basePolicies, extraPolicies, genericPolicies];
}

function outputPolicy(){
	var policyToOutput = collectPolicies();
	extWindow.postMessage({type:"outputBase", policy: policyToOutput[0], hd: hd, tpd: tpd}, "*");
	extWindow.postMessage({type:"outputExtra", policy: policyToOutput[1], hd: hd, tpd: tpd}, "*");
	extWindow.postMessage({type:"outputGeneric", policy: policyToOutput[2], hd: hd, tpd: tpd}, "*");
}

function checkAll(event){
	$(":checkbox").prop('checked', event.target.checked);
}

$(document).on("click", "span.clickable", null, function(){
	var xpath = $(this).text();
	xpath = xpath.substr(0, xpath.indexOf('>'));
	if (xpath.indexOf("#text[") > -1) xpath = xpath.substr(0, xpath.indexOf("#text["));
	if ($(this).hasClass("clicked")){
		extWindow.postMessage({type:"remove", selector: mapXPathToCSS[$(this).text()], XPath:xpath}, "*");
	}
	else{
		extWindow.postMessage({type:"clicked", selector: mapXPathToCSS[$(this).text()], XPath:xpath}, "*");
	}
	$(this).toggleClass("clicked");
});		//affects future elements.

function constructCSSFromXPath(p){
	var retVal = "";
	if (p.indexOf("sub:") == 0) p = p.substr(4);
	if (p.indexOf(">") > -1) p = p.substr(0, p.indexOf(">"));
	if (p.indexOf("//") == 0){
		var tagName = p.substr(2, p.indexOf("[") - 2);
		var consistentModifier = "";		//.class, [id='asdf']
		var multipleModifiers = [];			//[class^='ad'],[class*='ad ']
		p = p.substr(p.indexOf("[")+1);
		while (p.length > 0 && p[0]!="]"){
			p = p.substr(1);		//get rid of @
			var attrName = p.substr(0, p.indexOf("="));
			p = p.substr(attrName.length + 2);		//get rid of ='
			var attrValue = p.substr(0, p.indexOf("'"));
			if (attrName == "class") {
				//class names cannot have .* in them.  If forced to have, cannot visualize correctly.
				if (attrValue.substr(0,2) != ".*" && attrValue.substr(-2,2) != ".*") consistentModifier += "." + attrValue;
				else if (attrValue.substr(-2,2) == ".*" && attrValue.substr(0,2) == ".*") {
					attrValue = attrValue.substr(2, attrValue.length - 4);
					consistentModifier = "[class*='" + attrValue + "']";
				}
				else if (attrValue.substr(0,2) == ".*" && attrValue.substr(-2,2) != ".*") {
					attrValue = attrValue.substr(2);
					multipleModifiers[0] = "[class$='" + attrValue + "']";
					multipleModifiers[1] = "[class*=' " + attrValue + "']";
				}
				else if (attrValue.substr(-2,2) == ".*" && attrValue.substr(0,2) != ".*") {
					attrValue = attrValue.substr(0, attrValue.length - 2);
					multipleModifiers[0] = "[class^='" + attrValue + "']";
					multipleModifiers[1] = "[class*='" + attrValue + " ']";
				}
			}
			else {
				consistentModifier += "[";
				consistentModifier += attrName;
				if (attrValue == ".*") {attrValue = "";}		//has attribute is good enuf
				else if (attrValue.substr(0,2) == ".*" && attrValue.substr(-2,2) != ".*") {
					consistentModifier += "$='";
					attrValue = attrValue.substr(2) + "'";
				}
				else if (attrValue.substr(-2,2) == ".*" && attrValue.substr(0,2) != ".*") {
					consistentModifier += "^='";
					attrValue = attrValue.substr(0, attrValue.length - 2) + "'";
				}
				else if (attrValue.substr(-2,2) == ".*" && attrValue.substr(0,2) == ".*") {
					consistentModifier += "*='";
					attrValue = attrValue.substr(2, attrValue.length - 4) + "'";
				}
				else {
					//trivial case.
					attrValue = "='" + attrValue + "'";
				}
				consistentModifier += attrValue + "]";
			}
			p = p.substr(p.indexOf("'")+1);
		}
		if (multipleModifiers.length == 0) retVal = tagName + consistentModifier;
		else {
			retVal = tagName + multipleModifiers[0] + consistentModifier + "," + tagName + multipleModifiers[1] + consistentModifier;
		}
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

$(document).on("click", "button.move2Base", null, function(){
	$(this).parent().appendTo($("#base"));
	$(this).remove();
});

$(document).on("click", "button.move2Others", null, function(){
	$(this).parent().appendTo($("#otherDeeps"));
	$(this).remove();
});

$(document).on("click", "button.move2Gen", null, function(){
	if ($(this).parent().parent().attr("id") == "root") $(this).parent().children("span.output").html("root:" + $(this).parent().children("span.output").text());
	if ($(this).parent().parent().attr("id") == "parent") $(this).parent().children("span.output").html("^" + $(this).parent().children("span.output").text());
	$(this).parent().appendTo($("#generic"));
	$(this).remove();
});

$(document).on("click", "button.delete", null, function(){
	$(this).parent().remove();
});

$(document).on("click", "button.addPolicy", null, function(){
	var p = window.prompt("type your policy here:", "");
	if (!!p){
		mapXPathToCSS[p] = constructCSSFromXPath(p);
		var id = $(this).parent().children("ul").attr("id");
		var extraClass = (id == "adWidget" || id == "otherDeeps") ? " clickable" : ""
		$(this).parent().children("ul").append("<li class='policyEntry'><span class='output" + extraClass + "'>"+escapeHTML(p)+"</span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input></li>");
	}
});



$(document).on("click", "div.typeHeader>input:checkbox", null, function(){
	$(this).parent().children("ul").children().children("input:checkbox").prop('checked', $(this).prop('checked'));
});
window.addEventListener("message", receiveMessage, false);
