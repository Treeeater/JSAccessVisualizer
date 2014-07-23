var modelRawData = "";

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
	var data = (typeof generalized == 'undefined') ? processed : generalized;
});
