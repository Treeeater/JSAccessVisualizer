var fileRawData = "";
var cacheID;
var cacheXPath;
var generalized;
var processed;
var preprocessed;

function resetContent(){
	cacheID = undefined;
	cacheXPath = undefined;
	$("#mainList").html("");
}

function pickFile(){
	addon.port.emit("pickFile","recordFileRawData");
	resetContent();
}

function outputToFile(){
	addon.port.emit("outputToFile","");
	//diable checkbox automatically
	$("#outputFileCB").prop('checked', false);
	addon.port.emit("setOutputToFile", "false");
}

function outputToFileAdd(){
	addon.port.emit("outputToFileAdd","");
	//diable checkbox automatically
	$("#outputFileCB").prop('checked', false);
	addon.port.emit("setOutputToFile", "false");
}

function checkPolicyAndDisplay(){
	addon.port.emit("checkPolicyAndDisplay","");
}

function checkPolicyAndOutputToFile(){
	addon.port.emit("checkPolicyAndOutputToFile","");
}

function obtainNow(){
	addon.port.emit("obtainNow");
	resetContent();
}

function inferModelUI(){
	//infer for all domains.
	addon.port.emit("inferModel", "");
}

function generalize(){
	generalized = processed.generalizeModel("content");
	generalized = generalized.generalizeModel("setter");
	generalized = generalized.generalizeModel("getter");
	addon.port.emit('removeAll', "");
	$("#mainList").html("");
	for (var domain in generalized.recordsPerDomain){
		generalized.getContentRecords[domain] = generalized.getContentRecordsG[domain];
		generalized.setterRecords[domain] = generalized.setterRecordsG[domain];
		generalized.getterRecords[domain] = generalized.getterRecordsG[domain];
	}
	for (var domain in generalized.recordsPerDomain){
		$("#mainList").append("<li status='collapsed' class='domain'>&#9658; " + domain + "</li><hr/>");		//9660 is down pointing
	}
	$("li").click(toggleGeneric);
}

addon.port.on("xpathIDMapping", function(msg){
	cacheID = msg.cacheID;
	cacheXPath = msg.cacheXPath;
	generalize();
	$("#loading").remove();
});

function generalizeModelClicked(){
	if (typeof cacheID == "undefined"){
		var e = document.createElement('div');
		e.innerHTML = "<p style='font-size: 30px; text-align: center; margin-left:auto; margin-top:50%'>Loading...</p>";
		e.id = "loading"
		e.style.position = "absolute";
		e.style.left = "0px";
		e.style.top = "0px";
		e.style.backgroundColor = "hsla(202, 85%, 45%, 0.5)";
		e.style.height = "100%";
		e.style.width = "100%";
		e.style.zIndex = "100";
		document.body.appendChild(e);
		window.setTimeout('addon.port.emit("getIDXpathMapping","");',1000);
	}
	else generalize();
}

function RecordsPerSite(url){
	var that = this;
	
	this.URL = url;
	this.recordsPerDomain = {};			//map key:domain, value: raw array of Record
	this.setterRecords = {};			//Stores XPATH records.  Map, key:domain, value: compressed (parent covering for all children node) array of setter record.
	this.getterRecords = {};
	this.getContentRecords = {};
	this.specialRecords = {};			//Stores all none XPATH records
	
	this.getContentRecordsG = {};		//generalized model
	this.setterRecordsG = {};
	this.getterRecordsG = {};
	
	var filterGetRecords = function(s){
		s = s.toLowerCase();
		//given the additional string, return if this is a get access
		var ret = (s.indexOf('get') == 0 || s.indexOf('has') == 0);
		ret = ret && (s.indexOf('getparent')!=0);
		ret = ret && (s.indexOf('getfirstchild')!=0);
		ret = ret && (s.indexOf('getnextsibling')!=0);
		ret = ret && (s.indexOf('getprevioussibling')!=0);
		ret = ret && (s.indexOf('getownerdocument')!=0);
		ret = ret && (s.indexOf('getelement')!=0);
		ret = ret || (s.indexOf('scroll') == 0);
		ret = ret || (s.indexOf('client') == 0);
		ret = ret || (s.indexOf('attributes') == 0);
		return ret;
	};
	
	var filterSetRecords = function(record){
		var a = record.additional.toLowerCase();
		if (record.resource.indexOf('#text')!=-1){
			//text node, just remove this #text if the access is setNodeValue, otherwise skip this.
			if (record.additional.indexOf('setnodevalue')!=-1){
				//get rid of the #text
				record.resource = record.resource.split("/");
				record.resource.splice(-1,1);
				record.resource = record.resource.join("/");
				return true;
			}
			return false;
		}
		//given the additional string, return if this is a get access
		var ret = (a.indexOf('set') == 0);
		ret = ret || (a.indexOf('remove') == 0);
		//InsertBefore, AppendChild and ReplaceChild are related to inserted node's parent node, we do not care.
		ret = ret || (a.indexOf('insertbefore') == 0);
		ret = ret || (a.indexOf('appendchild') == 0);
		ret = ret || (a.indexOf('replacechild') == 0);
		ret = ret || (a.indexOf('insidedomaccess') == 0);
		ret = ret || (a.indexOf('document.write') == 0);
		return ret;
	};
	
	var filterGetContentRecords = function(record){
		var r = record.resource;
		var a = record.additional.toLowerCase();
		if (r.indexOf('#text')!=-1){
			//text node, just remove this #text if the access is wholeText, getNodeValue, otherwise skip this.
			if (a.indexOf('wholetext')!=-1 || a.indexOf('getnodevalue')!=-1){
				//get rid of the #text
				record.resource = record.resource.split("/");
				record.resource.splice(-1,1);
				record.resource = record.resource.join("/");
				return true;
			}
			return false;
		}
		if (a.indexOf('get')==-1) return false;
		//given the additional string, return if this is a get access
		var ret = (a.indexOf('innerhtml') != -1) || (a.indexOf('outerhtml') != -1) || (a.indexOf('text') != -1);
		ret = ret || a.indexOf('getsrc') != -1 || a.indexOf('gethref') != -1;
		return ret;
	};
	
	var removeDuplicates = function(mode, r, d){
		if (mode == "getContent"){
			for (var i = 0; i < that.getterRecords[d].length; i++){
				if (that.getterRecords[d][i].resource.indexOf(r) == 0){
					//newly added resource r already covers this recorded resource, therefore we remove this item.
					that.getterRecords[d].splice(i, 1);
					i--;		//fix the pointer.
				}
			}
			for (var i = 0; i < that.getContentRecords[d].length; i++){
				if (that.getContentRecords[d][i].resource.indexOf(r) == 0){
					//newly added resource r already covers this recorded resource, therefore we remove this item.
					that.getContentRecords[d].splice(i, 1);
					i--;		//fix the pointer.
				}
			}
		}
		else {
			//mode == "setter"
			for (var i = 0; i < that.setterRecords[d].length; i++){
				if (that.setterRecords[d][i].resource.indexOf(r) == 0){
					//newly added resource r already covers this recorded resource, therefore we remove this item.
					that.setterRecords[d].splice(i, 1);
					i--;		//fix the pointer.
				}
			}
		}
	};
	
	var wasCoveredBefore = function(mode, r, d){
		if (mode == "getContent"){
			for (var i = 0; i < that.getContentRecords[d].length; i++){
				if (r.indexOf(that.getContentRecords[d][i].resource) == 0) return true;
			}
			return false;
		}
		else {
			//mode == "setter"
			for (var i = 0; i < that.setterRecords[d].length; i++){
				if (r.indexOf(that.setterRecords[d][i].resource) == 0) return true;
			}
			return false;
		}
	};
	
	this.compressXPATH = function(){
		for (var domain in that.recordsPerDomain){
			var records = that.recordsPerDomain[domain];
			that.getterRecords[domain] = [];
			that.setterRecords[domain] = [];
			that.getContentRecords[domain] = [];
			that.specialRecords[domain] = [];
			var pushedSpecialEntry = [];
			var pushedGetterEntry = [];
			var pushedSetterEntry = [];
			for (var i = 0; i < records.length; i++){
				var record = records[i];
				if (record.resource.indexOf('/') == 0){
					//XPath entry
					if (filterGetContentRecords(record)){
						//this is a content getter entry.
						//if this node is already contained in another node, don't push this.
						if (wasCoveredBefore("getContent",record.resource, domain)) continue;
						removeDuplicates("getContent",record.resource, domain);
						that.getContentRecords[domain].push(record);
					}
					else if (filterSetRecords(record)){
						//this is a setter entry, which is *NOT* a content getter entry.
						//if (wasCoveredBefore("setter",record.resource, domain)) continue;
						//removeDuplicates("setter",record.resource, domain);
						//that.setterRecords[domain].push(record);
						if (pushedSetterEntry.indexOf(record.resource) == -1){
							that.setterRecords[domain].push(record);
							pushedSetterEntry.push(record.resource);
						}
					}
					else if (filterGetRecords(record.additional)){
						//this is a get entry that is *NOT* a content getter or setter.
						if (wasCoveredBefore("getContent",record.resource, domain)) continue;
						if (pushedGetterEntry.indexOf(record.resource) == -1){
							that.getterRecords[domain].push(record);
							pushedGetterEntry.push(record.resource);
						}
					}
				}
				else{
					//special entry
					//no need to detect duplicate or remove duplicate, this is not xpath related.
					if (pushedSpecialEntry.indexOf(record.resource) == -1){
						that.specialRecords[domain].push(record);
						pushedSpecialEntry.push(record.resource);
					}
				}
			}
		}
		return that;
	}

	this.generalizeModel = function(mode){
		var commonParents = [];
		var commonParent;
		var a;
		var b;
		var temp;
		if (mode == "content") {
			originalRecords = that.getContentRecords;
			targetRecords = that.getContentRecordsG;
		}
		else if (mode == "setter"){
			originalRecords = that.setterRecords;
			targetRecords = that.setterRecordsG;
		}
		else if (mode == "getter"){
			originalRecords = that.getterRecords;
			targetRecords = that.getterRecordsG;
		}
		for (var domain in that.recordsPerDomain){
			targetRecords[domain] = originalRecords[domain].slice(0);
			for (var iter = 0; true; iter++){
				commonParents = [];
				for (var i = 0; i < targetRecords[domain].length; i++){
					for (var j = 0; j < targetRecords[domain].length; j++){
						//pairwise common parent finding.
						if (i == j) continue;
						a = targetRecords[domain][i].resource;
						b = targetRecords[domain][j].resource;
						commonParent = "/BODY[1]";
						while (true){
							temp = a.substr(commonParent.length + 1);
							if (temp == "" || temp.indexOf('/')==-1) break;
							temp = temp.substr(0, temp.indexOf('/'));
							if (a.indexOf(commonParent + "/" + temp)!=0 || b.indexOf(commonParent + "/" + temp)!=0) break;
							commonParent = commonParent + "/" + temp;
						}
						if (commonParent == "/BODY[1]") continue;					//common parents are root, useless.
						if (commonParents.indexOf(commonParent)!=-1) continue;		//no duplicate
						//if the common parent differs too much than the two nodes in depth, do not even consider this common parent.
						var depthI = a.split('/').length - 1;
						var depthJ = b.split('/').length - 1;
						var depthC = commonParent.split('/').length - 1;
						if (Math.abs(depthI - depthC)/depthI >= 0.3) continue;		//other elements never get mingled with body, because body has a depth of 0. Infinity > 0.3
						if (Math.abs(depthJ - depthC)/depthJ >= 0.3) continue;
						commonParents.push(commonParent);
					}
				}
				if (commonParents.length == 0) break;
				//get the deepest common parents
				var deep = -1;
				for (var i = 0; i < commonParents.length; i++){
					temp = commonParents[i].split("/").length;
					if (deep < temp) deep = temp;
				}
				if (deep == -1) break;
				//for each deepest common parents, substitute their accessed children nodes with themselves
				for (var i = 0; i < commonParents.length; i++){
					temp = commonParents[i].split("/").length;
					if (temp != deep) continue;
					var collapsedNo = 0;
					for (var j = 0; j < targetRecords[domain].length; j++){
						if (targetRecords[domain][j].resource.indexOf(commonParents[i])==0){
							targetRecords[domain].splice(j,1);
							j--;
							collapsedNo++;
						}
					}
					//console.log("collapsed " + collapsedNo.toString() + " records in " + domain +"");
					targetRecords[domain].push(new Record("1", commonParents[i], "", ""));
				}
			}
			//now that we have generalized, we try to obtain IDs from the current page.  This is an async process.
			for (var i = 0; i < targetRecords[domain].length; i++){
				var splited;
				var rest = "";
				for (splited = targetRecords[domain][i].resource.split("/"); splited.length > 0; rest="/"+splited.splice(-1)[0] + rest){
					var index = cacheXPath.indexOf(splited.join("/"));
					if (index != -1) {
						var curNodeName = splited[splited.length-1];
						curNodeName = curNodeName.substr(0,curNodeName.indexOf('['));
						targetRecords[domain][i].resourceWID = "//" + curNodeName + "[@id='"+ cacheID[index] + "']" + rest;
						break;
					}
				}
			}
		}
		return that;
	};
	
	this.outputModel = function(){
		var retVal = "URL: " + that.URL + "---\n";
		for (var domain in that.recordsPerDomain){
			retVal += "tpd: " + domain + ":\n";
			retVal += "---\ngetContentRecords: \n";
			for (var i = 0; i < that.getContentRecords[domain].length; i++){
				if (that.getContentRecords[domain][i].resourceWID != "") retVal += that.getContentRecords[domain][i].resourceWID;
				else retVal += that.getContentRecords[domain][i].resource;
				retVal += "\n";
			}
			retVal += "---\nsetterRecords: \n";
			for (var i = 0; i < that.setterRecords[domain].length; i++){
				if (that.setterRecords[domain][i].resourceWID != "") retVal += that.setterRecords[domain][i].resourceWID;
				else retVal += that.setterRecords[domain][i].resource;
				retVal += "\n";
			}
			retVal += "---\nspecialRecords: \n";
			for (var i = 0; i < that.specialRecords[domain].length; i++){
				retVal += that.specialRecords[domain][i].resource + "\n";
			}
			retVal += "---\n"
		}
		return retVal;
	};
}
	
function showPolicyToUser(msg){
	console.log(msg);
}

function Record(t, r, a, rw){
	this.times = t;
	this.resource = r;
	this.additional = a;
	this.resourceWID = rw;
	this.owned = false;
}

String.prototype.chomp = function(){
	var ret = this;
	while (ret.length > 0 && (ret[ret.length-1] == '\r' || ret[ret.length-1] == '\n')) ret = ret.substr(0, ret.length-1);
	return ret.toString();
}

function preprocess(data){
	data = data.replace(/\r/g,'');					//get rid of file specific \r
	var url = data.substr(5, data.indexOf('\n---')-4);
	data = data.substr(data.indexOf('---')+4);		//get rid of the first url declaration.
	var r = new RecordsPerSite(url);
	domains = data.split("tpd: ");
	for (var i = 0; i < domains.length; i++){
		var curData = domains[i];
		if (curData == "") continue;
		var domain = curData.substr(0, curData.indexOf(":\n"));
		curData = curData.substr(curData.indexOf('\n')+1);
		curData = curData.substr(0,curData.length - 5);
		recordsRaw = curData.split("_t: ");
		if (!r.recordsPerDomain.hasOwnProperty(domain)) r.recordsPerDomain[domain] = [];
		for (var j = 0; j < recordsRaw.length; j++){
			var recordRaw = recordsRaw[j];
			if (recordRaw == "") continue;
			var times = recordRaw.substr(0, recordRaw.indexOf("\n"));
			recordRaw = recordRaw.substr(times.length + 5);
			var resource = recordRaw.substr(0, recordRaw.indexOf("\n"));
			var resourceWID = "";
			var sp = resource.split('|');
			if (sp[0] != resource){
				resource = sp[0];
				resourceWID = sp[1];
			}
			var additional = recordRaw.substr(resource.length + resourceWID.length + (resourceWID.length == 0 ? 0 : 1) + 5).chomp();
			var owned = false;
			if (resource.substr(0,3) == "[o]") {
				resource = resource.substr(3);
				owned = true;
			}
			var record = new Record(times, resource, additional, "");			//note: resourceWID not used here.
			record.owned = owned;
			r.recordsPerDomain[domain].push(record);
		}
	}
	return r;
}