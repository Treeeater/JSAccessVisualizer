var fileRawData = "";
var dataURL = "";

function pickFile(){
	addon.port.emit("pickFile");
	$("#mainList").html("");
}

function outputToFile(){
	addon.port.emit("outputToFile","");
	//diable checkbox automatically
	$("#outputFileCB").prop('checked', false);
	addon.port.emit("setOutputToFile", "false");
}

function obtainNow(){
	addon.port.emit("obtainNow");
	$("#mainList").html("");
}

function RecordsPerSite(url){
	var that = this;
	
	this.URL = url;
	this.recordsPerDomain = {};			//map key:domain, value: raw array of Record
	this.setterRecords = {};			//Stores XPATH records.  Map, key:domain, value: compressed (parent covering for all children node) array of setter record.
	this.getterRecords = {};
	this.getContentRecords = {};
	this.specialRecords = {};			//Stores all none XPATH records
	
	var filterGetRecords = function(s){
		//given the additional string, return if this is a get access
		var ret = (s.indexOf('Get') == 0);
		ret = ret && (s.indexOf('GetParent')!=0);
		ret = ret && (s.indexOf('GetFirstChild')!=0);
		ret = ret && (s.indexOf('GetNextSibling')!=0);
		ret = ret && (s.indexOf('GetPreviousSibling')!=0);
		ret = ret || (s.indexOf('Scroll') == 0);
		ret = ret || (s.indexOf('Client') == 0);
		ret = ret || (s.indexOf('Attributes') == 0);
		return ret;
	};
	
	var filterSetRecords = function(s){
		//given the additional string, return if this is a get access
		var ret = (s.indexOf('Set') == 0);
		ret = ret || (s.indexOf('Remove') == 0);
		return ret;
	};
	
	var filterGetgetContentRecords = function(r, a){
		a = a.toLowerCase();
		if (a.indexOf('get')==-1) return false;
		//given the additional string, return if this is a get access
		var ret = (a.indexOf('innerhtml') != -1) || (a.indexOf('outerhtml') != -1) || (a.indexOf('text') != -1);
		if (r.toLowerCase().indexOf('#text') != -1) {
			//this is a text node. GetNodeValue also is a content getter
			ret = ret || (a.indexOf('getnodevalue')!=-1);
		}
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
			for (var i = 0; i < records.length; i++){
				var record = records[i];
				if (record.resource.indexOf('/') == 0){
					//XPath entry
					if (filterGetgetContentRecords(record.resource, record.additional)){
						//this is a content getter entry.
						//if this node is already contained in another node, don't push this.
						if (wasCoveredBefore("getContent",record.resource, domain)) continue;
						removeDuplicates("getContent",record.resource, domain);
						that.getContentRecords[domain].push(record);
					}
					else if (filterSetRecords(record.additional)){
						//this is a setter entry, which is *NOT* a content getter entry.
						if (wasCoveredBefore("setter",record.resource, domain)) continue;
						removeDuplicates("setter",record.resource, domain);
						that.setterRecords[domain].push(record);
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
					if (pushedSpecialEntry.indexOf(record.resource + record.additional) == -1){
						that.specialRecords[domain].push(record);
						pushedSpecialEntry.push(record.resource + record.additional);
					}
				}
			}
		}
		return that;
	}
}

function Record(t, r, a){
	this.times = t;
	this.resource = r;
	this.additional = a;
}

String.prototype.chomp = function(){
	var ret = this;
	while (ret.length > 0 && (ret[ret.length-1] == '\r' || ret[ret.length-1] == '\n')) ret = ret.substr(0, ret.length-1);
	return ret.toString();
}

function preprocess(data){
	fileRawData = data;
	data = data.replace(/\r/g,'');					//get rid of file specific \r
	var url = data.substr(5, data.indexOf('\n---')-4);
	data = data.substr(data.indexOf('---')+4);		//get rid of the first url declaration.
	data = data.replace(/URL:\s.*?\n/g,'');			//get rid of additional url declarations (sometimes page refreshes themselves)
	var r = new RecordsPerSite(url);
	domains = data.split("tpd: ");
	for (i = 0; i < domains.length; i++){
		var curData = domains[i];
		if (curData == "") continue;
		var domain = curData.substr(0, curData.indexOf(":\n"));
		curData = curData.substr(curData.indexOf('\n')+1);
		curData = curData.substr(0,curData.length - 5);
		recordsRaw = curData.split("_t: ");
		if (!r.recordsPerDomain.hasOwnProperty(domain)) r.recordsPerDomain[domain] = [];
		for (j = 0; j < recordsRaw.length; j++){
			var recordRaw = recordsRaw[j];
			if (recordRaw == "") continue;
			var times = recordRaw.substr(0, recordRaw.indexOf("\n"));
			recordRaw = recordRaw.substr(times.length + 5);
			var resource = recordRaw.substr(0, recordRaw.indexOf("\n"));
			var additional = recordRaw.substr(resource.length + 5).chomp();
			var record = new Record(times, resource, additional);
			r.recordsPerDomain[domain].push(record);
		}
	}
	return r;
}