var extWindow;
var mapXPathToCSS = {};
var hd = "";
var tpd = "";
function receiveMessage(event)
{
  var d = event.data.policy;
  hd = event.data.domain;
  tpd = event.data.thirdPDomain;
  document.getElementById("hd").innerHTML = hd;
  document.getElementById("tpd").innerHTML = tpd;
  document.getElementById("vn").innerHTML = d.totalViolatingEntries;
  extWindow = event.source;
  var i = 0;
  for (i = 0; i < d.exact.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='clickable output'>" + d.exact[i].p + "</span><span style='color:blue'> matches " + d.exact[i].n + " entries</span>" + "<input class='check' type='checkbox'></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("exact").appendChild(toAppend);
	mapXPathToCSS[d.exact[i].p] = d.exact[i].sp;
  }
  for (i = 0; i < d.root.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + d.root[i].p + "</span><span style='color:blue'> matches " + d.root[i].n + " entries </span><input class='check' type='checkbox'></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("root").appendChild(toAppend);
  }
  for (i = 0; i < d.tag.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + d.tag[i].p + "</span><span style='color:blue'> matches " + d.tag[i].n + " entries </span>" + "<input class='check' type='checkbox'></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("tag").appendChild(toAppend);
  }
  for (i = 0; i < d.parent.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output'>" + d.parent[i].p + "</span><span style='color:blue'> matches " + d.parent[i].n + " entries </span>" + "<input class='check' type='checkbox'></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("parent").appendChild(toAppend);
  }
  for (i = 0; i < d.unclassified.length; i++){
	var toAppend = document.createElement("li");
	toAppend.innerHTML = "<span class='output clickable'>" + d.unclassified[i].p + "</span><span style='color:blue'> matches " + d.unclassified[i].n + " entries </span>" + "<input class='check' type='checkbox'></input>";
	$(toAppend).addClass("policyEntry");
	document.getElementById("unclassified").appendChild(toAppend);
  }
}

function collectPolicies(){
	var retVal = "";
	$("input:checked").parents().children("span.output").each(function (){
		if ($(this).parent().parent().attr("id") == "root") retVal+="root:";
		if ($(this).parent().parent().attr("id") == "parent") retVal+="^";
		retVal += $(this).text();
		retVal += "\n";
	});
	return retVal;
}

function outputPolicy(){
	var policyToOutput = collectPolicies();
	extWindow.postMessage({type:"output", policy: policyToOutput, hd: hd, tpd: tpd}, "*");
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

window.addEventListener("message", receiveMessage, false);
