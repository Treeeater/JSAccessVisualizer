var modelRawData = "";
var model;

function Model(url){
	var that = this;
	this.URL = url;
	this.recordsPerDomain = {};			//map key:domain, value: raw array of Record
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
	var f = data.URL.replace(/[\W]/g,'').substr(0,32) + ".model.txt";
	addon.port.emit("writeContentToFile", {fileName:f, content:str});
}

addon.port.on("modelFileRawData", function(msg){
	msg = msg.data.replace(/\r/g,'');					//get rid of file specific \r
	var url = msg.substr(5, msg.indexOf('\n---')-4);
	if (msg.nav) addon.port.emit("nav", url);
	msg = msg.substr(msg.indexOf('---')+4);		//get rid of the first url declaration.
	msg = msg.replace(/URL:\s.*?\n/g,'');			//get rid of additional url declarations (sometimes page refreshes themselves)
	domains = msg.split("tpd: ");
	model = new Model(url);
	for (var i = 0; i < domains.length; i++){
		var curData = domains[i];
		var domain = curData.substr(0, curData.indexOf(":\n"));
		if (domain == "") continue;
		model.recordsPerDomain[domain] = {};
		curData = curData.substr(curData.indexOf('\n')+1);
		curData = curData.substr(0,curData.length - 5);
		var temp = curData.split("\n");
		var curCategory;
		for (var j = 0; j < temp.length; j++){
			if (temp[j] == "---" || temp[j] == "") continue;
			if (temp[j] == "getContentRecords: ") {
				model.recordsPerDomain[domain]["getContentRecords"] = [];
				curCategory = model.recordsPerDomain[domain]["getContentRecords"];
				continue;
			}
			if (temp[j] == "setterRecords: ") {
				model.recordsPerDomain[domain]["setterRecords"] = [];
				curCategory = model.recordsPerDomain[domain]["setterRecords"];
				continue;
			}
			if (temp[j] == "specialRecords: ") {
				model.recordsPerDomain[domain]["specialRecords"] = [];
				curCategory = model.recordsPerDomain[domain]["specialRecords"];
				continue;
			}
			curCategory.push(temp[j]);
		}
	}
});
