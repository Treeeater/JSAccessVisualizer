var getElementByXpath = function (path) {
    return document.evaluate(path, document, null, 9, null).singleNodeValue;
};

self.port.on("nav", function(msg){
	document.location = msg;
});

self.port.on("scroll", function(msg){
	var xpath = "/html[1]"+msg.xpath;
	var element = getElementByXpath(xpath);
	if (element == null){
		self.port.emit("elementNotFound",xpath);
		return;
	}
	//scroll into view.
	element.scrollIntoView();
});

function display(xpath, color){
	var xpath = "/html[1]"+xpath;
	var ti = xpath.indexOf('#text');
	if (ti != -1){
		//text node, don't scroll into view or highlight, just return text content.
		var temp = xpath.substr(ti);
		if (temp.indexOf('/') != -1) return;		//impossible (why would a text child have any children?
		temp = temp.substr(6,temp.indexOf(']')-1);
		var truncatedXPath = xpath.substr(0, ti - 1);
		var ele = getElementByXpath(truncatedXPath);
		if (ele == null){
			self.port.emit("elementNotFound",xpath);
			return;
		}
		var text = $(ele).contents().filter(function() {return this.nodeType === 3;})[parseInt(temp)-1].nodeValue;
		self.port.emit('replyWithContent', {text:text, xpath:xpath});
		return;
	}
	var element = getElementByXpath(xpath);
	if (element == null){
		self.port.emit("elementNotFound",xpath);
		return;
	}
	var h = element.offsetHeight;
	var w = element.offsetWidth;
	if (h == 0 || w == 0){
		//invisible element, notify and don't do anything
		self.port.emit("elementNotVisible",xpath);
		return;
	}
	var color = color;
	var offset = $(element).offset();
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
	e.setAttribute('visualizer_overlay',xpath);
	document.body.appendChild(e);
}

self.port.on("display", function(msg){
	display(msg.xpath, msg.color);
});

self.port.on("stop", function(msg){
	var xpath = "/html[1]"+msg.xpath;
	if (xpath.indexOf('#text')!=-1) return;
	var element = getElementByXpath(xpath);
	if (element != null){
		$("div[visualizer_overlay='"+xpath+"']").remove();
	}
});

self.port.on("getContent", function(msg){
	var xpath = "/html[1]"+msg.xpath;
	var element = getElementByXpath(xpath);
	if (element != null){
		self.port.emit("contentAvailable", element.outerHTML.substr(0,400));
		alert(element.outerHTML.substr(0,400));
	}
});

self.port.on("renderAll", function(records){
	records = records.split("_");
	for (var i = 0; i < records.length; i++){
		display(records[i], "hsla(191, 85%, 65%, 0.5)");
	}
});

self.port.on("removeAll", function(msg){
	$("div[visualizer_overlay]").remove();
});
