var modelRawData = "";
var model;

function Model(url){
	var that = this;
	this.URL = url;
	this.domains = [];
	this.getContentRecords = {};
	this.setterRecords = {};
	this.specialRecords = {};
}

function resetContent(){
	cacheID = undefined;
	cacheXPath = undefined;
	$("#mainList").html("");
}

function loadModel(){
	addon.port.emit("pickFile","modelFileRawData");
	resetContent();
}

function outputModel(){
	var data = (typeof generalized == 'undefined') ? processed : generalized;
	var str = data.outputModel();
	var f = "ext\\"+data.URL.replace(/[\W]/g,'').substr(0,32) + ".model.txt";
	addon.port.emit("writeContentToFile", {fileName:f, content:str});
}

addon.port.on("modelFileRawData", function(msg){
	var nav = msg.nav;
	msg = msg.data.replace(/\r/g,'');					//get rid of file specific \r
	var url = msg.substr(5, msg.indexOf('\n---')-4);
	if (nav == 'true') addon.port.emit("nav", url);
	msg = msg.substr(msg.indexOf('---')+4);		//get rid of the first url declaration.
	msg = msg.replace(/URL:\s.*?\n/g,'');		//get rid of additional url declarations (sometimes page refreshes themselves)
	domains = msg.split("tpd: ");
	model = new Model(url);
	for (var i = 0; i < domains.length; i++){
		var curData = domains[i];
		var domain = curData.substr(0, curData.indexOf(":\n"));
		if (domain == "") continue;
		if (model.domains.indexOf(domain)==-1) model.domains.push(domain);
		curData = curData.substr(curData.indexOf('\n')+1);
		curData = curData.substr(0,curData.length - 5);
		var temp = curData.split("\n");
		var curCategory;
		for (var j = 0; j < temp.length; j++){
			if (temp[j] == "---" || temp[j] == "") continue;
			if (temp[j] == "getContentRecords: ") {
				model["getContentRecords"][domain] = [];
				curCategory = model["getContentRecords"][domain];
				continue;
			}
			if (temp[j] == "setterRecords: ") {
				model["setterRecords"][domain] = [];
				curCategory = model["setterRecords"][domain];
				continue;
			}
			if (temp[j] == "specialRecords: ") {
				model["specialRecords"][domain] = [];
				curCategory = model["specialRecords"][domain];
				continue;
			}
			curCategory.push(new Record("1", temp[j], "", ""));
		}
	}
	for (var domain in model.domains){
		$("#mainList").append("<li status='collapsed' class='domain'>&#9658; " + model.domains[domain] + "</li><hr/>");		//9660 is down pointing
	}
	$("li").click(toggleGeneric);
	processed = model;
});
