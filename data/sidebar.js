var selectedElement = null;

function htmlDecode(value) {
    if (value) {
        return $('<div />').html(value).text();
    } else {
        return '';
    }
}

function insertRecords(ele, domain, recordType){
	var records = processed[recordType][domain];
	ele.firstChild.nodeValue = htmlDecode("&#9660;") + " " +recordType;
	for (var i = 0; i < records.length; i++){
		var recordElement = document.createElement('li');
		recordElement.setAttribute('status', 'unselected');
		recordElement.setAttribute('class', 'recordEntry');
		if (records[i].resource.length > 30){
			recordElement.innerHTML = records[i].resource.substr(0,30)+"...";
			recordElement.title = records[i].resource;
		}
		else recordElement.innerHTML = records[i].resource;
		if (recordType != "specialRecords"){
			recordElement.setAttribute('xpath', records[i].resource);
			recordElement.addEventListener("mouseover", hoverIn, false);
			recordElement.addEventListener("mouseout", hoverOut, false);
		}
		else {
			recordElement.setAttribute('noHandlers','noHandlers');
		}
		$(ele).append(recordElement);
	}
}

function expandCategoryList(ele){
	var domain = $(ele).attr("url");
	insertRecords(ele, domain, ele.firstChild.nodeValue.substr(2));
}

function insertCategories(ele, domain){
	if (processed["contentRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; contentRecords<span class='displayall' c='contentRecords'>DisplayAll</span></li>");
	if (processed["setterRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; setterRecords<span class='displayall' c='setterRecords'>DisplayAll</span></li>");
	if (processed["getterRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; getterRecords<span class='displayall' c='getterRecords'>DisplayAll</span></li>");
	if (processed["specialRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; specialRecords</li>");
}

function expandDomainList(ele){
	var domain = ele.innerHTML.substr(2);
	$(ele).html("&#9660; "+domain);
	insertCategories(ele, domain);
}

function collapseGeneric(event){
	var text = event.target.firstChild.nodeValue.substr(2);
	event.target.firstChild.nodeValue = htmlDecode("&#9658;") + " " + text;
	if ($.contains(event.target, selectedElement)){
		//toggle element if its parent is collapsed
		if ($(selectedElement).is("[c]")){
			addon.port.emit('removeAll', "");
			$(selectedElement).removeClass('clicked');
			selectedElement = null;
		}
		else{
			$(selectedElement).removeClass('selected hovered NOTFOUND NOTVISIBLE');
			$(selectedElement).attr('status', 'unselected');
			sendToCS(selectedElement, "stop");
			selectedElement = null;
		}
	}
	if ($(event.target).is("[class='domain']")){
		$(event.target).children().remove();
	}
	else if ($(event.target).is("[class='category']")){
		$(event.target).children("li.recordEntry").remove();
	}
}

function expandGeneric(event){
	if ($(event.target).is("[class='domain']")) expandDomainList(event.target);
	if ($(event.target).is("[class='category']")) expandCategoryList(event.target);
}

function toggleGeneric(event){
	var wrapped = $(event.target);
	if (wrapped.attr('noHandlers') == 'noHandlers') return false;
	if (wrapped.attr('status') == 'collapsed') {
		wrapped.attr('status', 'expanded');
		expandGeneric(event);
		return false;
	}
	else if (wrapped.attr('status') == 'expanded') {
		wrapped.attr('status', 'collapsed');
		collapseGeneric(event);
		return false;
	}
	if (selectedElement != null && event.target != selectedElement){
		//if we have already selected an element and now we click on a new element
		if ($(selectedElement).is("[c]")){
			addon.port.emit('removeAll', "");
			$(selectedElement).removeClass('clicked');
			selectedElement = null;
		}
		else{
			$(selectedElement).removeClass('selected hovered NOTFOUND NOTVISIBLE');
			$(selectedElement).attr('status', 'unselected');
			sendToCS(selectedElement, "stop");
			selectedElement = null;
		}
	}
	if (wrapped.is("[c]")){
		//displayall button pressed
		var c = wrapped.attr('c');
		wrapped.toggleClass('clicked');
		if (wrapped.hasClass('clicked')) {
			var domain = wrapped.parent().attr('url');
			var records = processed[c][domain];
			var xpaths = [];
			selectedElement = event.target;
			addon.port.emit('renderAll', records.map(function(rec){return rec.resource;}).join("_"));
		}
		else {
			addon.port.emit('removeAll', "");
			selectedElement = null;
		}
	}
	else if (wrapped.attr('status') == 'unselected'){
		//MAKE SURE THIS ELEMENT EXISTS
		if (wrapped.hasClass('NOTFOUND')){
			return false;
		}
		if (wrapped.hasClass('NOTVISIBLE')){
			sendToCS(event.target, "getContent");
			return false;
		}
		selectedElement = event.target;
		wrapped.attr('status', 'selected');
		wrapped.addClass('selected');
		//send ajax to real page to display
		sendToCS(event.target, "scroll");
	}
	else if (wrapped.attr('status') == 'selected'){
		wrapped.attr('status', 'unselected');
		wrapped.removeClass('selected');
		selectedElement = null;
		//Do not stop the display on this element yet.
		//sendToCS(event.target, "stop");
	}
}

function sendToCS(ele, mode, c){
	var xpath;
	if (ele.hasAttribute('xpath')) xpath = ele.getAttribute('xpath');
	else xpath = ele.innerHTML;
	var color = "";
	if (mode == "display") color = c;
	addon.port.emit(mode, {xpath: xpath, color: color});
}

function hoverIn(event){
	if ($(event.target).hasClass('selected')) return false;
	$(event.target).addClass('hovered');
	//send ajax to real page to display
	sendToCS(event.target, "display", "hsla(290,60%,70%,0.5)");
}

function hoverOut(event){
	if ($(event.target).hasClass('selected')) return false;
	$(event.target).removeClass('hovered NOTFOUND NOTVISIBLE');
	//send ajax to real page to stop display
	sendToCS(event.target, "stop");
}

addon.port.on("fileRawData", function(msg){
	fileRawData = msg;
	preprocessed = preprocess(fileRawData);
	addon.port.emit("nav",preprocessed.URL);
	processed = preprocessed.compressXPATH();
	for (var domain in preprocessed.recordsPerDomain){
		$("#mainList").append("<li status='collapsed' class='domain'>&#9658; " + domain + "</li><hr/>");		//9660 is down pointing
	}
	$("li").click(toggleGeneric);
});

addon.port.on("NOTFOUND", function(xpath){
	xpath = xpath.substr(8);
	$("li[xpath='"+xpath+"']").addClass('NOTFOUND');
});

addon.port.on("NOTVISIBLE", function(xpath){
	xpath = xpath.substr(8);
	$("li[xpath='"+xpath+"']").addClass('NOTVISIBLE');
});

addon.port.on("CONTENT", function(innerHTML){
	//from the content scripts, we already alerted the user, for now we don't do anything here.
});