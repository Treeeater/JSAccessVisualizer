const {Cc,Ci,Cu,components} = require("chrome");
var pageMod = require("sdk/page-mod");
var data = require("sdk/self").data;
var v = require("./visualizer.js");
var tabs = require("sdk/tabs");
var CSWorker;
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
var outputToFile = true;

var {ToggleButton} = require("sdk/ui/button/toggle");

var button = ToggleButton({
    id: "Visualizer",
    label: "Visualizer",
    icon: {
     "16": "./icon/icon-16.png",
    "32": "./icon/icon-32.png",
    "64": "./icon/icon-64.png"
    },
    onChange: function(state) {
	  if (state.checked){
		sidebar.show();
	  }
      else{
		sidebar.hide();
	  }
    }
});

var closeAllOtherTabs = function(){
	if (tabs.length <= 1) return;
	for each (var tabIterator in tabs){
		if (tabIterator.i != 1) tabIterator.close();
	}
}

var sidebar = require("sdk/ui/sidebar").Sidebar({
  id: 'VisualizerSideBar',
  title: 'Visualizer SideBar',
  url: require("sdk/self").data.url("sidebar.html"),
  onAttach: function (sbWorker) {
	v.setSideBarWorker(sbWorker);
	sbWorker.port.on("updateSBCBStatus", function(){
		sbWorker.port.emit("updateSBCBStatus", outputToFile?"true":"false");
	});
    sbWorker.port.on("pickFile", function() {
		v.pickFile();
		CSworker.port.emit("setClearContent",false);
    });
    sbWorker.port.on("outputToFile", function(msg) {
		try {
			CSworker.port.emit("outputToFile","");
		}
		catch(ex){
			console.log("No page loaded yet, cannot output to file..");
		}
    });
    sbWorker.port.on("obtainNow", function() {
		CSworker.port.emit("obtainNow","");
    });
	sbWorker.port.on("display", function(msg){
		CSworker.port.emit("display", msg);
	});
	sbWorker.port.on("getContent", function(msg){
		CSworker.port.emit("getContent", msg);
	});
	sbWorker.port.on("stop", function(msg){
		CSworker.port.emit("stop", msg);
	});
	sbWorker.port.on("scroll", function(msg){
		CSworker.port.emit("scroll", msg);
	});
	sbWorker.port.on("renderAll", function(msg){
		CSworker.port.emit("renderAll", msg);
	});
	sbWorker.port.on("removeAll", function(msg){
		CSworker.port.emit("removeAll", msg);			//msg is not needed
	});
	sbWorker.port.on("setOutputToFile", function(msg){
		outputToFile = (msg === 'true');
		if (typeof CSworker != 'undefined') CSworker.port.emit("setOutputToFile",msg);
	});
	sbWorker.port.on("nav", function(msg){
		try {
			CSworker.port.emit("nav",msg);
		}
		catch (ex){
			//no tab available, create a new one
			tabs.open(msg);
		};
	});
  }
});

tabs.on("ready", function(tab) {
  tab.i = 1;
  CSworker = tab.attach({
    contentScriptFile: [data.url("jquery-2.1.1.min.js"), data.url("contentScript.js")],
	contentScriptWhen: 'end',
	onAttach: function(w) {
		v.setCSWorker(w);
	},
  });
  CSworker.port.on("elementNotFound",function(msg){
	v.elementNotFound(msg);
  });
  CSworker.port.on("clearSBContent",function(msg){
	v.clearSBContent(msg);
  });
  CSworker.port.on("requestOutputToFile",function(msg){
	CSworker.port.emit("setOutputToFile", (outputToFile ? "true" : "false"));
  });
  CSworker.port.on("obtained",function(msg){
	v.obtained(msg);
  });
  CSworker.port.on("nothingToDisplayAll",function(msg){
	v.nothingToDisplayAll(msg);
  });
  CSworker.port.on("replyWithContent",function(msg){
	v.replyWithContent(msg);
  });
  CSworker.port.on("contentAvailable",function(msg){
	v.contentAvailable(msg);
  });
  CSworker.port.on("elementNotVisible",function(msg){
	v.elementNotVisible(msg);
  });
  closeAllOtherTabs();
});

button.click();