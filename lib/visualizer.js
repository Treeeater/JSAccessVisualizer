const {Cc,Ci,Cu,components} = require("chrome");
Cu.import("resource://gre/modules/NetUtil.jsm");
const nsIFilePicker = Ci.nsIFilePicker;
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
Cu.import("resource://gre/modules/FileUtils.jsm");
var sideBarWorker;
var contentScriptWorker;
var rootOutputPath = "D:\\Dropbox\\zyc\\Research\\visualizer\\";
var fileComponent = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
var file = require("sdk/io/file");

exports.pickFile = function(msg){
	var fp = Cc["@mozilla.org/filepicker;1"]
				   .createInstance(nsIFilePicker);
				   
	fp.init(window, "Dialog Title", nsIFilePicker.modeOpen);
	fp.appendFilters(nsIFilePicker.filterText);
	var rv = fp.show();
	if (rv == nsIFilePicker.returnOK || rv == nsIFilePicker.returnReplace) {
	  //var file = fp.file;
	  // Get the path as string. Note that you usually won't 
	  // need to work with the string paths.
	  var path = fp.file.path;
	  // work with returned nsILocalFile...
	  analyzeContent(new FileUtils.File(path), msg);
	}
}

exports.writeContentToFile = function(msg){
	saveToFile(msg.fileName, msg.content, true);
}

exports.appendContentToFile = function(msg){
	saveToFile(msg.fileName, msg.content, false);
}

exports.obtained = function(data){
	sideBarWorker.port.emit("recordFileRawData", {data:data, nav:"false"});
}

exports.returningPolicy = function(data){
	sideBarWorker.port.emit("returningPolicy", data);
}

exports.setSideBarWorker = function (w){
	sideBarWorker = w;
}

exports.setCSWorker = function (w){
	contentScriptWorker = w;
}

exports.elementNotFound = function(xpath){
	sideBarWorker.port.emit("NOTFOUND", xpath);
}

exports.replyWithContent = function(msg){
	sideBarWorker.port.emit("replyWithContent", msg);
}

exports.elementNotVisible = function(xpath){
	sideBarWorker.port.emit("NOTVISIBLE", xpath);
}

exports.contentAvailable = function(innerHTML){
	sideBarWorker.port.emit("CONTENT", innerHTML);
}

exports.nothingToDisplayAll = function(msg){
	sideBarWorker.port.emit("nothingToDisplayAll", msg);
}

exports.clearSBContent = function(msg){
	sideBarWorker.port.emit("clearSBContent", msg);
}

exports.xpathIDMapping = function(msg){
	sideBarWorker.port.emit("xpathIDMapping", msg);
}
/*
//sync method
function analyzeContent(file){
	var data = "";
	var fstream = Cc["@mozilla.org/network/file-input-stream;1"].
				  createInstance(Ci.nsIFileInputStream);
	var cstream = Cc["@mozilla.org/intl/converter-input-stream;1"].
				  createInstance(Ci.nsIConverterInputStream);
	fstream.init(file, -1, 0, 0);
	cstream.init(fstream, "UTF-8", 0, 0); // you can use another encoding here if you wish

	let (str = {}) {
	  let read = 0;
	  do { 
		read = cstream.readString(0xffffffff, str); // read as much as we can and put it in str.value
		data += str.value;
	  } while (read != 0);
	}
	cstream.close(); // this closes fstream

	window.alert(data);
}
*/
function analyzeContent(f, msg){
	NetUtil.asyncFetch(f, function(inputStream, status) {
		if (!components.isSuccessCode(status)) {
			// Handle error!
			return;
		}

		// The file data is contained within inputStream.
		// You can read it into a string with
		try {
			var data = NetUtil.readInputStreamToString(inputStream, inputStream.available());
		}
		catch (ex){
			window.alert("empty file!");
			return;
		}
		sideBarWorker.port.emit(msg, {data:data, nav:"true"});
	});
}

function initDir(fn){
	var dirPath = fn.split("\\");
	dirPath.splice(-1, 1);
	dirPath = dirPath.join("\\");
	var toCreate = [];
	console.log(dirPath);
	while (!file.exists(dirPath)) {
		console.log(dirPath);
		dirPath = dirPath.split("\\");
		toCreate.push(dirPath.splice(-1, 1));
		dirPath = dirPath.join("\\");
	}
	while (toCreate.length > 0){
		dirPath = dirPath + "\\" + toCreate.splice(-1, 1);
		file.mkpath(dirPath);
	}
	//Delete all existing files.
	/*var existingFiles = file.list(dirPath);
	var i = 0;
	for (i = 0; i < existingFiles.length; i++)
	{
		file.remove(file.join(dirPath,existingFiles[i]));
	}*/
}

function saveToFile(fileName, content, overwrite)
{
	if (!!fileName) {
		var fn = rootOutputPath + fileName;
		initDir(fn);
		fileComponent.initWithPath(fn);  // The path passed to initWithPath() should be in "native" form.
		var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
		if (overwrite) foStream.init(fileComponent, 0x02 | 0x08 | 0x20, 0666, 0);
		else foStream.init(fileComponent, 0x02 | 0x08 | 0x10, 0666, 0);		//0x10 for append
		foStream.write(content, content.length);
		foStream.close();
	}
}
