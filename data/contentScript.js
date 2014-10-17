var outputToFile = true;
var clearContentUponNav = true;

var getElementByXpath = function (path) {
    return document.evaluate(path, document, null, 9, null).singleNodeValue;
};

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

var inferModelFromRawViolatingRecords = function(rawData, targetDomain){
	retVal = "";
	//2nd arg is optional, when specified, only infer the specified domain's policy.
	//rawData is the raw data obtained from document.checkPolicyToString
	console.log(rawData);
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
		console.log(data);
		//Handle possible scenarios like //SCRIPT>GetSrc first.
		var cache = {};
		var remainingAccesses = [];
		for (var k in tagPolicyValues) {
			if (tagPolicyValues[k] > 1){
				var tagName = k.substr(0, k.indexOf('>'));
				if (!cache[tagName]) {
					cache[tagName] = document.getElementsByTagName(tagName).length;
				}
				if (tagPolicyValues[k] >= cache[tagName]/3) {
					policies.tag.push(k);
					//Erase the handled accesses from dataDomain.violatingEntries.
					//it's ok to write loop here as we do not expect this to happen many times
					for (j = 0; j < dataDomain.violatingEntries.length; j++){
						var e = dataDomain.violatingEntries[j];
						if (k != "//" + e.t + ">" + e.a + ":" + e.n) {
							remainingAccesses.push(e);
						}
					}
				}
			}
		}
		console.log(remainingAccesses);
		//start with deepmost access, get an array of deepmost nodes (if one node xpath is another one's prefix, ignore this for now)
		deepNodes = [];
		shallowNodes = [];
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
			}
		}
		console.log(deepNodes);
		console.log(shallowNodes);
		//remainingAccesses are divided into two types: shallowNodes and deepNodes.  Shallow nodes are parents of deep nodes.
		//Now, for these deep nodes, discover their pattern --- e.g. //DIV[@id="ad-.*"].  If impossible, list themselves
	}
	//confirm the pattern doesn't over-include other unrelated nodes
	//check root policy entry type possibility
	//for the rest accesses, see if any of them are likely //A>gethref category (check if 33% or more of those same tag names were accessed)
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