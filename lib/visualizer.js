const {Cc,Ci,Cu,components} = require("chrome");
Cu.import("resource://gre/modules/NetUtil.jsm");
const nsIFilePicker = Ci.nsIFilePicker;
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
Cu.import("resource://gre/modules/FileUtils.jsm");
var sideBarWorker;
var contentScriptWorker;
var rootOutputPath = "D:\\Dropbox\\zyc\\Research\\visualizer\\ext\\";
var fileComponent = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);

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
	saveToFile(msg.fileName, msg.content);
}

exports.obtained = function(data){
	sideBarWorker.port.emit("recordFileRawData", {data:data, nav:"false"});
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

function saveToFile(fileName, content)
{
	if (!!fileName) {
		fileComponent.initWithPath(rootOutputPath+fileName);  // The path passed to initWithPath() should be in "native" form.
		var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
		foStream.init(fileComponent, 0x02 | 0x08 | 0x20, 0666, 0);		//0x10 for append
		foStream.write(content, content.length);
		foStream.close();
	}
}
