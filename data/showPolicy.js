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
  for (i = 0; i < policy.base.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.base[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.base[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("base").appendChild(toAppend);
  }
  for (i = 0; i < policy.adWidget.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output' index='"+ i.toString() +"'>" + escapeHTML(policy.adWidget[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.adWidget[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("adWidget").appendChild(toAppend);
	mapXPathToCSS[policy.adWidget[i].p] = policy.adWidget[i].sp;
  }
  for (i = 0; i < policy.otherDeeps.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output' index='"+ i.toString() +"'>" + escapeHTML(policy.otherDeeps[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.otherDeeps[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("otherDeeps").appendChild(toAppend);
	mapXPathToCSS[policy.otherDeeps[i].p] = policy.otherDeeps[i].sp;
  }
  for (i = 0; i < policy.root.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.root[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.root[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("root").appendChild(toAppend);
  }
  for (i = 0; i < policy.tag.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.tag[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.tag[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("tag").appendChild(toAppend);
  }
  for (i = 0; i < policy.parent.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.parent[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.parent[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("parent").appendChild(toAppend);
  }
  for (i = 0; i < policy.unclassified.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output clickable' index='"+ i.toString() +"'>" + escapeHTML(policy.unclassified[i].p) + "</span><span class='matchCount' style='color:blue'> matches " + policy.unclassified[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><button class='move2Base'>move2Base</button><button class='move2Gen'>move2Gen</button><input class='check' type='checkbox' checked></input>";
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
	if (p.indexOf("//") == 0){
		retVal = p.substr(2, p.indexOf("[") - 2);
		p = p.substr(p.indexOf("[")+1);
		while (p.length > 0 && p[0]!="]"){
			p = p.substr(1);		//get rid of @
			retVal += "[";
			var tagName = p.substr(0, p.indexOf("="));
			if (tagName == "class") {
				//class names cannot have .* in them.  If forced to have, cannot visualize correctly.
				retVal += "." + p.substr(retVal.length + 2)
			}
			else {
				retVal += tagName;
				p = p.substr(tagName.length + 2);		//get rid of ='
				var value = p.substr(0, p.indexOf("'"));
				if (value.substr(0,2) ==".*") {retVal += "$"; value = value.substr(2);}
				if (value.substr(-2,2) == ".*") {retVal += "^"; value = value.substr(0, value.length - 2);}
				retVal += "='" + value + "']"
				p = p.substr(p.indexOf("'")+1);
			}
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

$(document).on("click", "button.move2Gen", null, function(){
	$(this).parent().appendTo($("#generic"));
	$(this).remove();
});

$(document).on("click", "button.delete", null, function(){
	$(this).parent().remove();
});

$(document).on("click", "div.typeHeader>input:checkbox", null, function(){
	$(this).parent().children("ul").children().children("input:checkbox").prop('checked', $(this).prop('checked'));
});
window.addEventListener("message", receiveMessage, false);
