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

self.port.on("inferModel", function(){
	self.port.emit("returningRawViolatingRecords",document.checkPolicyToString());
});

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