var outputToFile = true;
var clearContentUponNav = true;
var logMsgCount = 0;

var getElementByXpath = function (path) {
    return document.evaluate(path, document, null, 9, null).singleNodeValue;
};

var getElementsByXpath = function (path) {
    return document.evaluate(path, document, null, 4, null);
};

var getElementsByCSS = function (selector) {
    return document.querySelectorAll(selector);
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

self.port.on("inferModel", function(targetDomain){
	var string = inferModelFromRawViolatingRecords(document.checkPolicyToString(), targetDomain);
	var tld = document.domain.split(".");
	if (tld.length > 2) tld = tld[tld.length - 2] + "." + tld[tld.length - 1];
	else tld = tld.join(".");
	self.port.emit("returningPolicy", {policy:string, domain:tld, thirdPDomain:targetDomain});
});

var getPatterns = function(abs, agg){
	var i;
	var returnValue = [];
	var iteration = 0;
	var MAXITERATION = 5;
	while (abs.length > 0 && iteration < MAXITERATION){
		iteration++;
		var patterns = [];
		var classPatterns = [];
		for (i = 0; i < agg.length; i++){
			//agg's max length is 3.
			//special case for class:
			var matchNumber = 0;
			if (agg[i].n.indexOf("class__")!=-1) {
				var tagName = agg[i].n.substr(0, agg[i].n.indexOf(">"));
				var attrName = agg[i].n.substr(tagName.length + 8);		//8: >class__
				var p = tagName + "."+ attrName;
				matchNumber = getElementsByCSS(p).length;
				if (matchNumber > agg[i].f || matchNumber <= 1) continue;		//this accidentally matches other nodes.
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
			var tagName = agg[i].n.substr(0, agg[i].n.indexOf(">"));
			var attrName = agg[i].n.substr(tagName.length + 1);
			if (headPattern == "" && tailPattern == ""){
				//test if simply having this attribute can be a unique identifier.
				var pattern = tagName + "[" + attrName + "]";
				var matchRate = getElementsByCSS(pattern).length / agg[i].f;
				if (matchRate < 4) {
					patterns.push({p:pattern, n:agg[i].f, r:matchRate});
				}
			}
			else {
				if (headPattern != "" && maxHeadMatch > 0) {
					headPattern = tagName + "[" + attrName + "^='" + headPattern + "']";
					headMatchRate = getElementsByCSS(headPattern).length / maxHeadMatch;
					if (headMatchRate >= 4) {
						headMatchRate = 0;		//This describer is too inacurrate, cannot use.
						maxHeadMatch = 0;
					}
				}
				if (tailPattern != "" && maxTailMatch > 0) {
					tailPattern = tagName + "[" + attrName + "$='" + tailPattern + "']";
					tailMatchRate = getElementsByCSS(tailPattern).length / maxTailMatch;
					if (tailMatchRate >= 4) {
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
			var tagName = "";
			var attrName = "";
			var attrValue = "";
			var selectorPattern = maxPattern;
			//prepare to remove all matched nodes and do it again.
			var toEliminate = getElementsByCSS(selectorPattern);
			
			//convert maxPattern from CSS selector to our selector
			if (classPatterns.indexOf(maxPattern) > -1){
				tagName = maxPattern.substr(0, maxPattern.indexOf("."));
				attrValue = maxPattern.substr(tagName.length+1);
				attrName = "class";
			}
			else {
				tagName = maxPattern.substr(0, maxPattern.indexOf("["));
				maxPattern = maxPattern.substr(tagName.length + 1);
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
			maxPattern = "//" + tagName + "[@" + attrName + "='" + attrValue + "']>!";		//TODO: >! could be too relaxed. This can be further tightened with analysis, but we leave this for future work.
			returnValue.push({p:maxPattern, sp:selectorPattern});
			
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
				var policy = abs[i].r;
				var temp = policy.indexOf("|");
				if (temp > -1) policy = policy.substr(temp + 1);
				policy += ">!"
				returnValue.push({p:policy, sp:""});
			}
			break;
		}
		if (iteration >= MAXITERATION){
			//max iterations reached, just dump all the rest and output alarm
			for (i = 0; i < abs.length; i++){
				//unmatched accesses
				var policy = abs[i].r;
				var temp = policy.indexOf("|");
				if (temp > -1) policy = policy.substr(temp + 1);
				policy += ">!"
				returnValue.push({p:policy, sp:""});
			}
			error("Too many iterations, dumping all other accesses in original form.");
			break;
		}
	}
	return returnValue;
}

var learnPatterns = function(deepInsertionNodes){
	//Obtain real node handles first.
	var i,j;
	var abstractedList = [];		//[{r:resource: a:[{n:v}, {n:v}, ..]}, ...]
	var aggregatedAttrNames = [];			//[{id:4}, {class:5}];
	var aggregatedAttrN = [];		//auxillary structures to generate aggregatedAttrNames.
	var aggregatedAttrF = [];
	for (i = 0; i < deepInsertionNodes.length; i++){
		var node = getElementByXpath(deepInsertionNodes[i].xpath.split("|")[0]);
		if (node != null) {
			var a = node.attributes;
			var attributeCandidates = {};
			for (j = 0; j < a.length; j++){
				var temp = a[j].name;
				if (deepInsertionNodes[i].forbidden.indexOf(temp)==-1){
					if (temp == "class") {
					//special treatment for class
						var values = a[j].value.split(" ");
						for (var k = 0; k < values.length; k++){
							if (values[k]=="") continue;
							temp = node.tagName + ">class__" + values[k];
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
						temp = node.tagName + ">" + temp;
						attributeCandidates[temp] = a[j].value;
						if (aggregatedAttrN.indexOf(temp) == -1) {
							aggregatedAttrN.push(temp);
							aggregatedAttrF.push(1);
						}
						else aggregatedAttrF[aggregatedAttrN.indexOf(temp)] += 1;
					}
				}
			}
			abstractedList.push({r: deepInsertionNodes[i].xpath, n: node, a:attributeCandidates});
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
	return patterns;
	//TODO: Guess their parent and grandparents. This is not yet seen to be useful, but could benefit some sites in the future.
	
	//XPATH to match tail pattern://div[substring(@id, string-length(@id)-1, 2)='gh']
	//To match head pattern://div[starts-with(@id, 'g')]
	//To count: count(//div), retrieve by result.numberValue
}

var inferModelFromRawViolatingRecords = function(rawData, targetDomain){
	retVal = "";
	//2nd arg is optional, when specified, only infer the specified domain's policy.
	//rawData is the raw data obtained from document.checkPolicyToString
	//Parse data to records
	rawData = rawData.replace(/\r/g,'');					//get rid of file specific \r
	var url = rawData.substr(5, rawData.indexOf('\n---')-4);
	rawData = rawData.substr(rawData.indexOf('---')+4);		//get rid of the first url declaration.
	rawData = rawData.substr(0, rawData.length-5);
	domains = rawData.split("tpd: ");
	var policies = {base:[], tag:[], root:[], sub:[], exact:[], parent:[], unclassified:[], totalViolatingEntries:0};
	var data = {};
	var i,j;
	for (i = 0; i < domains.length; i++){
		var curData = domains[i];
		if (curData == "") continue;
		var domain = curData.substr(0, curData.indexOf(":\n"));
		data[domain] = {};
		var dataDomain = data[domain];			//alias pointing to the same object.
		if (typeof targetDomain != "undefined" && targetDomain != "" && domain != targetDomain) continue; 
		curData = curData.substr(curData.indexOf('\n')+1);
		//Ignore matched cases
		var matchedEntries = 0;
		var matchedPolicies = 0;
		while (curData.length > 2 && curData.substr(0, 2) == "M:"){
			matchedPolicies++;
			curData = curData.substr(curData.indexOf("<-with->") + 9);
			matchedEntries += parseInt(curData.substr(0, curData.indexOf("\n")));
			curData = curData.substr(curData.indexOf("\n") + 1);
		}
		dataDomain.matchedPolicies = matchedPolicies;
		dataDomain.matchedEntries = matchedEntries;
		dataDomain.violatingEntries = [];
		var tagPolicyValues = {};
		if (curData.length <= 2) continue;		//all reported accesses are matched with existing policy.
		//Collect unmatched cases
		policyBase = {};
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
				nodeInfo = nodeInfo.substr(0, nodeInfo.length - 1);
			}
			else additional = thisData.substr(0, thisData.length - 1);
			//Ignore base access (/html, document.cookie, etc.)
			if (resource[0] == "/"){
				var temp = resource.split("|")[0];
				if (temp != "/HTML[1]" && temp != "/HTML[1]/BODY[1]" && temp != "/HTML[1]/HEAD[1]")
				{
					//Classify accesses by tagnames
					var tagName = temp.split("/");
					tagName = tagName[tagName.length - 1];
					tagName = tagName.substr(0, tagName.indexOf('['));
					var key = "//" + tagName + ">" + additional + ":" + nodeInfo;
					if (!tagPolicyValues[key]) tagPolicyValues[key] = 1;
					else tagPolicyValues[key]++;
					dataDomain.violatingEntries.push({r:resource, a:additional, n:nodeInfo, t:tagName});		//r = resource, a = apiname, n = argvalue.
				}
				else {
					//suggest base policies:
					var policy = resource + ">" + additional;
					if (!!nodeInfo) {
						policy += ":";
						if (nodeInfo.indexOf("[o]") == 0) {
							policy += "\\[o\\]";
							nodeInfo = nodeInfo.substr(3);
						}
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
								policy += nodeInfo.substr(0, startingGT + 1);
								nodeInfo = nodeInfo.substr(startingGT + 1);
								if (nodeInfo[nodeInfo.length - 1] == ">"){
									var endingLT = nodeInfo.lastIndexOf("<");
									if (endingLT > 0) {
										policy += ".*";
										policy += nodeInfo.substr(endingLT);
									}
									else if (endingLT == -1) policy += ".*";
									else policy += nodeInfo.substr(endingLT);
								}
								else policy += ".*";
							}
							else policy += ".*";
						}
						else {
							policy += nodeInfo;
						}
					}
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
				}
				policies.base.push({p:policy, n: 1});
			}
		}
		//aggregate results from policyBase to policies.base
		for (var policy in policyBase){
			policies.base.push({p:policy, n: policyBase[policy]});
		}
		//Handle possible scenarios like //SCRIPT>GetSrc first.
		var cache = {};
		for (var k in tagPolicyValues) {
			if (tagPolicyValues[k] > 1){
				var tagName = k.substr(2);
				tagName = tagName.substr(0,tagName.indexOf('>'));
				if (!cache[tagName]) {
					cache[tagName] = document.getElementsByTagName(tagName).length;
				}
				if (tagPolicyValues[k] >= cache[tagName]/3) {
					policies.tag.push({p:k, n:tagPolicyValues[k]});
					//Erase the handled accesses from dataDomain.violatingEntries.
					//it's ok to write loop here as we do not expect this to happen many times
					for (j = 0; j < dataDomain.violatingEntries.length; j++){
						var e = dataDomain.violatingEntries[j];
						if (k == "//" + e.t + ">" + e.a + ":" + e.n) {
							dataDomain.violatingEntries.splice(j, 1);
							j--;
						}
					}
				}
			}
		}
		var remainingAccesses = [];
		//make a deep copy of violatingEntries.
		for (var k = 0; k < dataDomain.violatingEntries.length; k++){
			remainingAccesses.push(dataDomain.violatingEntries[k]);
		}
		//start with deepmost access, get an array of deepmost nodes (if one node xpath is another one's prefix, ignore this for now)
		var deepNodes = [];
		var shallowNodes = [];
		while (remainingAccesses.length > 0){
			//get deepmost node
			var maxDepth = -1;
			var maxIndex = 0;
			for (j = 0; j < remainingAccesses.length; j++){
				var curDepth = remainingAccesses[j].r.split('|')[0].split('/').length;
				if (curDepth > maxDepth) {
					maxDepth = curDepth;
					maxIndex = j;
				}
			}
			deepNodes.push(remainingAccesses.splice(maxIndex, 1)[0]);
			var maxXPath = deepNodes[deepNodes.length-1].r.split('|')[0];
			//eliminate its parent nodes.
			for (j = 0; j < remainingAccesses.length; j++){
				var curXPath = remainingAccesses[j].r.split('|')[0];
				if (maxXPath != curXPath && maxXPath.indexOf(curXPath) == 0) {
					//current access is a parent of other accesses.
					shallowNodes.push(remainingAccesses.splice(j, 1)[0]);
					j--;
				}
				else if (maxXPath == curXPath && j != maxIndex) {
					//push other accesses of itself in deepNodes too.
					deepNodes.push(remainingAccesses.splice(j, 1)[0]);
					j--;
				}
			}
		}
		//remainingAccesses are divided into two types: shallowNodes and deepNodes.  Shallow nodes are parents of deep nodes.
		var deepInsertionNodes = [];
		j = 0;
		while (j < deepNodes.length){
			var curNode = deepNodes[j];
			var insert = false;
			var setAttributes = [];
			var start = j;
			//see how many after this is talking about the same node
			while (true){
				if (!insert) insert = (deepNodes[j].a == "InsertBefore" || deepNodes[j].a == "AppendChild" || deepNodes[j].a == "document.write" || deepNodes[j].a == "ReplaceChild" || deepNodes[j].a == "SetInnerHTML");
				if (deepNodes[j].a == "SetAttribute") setAttributes.push(deepNodes[j].n);
				else if (deepNodes[j].a.indexOf("Set") == 0) setAttributes.push(deepNodes[j].a.substr(3).toLowerCase());
				//(setattributes could have duplicate, but max of two dup)
				j++;
				if (j >= deepNodes.length || deepNodes[j-1].r != deepNodes[j].r) break;
			}
			if (insert){
				deepInsertionNodes.push({"xpath":deepNodes[j-1].r, "forbidden":setAttributes, "a":deepNodes[j-1].a, "n":deepNodes[j-1].n});
				deepNodes.splice(start, j - start);
				j = start;
			}
		}
		//deepInsertionNodes contains deep nodes that have accessed insertion APIs.
		//Now, for these nodes, discover their pattern --- e.g. //DIV[@id="ad-.*"].  If impossible, list themselves
		policies.exact = learnPatterns(deepInsertionNodes);
		//get how many entries the exact patterns matched:
		for (var k = 0; k < policies.exact.length; k++){
			var match = 0;
			for (var l = 0; l < dataDomain.violatingEntries.length; l++){
				var node = getElementByXpath(dataDomain.violatingEntries[l].r.split('|')[0]);
				if (policies.exact[k].sp != ""){
					if (node.mozMatchesSelector(policies.exact[k].sp)) {
						match++;
						dataDomain.violatingEntries.splice(l, 1);			//violatingEntries will be modified here.
						l--;
					}
				}
				else {
					match = 1;
					dataDomain.violatingEntries.splice(l, 1);			//violatingEntries will be modified here.
					l--;
					break;
				}
			}
			policies.exact[k].n = match;
		}
		//check root policy entry type possibility.
		//note: root policies are not meant to be exclusive.  Deriving one root policy will not lead to excluding its matching accesses.
		//Therefore, root policies may overlap each other in terms of coverage.
		for (var k = 0; k < deepInsertionNodes.length; k++){
			var nodeXPath = deepInsertionNodes[k].xpath.split("|")[0];
			var l = nodeXPath.split('/').length - 1;
			if (l <= 3) continue;
			var node = getElementByXpath(nodeXPath);
			for (j = 0; j < policies.exact.length; j++){
				if (policies.exact[j].sp != "" && node.mozMatchesSelector(policies.exact[j].sp)) break;
			}
			var matchIndex = j;
			if (matchIndex == policies.exact.length) continue;			//no match for this node (probably no policy generated to match this)
			var roots = {};				//{'scrollLeft': 3}
			var parents = {};			//{'scrollLeft': 3}
			for (j = 0; j < shallowNodes.length; j++){
				var sx = shallowNodes[j].r.split('|')[0];
				if (nodeXPath.indexOf(sx) != 0) {
					shallowNodes[j].shouldDelete = false;
					continue;
				}
				//this shallowNodes matches as a prefix for a deeper nodes.
				var key = ">" + shallowNodes[j].a + ((shallowNodes[j].n != "") ? (":" + shallowNodes[j].n) : "");
				if (roots.hasOwnProperty(key)) {
					roots[key] += 1;
				}
				else roots[key] = 1;
				if (sx.split('/').length == l) {
					parents[key] = 1;
				}
				//mark and get rid of this in violatingEntries in the future:
				shallowNodes[j].shouldDelete = true;
			}
			for (var key in roots){
				if (roots[key] > 1 || ((!parents.hasOwnProperty(key)) && roots[key] == 1)){
					var toPush = policies.exact[matchIndex].p.substr(0, policies.exact[matchIndex].p.length - 2) + key;
					if (policies.root.map(function(o){return o.p}).indexOf(toPush) == -1) policies.root.push({p:toPush, n: roots[key]});
				}
				else if (parents.hasOwnProperty(key) && roots[key] == 1){
					var toPush = policies.exact[matchIndex].p.substr(0, policies.exact[matchIndex].p.length - 2) + key;
					if (policies.parent.map(function(o){return o.p}).indexOf(toPush) == -1) policies.parent.push({p:toPush, n: 1});
				}
			}
		}
		var dv = dataDomain.violatingEntries;
		//get rid of marked shallowNodes:
		for (var j = 0; j < shallowNodes.length; j++){
			if (shallowNodes[j].shouldDelete){
				for (var k = 0; k < dv.length; k++){
					if (dv[k].r == shallowNodes[j].r) {
						dv.splice(k, 1);
						k--;
					}
				}
			}
		}
		//For the rest unclassified, prompt suspicious tag and ask the developer (user).
		for (var j = 0; j < dv.length; j++){
			policies.unclassified.push({p:dv[j].r.split('|')[0] + ">" + dv[j].a + (dv[j].n == "" ? "" : ":" + dv[j].n), n: 1});
		}
	}
	return policies;
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