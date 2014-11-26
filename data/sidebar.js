var selectedElement = null;
var displayAllPressed = false;
var calculatorImageSrc = "<img height='20' onclick='calculatorUIClicked(event)' style='float:right;' src='./icon/calculator.png'/>";

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
		if (records[i].owned) recordElement.setAttribute('class', 'recordEntry owned');
		var textToDisplay = records[i].resource;
		if (records[i].resourceWID != "") textToDisplay = records[i].resourceWID;
		if (textToDisplay.length > 30){
			recordElement.innerHTML = textToDisplay.substr(0,30)+"...";
			recordElement.title = textToDisplay;
		}
		else recordElement.innerHTML = textToDisplay;
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
	if (processed["getContentRecords"] && processed["getContentRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; getContentRecords<span class='displayall' c='getContentRecords'>DisplayAll</span></li>");
	if (processed["setterRecords"] && processed["setterRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; setterRecords<span class='displayall' c='setterRecords'>DisplayAll</span></li>");
	if (processed["getterRecords"] && processed["getterRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; getterRecords<span class='displayall' c='getterRecords'>DisplayAll</span></li>");
	if (processed["specialRecords"] && processed["specialRecords"][domain].length != 0)
		$(ele).append("<br/><li status='collapsed' class='category' url="+domain+">&#9658; specialRecords</li>");
}

function expandDomainList(ele){
	var eleInnerHTML = ele.innerHTML;
	var domain = ele.innerHTML.substr(2, ele.innerHTML.length - calculatorImageSrc.length - 1);
	var remaining = ele.innerHTML.substr(2, ele.innerHTML.length - 1);
	$(ele).html("&#9660; " + remaining);
	insertCategories(ele, domain);
}

function collapseGeneric(event){
	var text = event.target.firstChild.nodeValue.substr(2);
	event.target.firstChild.nodeValue = htmlDecode("&#9658;") + " " + text;
	if ($.contains(event.target, selectedElement)){
		//toggle element if its parent is collapsed
		if ($(selectedElement).is("[c]")){
			if ($(selectedElement).parent()[0] != $(event.target)[0]){
				//only removeAll when displayall's domain is collapsed, but not the category.
				displayAllPressed = false;
				addon.port.emit('removeAll', "");
				$(selectedElement).removeClass('clicked');
				selectedElement = null;
			}
		}
		else{
			$(selectedElement).removeClass('selected hovered NOTFOUND NOTVISIBLE');
			$(selectedElement).attr('status', 'unselected');
			sendToCS(selectedElement, "stop");
			selectedElement = null;
		}
	}
	if ($(event.target).is("[class='domain']")){
		$(event.target).children().not("img").remove();
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
	if (wrapped.is("[text]")){
		return false;
	}
	if (selectedElement != null && event.target != selectedElement){
		//if we have already selected an element and now we click on a new element
		if ($(selectedElement).is("[c]")){
			displayAllPressed = false;
			addon.port.emit('removeAll', "");
			$(selectedElement).removeClass('clicked');
			selectedElement = null;
		}
		else{
			displayAllPressed = false;
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
			displayAllPressed = true;
			var domain = wrapped.parent().attr('url');
			var records = processed[c][domain];
			var xpaths = [];
			selectedElement = event.target;
			addon.port.emit('renderAll', records.map(function(rec){return rec.resource;}).join("__|__"));
		}
		else {
			displayAllPressed = false;
			wrapped.removeClass('NOTVISIBLE');		//if it is invisible.
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
		displayAllPressed = false;
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
	if (displayAllPressed) return false;
	$(event.target).addClass('hovered');
	//send ajax to real page to display
	sendToCS(event.target, "display", "hsla(290,60%,70%,0.5)");
}

function hoverOut(event){
	if ($(event.target).hasClass('selected')) return false;
	if (displayAllPressed) return false;
	$(event.target).removeClass('hovered NOTFOUND NOTVISIBLE');
	//send ajax to real page to stop display
	sendToCS(event.target, "stop");
}

function calculatorUIClicked(event){
	var temp = event.target.parentNode.firstChild.nodeValue;
	var domain = temp.substr(2);
	console.log("Calculating policy for " + domain);
	addon.port.emit("inferModel", domain);
}

function changeThreshold(){
	addon.port.emit("changeThreshold","");
}

addon.port.on("changedThreshold", function(msg){
	$("#matchThreshold").html(msg);
});

addon.port.on("recordFileRawData", function(msg){
	resetContent();
	fileRawData = msg.data;
	preprocessed = preprocess(fileRawData);
	if (msg.nav == "true") {
		addon.port.emit("nav",preprocessed.URL);
		$("#outputFileCB").prop('checked', false);
		addon.port.emit("setOutputToFile", "false");
	}
	processed = preprocessed.compressXPATH();
	for (var domain in preprocessed.recordsPerDomain){
		$("#mainList").append("<li status='collapsed' class='domain'>" + "&#9658; " + domain + calculatorImageSrc + "</li><hr/>");		//9660 is down pointing
	}
	$("li").click(toggleGeneric);
});

addon.port.on("NOTFOUND", function(xpath){
	try {
		$("li[xpath='"+xpath+"']").addClass('NOTFOUND');
	}
	catch(ex){
		//could be the policy visualizer is calling, not found will not return to the correct sender, which is fine.
	}
});

addon.port.on("replyWithContent", function(msg){
	var xpath = msg.xpath.substr(8);
	var text = msg.text;
	$("li[xpath='"+xpath+"']").attr('title',text).attr('text',text);
	//trigger this two events is to make jquery ui render the new tooltip.
	//This is not a perfect solution, as if the user moves mouse too fast, the real user's mouseleave event occurs before the synthesized mouseenter event, therefore the tooltip stays there until the user moves her mouse back in and out again.
	$('li[xpath="'+xpath+'"]').trigger('mouseleave');
	$('li[xpath="'+xpath+'"]').trigger('mouseenter');
});

addon.port.on("NOTVISIBLE", function(xpath){
	$('li[xpath="'+xpath+'"]').addClass('NOTVISIBLE');
});

var reportOutputToFile = function(){
	if ($("#outputFileCB").is(':checked')) addon.port.emit("setOutputToFile","true");
	else addon.port.emit("setOutputToFile","false");
}

addon.port.on("updateSBCBStatus", function(msg){
	$("#outputFileCB").prop('checked', (msg === 'true'));
	$("#outputFileCB").change(reportOutputToFile);
});

addon.port.emit("updateSBCBStatus","");

addon.port.on("clearSBContent", resetContent.bind(this, true));

addon.port.on("returningPolicy", showPolicyToUser);

addon.port.on("reportViolatingDomains", displayViolatingDomains);

addon.port.on("nothingToDisplayAll", function(){
	//from the content scripts, we already alerted the user, for now we don't do anything here.
	$(selectedElement).addClass("NOTVISIBLE");
});

addon.port.on("CONTENT", function(innerHTML){
	//from the content scripts, we already alerted the user, for now we don't do anything here.
});

$("body").disableSelection();