var outputToFile = true;
var clearContentUponNav = true;

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
	console.log("\n");
	console.log(msg);
}

var debug = function(msg){
	console.log("D->");
	console.log(msg);
}

self.port.on("nav", function(msg){
	document.location = msg;
});

self.port.on("obtainNow", function(){
	self.port.emit("obtained",document.visualizerOutputToString());
});

self.port.on("inferModel", function(targetDomain){
	var string = inferModelFromRawViolatingRecords(document.checkPolicyToString(), targetDomain);
	self.port.emit("returningPolicy", string);
});

var getPatterns = function(abs, agg){
	var i;
	var returnValue = [];
	while (abs.length > 0){
		var patterns = [];
		for (i = 0; i < agg.length; i++){
			//agg's max length is 3.
			//special case for class:
			var matchNumber = 0;
			if (agg[i].n.indexOf("class__")!=-1) {
				var tagName = agg[i].n.substr(0, agg[i].n.indexOf(">"));
				var attrName = agg[i].n.substr(tagName.length + 8);		//8: >class__
				var p = tagName + "[class='" + attrName + "']";
				matchNumber = getElementsByCSS(p).length;
				if (matchNumber > agg[i].f || matchNumber <= 1) continue;		//this accidentally matches other nodes.
				else {
					patterns.push({p:p, n:matchNumber});
					continue;
				}
			}
			//for all other attr:
			var headPattern="";
			var prevMaxMatches = 0;
			for (j = 0; j < abs.length; j++){
				abs[j].excluded = false;
			}
			while (true){
				var curC = {};
				var maxC = "";
				var maxMatches = -1;
				for (j = 0; j < abs.length; j++){
					if (!abs[j].a.hasOwnProperty(agg[i].n) || abs[j].excluded) continue;
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
				if (maxC == "" || maxMatches < prevMaxMatches) break;
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
			var tailPattern="";
			while (true){
				var curC = {};
				var maxC = "";
				var maxMatches = -1;
				for (j = 0; j < abs.length; j++){
					if (!abs[j].a.hasOwnProperty(agg[i].n) || abs[j].excluded) continue;
					var c = abs[j].a[agg[i].n].substr(abs[j].a[agg[i].n].length - tailPattern.length - 1,1);
					if (curC.hasOwnProperty(c)) {
						curC[c]++;
						if (maxMatches < curC[c]) {
							maxMatches = curC[c];
							maxC = c;
						}
					}
					else curC[c] = 1;
				}
				if (maxC == "" || maxMatches < prevMaxMatches) break;
				else {
					if (prevMaxMatches == 0) prevMaxMatches = maxMatches;
					for (j = 0; j < abs.length; j++){
						if (!abs[j].a.hasOwnProperty(agg[i].n)) abs[j].excluded = false;
						else abs[j].excluded = (maxC != abs[j].a[agg[i].n].substr(abs[j].a[agg[i].n].length - tailPattern.length - 1,1));
					}
					tailPattern = tailPattern + maxC;
				}
			}
			var headMatchNumber = 0;
			var tailMatchNumber = 0;
			//construct real head pattern and tail pattern
			var tagName = agg[i].n.substr(0, agg[i].n.indexOf(">"));
			var attrName = agg[i].n.substr(name.length + 2);
			if (headPattern != "") {
				headPattern = tagName + "[" + attrName + "^='" + headPattern + "']";
				headMatchNumber = getElementsByCSS(headPattern).length;
				if (headMatchNumber > agg[i].f || headMatchNumber <= 1) headMatchNumber = 0;
			}
			if (tailPattern != "") {
				tailPattern = tagName + "[" + attrName + "$='" + tailPattern + "']";
				tailMatchNumber = getElementsByCSS(tailPattern).length;
				if (tailMatchNumber > agg[i].f || tailMatchNumber <= 1) tailMatchNumber = 0;
			}
			if (headMatchNumber == 0 && tailMatchNumber == 0) continue;
			else if (headMatchNumber >= tailMatchNumber) patterns.push({p:headPattern, n:headMatchNumber});
			else patterns.push({p:tailPattern, n:tailMatchNumber});
		}
		var maxMatchNumber = 0;
		var maxPattern = "";
		for (i = 0; i < patterns.length; i++){
			if (maxMatchNumber < patterns[i].n){
				maxMatchNumber = patterns[i].n;
				maxPattern = patterns[i].p;
			}
		}
		if (maxPattern != "") {
			returnValue.push(maxPattern);
			//remove all matched nodes and do it again.
			var toEliminate = getElementsByCSS(maxPattern);
			for (i = 0; i < toEliminate.length; i++){
				for (j = 0; j < abs.length; j++){
					if (toEliminate[i] == abs[j].n) {
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
				returnValue.push(abs[i].r);
			}
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
		//if the attribute is not present in more than one node, it is not a good selector
		if (aggregatedAttrF[i] > 1) aggregatedAttrNames.push({n:aggregatedAttrN[i], f:aggregatedAttrF[i]});
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
	console.log(abstractedList);
	var patterns = getPatterns(abstractedList, aggregatedAttrNames);
	console.log(patterns);
	//Guess ID, class, and then the rest of their most common attributes in order
	//Guess their parent and grandparents.
	//Match tail pattern://div[substring(@id, string-length(@id)-1, 2)='gh']
	//Match head pattern://div[starts-with(@id, 'g')]
	//Count: count(//div), retrieve by result.numberValue
}

var inferModelFromRawViolatingRecords = function(rawData, targetDomain){
	retVal = "";
	//2nd arg is optional, when specified, only infer the specified domain's policy.
	//rawData is the raw data obtained from document.checkPolicyToString
	consoleLog(rawData);
	//Parse data to records
	rawData = rawData.replace(/\r/g,'');					//get rid of file specific \r
	var url = rawData.substr(5, rawData.indexOf('\n---')-4);
	rawData = rawData.substr(rawData.indexOf('---')+4);		//get rid of the first url declaration.
	rawData = rawData.substr(0, rawData.length-5);
	domains = rawData.split("tpd: ");
	var policies = {base:[], tag:[], root:[], sub:[], exact:[]};
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
		while (curData.length > 4 && curData.substr(0, 4) == "_r: "){
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
			else additional = thisData;
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
			}
		}
		consoleLog(data);
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
					policies.tag.push(k);
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
		var remainingAccesses = dataDomain.violatingEntries;
		consoleLog(remainingAccesses);
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
		consoleLog(deepNodes);
		consoleLog(shallowNodes);
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
				if (!insert) insert = (deepNodes[j].a == "InsertBefore" || deepNodes[j].a == "AppendChild" || deepNodes[j].a == "document.write" || deepNodes[j].a == "ReplaceChild");
				if (deepNodes[j].a == "SetAttribute") setAttributes.push(deepNodes[j].n);
				else if (deepNodes[j].a.indexOf("Set") == 0) setAttributes.push(deepNodes[j].a.substr(3).toLowerCase());
				//(setattributes could have duplicate, but max of two dup)
				j++;
				if (j >= deepNodes.length || deepNodes[j-1].r != deepNodes[j].r) break;
			}
			if (insert) {
				deepInsertionNodes.push({"xpath":deepNodes[j-1].r, "forbidden":setAttributes});
				deepNodes.splice(start, j - start);
				j = start;
			}
		}
		consoleLog(deepInsertionNodes);
		//deepInsertionNodes contains deep nodes that has accessed insertion APIs.
		//Now, for these nodes, discover their pattern --- e.g. //DIV[@id="ad-.*"].  If impossible, list themselves
		var patterns = learnPatterns(deepInsertionNodes);
	}
	//confirm the pattern doesn't over-include other unrelated nodes
	//check root policy entry type possibility
	//For all of the above, categorize them as Ads/Widgets, or getting contents by looking at whether they have appendChild-like APIs called
	//For the rest unclassified, prompt suspicious tag and ask the developer (user).
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

function display(xpath, color){
	var xpath = xpath;
	var xpathBeforeTruncation = xpath;
	var ti = xpath.indexOf('#text');
	if (ti != -1){
		//text node
		var truncatedXPath = xpath.substr(0, ti - 1);
		var ele = getElementByXpath(truncatedXPath);
		if (ele == null){
			self.port.emit("elementNotFound",xpath);
			return;
		}
		if (ele.childNodes.length != 1) {
			//parent node has more than one child, don't scroll into view or highlight, just return text content.
			var temp = xpath.substr(ti);
			if (temp.indexOf('/') != -1) return;		//impossible (why would a text child have any children?
			temp = temp.substr(6,temp.indexOf(']')-1);	//get index of this text element
			var text = $(ele).contents().filter(function() {return this.nodeType === 3;})[parseInt(temp)-1].nodeValue;
			self.port.emit('replyWithContent', {text:text, xpath:xpath});
			return;
		}
		//if its parent only has this textnode as child, highlight its parent.
		xpath = truncatedXPath;
	}
	if (xpath.indexOf(':')!=-1){
		//this could be a FB customized node like FB:like
		//just ignore it.
		self.port.emit("elementNotVisible",xpath);
		return;
	}
	var element = getElementByXpath(xpath);
	if (element == null){
		self.port.emit("elementNotFound",xpath);
		return;
	}
	var h = element.offsetHeight;
	var w = element.offsetWidth;
	var offset = $(element).offset();
	if (h == 0 || w == 0 || offset.left < 0 || offset.top < 0){
		//invisible element, notify and don't do anything
		self.port.emit("elementNotVisible",xpath);
		return;
	}
	var color = color;
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
	e.setAttribute('visualizer_overlay',xpathBeforeTruncation);		//here this is important to let remove function remove the correct overlay.
	document.body.appendChild(e);
}

self.port.on("display", function(msg){
	display(msg.xpath, msg.color);
});

self.port.on("stop", function(msg){
	var xpath = msg.xpath;
	$('div[visualizer_overlay="'+xpath+'"]').remove();
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