var outputToFile = true;
var clearContentUponNav = true;
var logMsgCount = 0;
var matchRateThreshold = 1;		// <= is ok, > is not.  higher the relaxer, lower the stricter.
var tagThreshold = 0.25;

var getElementByXpath = function (path) {
	try {
		var i = path.indexOf("/#text[");
		if (i > -1) {
			var index = path.substr(i+7);
			index = index.substr(0, index.indexOf("]"));
			path = path.substr(0, i) + "/text()[" + index + "]";
		}
		return document.evaluate(path, document, null, 9, null).singleNodeValue;
	}
	catch(ex){
		alert("document.evaluate error in contentScript.js: " + path);
	}
};

function constructCSSFromXPath(p){
	var retVal = "";
	if (p.indexOf("sub:") == 0) p = p.substr(4);
	if (p.indexOf(">") > -1) p = p.substr(0, p.indexOf(">"));
	if (p.indexOf("//") == 0){
		var nodeName = p.substr(2, p.indexOf("[") - 2);
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
		if (multipleModifiers.length == 0) retVal = nodeName + consistentModifier;
		else {
			retVal = nodeName + multipleModifiers[0] + consistentModifier + "," + nodeName + multipleModifiers[1] + consistentModifier;
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

function convertPolicyFormat(p){
	//This converts a //DIV[@id='c']>getAttribute:src to data structure used in contentScript.js: 
	//{p:"//DIV[@id='c']>getAttribute", sp:"DIV[id='c']", xp:"", a:"getAttribute", n:"src"}
	//gets rid of sub:
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
		sp = constructCSSFromXPath(p);
	}
	else {
		xp = p;
	}
	return {p:pp, sp:sp, xp:xp, a:a, n:n};
}

var getElementsByXpath = function (path) {
    return document.evaluate(path, document, null, 4, null);
};

var getElementsByCSS = function (selector) {
    try {
		return document.querySelectorAll(selector);
	}
	catch(ex){alert("getElementByCSS error in contentScript.js: " + selector);}
};

var consoleLog = function(msg){
	logMsgCount++;
	console.log("L"+logMsgCount.toString()+"->");
	if (msg) console.log(msg);
}

var debug = function(msg){
	console.log("D->");
	console.log(msg);
}

var error = function(msg){
	console.log("E->");
	console.log(msg);
}

function getRootDomain(url){
	var domain = url;
	if (url.indexOf('http')!=-1) domain = domain.substr(domain.indexOf('/')+2,domain.length);			//get rid of protocol if there's one.
	else if (url.indexOf('//')==0) domain = domain.substr(2,domain.length);		//get rid of the starting // if there's one.
	if (domain.indexOf('/')!=-1) domain = domain.substr(0,domain.indexOf('/'));					//get rid of paths if there's one.
	if (domain.indexOf(':')!=-1) domain = domain.substr(0,domain.indexOf(':'));					//get rid of port if there's one.
	var domainArray = domain.split('.');
	if (domainArray.length < 2) return domain;			//error. Never return TLD.
	domain = domainArray[domainArray.length-2] + '.' + domainArray[domainArray.length-1];
	return domain;
}

self.port.on("nav", function(msg){
	document.location = msg;
});

self.port.on("obtainNow", function(){
	self.port.emit("obtained",document.visualizerOutputToString());
});

self.port.on("checkViolations", function(){
	var violationString = document.checkPolicyToString();
	var retVal = {v:[], m:[]};
	var rawData = violationString.replace(/\r/g,'');					//get rid of file specific \r
	rawData = rawData.substr(rawData.indexOf('---'));		//get rid of the first url declaration.
	rawData = rawData.substr(0, rawData.length-5);
	domains = rawData.split("---\ntpd: ");
	var i,j;
	var curData;
	var domain;
	for (i = 0; i < domains.length; i++){
		curData = domains[i];
		if (curData == "") continue;
		domain = curData.substr(0, curData.indexOf(":\n"));
		curData = curData.substr(curData.indexOf('\n')+1);
		if (curData.indexOf("_r: ")>-1) retVal.v.push(domain);
		else retVal.m.push(domain);
	}
	self.port.emit("reportViolatingDomains",retVal);
});

function prepareSetAttributes(e, b){
	var arr = e.replace(/\r/g,"").split("\n");
	if (typeof b != "undefined") arr = arr.concat(b.replace(/\r/g,"").split("\n"));
	var i = 0;
	for (i = 0; i < arr.length; i++){
		if (arr[i].length == 0 || arr[i][0] != "/") continue;
		var first = arr[i].split(">")[0];
		var second = arr[i].split(">")[1];
		if (second.indexOf("SetAttribute")==0){
			second = second.substr(13);
		}
		else if (second.indexOf("Set")==0){
			second = second.substr(3).toLowerCase();
		}
		else if (second == "ClassName" || second == "ClassList"){
			second = "class";
		}
		else continue;
		first = first.split("/");
		first = first[first.length-1];
		first = first.split("[")[0];
		if (first == "") first = "universal";
		if (!setAttributes.hasOwnProperty(first)) setAttributes[first] = [];
		setAttributes[first].push(second);
	}
}

self.port.on("inferModel", function(msg){
	td = msg.tpd;
	tld = msg.hd;
	//Load existing policies.
	setAttributes = {};
	existingPolicies = msg.existingPoliciesLoaded;			//global var
	prepareSetAttributes(msg.existingPoliciesLoaded, msg.basePoliciesLoaded);
	inferModelFromRawViolatingRecords(document.checkPolicyToString(), td);
});

function processPolicies(){
	//tell the interactive window to close itself
	self.port.emit("postToInteractive", {type:"close"});
	//done with interactive phase and policy candidate generation, present them to the admin.
	if (policies.base.length == 0 && policies.tag.length == 0 && policies.root.length == 0 && policies.adWidget.length == 0 && policies.otherDeeps.length == 0 && policies.parent.length == 0 && policies.unclassified.length == 0) return;
	self.port.emit("returningPolicy", {policy:policies, domain:tld, thirdPDomain:td});
}

var combinePolicies = function(p1, p2){
	//combine two policies and return their combination.
	var retVal = {base:[], tag:[], root:[], adWidget:[], otherDeeps:[], parent:[], unclassified:[], totalViolatingEntries:0};
	for (var prop in retVal){
		if (prop != "totalViolatingEntries") retVal[prop] = p1[prop].concat(p2[prop]);
		else retVal[prop] = p1[prop] + p2[prop];
	}
	return retVal;
}

var checkAgainstForbiddenAttr = function(nodeName, attrName){
	if (setAttributes.hasOwnProperty(nodeName) && setAttributes[nodeName].indexOf(attrName) > -1) return false;
	if (setAttributes.hasOwnProperty("universal") && setAttributes["universal"].indexOf(attrName) > -1) return false;
	return true;
}

var getSoloPattern = function (abs){
	var node = abs.n;
	var resource = abs.r;
	var retVal = {p:"", sp:"", xp:resource};
	var attrNames = [];
	var attrValues = [];
	var constructP = function(){
		var p = "//" + node.nodeName + "[";
		var c = [];
		for (var i = 0; i < attrNames.length; i++){
			if (attrValues[i].indexOf("http") > -1 && (attrNames[i] == "src" || attrNames[i] == "action")){
				//value is likely a url, do some optimization here:
				var v = attrValues[i];
				var protocol = v.substr(0, v.indexOf("/"));
				var domain = v.substr(v.indexOf("/")+2);
				if (domain.indexOf("/") > -1) domain = domain.substr(0, domain.indexOf("/"));
				domain = "[^/]*" + domain.split(".").splice(-2, 2).join("\\.");
				attrValues[i] = protocol + "//" + domain + ".*";
			}
			if (attrNames[i] == "class") c.push(attrValues[i]);
			else p += "@" + attrNames[i] + "='" + attrValues[i] + "'";
		}
		if (c.length > 0) p += "@class='" + c.join(" ") + "'";
		p += "]";
		return p;
	};
	var constructSP = function(){
		var sp = node.nodeName;
		for (var i = 0; i < attrNames.length; i++){
			if (attrNames[i] == "class") sp += "." + attrValues[i];
			else sp += "[" + attrNames[i] + "='" + attrValues[i] + "']";
		}
		return sp;
	};
	if (node.hasAttribute("id") && checkAgainstForbiddenAttr(node.nodeName, "id")){
		//assume id is unique
		var value = node.id;
		attrNames.push("id");
		attrValues.push(value);
		retVal.p = constructP();
		retVal.sp = constructSP();
		return retVal;
	}
	//class if preferred over other attributes
	if (node.hasAttribute("class") && checkAgainstForbiddenAttr(node.nodeName, "class")){
		var nl = node.classList;
		for (var i = 0; i < nl.length; i++){
			attrNames.push("class");
			attrValues.push(nl[i]);
		}
		retVal.sp = constructSP();
		retVal.p = constructP();
		if (document.querySelectorAll(retVal.sp).length == 1) return retVal;
	}
	//fall back to attempting to use all attributes, finding until one unique selector is found.
	var na = node.attributes;
	for (var i = 0; i < na.length; i++){
		var attrName = na[i].name;
		if (attrName == "class" || attrName == "id" || !checkAgainstForbiddenAttr(node.nodeName, attrName) || !checkAppropriateAttributes(attrName)) continue;
		attrNames.push(attrName);
		attrValues.push(na[i].value);
		retVal.sp = constructSP();
		retVal.p = constructP();
		try {
			if (document.querySelectorAll(retVal.sp).length == 1) return retVal;
		}
		catch(ex){alert("GetSoloPattern error in contentScript.js: " + retVal.sp);}
	}
	//no selector can be unique, set sp to empty and p to xpath
	retVal.p = retVal.xp;
	retVal.sp = "";
	return retVal;
}

var getPatterns = function(constABS, agg){
	var i;
	var returnValue = [];
	var iteration = 0;
	var MAXITERATION = 5;
	var abs = [];
	for (var i = 0; i < constABS.length; i++){
		abs.push(constABS[i]);
	}
	var heuristics = ["sponsor", "ad", "leaderboard", "widget", "twit", "facebook", "twtt"];
	while (abs.length > 0 && iteration < MAXITERATION){
		iteration++;
		var patterns = [];
		var classPatterns = [];
		for (i = 0; i < agg.length; i++){
			//agg's max length is 3.
			//special case for class:
			var matchNumber = 0;
			if (agg[i].n.indexOf("class__")!=-1) {
				var nodeName = agg[i].n.substr(0, agg[i].n.indexOf(">"));
				var attrName = agg[i].n.substr(nodeName.length + 8);		//8: >class__
				var p = nodeName + "."+ attrName;
				matchNumber = getElementsByCSS(p).length;
				if (matchNumber > agg[i].f * matchRateThreshold) continue;		//this accidentally matches other nodes.
				else {
					patterns.push({p:p, n:matchNumber});
					classPatterns.push(p);
					continue;
				}
			}
			//for all other attr:
			var headPattern="";
			var prevMaxMatches = 0;
			var maxHeadMatch = 0;
			var maxTailMatch = 0;
			for (j = 0; j < abs.length; j++){
				abs[j].excluded = false;
			}
			while (true){
				var curC = {};
				var maxC = "";
				var maxMatches = -1;
				for (j = 0; j < abs.length; j++){
					if (!abs[j].a.hasOwnProperty(agg[i].n) || abs[j].excluded) continue;
					if (headPattern.length >= abs[j].a[agg[i].n].length) continue;
					var c = abs[j].a[agg[i].n].substr(headPattern.length,1);
					if (curC.hasOwnProperty(c)) {
						curC[c]++;
						if (maxMatches < curC[c]) {
							maxMatches = curC[c];
							maxC = c;
						}
					}
					else curC[c] = 1;
				}
				if (maxC == "" || maxMatches < prevMaxMatches) {
					maxHeadMatch = prevMaxMatches;
					break;
				}
				else {
					if (prevMaxMatches == 0) prevMaxMatches = maxMatches;
					for (j = 0; j < abs.length; j++){
						if (!abs[j].a.hasOwnProperty(agg[i].n)) abs[j].excluded = false;
						else abs[j].excluded = (maxC != abs[j].a[agg[i].n].substr(headPattern.length,1));	//disqualify this entry in future comparisons.
					}
					headPattern = headPattern + maxC;
				}
			}
			prevMaxMatches = 0;
			for (j = 0; j < abs.length; j++){
				abs[j].excluded = false;
			}
			var tailPattern = "";
			while (true){
				var curC = {};
				var maxC = "";
				var maxMatches = -1;
				for (j = 0; j < abs.length; j++){
					if (!abs[j].a.hasOwnProperty(agg[i].n) || abs[j].excluded) continue;
					if (tailPattern.length >= abs[j].a[agg[i].n].length) continue;
					var c = abs[j].a[agg[i].n].substr( - tailPattern.length - 1,1);
					if (c >= '0' && c <= '9') continue;		//digit at the end is unlikely to be a pattern.
					if (curC.hasOwnProperty(c)) {
						curC[c]++;
						if (maxMatches < curC[c]) {
							maxMatches = curC[c];
							maxC = c;
						}
					}
					else curC[c] = 1;
				}
				if (maxC == "" || maxMatches < prevMaxMatches) {
					maxTailMatch = prevMaxMatches;
					break;
				}
				else {
					if (prevMaxMatches == 0) prevMaxMatches = maxMatches;
					for (j = 0; j < abs.length; j++){
						if (!abs[j].a.hasOwnProperty(agg[i].n)) abs[j].excluded = false;
						else abs[j].excluded = (maxC != abs[j].a[agg[i].n].substr( - tailPattern.length - 1,1));
					}
					tailPattern = maxC + tailPattern;
				}
			}
			//MatchRate is how accurate this head pattern matches targets, the lower the better, the best is 1.
			var headMatchRate = 0;
			var tailMatchRate = 0;
			//construct real head pattern and tail pattern
			var nodeName = agg[i].n.substr(0, agg[i].n.indexOf(">"));
			var attrName = agg[i].n.substr(nodeName.length + 1);
			if (headPattern == "" && tailPattern == ""){
				//test if simply having this attribute can be a unique identifier.
				var pattern = nodeName + "[" + attrName + "]";
				var nodes = getElementsByCSS(pattern);
				if (!nodes) continue;
				var matchRate = nodes.length / agg[i].f;
				if (matchRate <= matchRateThreshold) {
					patterns.push({p:pattern, n:agg[i].f, r:matchRate});
				}
			}
			else {
				if (headPattern != "" && maxHeadMatch > 0) {
					headPattern = nodeName + "[" + attrName + "^='" + headPattern + "']";
					headMatchRate = getElementsByCSS(headPattern).length / maxHeadMatch;
					if (headMatchRate > matchRateThreshold) {
						headMatchRate = 0;		//This describer is too inacurrate, cannot use.
						maxHeadMatch = 0;
					}
				}
				if (tailPattern != "" && maxTailMatch > 0) {
					tailPattern = nodeName + "[" + attrName + "$='" + tailPattern + "']";
					tailMatchRate = getElementsByCSS(tailPattern).length / maxTailMatch;
					if (tailMatchRate > matchRateThreshold) {
						tailMatchRate = 0;		//This describer is too inacurrate, cannot use.
						maxTailMatch = 0;
					}
				}
				//priorize the number of elements matched, then the accuracy rate.
				if (maxHeadMatch == 0 && maxTailMatch == 0) continue;
				else if (maxHeadMatch != 0 && maxTailMatch == 0) patterns.push({p:headPattern, r:headMatchRate, n: maxHeadMatch});
				else if (maxHeadMatch == 0 && maxTailMatch != 0) patterns.push({p:tailPattern, r:tailMatchRate, n: maxTailMatch});
				else if (maxHeadMatch > maxTailMatch) patterns.push({p:headPattern, r:headMatchRate, n: maxHeadMatch});
				else if (maxHeadMatch < maxTailMatch) patterns.push({p:tailPattern, r:tailMatchRate, n: maxTailMatch});
				else {
					if (headMatchRate <= tailMatchRate) patterns.push({p:headPattern, r:headMatchRate, n: maxHeadMatch});
					else patterns.push({p:tailPattern, r:tailMatchRate, n: maxTailMatch});
				}
			}
		}
		var maxMatchNumber = 0;
		var maxPattern = "";
		var maxMatchRate = 10000;		//initial value doesn't matter
		for (i = 0; i < patterns.length; i++){
			//favor heuristics:
			for (var j = 0; j < heuristics.length; j++){
				if (patterns[i].p.indexOf(heuristics[j]) > -1){
					patterns[i].n = maxMatchNumber + 10000;		//use this if it matches heuristics. //do not want to simply break the outerloop if there are multiple attrvalues featuring heuristics.
					break;
				}
			}
			if (maxMatchNumber < patterns[i].n){
				maxMatchNumber = patterns[i].n;
				maxPattern = patterns[i].p;
				maxMatchRate = patterns[i].r;
			}
			else if (maxMatchNumber == patterns[i].n) {
				if (maxMatchRate > patterns[i].r) {
					maxPattern = patterns[i].p;
					maxMatchRate = patterns[i].r;
				}
			}
		}
		if (maxPattern != "") {
			var nodeName = "";
			var attrName = "";
			var attrValue = "";
			var selectorPattern = maxPattern;
			//prepare to remove all matched nodes and do it again.
			var toEliminate = getElementsByCSS(selectorPattern);
			
			//convert maxPattern from CSS selector to our selector
			if (classPatterns.indexOf(maxPattern) > -1){
				nodeName = maxPattern.substr(0, maxPattern.indexOf("."));
				attrValue = maxPattern.substr(nodeName.length+1);
				attrName = "class";
			}
			else {
				nodeName = maxPattern.substr(0, maxPattern.indexOf("["));
				maxPattern = maxPattern.substr(nodeName.length + 1);
				var headIndex = maxPattern.indexOf("^");
				var tailIndex = maxPattern.indexOf("$");
				if (headIndex != -1 && (tailIndex == -1 || (tailIndex != -1 && headIndex < tailIndex))) {
					attrName = maxPattern.substr(0, headIndex);
					maxPattern = maxPattern.substr(attrName.length + 3);
					attrValue = maxPattern.substr(0, maxPattern.length - 2) + ".*";
				}
				else if (tailIndex != -1 && (headIndex == -1 || (headIndex != -1 && tailIndex < headIndex))) {
					attrName = maxPattern.substr(0, tailIndex);
					maxPattern = maxPattern.substr(attrName.length + 3);					//rid of $=
					attrValue = ".*" + maxPattern.substr(0, maxPattern.length - 2);			//rid of ']
				}
				else {
					//this is attr describer without a value scenario.
					attrName = maxPattern.substr(0, maxPattern.length - 1);
					attrValue = ".*";
				}
			}
			maxPattern = "//" + nodeName + "[@" + attrName + "='" + attrValue + "']";		
			returnValue.push({p:maxPattern, sp:selectorPattern, xp: maxPattern});
			
			//update agg and abs array to reflect this node has been matched:
			for (i = 0; i < toEliminate.length; i++){
				for (j = 0; j < abs.length; j++){
					if (toEliminate[i] == abs[j].n) {
						for (var name in abs[j].a){
							for (var k = 0; k < agg.length; k++){
								if (agg[k].n == name) {
									agg[k].f--;
									if (agg[k].f == 0) {
										agg.splice(k, 1);
										k--;
									}
									break;
								}
							}
						}
						//remove this entry in abs.
						abs.splice(j, 1);
						break;
					}
				}
			}
		}
		else {
			//no more policies can be generated.
			for (i = 0; i < abs.length; i++){
				//unmatched accesses
				returnValue.push(getSoloPattern(abs[i]));
			}
			break;
		}
		if (iteration >= MAXITERATION){
			//max iterations reached, just dump all the rest and output alarm
			for (i = 0; i < abs.length; i++){
				//unmatched accesses
				returnValue.push(getSoloPattern(abs[i]));
			}
			error("Too many iterations, dumping all other accesses in original form.");
			break;
		}
	}
	return returnValue;
}

var checkAppropriateAttributes = function(attrName){
	if (attrName == "style" || attrName == "width" || attrName == "height" || attrName == "frameborder" || attrName == "framespacing" || attrName == "scrolling") return false;
	if (attrName.indexOf("margin")>-1) return false;
	return true;
}

var learnPatterns = function(insertionNodes){
	//Obtain real node handles first.
	var i,j;
	var abstractedList = [];		//[{r:resource: a:[{n:v}, {n:v}, ..]}, ...]
	var aggregatedAttrNames = [];			//[{id:4}, {class:5}];
	var aggregatedAttrN = [];		//auxillary structures to generate aggregatedAttrNames.
	var aggregatedAttrF = [];
	for (i = 0; i < insertionNodes.length; i++){
		var node = getElementByXpath(insertionNodes[i].xpath);
		if (!!node && node.nodeType == 1) {
			var a = node.attributes;
			var attributeCandidates = {};
			for (j = 0; j < a.length; j++){
				var temp = a[j].name;
				if (!checkAppropriateAttributes(temp)) continue;		//don't use certain attributes as identifier.
				if (checkAgainstForbiddenAttr(node.nodeName, temp)){
					if (temp == "class") {
					//special treatment for class
						var values = a[j].value.split(" ");
						for (var k = 0; k < values.length; k++){
							if (values[k]=="") continue;
							temp = node.nodeName + ">class__" + values[k];
							//hasClass A -> class__A=true
							attributeCandidates[temp]="true";
							if (aggregatedAttrN.indexOf(temp) == -1) {
								aggregatedAttrN.push(temp);
								aggregatedAttrF.push(1);
							}
							else aggregatedAttrF[aggregatedAttrN.indexOf(temp)] += 1;
						}
					}
					else {
						temp = node.nodeName + ">" + temp;
						attributeCandidates[temp] = a[j].value;
						if (aggregatedAttrN.indexOf(temp) == -1) {
							aggregatedAttrN.push(temp);
							aggregatedAttrF.push(1);
						}
						else aggregatedAttrF[aggregatedAttrN.indexOf(temp)] += 1;
					}
				}
			}
			abstractedList.push({r: insertionNodes[i].xpath, n: node, a:attributeCandidates, as:insertionNodes[i].as, an:insertionNodes[i].an});
		}
	}
	//construct aggregatedAttrNames
	for (i = 0; i < aggregatedAttrN.length; i++) {
		//if the attribute is not present in more than one node, it is not a good selector: if (aggregatedAttrF[i] > 1) 
		aggregatedAttrNames.push({n:aggregatedAttrN[i], f:aggregatedAttrF[i]});
	}
	//sort it
	aggregatedAttrNames.sort(function (a,b){
		//id and class are prioritized
		if (b.f == a.f && (a.n.substr(a.n.indexOf('>')+1) == 'id')) return -1; 
		if (b.f == a.f && (b.n.substr(b.n.indexOf('>')+1) == 'id')) return 1; 
		if (b.f == a.f && (a.n.substr(a.n.indexOf('>')+1).indexOf('class__')==0)) return -1; 
		if (b.f == a.f && (b.n.substr(b.n.indexOf('>')+1).indexOf('class__')==0)) return 1; 
		return b.f - a.f;
	});
	aggregatedAttrNames.splice(3, aggregatedAttrNames.length);			//only use the top three candidates for performance reasons.
	var patterns = getPatterns(abstractedList, aggregatedAttrNames);
	var retVal = [];
	var pushed = [];
	//Now, add as and an to policies' end:
	for (var i = 0; i < patterns.length; i++){
		if (patterns[i].sp != "") {
			for (var j = 0; j < abstractedList.length; j++){
				if (abstractedList[j].n.mozMatchesSelector(patterns[i].sp)) {
					for (var k = 0; k < abstractedList[j].as.length; k++){
						var a = abstractedList[j].as[k];
						var p = patterns[i].p + ">" + a;
						var n = "";
						if (!!abstractedList[j].an[k]) n = abstractedList[j].an[k];
						if (n != "") p += ":" + n;
						var key = p + patterns[i].sp + patterns[i].xp + a + n;
						if (pushed.indexOf(key)==-1) {
							pushed.push(key);
							retVal.push({p:p, sp:patterns[i].sp, xp:patterns[i].xp, a:a, n:n});
						}
					}
				}
			}
		}
		else {
			for (var j = 0; j < abstractedList.length; j++){
				var matchedNode = getElementByXpath(patterns[i].xp);
				if (abstractedList[j].n == matchedNode) {
					for (var k = 0; k < abstractedList[j].as.length; k++){
						var a = abstractedList[j].as[k];
						var p = patterns[i].p + ">" + a;
						var n = "";
						if (!!abstractedList[j].an[k]) n = abstractedList[j].an[k];
						if (n != "") p += ":" + n;
						var key = p + patterns[i].sp + patterns[i].xp + a + n;
						if (pushed.indexOf(key)==-1) {
							pushed.push(key);
							retVal.push({p:p, sp:patterns[i].sp, xp:patterns[i].xp, a:a, n:n});
						}
					}
				}
			}
		}
	}
	return retVal;	
	//XPATH to match tail pattern://div[substring(@id, string-length(@id)-1, 2)='gh']
	//To match head pattern://div[starts-with(@id, 'g')]
	//To count: count(//div), retrieve by result.numberValue
}

var simplifyNodeInfo = function(nodeInfo){
	var policy = "";
	var owned = false;
	if (nodeInfo.indexOf("[o]") == 0) {
		policy += "\\[o\\]";
		owned = true;
		nodeInfo = nodeInfo.substr(3);
	}
	if (nodeInfo.indexOf("<") == 0 && owned){
		nodeInfo = nodeInfo.substr(1);
		nodeInfo = nodeInfo.replace(/\*/g, "\\*").replace(/\d+/g, "\\d*").replace(/\?/g, "\\?").replace(/\./g, "\\.").replace(/\+/g, "\\+");
		var endingPos = nodeInfo.indexOf(">");
		if (endingPos > -1){
			var spacePos = nodeInfo.indexOf(" ");
			var nodeName = "";
			if (spacePos > -1 && spacePos < endingPos) nodeName = nodeInfo.substr(0, spacePos);
			else {
				spacePos = nodeInfo.indexOf("\n");
				if (spacePos > -1 && spacePos < endingPos) nodeName = nodeInfo.substr(0, spacePos);
			}
			policy += "<" + nodeName + "[^]*>";
		}
		else policy += "[^]*";
	}
	else {
		if (nodeInfo.indexOf("<") == 0){
			var startingGT = nodeInfo.indexOf(">");
			while (startingGT != -1){
				if (nodeInfo.indexOf("'") < nodeInfo.indexOf('"')){
					if (nodeInfo.substr(0, startingGT).split("'").length % 2 == 1) break;
				}
				else {
					if (nodeInfo.substr(0, startingGT).split('"').length % 2 == 1) break;
				}
				startingGT = nodeInfo.indexOf(">", startingGT + 1);
			}
			if (startingGT != -1) {
				var openingTag = nodeInfo.substr(0, startingGT + 1);
				if (openingTag.indexOf("<script") == 0 || openingTag.indexOf("<iframe") == 0 || openingTag.indexOf("<img") == 0) {
					var nodeName;
					if (openingTag.indexOf("<script") == 0) nodeName = "script";
					if (openingTag.indexOf("<iframe") == 0) nodeName = "iframe";
					if (openingTag.indexOf("<img") == 0) nodeName = "img";
					if (openingTag.indexOf("src") > -1){
						openingTag = openingTag.substr(openingTag.indexOf("src") + 3);
						var seperator;
						if (openingTag.indexOf("\"") == -1) seperator = "'";
						else if (openingTag.indexOf("'") == -1) seperator = "\"";
						else seperator = (openingTag.indexOf("\"") < openingTag.indexOf("'")) ? "\"" : "'";
						openingTag = openingTag.substr(openingTag.indexOf(seperator) + 1);
						var url = openingTag.substr(0, openingTag.indexOf(seperator));
						var domain = getRootDomain(url);
						openingTag = "<" + nodeName + "[^<>]*src\\s*=\\s*" + seperator + "[^" + seperator + "]*" + domain + "/[^<>]*>";
					}
				}
				policy += openingTag;
				if (startingGT != nodeInfo.length - 1){
					nodeInfo = nodeInfo.substr(startingGT + 1);
					if (nodeInfo.length > 0 && nodeInfo[nodeInfo.length - 1] == ">"){
						var endingLT = nodeInfo.lastIndexOf("<");
						if (endingLT > 0) {
							policy += "[^]*";
							policy += nodeInfo.substr(endingLT);
						}
						else if (endingLT == -1) policy += "[^]*";
						else policy += nodeInfo.substr(endingLT);
					}
					else policy += "[^]*";
				}
			}
			else policy += "[^]*";
		}
	}
	if (policy == "") policy = nodeInfo;		//this is the scenario where the nodeInfo is not really 'nodeInfo', it's an argument from SetAttribute.
	return policy;
}

self.port.on("fromInteractive",function(d){
	switch(d.phase){
		case "base":
			policies = d.p;
			afterBasePolicy();
			break;
		case "existing":
			afterExistingPolicy();
			break;
		case "tag":
			policies = d.p;
			afterTagPolicy();
			break;
		case "insertionOtherDeeps":
			policies = d.p;
			afterInsertionDeepPolicy();
		default:
			break;
	}
});

var inferModelFromRawViolatingRecords = function(rawData, targetDomain){
	//rawData is the raw data obtained from document.checkPolicyToString
	//Parse data to records
	forceNewWindow = true;
	policies = {base:[], tag:[], root:[], adWidget:[], otherDeeps:[], parent:[], unclassified:[], totalViolatingEntries:0};
	if (!targetDomain) processPolicies();
	rawData = rawData.replace(/\r/g,'');					//get rid of file specific \r
	rawData = rawData.substr(rawData.indexOf('---'));		//get rid of the first url declaration.
	rawData = rawData.substr(0, rawData.length-5);
	domains = rawData.split("---\ntpd: ");
	var i,j;
	var curData;
	var domain;
	for (i = 0; i < domains.length; i++){
		curData = domains[i];
		if (curData == "") continue;
		domain = curData.substr(0, curData.indexOf(":\n"));
		if (domain == targetDomain) break;
	}
	if (i == domains.length) {
		alert("cannot find this domain in violation report, exiting...");
		processPolicies();
	}
	curData = curData.substr(curData.indexOf('\n')+1);
	//Ignore matched cases
	matchedEntries = 0;
	matchedPolicies = 0;
	while (curData.length > 2 && curData.substr(0, 2) == "M:"){
		matchedPolicies++;
		curData = curData.substr(curData.indexOf("<-with->") + 9);
		var matchingTimes = curData;
		if (curData.indexOf("\n") > -1) matchingTimes = curData.substr(0, curData.indexOf("\n"));
		matchedEntries += parseInt(matchingTimes);
		curData = curData.substr(curData.indexOf("\n") + 1);
	}
	dv = [];			//stores all violating records (dynamically updated if admins accept new policy candidates).
	tagPolicyValues = {};
	if (curData.length <= 4) {
		//all reported accesses are matched with existing policy.
		alert("All existing accesses (" + matchedEntries + ") are matched with current policy, exiting...");
		processPolicies();
		return;
	}
	//Collect unmatched cases
	var policyBase = {};
	var outgoingNetworkRecorded = {};
	var textPushed = [];
	while (curData.length > 4 && curData.substr(0, 4) == "_r: "){
		policies.totalViolatingEntries++;
		curData = curData.substr(4);
		var thisData = "";
		if (curData.indexOf("_r: ") != -1) {
			thisData = curData.substr(0, curData.indexOf("_r: "));
			curData = curData.substr(curData.indexOf("_r: "));
		}
		else thisData = curData;
		var resource = thisData.substr(0, thisData.indexOf("\n_a: "));
		thisData = thisData.substr(thisData.indexOf("\n_a: ") + 5);
		var additional = "";
		var nodeInfo = "";
		if (thisData.indexOf("\n_n: ")!=-1){
			additional = thisData.substr(0, thisData.indexOf("\n_n: "));
			nodeInfo = thisData.substr(thisData.indexOf("\n_n: ") + 5);
			if (nodeInfo[nodeInfo.length - 1] == "\n") nodeInfo = nodeInfo.substr(0, nodeInfo.length - 1);
			nodeInfo = simplifyNodeInfo(nodeInfo);
		}
		else if (thisData[thisData.length - 1] == "\n") additional = thisData.substr(0, thisData.length - 1);
		else additional = thisData;
		if (additional == "ScrollTop" || additional == "ScrollLeft" || additional == "ScrollHeight" || additional == "ScrollWidth" || additional == "ClientTop" || additional == "ClientWidth" || additional == "ClientLeft" || additional == "ClientHeight" || additional == "GetBoundingClientRect") additional = "getSize";
		//Ignore base access (/html, document.cookie, etc.)
		if (resource[0] == "/"){
			var temp = resource.split("|")[0];
			if (temp != "/HTML[1]" && temp != "/HTML[1]/BODY[1]" && temp != "/HTML[1]/HEAD[1]")
			{
				if (additional == "document.write" || additional == "AppendChild" || additional == "RemoveChild" || additional == "InsertBefore" || additional == "ReplaceChild" || additional == "SetInnerHTML") {
					//insertion deprecating to ! only happens on non-base accesses.
					var node = getElementByXpath(temp);
					if (!node || node.offsetHeight <= 0.9 * document.body.scrollHeight || node.offsetWidth <= 0.9 * document.documentElement.offsetWidth || temp.split("/") > 4){
						//also only deprecate when the node is not too large, or deep enough
						nodeInfo = "";
						additional = "!";
					}
				}
				//Classify accesses by nodeNames
				var nodeName = temp.split("/");
				nodeName = nodeName[nodeName.length - 1];
				nodeName = nodeName.substr(0, nodeName.indexOf('['));
				//If the nodeName is #text, change the resource to its parent, and add text to additional
				if (nodeName == "#text") {
					temp = temp.split("/");
					temp.splice(-1, 1);
					temp = temp.join("/");
					resource = temp;
					additional = "#text" + additional;
				}
				if (textPushed.indexOf(temp + additional + nodeInfo) == -1){
					var key = "//" + nodeName + ">" + additional + (nodeInfo != "" ? ":" + nodeInfo : "");
					if (!tagPolicyValues[key]) tagPolicyValues[key] = 1;
					else tagPolicyValues[key]++;
					//make sure we don't push duplicates. Although the trace should not contain duplicates, we have shortened the records to text nodes, leaving only its parent in the resource, which might create duplicates.
					dv.push({r:temp, a:additional, n:nodeInfo, t:nodeName, shouldDelete:false});		//r = resource, a = apiname, n = argvalue, shouldDelete is a helper for getting rid of root-matching records.
					textPushed.push(temp + additional + nodeInfo);
				}
			}
			else {
				//suggest base policies:
				var policy = temp + ">" + additional;
				if (!!nodeInfo) policy += ":" + nodeInfo;
				//indirect push, n might not be 1
				if (policyBase.hasOwnProperty(policy)) policyBase[policy]++;
				else policyBase[policy] = 1;
			}
		}
		else {
			//Suggest base policies.
			//directly push, n must equal to 1.
			var policy = resource;
			if (resource == "Outgoing network traffic") {
				policy = resource + ":" + getRootDomain(additional);
				if (outgoingNetworkRecorded.hasOwnProperty(policy)) {
					outgoingNetworkRecorded[policy]++;
				}
				else {
					outgoingNetworkRecorded[policy] = 1;
				}
			}
			else policies.base.push({p:policy, n: 1});
		}
	}
	//aggregate outgoingNetworkRecorded
	for (var policy in outgoingNetworkRecorded){
		policies.base.push({p:policy, n: outgoingNetworkRecorded[policy]});
	}
	//aggregate results from policyBase to policies.base
	for (var policy in policyBase){
		policies.base.push({p:policy, n: policyBase[policy]});
	}
	if (policies.base.length > 0){
		//Done calculating base policy candidates, ask the admin to approve the base policies, and if this covers all, stop.
		self.port.emit("postToInteractive", {type:"base", p:policies, hd:tld, tpd:td, matches:matchedEntries, forceNewWindow:forceNewWindow, tve:policies.totalViolatingEntries});
		forceNewWindow = false;
	}
	else {
		afterBasePolicy();
	}
}

var afterBasePolicy = function(){
	//base policy candidates were approved/disapproved, now move onto site-specific policies.
	//dv stores all ss policies.
	if (dv.length == 0) {
		processPolicies();
		return;
	}
	//emit existing site-specific policies if there's any.
	if (!!existingPolicies){
		self.port.emit("postToInteractive", {type:"existing", p:policies, hd:tld, tpd:td, matches:matchedEntries, ep:existingPolicies, tve:dv.length, forceNewWindow:forceNewWindow});
		forceNewWindow = false;
	}
	else {
		afterExistingPolicy();
	}
}

var afterExistingPolicy = function(){
	//The augmented base policy can't cover all violations, continue to suggest tag policies.
	//Handle possible scenarios like //SCRIPT>GetSrc first.
	var cache = {};
	for (var k in tagPolicyValues) {
		if (tagPolicyValues[k] > 1){
			var nodeName = k.substr(2);
			nodeName = nodeName.substr(0,nodeName.indexOf('>'));
			if (!cache[nodeName]) {
				if (nodeName == "#text") cache[nodeName] = document.evaluate("count(//text())", document, null, 1, null).numberValue;
				else cache[nodeName] = document.getElementsByTagName(nodeName).length;
			}
			if (tagPolicyValues[k] >= cache[nodeName]*tagThreshold) {
				policies.tag.push({p:k, n:tagPolicyValues[k]/cache[nodeName]});
			}
		}
	}
	if (policies.tag.length > 0){
		self.port.emit("postToInteractive", {type:"tag", p:policies, hd:tld, tpd:td, matches:matchedEntries, tve:dv.length, forceNewWindow:forceNewWindow});
		forceNewWindow = false;
	}
	else {
		afterTagPolicy();
	}
}

var afterTagPolicy = function(){
	for (var i in policies.tag) {
		var k = policies.tag[i].p;
		//Erase the handled accesses from dataDomain.violatingEntries.
		//it's ok to write loop here as we do not expect this to happen many times
		for (j = 0; j < dv.length; j++){
			var e = dv[j];
			if (k == "//" + e.t + ">" + (e.a.substr(0,5) == "#text" ? e.a.substr(5) : e.a) + (e.n != "" ? ":" + e.n : "")) {
				dv.splice(j, 1);
				j--;
			}
		}
		//Update setAttributes object
		prepareSetAttributes(policies.tag[i].p);
	}
	if (dv.length == 0) {
		processPolicies();
		return;
	}
	//Copy dv into a new temp array, preserving what's in dv for future use.
	remainingAccesses = [];
	for (var k = 0; k < dv.length; k++){
		remainingAccesses.push(dv[k]);
	}
	//Make sure all nodes here are still live, if they are not, get their parents until they're live.
	//Also make sure the nodes have at least one non-style attribute.
	var noAvailableAttrAsCandidate = function(node, xpath){
		//returns true if node has no meaningful attribute to form a good selector.
		if (!node || !node.attributes) return true;
		//, or it contains only attribute which it already sets.
		for (var i = 0; i < node.attributes.length; i++){
			if (checkAppropriateAttributes(node.attributes[i].name) && checkAgainstForbiddenAttr(dv[k].t, node.attributes[i].name))
			{
				return false;
			}
		}
		return true;
	}
	for (var k = 0; k < remainingAccesses.length; k++){
		var xpath = remainingAccesses[k].r;
		var node = getElementByXpath(xpath);
		var level = 0;
		while ((!node || noAvailableAttrAsCandidate(node, xpath)) && level < 100){
			//node is either dead or has no attribute, get its parent.
			xpath = xpath.split('/');
			if (xpath.length == 1) break;
			xpath.splice(-1, 1);
			xpath = xpath.join("/");
			node = getElementByXpath(xpath);
			level++;
		}
		if (level == 0) continue;
		if (!!node) {
			remainingAccesses[k].r = xpath;
			remainingAccesses[k].t = node.nodeName;
			remainingAccesses[k].sub = true;
		}
		else {
			//this entry is dead/has no attribute, and 
			remainingAccesses.splice(k,1);
			k--;
		}
	}
	//Now, inappropriate deepnodes (those that ain't alive anymore, or don't have any attribute) are marked with .sub=true.
	//Then, get all deepnodes, regardless of whether they are insertion accesses or not:
	deepNodes = [];
	shallowNodes = [];
	while (remainingAccesses.length > 0){
		//get deepmost node
		var maxDepth = -1;
		var maxIndex = 0;
		for (j = 0; j < remainingAccesses.length; j++){
			var curDepth = remainingAccesses[j].r.split('/').length;
			if (curDepth > maxDepth) {
				maxDepth = curDepth;
				maxIndex = j;
			}
		}
		deepNodes.push(remainingAccesses.splice(maxIndex, 1)[0]);
		var maxXPath = deepNodes[deepNodes.length-1].r;
		//eliminate its parent nodes.
		for (j = 0; j < remainingAccesses.length; j++){
			var curXPath = remainingAccesses[j].r;
			if (maxXPath != curXPath && maxXPath.indexOf(curXPath) == 0) {
				//current access is a parent of other accesses.
				shallowNodes.push(remainingAccesses.splice(j, 1)[0]);
				j--;
			}
			else if (maxXPath == curXPath) {
				//push other accesses of itself in deepNodes too.
				deepNodes.push(remainingAccesses.splice(j, 1)[0]);
				j--;
			}
		}
	}
	delete remainingAccesses;
	//Now, two collections of nodes are created: shallowNodes and deepNodes.  Shallow nodes are parents of deep nodes.
	//Then, we try to get all insertionNodes and otherDeepNodes.
	insertionNodes = [];
	otherDeepNodes = [];
	j = 0;
	while (j < deepNodes.length){
		var curNode = deepNodes[j];
		var insert = false;
		var start = j;
		var as = [];
		var an = [];
		//see how many after this is talking about the same node
		while (true){
			if (!insert) insert = (deepNodes[j].a == "!");
			var attrChanged = "";
			if (deepNodes[j].a == "SetAttribute") attrChanged = deepNodes[j].n;
			else if (deepNodes[j].a.indexOf("Set") == 0) attrChanged = deepNodes[j].a.substr(3).toLowerCase();
			if (attrChanged != ""){
				if (!setAttributes.hasOwnProperty(deepNodes[j].t)) setAttributes[deepNodes[j].t] = [];
				setAttributes[deepNodes[j].t].push(attrChanged);
			}
			as.push(deepNodes[j].a);
			an.push(deepNodes[j].n);
			j++;
			if (j >= deepNodes.length || deepNodes[j-1].r != deepNodes[j].r) break;
		}
		if (insert){
			an = an.map(function(o){if (o.indexOf("\\[o\\]")==0 || o.indexOf("<")==0) return ""; else return o;});
			insertionNodes.push({"xpath":deepNodes[j-1].r, "as":as, "an":an});		//for inserted nodes, don't care about specific API accessed
		}
		else {
			otherDeepNodes.push({"xpath":deepNodes[j-1].r, "as":as, "an":an});
		}
		deepNodes.splice(start, j - start);
		j = start;
	}
	while (j < shallowNodes.length){
		var curNode = shallowNodes[j];
		var insert = false;
		var start = j;
		var as = [];
		var an = [];
		//see how many after this is talking about the same node
		while (true){
			if (!insert) insert = (shallowNodes[j].a == "!");
			var attrChanged = "";
			if (shallowNodes[j].a == "SetAttribute") attrChanged = shallowNodes[j].n;
			else if (shallowNodes[j].a.indexOf("Set") == 0) attrChanged = shallowNodes[j].a.substr(3).toLowerCase();
			if (attrChanged != ""){
				if (!setAttributes.hasOwnProperty(shallowNodes[j].t)) setAttributes[shallowNodes[j].t] = [];
				setAttributes[shallowNodes[j].t].push(attrChanged);
			}
			as.push(shallowNodes[j].a);
			an.push(shallowNodes[j].n);
			j++;
			if (j >= shallowNodes.length || shallowNodes[j-1].r != shallowNodes[j].r) break;
		}
		if (insert){
			an = an.map(function(o){if (o.indexOf("\\[o\\]")==0 || o.indexOf("<")==0) return ""; else return o;});
			insertionNodes.push({"xpath":shallowNodes[j-1].r, "as":as, "an":an});		//for inserted nodes, don't care about specific API accessed
			shallowNodes.splice(start, j - start);
			j = start;
		}
	}
	//Now, insertionNodes include all nodes whose insertion apis are called.  otherDeepNodes include all the rest deep nodes.
	//Now, for these nodes, discover their pattern --- e.g. //DIV[@id="ad-.*"].  If impossible, list themselves.
	policies.adWidget = learnPatterns(insertionNodes);
	policies.otherDeeps = learnPatterns(otherDeepNodes);
	//Iterate through all insertionNodes and otherDeepNodes, adding sub: to the policy beginning if necessary
	var addSubPolicy = function(ps){
		for (var k = 0; k < ps.length; k++){
			var matched = false;
			ps[k].shouldAddSub = false;
			ps[k].shouldRetainOriginal = false;
			for (var l = 0; l < dv.length; l++){
				var vxpath = dv[l].r;
				var node = getElementByXpath(vxpath);
				if (ps[k].sp != "" && !!node && node.nodeType == 1){
					if (node.mozMatchesSelector(ps[k].sp) && (ps[k].a=="!" || ps[k].a=="" || (ps[k].a == dv[l].a && (ps[k].n == "" || ps[k].n == dv[l].n || dv[l].n.match(ps[k].n))))) {
						if (dv[l].sub) ps[k].shouldAddSub = true;
						else ps[k].shouldRetainOriginal = true;
					}
				}
				else {
					if (ps[k].xp == vxpath && (ps[k].a=="!" || ps[k].a=="" || (ps[k].a == dv[l].a && (ps[k].n == "" || ps[k].n == dv[l].n || dv[l].n.match(ps[k].n))))){
						if (dv[l].sub) ps[k].shouldAddSub = true;
						else ps[k].shouldRetainOriginal = true;
					}
				}
			}
		}
		for (k = 0; k < ps.length; k++){
			if (ps[k].shouldAddSub){
				if (!ps[k].shouldRetainOriginal){
					ps[k].p = "sub:" + ps[k].p;
				}
				else {
					//add a sub policy, instead of replacing the original one.
					ps.push({p:"sub:" + ps[k].p, sp:ps[k].sp, xp:ps[k].xp, a:ps[k].a, n:ps[k].n});
				}
			}
		}
	}
	addSubPolicy(policies.adWidget);
	addSubPolicy(policies.otherDeeps);
	//remove some candidates if the same selector with a ! additional has been proposed
	var toRemove = [];
	for (var i = 0; i < policies.adWidget.length; i++){
		if (policies.adWidget[i].a == "!"){
			toRemove.push(policies.adWidget[i].p.substr(0, policies.adWidget[i].p.indexOf(">")));
		}
	}
	for (var i = 0; i < policies.otherDeeps.length; i++){
		if (policies.otherDeeps[i].a == "!"){
			toRemove.push(policies.otherDeeps[i].p.substr(0, policies.otherDeeps[i].p.indexOf(">")));
		}
	}
	for (var i = 0; i < toRemove.length; i++){
		for (var j = 0; j < policies.adWidget.length; j++){
			if (policies.adWidget[j].p.substr(0, policies.adWidget[j].p.indexOf(">")) == toRemove[i] && policies.adWidget[j].a != "!"){
				policies.adWidget.splice(j,1);
				j--;
			}
		}
		for (var j = 0; j < policies.otherDeeps.length; j++){
			if (policies.otherDeeps[j].p.substr(0, policies.otherDeeps[j].p.indexOf(">")) == toRemove[i] && policies.otherDeeps[j].a != "!"){
				policies.otherDeeps.splice(j,1);
				j--;
			}
		}
	}
	//done suggesting deep/insertion node selector candidates.
	if (policies.adWidget.length > 0 || policies.otherDeeps.length > 0){
		self.port.emit("postToInteractive", {type:"insertionOtherDeeps", p:policies, hd:tld, tpd:td, matches:matchedEntries, tve:dv.length, forceNewWindow:forceNewWindow});
		forceNewWindow = false;
	}
	else {
		afterInsertionDeepPolicy();
	}
}

var afterInsertionDeepPolicy = function(){
	//exclude entries the adWidget and otherDeeps patterns matched:
	var excludeAccessesMatched = function(ps){
		for (var k = 0; k < ps.length; k++){
			var match = 0;
			for (var l = 0; l < dv.length; l++){
				var vxpath = dv[l].r;
				var node = getElementByXpath(vxpath);
				var selectorToMatch = ps[k].sp;
				var xpToMatch = ps[k].xp;
				var sub = false;
				if (ps[k].p.substr(0, 4) == "sub:"){
					selectorToMatch + " " + node.nodeName;
					sub = true;
				}
				if (ps[k].sp != "" && !!node && node.nodeType == 1){
					if (node.mozMatchesSelector(selectorToMatch) && (ps[k].a=="!" || (ps[k].a == dv[l].a && (ps[k].n == "" || ps[k].n == dv[l].n || dv[l].n.match(ps[k].n))))) {
						match++;
						dv.splice(l, 1);			//dv will be modified here.
						l--;
					}
				}
				else {
					if (((vxpath.indexOf(xpToMatch)==0 && vxpath != xpToMatch && sub) || (!sub && vxpath == xpToMatch)) && (ps[k].a=="!" || (ps[k].a == dv[l].a && (ps[k].n == "" || ps[k].n == dv[l].n || dv[l].n.match(ps[k].n))))){
						match++;
						dv.splice(l, 1);			//dv will be modified here.
						l--;
					}
				}
			}
			ps[k].n = match;
		}
	}
	excludeAccessesMatched(policies.adWidget);
	excludeAccessesMatched(policies.otherDeeps);
	//Gather all Nodes of interests:
	existingPolicies = existingPolicies.split("\n");
	noi = [];
	for (var i = 0; i < existingPolicies.length; i++){
		//skip empty, special and tag policies in existing Policies.
		if (existingPolicies[i] == "" || existingPolicies[i][0] != "/" || existingPolicies[i].indexOf("[")==-1 ) continue;
		noi.push(convertPolicyFormat(existingPolicies[i]));
	}
	//get rid of sub: for root and parent candidate computation
	for (var i = 0; i < policies.adWidget.length; i++){
		noi.push({p:policies.adWidget[i].p, sp:policies.adWidget[i].sp, xp:policies.adWidget[i].xp, a:policies.adWidget[i].a, n:policies.adWidget[i].n});
		if (noi[noi.length-1].p.substr(0,4) == "sub:") noi[noi.length-1].p = noi[noi.length-1].p.substr(4);
	}
	for (var i = 0; i < policies.otherDeeps.length; i++){
		noi.push({p:policies.otherDeeps[i].p, sp:policies.otherDeeps[i].sp, xp:policies.otherDeeps[i].xp, a:policies.otherDeeps[i].a, n:policies.otherDeeps[i].n});
		if (noi[noi.length-1].p.substr(0,4) == "sub:") noi[noi.length-1].p = noi[noi.length-1].p.substr(4);
	}
	//check root and parent policy entry type possibility.
	//note: root and parent policies are not meant to be exclusive.  Deriving one root policy will not lead to excluding its matching accesses.
	//Therefore, root policies may overlap each other in terms of coverage.
	var getRootPolicies = function(ps){
		for (var k = 0; k < ps.length; k++){
			var roots = {};				//{'scrollLeft': 3}
			var parents = {};			//{'scrollLeft': 3}
			var qualifyRoot = false;
			var qualifyParent = false;
			if (ps[k].xp != ""){
				var l = ps[k].xp.split('/').length - 1;
				if (l <= 3) continue;
				for (var j = 0; j < dv.length; j++){
					var sx = dv[j].r;
					if (ps[k].xp.indexOf(sx) != 0) {
						continue;
					}
					//this dv matches as a prefix for a deeper nodes.
					var key = ">" + dv[j].a + ((dv[j].n != "") ? (":" + dv[j].n) : "");
					if (roots.hasOwnProperty(key)) {
						roots[key] += 1;
					}
					else roots[key] = 1;
					if (sx.split('/').length == l) {
						parents[key] = 1;
					}
					//mark and get rid of this in violatingEntries in the future:
					dv[j].shouldDelete = true;
				}
				for (var key in roots){
					if (roots[key] > 1 || ((!parents.hasOwnProperty(key)) && roots[key] == 1)){
						var toPush = ps[k].p.substr(0, ps[k].p.indexOf(">")) + key;
						if (policies.root.map(function(o){return o.p}).indexOf(toPush) == -1) policies.root.push({p:toPush, n: roots[key]});
					}
					else if (parents.hasOwnProperty(key) && roots[key] == 1){
						var toPush = ps[k].p.substr(0, ps[k].p.indexOf(">")) + key;
						if (policies.parent.map(function(o){return o.p}).indexOf(toPush) == -1) policies.parent.push({p:toPush, n: parents[key]});
					}
				}
			}
			else {
				for (var j = 0; j < dv.length; j++){
					var curNode = getElementByXpath(dv[j].r);
					var key = ">" + dv[j].a + ((dv[j].n != "") ? (":" + dv[j].n) : "");
					if ($(curNode).find(ps[k].sp).length > 0) {
						if (!qualifyRoot && $(curNode).children(ps[k].sp).length > 0) {
							qualifyParent = true;
							if (parents.hasOwnProperty(key)) {
								//in the CSS selector scenario, parent may match multiple dvs, because the selector may match multiple elements.
								parents[key] += 1;
							}
							else parents[key] = 1;
							//still increment the root key, but we may ignore it later if qualifyRoot is false in the end.
						}
						else {
							qualifyRoot = true;			//find means search through descendants that matches the selector in argument.
							qualifyParent = false;		//must set previously set parent to false.
						}
						//always increment roots key.
						if (roots.hasOwnProperty(key)) {
							roots[key] += 1;
						}
						else roots[key] = 1;
						//mark and get rid of this in violatingEntries in the future:
						dv[j].shouldDelete = true;
					}
				}
				if (qualifyRoot){
					for (var key in roots){
						var toPush = ps[k].p.substr(0, ps[k].p.indexOf(">")) + key;
						if (policies.root.map(function(o){return o.p}).indexOf(toPush) == -1) policies.root.push({p:toPush, n: roots[key]});
					}
				}
				else if (qualifyParent){
					for (var key in parents){
						var toPush = ps[k].p.substr(0, ps[k].p.indexOf(">")) + key;
						if (policies.parent.map(function(o){return o.p}).indexOf(toPush) == -1) policies.parent.push({p:toPush, n: parents[key]});
					}
				}
			}
		}
	}
	getRootPolicies(noi);
	//get rid of marked shallowNodes:
	for (var i = 0; i < dv.length; i++){
		if (dv[i].shouldDelete) {
			dv.splice(i, 1);
			i--;
		}
	}
	//For the rest unclassified, prompt suspicious tag and ask the developer (user).
	for (var j = 0; j < dv.length; j++){
		var nodeInfo = "";
		if (!!dv[j].n) nodeInfo = dv[j].n;
		policies.unclassified.push({p:dv[j].r + ">" + dv[j].a + (nodeInfo == "" ? "" : ":" + nodeInfo), n: 1});
	}
	processPolicies();
}

self.port.on("scroll", function(msg){
	var xpath = msg.xpath;
	var element = getElementByXpath(xpath);
	if (element == null){
		self.port.emit("elementNotFound",xpath);
		return;
	}
	//scroll into view.
	element.scrollIntoView();
});

function addElementOverlay(element, color, identifier, originalXPath){
	if (element == null){
		if (originalXPath) self.port.emit("elementNotFound",originalXPath);
		return null;
	}
	var h = element.offsetHeight;
	var w = element.offsetWidth;
	var offset = $(element).offset();
	if (h == 0 || w == 0 || offset.left < 0 || offset.top < 0){
		//invisible element, notify and don't do anything
		if (originalXPath) self.port.emit("elementNotVisible",originalXPath);
		return element;
	}
	somethingToDisplay = true;
	var e = document.createElement('div');
	e.style.position = "absolute";
	e.style.left = offset.left.toString() + "px";
	e.style.top = offset.top.toString() + "px";
	e.style.backgroundColor = color;
	e.style.height = h.toString() + "px";
	e.style.width = w.toString() + "px";
	e.style.zIndex = "100";
	e.style.borderStyle = "solid";
	e.style.borderWidth = "medium";
	e.style.borderColor = "blue";
	e.setAttribute('visualizer_overlay',identifier);		//here this is important to let remove function remove the correct overlay.
	document.body.appendChild(e);
	return element;
}

function display(xpath, color){
	var xpathBeforeTruncation = xpath;
	var ti = xpath.indexOf('#text');
	if (ti != -1){
		//text node
		var truncatedXPath = xpath.substr(0, ti - 1);
		var ele = getElementByXpath(truncatedXPath);
		if (ele == null){
			self.port.emit("elementNotFound",xpath);
			return null;
		}
		if (ele.childNodes.length != 1) {
			//parent node has more than one child, don't scroll into view or highlight, just return text content.
			var temp = xpath.substr(ti);
			if (temp.indexOf('/') != -1) return;		//impossible (why would a text child have any children?
			temp = temp.substr(6,temp.indexOf(']')-1);	//get index of this text element
			var text = $(ele).contents().filter(function() {return this.nodeType === 3;})[parseInt(temp)-1].nodeValue;
			self.port.emit('replyWithContent', {text:text, xpath:xpath});
			return null;
		}
		//if its parent only has this textnode as child, highlight its parent.
		xpath = truncatedXPath;
	}
	if (xpath.indexOf(':')!=-1){
		//this could be a FB customized node like FB:like
		//just ignore it.
		self.port.emit("elementNotVisible",xpath);
		return null;
	}
	var element = getElementByXpath(xpath);
	return addElementOverlay(element, color, xpathBeforeTruncation, xpath);
}

function CSSDisplay(selector, color){
	var i = 0;
	$(selector).each(function(){
		var ele = addElementOverlay(this, color, selector);
		if (i == 0 && !!ele) ele.scrollIntoView();  
		i++;
	});
}

self.port.on("display", function(msg){
	display(msg.xpath, msg.color);
});

self.port.on("CSSDisplay", function(msg){
	if (!!msg.CSSSelector) CSSDisplay(msg.CSSSelector, msg.color);
	else {
		var ele = display(msg.XPath, msg.color);
		if (!!ele) ele.scrollIntoView();
	}
});

self.port.on("stop", function(msg){
	var xpath = msg.xpath;
	$('div[visualizer_overlay="'+xpath+'"]').remove();
});

self.port.on("RemoveCSSDisplay", function(msg){
	if (!!msg.CSSSelector) $('div[visualizer_overlay="'+msg.CSSSelector+'"]').remove();
	else $('div[visualizer_overlay="'+msg.XPath+'"]').remove();
});

self.port.on("getContent", function(msg){
	var xpath = msg.xpath;
	if (xpath.indexOf(':')!=-1) {
		//FB:like node or similar
		alert("customized node by FB?");
		return;
	}
	var element = getElementByXpath(xpath);
	if (element != null){
		self.port.emit("contentAvailable", element.outerHTML.substr(0,400));
		alert(element.outerHTML.substr(0,400));
	}
});

self.port.on("setClearContent", function(msg){
	clearContentUponNav = msg;
});

self.port.on("renderAll", function(records){
	records = records.split("__|__");
	somethingToDisplay = false;
	for (var i = 0; i < records.length; i++){
		display(records[i], "hsla(191, 85%, 65%, 0.5)");
	}
	if (!somethingToDisplay){
		//alert('There is no visible element in this category to display!');
		self.port.emit("nothingToDisplayAll","");
	}
});

self.port.on("removeAll", function(msg){
	$("div[visualizer_overlay]").remove();
});

self.port.on("setOutputToFile", function(msg){
	//receive update outputToFile variable.
	outputToFile = (msg==='true');
});

self.port.on("outputToFile", function(msg){
	document.visualizerOutputToFile();
});

self.port.on("outputToFileAdd", function(msg){
	document.visualizerOutputToFileAdd();
});

self.port.on("checkPolicyAndOutputToFile", function(msg){
	document.checkPolicyToFile();
});

self.port.on("checkPolicyAndDisplay", function(msg){
	alert("not implemented yet!");
	//self.port.emit("obtained",document.checkPolicyToString());
});

window.addEventListener('beforeunload',function(){
	if (outputToFile) {
		document.visualizerOutputToFile();
	}
	if (clearContentUponNav){
		self.port.emit("clearSBContent","");
	}
	clearContentUponNav = true;
});

self.port.emit("requestOutputToFile","");			//request update outputToFile variable.

self.port.on("changeOvermatchThreshold", function(){
	var a = window.prompt("Set the overmatching threshold, the higher the more relaxed.", "1");
	if (!!a){
		matchRateThreshold = parseFloat(a);
		self.port.emit("changedOvermatchThreshold",a);
	}
});

self.port.on("changeTagThreshold", function(){
	var a = window.prompt("Set the tag threshold, the lower the more relaxed.", "0.25");
	if (!!a){
		tagThreshold = parseFloat(a);
		self.port.emit("changedTagThreshold",a);
	}
});

self.port.on("getIDXpathMapping", function(){
	//send xpath - id map to sidebar
	var cacheID = [];
	var cacheXPath = [];
	var i = 0;
	var recur = function(root, curXPath, index){
		var id = root.id;
		curXPath = curXPath + "/" + root.nodeName + "[" + index + "]";
		if (id != "") {
			cacheID[i] = id;
			cacheXPath[i] = curXPath;
			i++;
		}
		var next = root.firstElementChild;
		var elements = {};
		while (next != null){
			var nextName = next.nodeName;
			if (elements.hasOwnProperty(nextName)) elements[nextName]++;
			else elements[nextName] = 1;
			recur(next, curXPath, elements[nextName]);
			next = next.nextElementSibling;
		}
	};
	recur(document.body, "", 1);
	self.port.emit("xpathIDMapping", {cacheID:cacheID, cacheXPath:cacheXPath});
});