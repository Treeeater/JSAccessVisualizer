const {Cc,Ci,Cu,components} = require("chrome");
var pageMod = require("sdk/page-mod");
var data = require("sdk/self").data;
var v = require("./visualizer.js");
var tabs = require("sdk/tabs");
var CSWorker;
var window = Cc["@mozilla.org/appshell/appShellService;1"].getService(Ci.nsIAppShellService).hiddenDOMWindow;
var outputToFile = false;				//this controls the default value for the checkbox at firefox initialization.
var system = require("sdk/system");		
filePath = require("sdk/system").pathFor("CurProcD");
driverLetter = filePath[0];
if (system.staticArgs.user == "author") {
	rootPolicyPath = driverLetter + ":\\Dropbox\\zyc\\Research\\visualizer\\policies\\";	//json as argument in --static-args="{a:b}"
}
else {
	rootPolicyPath = driverLetter + ":\\policies\\";
}
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
	v.setPolicyPath(rootPolicyPath);
	sbWorker.port.on("updateSBCBStatus", function(){
		sbWorker.port.emit("updateSBCBStatus", outputToFile?"true":"false");
	});
    sbWorker.port.on("pickFile", function(msg) {
		v.pickFile(msg);
		try {
			CSworker.port.emit("setClearContent",false);
		}
		catch (ex) {
			//the user clicked on pickFile as the first action (as opposed to nav to a site first), just ignore this exception.
		};
    });
    sbWorker.port.on("writeContentToFile", function(msg) {
		v.writeContentToFile(msg);
    });
    sbWorker.port.on("appendContentToFile", function(msg) {
		v.appendContentToFile(msg);
    });
    sbWorker.port.on("outputToFile", function(msg) {
		try {
			CSworker.port.emit("outputToFile","");
		}
		catch(ex){
			console.log("No page loaded yet, cannot output to file..");
		}
    });
    sbWorker.port.on("outputToFileAdd", function(msg) {
		try {
			CSworker.port.emit("outputToFileAdd","");
		}
		catch(ex){
			console.log("No page loaded yet, cannot output to file..");
		}
    });
    sbWorker.port.on("checkPolicyAndDisplay", function(msg) {
		try {
			CSworker.port.emit("checkPolicyAndDisplay","");
		}
		catch(ex){
			console.log("No page loaded yet, cannot check policy..");
		}
    });
    sbWorker.port.on("checkPolicyAndOutputToFile", function(msg) {
		try {
			CSworker.port.emit("checkPolicyAndOutputToFile","");
		}
		catch(ex){
			console.log("No page loaded yet, cannot check policy..");
		}
    });
    sbWorker.port.on("obtainNow", function() {
		try {CSworker.port.emit("obtainNow","");} catch (ex){ console.log("navigate to a site first!") };
    });
	sbWorker.port.on("display", function(msg){
		CSworker.port.emit("display", msg);
	});
	sbWorker.port.on("CSSDisplay", function(msg){
		CSworker.port.emit("CSSDisplay", msg);
	});
	sbWorker.port.on("RemoveCSSDisplay", function(msg){
		CSworker.port.emit("RemoveCSSDisplay", msg);
	});
	sbWorker.port.on("changeOvermatchThreshold", function(msg){
		CSworker.port.emit("changeOvermatchThreshold", msg);
	});
	sbWorker.port.on("changeTagThreshold", function(msg){
		CSworker.port.emit("changeTagThreshold", msg);
	});
	sbWorker.port.on("loadExistingPolicies", function(msg){
		v.loadExistingPolicies(msg);
	});
	sbWorker.port.on("inferModel", function(msg){
		CSworker.port.emit("inferModel", msg);
	});
	sbWorker.port.on("checkViolations", function(msg){
		CSworker.port.emit("checkViolations", msg);
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
	sbWorker.port.on("fromInteractive", function(msg){
		CSworker.port.emit("fromInteractive", msg);
	});
	sbWorker.port.on("removeAll", function(msg){
		CSworker.port.emit("removeAll", msg);			//msg is not needed
	});
	sbWorker.port.on("setOutputToFile", function(msg){
		outputToFile = (msg === 'true');
		if (typeof CSworker != 'undefined') CSworker.port.emit("setOutputToFile",msg);
	});
	sbWorker.port.on("getIDXpathMapping", function(msg){
		if (typeof CSworker != 'undefined') CSworker.port.emit("getIDXpathMapping",msg);
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
	attachTo: 'top',
	onAttach: function(w) {
		v.setCSWorker(w);
	},
  });
  CSworker.port.on("elementNotFound",function(msg){
	v.elementNotFound(msg);
  });
  CSworker.port.on("reportViolatingDomains",function(msg){
	v.reportViolatingDomains(msg);
  });
  CSworker.port.on("postToInteractive",function(msg){
	v.postToInteractive(msg);
  });
  CSworker.port.on("clearSBContent",function(msg){
	try {v.clearSBContent(msg);} catch(ex){};
  });
  CSworker.port.on("requestOutputToFile",function(msg){
	CSworker.port.emit("setOutputToFile", (outputToFile ? "true" : "false"));
  });
  CSworker.port.on("obtained",function(msg){
	v.obtained(msg);
  });
  CSworker.port.on("returningPolicy",function(msg){
	v.returningPolicy(msg);
  });
  CSworker.port.on("changedOvermatchThreshold",function(msg){
	v.changedOvermatchThreshold(msg);
  });
  CSworker.port.on("changedTagThreshold",function(msg){
	v.changedTagThreshold(msg);
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
  CSworker.port.on("xpathIDMapping",function(msg){
	v.xpathIDMapping(msg);
  });
  CSworker.port.on("elementNotVisible",function(msg){
	v.elementNotVisible(msg);
  });
  closeAllOtherTabs();
});

button.click();