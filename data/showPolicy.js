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
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.base[i].p) + "</span><span style='color:blue'> matches " + policy.base[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("base").appendChild(toAppend);
  }
  for (i = 0; i < policy.adWidget.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output' index='"+ i.toString() +"'>" + escapeHTML(policy.adWidget[i].p) + "</span><span style='color:blue'> matches " + policy.adWidget[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("adWidget").appendChild(toAppend);
	mapXPathToCSS[policy.adWidget[i].p] = policy.adWidget[i].sp;
  }
  for (i = 0; i < policy.otherDeeps.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output' index='"+ i.toString() +"'>" + escapeHTML(policy.otherDeeps[i].p) + "</span><span style='color:blue'> matches " + policy.otherDeeps[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("otherDeeps").appendChild(toAppend);
	mapXPathToCSS[policy.otherDeeps[i].p] = policy.otherDeeps[i].sp;
  }
  for (i = 0; i < policy.root.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.root[i].p) + "</span><span style='color:blue'> matches " + policy.root[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("root").appendChild(toAppend);
  }
  for (i = 0; i < policy.tag.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.tag[i].p) + "</span><span style='color:blue'> matches " + policy.tag[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("tag").appendChild(toAppend);
  }
  for (i = 0; i < policy.parent.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output' index='"+ i.toString() +"'>" + escapeHTML(policy.parent[i].p) + "</span><span style='color:blue'> matches " + policy.parent[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("parent").appendChild(toAppend);
  }
  for (i = 0; i < policy.unclassified.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output clickable' index='"+ i.toString() +"'>" + escapeHTML(policy.unclassified[i].p) + "</span><span style='color:blue'> matches " + policy.unclassified[i].n + " entries. </span><button class='edit'>edit</button><button class='delete'>delete</button><input class='check' type='checkbox' checked></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("unclassified").appendChild(toAppend);
  }
}

function collectPolicies(){
	var extraPolicies = "";
	var basePolicies = "";
	var index = 0;
	var id;
	$("input:checked").parents().children("span.output").each(function (){
		index = parseInt($(this).attr('index'));
		id = $(this).parent().parent().attr("id");
		if (id == "base") {
			basePolicies += policy.base[index].p + "\n";
		}
		else {
			if (id == "root") extraPolicies+="root:";
			if (id == "parent") extraPolicies+="^";
			extraPolicies += policy[id][index].p + "\n";
		}
	});
	return [basePolicies, extraPolicies];
}

function outputPolicy(){
	var policyToOutput = collectPolicies();
	extWindow.postMessage({type:"outputBase", policy: policyToOutput[0], hd: hd, tpd: tpd}, "*");
	extWindow.postMessage({type:"outputExtra", policy: policyToOutput[1], hd: hd, tpd: tpd}, "*");
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

$(document).on("click", "button.edit", null, function(){
	var index = parseInt($(this).parent().children("span.output").attr("index"));
	var type = $(this).parent().parent().attr("id");
	var p = window.prompt("type your policy here:", policy[type][index].p);
	if (!!p){
		policy[type][index].p = p;
		$(this).parent().children("span.output").html(escapeHTML(p));
	}
});

$(document).on("click", "button.delete", null, function(){
	$(this).parent().remove();
});

$(document).on("click", "div.typeHeader>input:checkbox", null, function(){
	$(this).parent().children("ul").children().children("input:checkbox").prop('checked', $(this).prop('checked'));
});
window.addEventListener("message", receiveMessage, false);
