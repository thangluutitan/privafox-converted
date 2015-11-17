/* -*- indent-tabs-mode: nil; js-indent-level: 4 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
if (!String.prototype.endsWith) {
  String.prototype.endsWith = function(searchString, position) {
      var subjectString = this.toString();
      if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
  };
}
var gConnectionsDialog = {
  beforeAccept: function ()
  {
    var proxyTypePref = document.getElementById("network.proxy.type");
	var userProxySetting = [];
	var systemProxySetting = [];
	userProxySetting.type = document.getElementById("network.proxy.type").value;
	Services.prefs.setIntPref("browser.proxyChange.lastProxyInfo.type",userProxySetting.type);
    if (proxyTypePref.value == 2) {
	  userProxySetting.autoconfig_url = document.getElementById("network.proxy.autoconfig_url").value;
	  //Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.autoconfig_url",document.getElementById("network.proxy.autoconfig_url").value);
	  Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.autoconfig_url",userProxySetting.autoconfig_url);
      this.doAutoconfigURLFixup();
      return true;
    }
	var isWindow = Services.prefs.getBoolPref("browser.isWindow");
	var isLinux = Services.prefs.getBoolPref("browser.isLinux");
	var isMac = Services.prefs.getBoolPref("browser.isMac");
	
	if (proxyTypePref.value == 5){
		//let Ci = Components.interfaces;
		//let Cu = Components.utils;
		//let Cc = Components.classes;
		//var currentProxy = document.getElementById("network.proxy.ftp");
		if (isWindow){
			var proxyService = Components.classes["@mozilla.org/system-proxy-settings;1"].getService(Components.interfaces.nsISystemProxySettings);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.isChange",true);
			//Services.prompt.alert(null, "systemProxySetting","2");
			var getProxyForURISetting = proxyService.getProxyForURI("http","all","google.com",80);
			var PACURI = "";
			var systemProxyString = JSON.stringify(getProxyForURISetting).replace("\"","");
			systemProxyString = systemProxyString.replace("\"","").replace("\"","");
			var flagString = "";
			if (systemProxyString.indexOf("PROXY ")>-1 && systemProxyString.indexOf("PROXY_TYPE_DIRECT")>-1){
				flagString = systemProxyString.substr(systemProxyString.indexOf("PROXY_TYPE_DIRECT"));
				systemProxyString = systemProxyString.substr(0,systemProxyString.indexOf("PROXY_TYPE_DIRECT"));
			}else{ //No Proxy (DIRECT)
				flagString = systemProxyString.substr(systemProxyString.indexOf("PROXY_TYPE_DIRECT"));
				systemProxyString = "DIRECT";
			}
			var PROXY_TYPE_PROXY = false;
			var PROXY_TYPE_AUTO_PROXY_URL = false;
			var PROXY_TYPE_AUTO_DETECT = false;
			if (flagString){
				if (flagString.indexOf("PROXY_TYPE_PROXY")>-1)
					PROXY_TYPE_PROXY = true;
				if (flagString.indexOf("PROXY_TYPE_AUTO_PROXY_URL")>-1){
					PROXY_TYPE_AUTO_PROXY_URL = true;
					PACURI = proxyService.PACURI;//AutoProxyURL
					if(typeof(PACURI) !== "undefined" && PACURI !== null){
						Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url",PACURI);
						systemProxySetting.autoconfig_url = PACURI;
					}else{
						Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url","");
						systemProxySetting.autoconfig_url = "";
					}
				}else{
					systemProxySetting.autoconfig_url = "";
					PROXY_TYPE_AUTO_PROXY_URL = false;
				}
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoconfig",PROXY_TYPE_AUTO_PROXY_URL);	
				systemProxySetting.autoconfig = PROXY_TYPE_AUTO_PROXY_URL;
				if (flagString.indexOf("PROXY_TYPE_AUTO_DETECT")>-1)
					PROXY_TYPE_AUTO_DETECT = true;
				else
					PROXY_TYPE_AUTO_DETECT = false;
				
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoDetect",PROXY_TYPE_AUTO_DETECT);
				systemProxySetting.autoDetect = PROXY_TYPE_AUTO_DETECT;
			}
			//if (systemProxyString.length>5) systemProxyString +=";"//PROXY 
			var isUseSameProxyServer = false;
			//Services.prompt.alert(null, "SysProxy:",systemProxyString + "Flags:" + flagString);
			//if (typeof(systemProxyString) !== "undefined" && systemProxyString !== null){
			if (systemProxyString && systemProxyString.indexOf("PROXY")>-1 && systemProxyString !="DIRECT"){
				//Detect use sameProxyServer
				
				if (systemProxyString.indexOf("PROXY ")>-1 && systemProxyString.split(";").length>1 
					&& systemProxyString.indexOf("http=") == -1 && systemProxyString.indexOf(";")>-1){
					isUseSameProxyServer = true;	
				}
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.sameProxyServer",isUseSameProxyServer);
				if(!isUseSameProxyServer){
					//Get http info
					if (systemProxyString.indexOf("http=")>-1){
						if(systemProxyString.indexOf(";",systemProxyString.indexOf("http="))>-1)
							systemProxySetting.http = systemProxyString.substr(systemProxyString.indexOf("http=")+5,systemProxyString.indexOf(";",systemProxyString.indexOf("http=")) - systemProxyString.indexOf("http=") - 5);
						
						
						if(systemProxySetting.http.indexOf(":")>-1) {
							systemProxySetting.http_port = systemProxySetting.http.substr(systemProxySetting.http.indexOf(":")+1);
							systemProxySetting.http = systemProxySetting.http.substr(0,systemProxySetting.http.indexOf(":"));
						}
							
							
					}else{
						systemProxySetting.http = "";
						systemProxySetting.http_port = 0;
					}
					//Get https info
					if (systemProxyString.indexOf("https=")>-1){
						if(systemProxyString.indexOf(";",systemProxyString.indexOf("https="))>-1)
							systemProxySetting.https = systemProxyString.substr(systemProxyString.indexOf("https=")+6,systemProxyString.indexOf(";",systemProxyString.indexOf("https=")) - systemProxyString.indexOf("https=") - 6);
						
						
						if(systemProxySetting.https.indexOf(":")>-1) {
							systemProxySetting.https_port = systemProxySetting.https.substr(systemProxySetting.https.indexOf(":")+1);
							systemProxySetting.https = systemProxySetting.https.substr(0,systemProxySetting.https.indexOf(":"));
						}
					}else{
						systemProxySetting.https = "";
						systemProxySetting.https_port = 0;
					}
					
					//Get ftp info
					if (systemProxyString.indexOf("ftp=")>-1){
						if(systemProxyString.indexOf(";",systemProxyString.indexOf("ftp="))>-1)
							systemProxySetting.ftp = systemProxyString.substr(systemProxyString.indexOf("ftp=")+4,systemProxyString.indexOf(";",systemProxyString.indexOf("ftp=")) - systemProxyString.indexOf("ftp=") - 4);
						
						
						if(systemProxySetting.ftp.indexOf(":")>-1) {
							systemProxySetting.ftp_port = systemProxySetting.ftp.substr(systemProxySetting.ftp.indexOf(":")+1);
							systemProxySetting.ftp = systemProxySetting.ftp.substr(0,systemProxySetting.ftp.indexOf(":"));
						}
					}else{
						systemProxySetting.ftp = "";
						systemProxySetting.ftp_port = 0;
					}
					
					//Get https socks
					if (systemProxyString.indexOf("socks=")>-1){
						if(systemProxyString.indexOf(";",systemProxyString.indexOf("socks="))>-1)
							systemProxySetting.socks = systemProxyString.substr(systemProxyString.indexOf("socks=")+6,systemProxyString.indexOf(";",systemProxyString.indexOf("socks=")) - systemProxyString.indexOf("socks=") - 6);
						
						
						if(systemProxySetting.socks.indexOf(":")>-1) {
							systemProxySetting.socks_port = systemProxySetting.socks.substr(systemProxySetting.socks.indexOf(":")+1);
							systemProxySetting.socks = systemProxySetting.socks.substr(0,systemProxySetting.socks.indexOf(":"));
						}
					}else{
						systemProxySetting.socks = "";
						systemProxySetting.socks_port = 0;
					}
					
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http",systemProxySetting.http);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",systemProxySetting.http_port);
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp",systemProxySetting.ftp);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",systemProxySetting.ftp_port);
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl",systemProxySetting.https);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",systemProxySetting.https_port);
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks",systemProxySetting.socks);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",systemProxySetting.socks_port);
				}else{
					systemProxyString = systemProxyString.replace(";","");
					if (systemProxyString.indexOf("PROXY ")>-1)
						systemProxySetting.http  = systemProxyString.substr(systemProxyString.indexOf("PROXY ")+6, systemProxyString.indexOf(":") -6);
					else
						systemProxySetting.http = "";
					
					//systemProxyString.indexOf("https=")+6,systemProxyString.indexOf(";",systemProxyString.indexOf("https=")) - systemProxyString.indexOf("https=") - 6);
					
						
					if(systemProxyString.indexOf(":")>-1) 
						systemProxySetting.http_port = systemProxyString.substr(systemProxyString.indexOf(":")+1);
					else
						systemProxySetting.http_port = 0;
					//Services.prompt.alert(null, "Host:",	systemProxySetting.http + "port:" + systemProxySetting.http_port);
					
					if(typeof(systemProxySetting.http) == "undefined" && systemProxySetting.http == null){
						systemProxySetting.http = "";
					}
					if(typeof(systemProxySetting.http_port) == "undefined" && systemProxySetting.http_port == null){
						systemProxySetting.http_port = 0;
					}
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http",systemProxySetting.http);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",systemProxySetting.http_port);
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp",systemProxySetting.http);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",systemProxySetting.http_port);
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl",systemProxySetting.http);
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",systemProxySetting.http_port);
					Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks","");
					Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",0);
					
					
				}
				
			}else{//Direct Connection
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoconfig",systemProxySetting.autoconfig);
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoDetect",systemProxySetting.autoDetect);
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.sameProxyServer",systemProxySetting.sameProxyServer);
				
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",0);
			
				/*
				Services.prompt.alert(null, "Direct Connection:","http:"+systemProxySetting.http + "port:" + systemProxySetting.http_port +
																"\nhttps:"+systemProxySetting.https + "port:" + systemProxySetting.https_port +
																"\nftp:"+systemProxySetting.ftp + "port:" + systemProxySetting.ftp_port +
																"\nsocks:"+systemProxySetting.socks + "port:" + systemProxySetting.socks_port +
																"\nAutoConfig:"+systemProxySetting.autoconfig + "autoconfig_url:" + systemProxySetting.autoconfig_url +
																"\nautoDetect:"+systemProxySetting.autoDetect + "sameProxyServer:" + systemProxySetting.sameProxyServer);
																*/
			}
		}

		if (isMac){
			var proxyService = Components.classes["@mozilla.org/system-proxy-settings;1"].getService(Components.interfaces.nsISystemProxySettings);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.isChange",true);
			var proxyString = proxyService.getProxyForURI("all","all","google.com",80);
			//Services.prompt.alert(null, "Direct Connection:",proxyString);
			var objProxyInfo = JSON.parse(proxyString);

			objProxyInfo = objProxyInfo.__SCOPED__.en0;
			
			systemProxySetting.HTTPEnable = objProxyInfo.HTTPEnable == 1 ;
			systemProxySetting.HTTPSEnable = objProxyInfo.HTTPSEnable == 1 ;
			systemProxySetting.FTPEnable = objProxyInfo.FTPEnable == 1 ;
			systemProxySetting.SOCKSEnable = objProxyInfo.SOCKSEnable == 1 ;
			systemProxySetting.FTPPassive = objProxyInfo.FTPPassive == 1 ;
			//if(typeof(objProxyInfo.ProxyAutoDiscoveryEnable) == "undefined" || objProxyInfo.ProxyAutoDiscoveryEnable == null)
			var autoDectectLink = "http://wpad/wpad.dat";
			systemProxySetting.autoconfig = false;
		  	systemProxySetting.autoDetect = false;
		  	if (typeof(objProxyInfo.ProxyAutoDiscoveryEnable) !== 'undefined' && objProxyInfo.ProxyAutoConfigURLString == autoDectectLink){
		    	systemProxySetting.autoDetect = true;
		    
		  	}else{
		    	systemProxySetting.autoDetect = false;
		  	}

		  	if (typeof(objProxyInfo.ProxyAutoConfigEnable) !== 'undefined' && objProxyInfo.ProxyAutoConfigURLString != autoDectectLink){
		    	systemProxySetting.autoconfig = objProxyInfo.ProxyAutoConfigEnable == 1;
		    
		  	}else{
		   		systemProxySetting.autoconfig = false;
		  	}

			//Add more field for MAC-OS proxy
			systemProxySetting.GopherEnable = false ;
			systemProxySetting.GopherUser = "" ;
			if (typeof(objProxyInfo.GopherEnable) !== 'undefined' &&  objProxyInfo.GopherEnable == 1){
				systemProxySetting.GopherEnable = true ;
		    	systemProxySetting.GopherProxy = objProxyInfo.GopherProxy;
				systemProxySetting.GopherPort = objProxyInfo.GopherPort;
				
				if (typeof(objProxyInfo.GopherUser) !== 'undefined')
					systemProxySetting.GopherUser = objProxyInfo.GopherUser;
				//Services.prompt.alert(null, "FTPPassive","FTPPassive:"+systemProxySetting.FTPPassive + "GopherUser:"+systemProxySetting.GopherUser);

		  	}else{
		   		systemProxySetting.GopherProxy = "";
				systemProxySetting.GopherPort = 0;
		  	}
			
			
			systemProxySetting.RTSPEnable = false ;
			if (typeof(objProxyInfo.RTSPEnable) !== 'undefined' && objProxyInfo.RTSPEnable == 1){
				systemProxySetting.RTSPEnable = true ;
		    	systemProxySetting.RTSPProxy = objProxyInfo.RTSPProxy;
				systemProxySetting.RTSPPort = objProxyInfo.RTSPPort;
				//Services.prompt.alert(null, "RTSPProxy","RTSPProxy:"+systemProxySetting.RTSPProxy + "P:" + systemProxySetting.RTSPPort);
		  	}else{
		   		systemProxySetting.RTSPProxy = "";
				systemProxySetting.RTSPPort = 0;
		  	}


		  	systemProxySetting.ExceptionsList = "" ;
			if (typeof(objProxyInfo.ExceptionsList) !== 'undefined')
		    	systemProxySetting.ExceptionsList = objProxyInfo.ExceptionsList.join(",");
		  	
		    //Services.prompt.alert(null, "ExceptionsList","ExceptionsList:"+systemProxySetting.ExceptionsList);
			//Add more field for MAC-OS proxy
			//RTSPEnable RTSPProxy RTSPPort GopherEnable GopherProxy GopherPort GopherUser FTPPassive ExceptionsList
			//ExcludeSimpleHostnames HTTPUser HTTPSUser  RTSPUser SOCKSUser FTPUser  
			systemProxySetting.ExcludeSimpleHostnames = false ;
			if (typeof(objProxyInfo.RTSPEnable) !== 'undefined' && objProxyInfo.ExcludeSimpleHostnames == 1){
				systemProxySetting.ExcludeSimpleHostnames = true ;
		  	}else{
		   		systemProxySetting.ExcludeSimpleHostnames = false ;
		  	}

		  	systemProxySetting.HTTPUser = "" ;
			if (typeof(objProxyInfo.HTTPUser) !== 'undefined'){
				systemProxySetting.HTTPUser = objProxyInfo.HTTPUser ;
		  	}else{
		   		systemProxySetting.HTTPUser = "" ;
		  	}

		  	systemProxySetting.HTTPSUser = "" ;
			if (typeof(objProxyInfo.HTTPSUser) !== 'undefined'){
				systemProxySetting.HTTPSUser = objProxyInfo.HTTPSUser ;
		  	}else{
		   		systemProxySetting.HTTPSUser = "" ;
		  	}

		  	systemProxySetting.RTSPUser = "" ;
			if (typeof(objProxyInfo.RTSPUser) !== 'undefined'){
				systemProxySetting.RTSPUser = objProxyInfo.RTSPUser ;
		  	}else{
		   		systemProxySetting.RTSPUser = "" ;
		  	}

		  	systemProxySetting.SOCKSUser = "" ;
			if (typeof(objProxyInfo.SOCKSUser) !== 'undefined'){
				systemProxySetting.SOCKSUser = objProxyInfo.SOCKSUser ;
		  	}else{
		   		systemProxySetting.SOCKSUser = "" ;
		  	}

		  	systemProxySetting.FTPUser = "" ;
			if (typeof(objProxyInfo.FTPUser) !== 'undefined'){
				systemProxySetting.FTPUser = objProxyInfo.FTPUser ;
		  	}else{
		   		systemProxySetting.FTPUser = "" ;
		  	}

			if(systemProxySetting.HTTPEnable){
				systemProxySetting.http = objProxyInfo.HTTPProxy;
				systemProxySetting.http_port = objProxyInfo.HTTPPort;
			}else{
				systemProxySetting.http = "";
				systemProxySetting.http_port = 0;
			}
			
			if(systemProxySetting.HTTPSEnable){
				systemProxySetting.https = objProxyInfo.HTTPSProxy;
				systemProxySetting.https_port = objProxyInfo.HTTPSPort;
			}else{
				systemProxySetting.https = "";
				systemProxySetting.https_port = 0;
			}

			if(systemProxySetting.FTPEnable){
				systemProxySetting.ftp = objProxyInfo.FTPProxy;
				systemProxySetting.ftp_port = objProxyInfo.FTPPort;
			}else{
				systemProxySetting.ftp = "";
				systemProxySetting.ftp_port = 0;
			}

			if(systemProxySetting.SOCKSEnable){
				systemProxySetting.socks = objProxyInfo.SOCKSProxy;
				systemProxySetting.socks_port = objProxyInfo.SOCKSPort;
			}else{
				systemProxySetting.socks = "";
				systemProxySetting.socks_port = 0;
			}
			
			if(systemProxySetting.autoDetect || systemProxySetting.autoconfig){
		    	systemProxySetting.autoconfig_url = objProxyInfo.ProxyAutoConfigURLString;
		  	}else{
		    	systemProxySetting.autoconfig_url = "";
		  	}
		  	
			
			
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url",systemProxySetting.autoconfig_url);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoconfig",systemProxySetting.autoconfig);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoDetect",systemProxySetting.autoDetect);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http",systemProxySetting.http);
			Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",systemProxySetting.http_port);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl",systemProxySetting.https);
			Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",systemProxySetting.https_port);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp",systemProxySetting.ftp);
			Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",systemProxySetting.ftp_port);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks",systemProxySetting.socks);
			Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",systemProxySetting.socks_port);

			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.FTPPassive",systemProxySetting.FTPPassive);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.RTSPEnable",systemProxySetting.RTSPEnable);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.RTSPProxy",systemProxySetting.RTSPProxy);
			Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.RTSPPort",systemProxySetting.RTSPPort);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.GopherEnable",systemProxySetting.GopherEnable);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.GopherProxy",systemProxySetting.GopherProxy);
			Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.GopherPort",systemProxySetting.GopherPort);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.GopherUser",systemProxySetting.GopherUser);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ExceptionsList",systemProxySetting.ExceptionsList);

			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.ExcludeSimpleHostnames",systemProxySetting.ExcludeSimpleHostnames);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.HTTPUser",systemProxySetting.HTTPUser);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.HTTPSUser",systemProxySetting.HTTPSUser);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.RTSPUser",systemProxySetting.RTSPUser);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.SOCKSUser",systemProxySetting.SOCKSUser);
			Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.FTPUser",systemProxySetting.FTPUser);

			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.HTTPEnable",systemProxySetting.HTTPEnable);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.HTTPSEnable",systemProxySetting.HTTPSEnable);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.FTPEnable",systemProxySetting.FTPEnable);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.SOCKSEnable",systemProxySetting.SOCKSEnable);
			//HTTPEnable HTTPSEnable FTPEnable SOCKSEnable

			////       
			/*
			Services.prompt.alert(null, "ProxyInfo","http:"+systemProxySetting.http + "port:" + systemProxySetting.http_port +
                            "\nhttps:"+systemProxySetting.https + "port:" + systemProxySetting.https_port +
                            "\nftp:"+systemProxySetting.ftp + "port:" + systemProxySetting.ftp_port +
                            "\nsocks:"+systemProxySetting.socks + "port:" + systemProxySetting.socks_port +
                            "\nAutoConfig:"+systemProxySetting.autoconfig + "autoconfig_url:" + systemProxySetting.autoconfig_url +
                            "\nautoDetect:"+systemProxySetting.autoDetect + "FTPPassive:" + systemProxySetting.FTPPassive );
			*/
		}
	    
		if (isLinux){
			var proxyService = Components.classes["@mozilla.org/system-proxy-settings;1"].getService(Components.interfaces.nsISystemProxySettings);
			Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.isChange",true);
			
			var getProxyForURISetting = proxyService.getProxyForURI("all","all","google.com",80);
			var PACURI = "";
			var systemProxyString = JSON.stringify(getProxyForURISetting).replace("DIRECT",";DIRECT");
			//systemProxyString = systemProxyString.replace('"', '').replace('"', '');
			while(systemProxyString && systemProxyString.indexOf(" ")>-1)
				systemProxyString = systemProxyString.replace(" ","");
			//while(systemProxyString && systemProxyString.indexOf('"')>-1)
		        //        systemProxyString = systemProxyString.replace('"','');
        
			//"aaa.com;auto;manual;http=1.1.1.1:10;https=2.2.2.2:20;ftp=3.3.3.3:30;socks=4.4.4.4:40"
			//Detect AutoProxyURL
			//Services.prompt.alert(null, "SysProxy:",systemProxyString);
			if (systemProxyString && systemProxyString.indexOf(";auto")>0){//Auto Mode
				PACURI = systemProxyString.substr(0,systemProxyString.indexOf(";auto"));
				systemProxySetting.autoconfig_url = PACURI.replace(" ","").replace(" ","").replace("\"","").replace("\"","");;
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url",systemProxySetting.autoconfig_url);
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoconfig",true);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",0);
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.mode",1);//Auto Mode
			}else if (systemProxyString && systemProxyString.indexOf("none;")>0){//None Mode
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url","");
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoconfig",false);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",0);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks","");
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",0);
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.mode",0);
			}else if (systemProxyString && systemProxyString.indexOf("manual;")>0){//Manual Mode
				//Get http info
				systemProxySetting.mode = 2;
				if (systemProxyString.indexOf("http=")>-1){
					if(systemProxyString.indexOf(";",systemProxyString.indexOf("http="))>-1)
						systemProxySetting.http = systemProxyString.substr(systemProxyString.indexOf("http=")+5,systemProxyString.indexOf(";",systemProxyString.indexOf("http=")) - systemProxyString.indexOf("http=") - 5);
					systemProxySetting.http_port =0;
					if(systemProxySetting.http.indexOf(":")>-1) {
						systemProxySetting.http_port = systemProxySetting.http.substr(systemProxySetting.http.indexOf(":")+1);
						systemProxySetting.http = systemProxySetting.http.substr(0,systemProxySetting.http.indexOf(":"));
					}
						
				}else{
					systemProxySetting.http = "";
					systemProxySetting.http_port = 0;
				}
				
				//Get https info
				if (systemProxyString.indexOf("https=")>-1){
					if(systemProxyString.indexOf(";",systemProxyString.indexOf("https="))>-1)
						systemProxySetting.https = systemProxyString.substr(systemProxyString.indexOf("https=")+6,systemProxyString.indexOf(";",systemProxyString.indexOf("https=")) - systemProxyString.indexOf("https=") - 6);
					if(systemProxySetting.https.indexOf(":")>-1) {
						systemProxySetting.https_port = systemProxySetting.https.substr(systemProxySetting.https.indexOf(":")+1);
						systemProxySetting.https = systemProxySetting.https.substr(0,systemProxySetting.https.indexOf(":"));
					}
						
				}else{
					systemProxySetting.https = "";
					systemProxySetting.https_port = 0;
				}
				
				//Get socks info
				if (systemProxyString.indexOf("socks=")>-1){
					systemProxySetting.socks = systemProxyString.substr(systemProxyString.indexOf("socks=")+6);
					
					if(systemProxySetting.socks.indexOf(":")>-1) {
						systemProxySetting.socks_port = systemProxySetting.socks.substr(systemProxySetting.socks.indexOf(":")+1).replace('"', '');
						
						systemProxySetting.socks = systemProxySetting.socks.substr(0,systemProxySetting.socks.indexOf(":"));
						
					}
						
				}else{
					systemProxySetting.socks = "";
					systemProxySetting.socks_port = 0;
				}
				
				//Get ftp info
				if (systemProxyString.indexOf("ftp=")>-1){
					if(systemProxyString.indexOf(";",systemProxyString.indexOf("ftp="))>-1)
						systemProxySetting.ftp = systemProxyString.substr(systemProxyString.indexOf("ftp=")+4,systemProxyString.indexOf(";",systemProxyString.indexOf("ftp=")) - systemProxyString.indexOf("ftp=") - 4);
					if(systemProxySetting.ftp.indexOf(":")>-1) {
						systemProxySetting.ftp_port = systemProxySetting.ftp.substr(systemProxySetting.ftp.indexOf(":")+1);
						systemProxySetting.ftp = systemProxySetting.ftp.substr(0,systemProxySetting.ftp.indexOf(":"));
					}
						
				}else{
					systemProxySetting.ftp = "";
					systemProxySetting.ftp_port = 0;
				}
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.mode",2);//Manual Mode
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.autoconfig_url","");
				Services.prefs.setBoolPref("browser.proxyChange.lastSystemProxyInfo.autoconfig",false);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.http",systemProxySetting.http);
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.http_port",systemProxySetting.http_port);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ssl",systemProxySetting.https);
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ssl_port",systemProxySetting.https_port);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.ftp",systemProxySetting.ftp);
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.ftp_port",systemProxySetting.ftp_port);
				Services.prefs.setCharPref("browser.proxyChange.lastSystemProxyInfo.socks",systemProxySetting.socks);
				Services.prefs.setIntPref("browser.proxyChange.lastSystemProxyInfo.socks_port",systemProxySetting.socks_port);
				
			}
			
		}
		

		
	}
	
    if (proxyTypePref.value != 1)
      return true;

    var httpProxyURLPref = document.getElementById("network.proxy.http");
    var httpProxyPortPref = document.getElementById("network.proxy.http_port");
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");

    // If the port is 0 and the proxy server is specified, focus on the port and cancel submission.
    for (let prefName of ["http","ssl","ftp","socks"]) {
      let proxyPortPref = document.getElementById("network.proxy." + prefName + "_port");
      let proxyPref = document.getElementById("network.proxy." + prefName);
      // Only worry about ports which are currently active. If the share option is on, then ignore
      // all ports except the HTTP port
      if (proxyPref.value != "" && proxyPortPref.value == 0 &&
            (prefName == "http" || !shareProxiesPref.value)) {
        document.getElementById("networkProxy" + prefName.toUpperCase() + "_Port").focus();
        return false;
      }
    }

    // In the case of a shared proxy preference, backup the current values and update with the HTTP value
    if (shareProxiesPref.value) {
      var proxyPrefs = ["ssl", "ftp", "socks"];
      for (var i = 0; i < proxyPrefs.length; ++i) {
        var proxyServerURLPref = document.getElementById("network.proxy." + proxyPrefs[i]);
        var proxyPortPref = document.getElementById("network.proxy." + proxyPrefs[i] + "_port");
        var backupServerURLPref = document.getElementById("network.proxy.backup." + proxyPrefs[i]);
        var backupPortPref = document.getElementById("network.proxy.backup." + proxyPrefs[i] + "_port");
        backupServerURLPref.value = backupServerURLPref.value || proxyServerURLPref.value;
        backupPortPref.value = backupPortPref.value || proxyPortPref.value;
        proxyServerURLPref.value = httpProxyURLPref.value;
        proxyPortPref.value = httpProxyPortPref.value;
      }
    }
    
    this.sanitizeNoProxiesPref();
	
    //Privafox save last proxy
	
	if (proxyTypePref.value == 1){
		//var currentProxy = document.getElementById("network.proxy.ftp");

		userProxySetting.http = document.getElementById("network.proxy.http").value;
		userProxySetting.http_port = document.getElementById("network.proxy.http_port").value;
		userProxySetting.ftp = document.getElementById("network.proxy.ftp").value;
		userProxySetting.ftp_port = document.getElementById("network.proxy.ftp_port").value;
		userProxySetting.ssl = document.getElementById("network.proxy.ssl").value;
		userProxySetting.ssl_port = document.getElementById("network.proxy.ssl_port").value;
		userProxySetting.socks = document.getElementById("network.proxy.socks").value;
		userProxySetting.socks_port = document.getElementById("network.proxy.socks_port").value;
		userProxySetting.socks_version = document.getElementById("network.proxy.socks_version").value;
		userProxySetting.socks_remote_dns = document.getElementById("network.proxy.socks_remote_dns").value;
		userProxySetting.share_proxy_settings = document.getElementById("network.proxy.share_proxy_settings").value;
		userProxySetting.no_proxies_on = document.getElementById("network.proxy.no_proxies_on").value;
		//var isChange = Services.prefs.getBoolPref("browser.proxyChange.isChange");
		//if (isChange === true){
		
		Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.http",userProxySetting.http);
		Services.prefs.setIntPref("browser.proxyChange.lastProxyInfo.http_port",userProxySetting.http_port);
		Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.ftp",userProxySetting.ftp);
		Services.prefs.setIntPref("browser.proxyChange.lastProxyInfo.ftp_port",userProxySetting.ftp_port);
		Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.ssl",userProxySetting.ssl);
		Services.prefs.setIntPref("browser.proxyChange.lastProxyInfo.ssl_port",userProxySetting.ssl_port);
		Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.socks",userProxySetting.socks);
		Services.prefs.setIntPref("browser.proxyChange.lastProxyInfo.socks_port",userProxySetting.socks_port);
		Services.prefs.setIntPref("browser.proxyChange.lastProxyInfo.socks_version",userProxySetting.socks_version);
		Services.prefs.setBoolPref("browser.proxyChange.lastProxyInfo.socks_remote_dns",userProxySetting.socks_remote_dns);
		Services.prefs.setBoolPref("browser.proxyChange.lastProxyInfo.share_proxy_settings",userProxySetting.share_proxy_settings);
		Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.no_proxies_on",userProxySetting.no_proxies_on);
		
	}
    return true;
  },

  checkForSystemProxy: function ()
  {
    if ("@mozilla.org/system-proxy-settings;1" in Components.classes)
      document.getElementById("systemPref").removeAttribute("hidden");
  },
  
  proxyTypeChanged: function ()
  {
    var proxyTypePref = document.getElementById("network.proxy.type");

    // Update http
    var httpProxyURLPref = document.getElementById("network.proxy.http");
    httpProxyURLPref.disabled = proxyTypePref.value != 1;
    var httpProxyPortPref = document.getElementById("network.proxy.http_port");
    httpProxyPortPref.disabled = proxyTypePref.value != 1;

    // Now update the other protocols
    this.updateProtocolPrefs();

    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    shareProxiesPref.disabled = proxyTypePref.value != 1;
    var autologinProxyPref = document.getElementById("signon.autologin.proxy");
    autologinProxyPref.disabled = proxyTypePref.value == 0;
    var noProxiesPref = document.getElementById("network.proxy.no_proxies_on");
    noProxiesPref.disabled = proxyTypePref.value != 1;

    var autoconfigURLPref = document.getElementById("network.proxy.autoconfig_url");
    autoconfigURLPref.disabled = proxyTypePref.value != 2;

    this.updateReloadButton();
  },
  
  updateDNSPref: function ()
  {
	 
    var socksVersionPref = document.getElementById("network.proxy.socks_version");
    var socksDNSPref = document.getElementById("network.proxy.socks_remote_dns");
    var proxyTypePref = document.getElementById("network.proxy.type");
    var isDefinitelySocks4 = !socksVersionPref.disabled && socksVersionPref.value == 4;
    socksDNSPref.disabled = (isDefinitelySocks4 || proxyTypePref.value == 0);
    return undefined;
  },
  
  updateReloadButton: function ()
  {
    // Disable the "Reload PAC" button if the selected proxy type is not PAC or
    // if the current value of the PAC textbox does not match the value stored
    // in prefs.  Likewise, disable the reload button if PAC is not configured
    // in prefs.

    var typedURL = document.getElementById("networkProxyAutoconfigURL").value;
    var proxyTypeCur = document.getElementById("network.proxy.type").value;

    var prefs =
        Components.classes["@mozilla.org/preferences-service;1"].
        getService(Components.interfaces.nsIPrefBranch);
    var pacURL = prefs.getCharPref("network.proxy.autoconfig_url");
    var proxyType = prefs.getIntPref("network.proxy.type");

    var disableReloadPref =
        document.getElementById("pref.advanced.proxies.disable_button.reload");
    disableReloadPref.disabled =
        (proxyTypeCur != 2 || proxyType != 2 || typedURL != pacURL);
  },
  
  readProxyType: function ()
  {
    this.proxyTypeChanged();
    return undefined;
  },
  
  updateProtocolPrefs: function ()
  {
    var proxyTypePref = document.getElementById("network.proxy.type");
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    var proxyPrefs = ["ssl", "ftp", "socks"];
    for (var i = 0; i < proxyPrefs.length; ++i) {
      var proxyServerURLPref = document.getElementById("network.proxy." + proxyPrefs[i]);
      var proxyPortPref = document.getElementById("network.proxy." + proxyPrefs[i] + "_port");
      
      // Restore previous per-proxy custom settings, if present. 
      if (!shareProxiesPref.value) {
        var backupServerURLPref = document.getElementById("network.proxy.backup." + proxyPrefs[i]);
        var backupPortPref = document.getElementById("network.proxy.backup." + proxyPrefs[i] + "_port");
        if (backupServerURLPref.hasUserValue) {
          proxyServerURLPref.value = backupServerURLPref.value;
          backupServerURLPref.reset();
        }
        if (backupPortPref.hasUserValue) {
          proxyPortPref.value = backupPortPref.value;
          backupPortPref.reset();
        }
      }

      proxyServerURLPref.updateElements();
      proxyPortPref.updateElements();
      proxyServerURLPref.disabled = proxyTypePref.value != 1 || shareProxiesPref.value;
      proxyPortPref.disabled = proxyServerURLPref.disabled;
    }
    var socksVersionPref = document.getElementById("network.proxy.socks_version");
    socksVersionPref.disabled = proxyTypePref.value != 1 || shareProxiesPref.value;
    this.updateDNSPref();
    return undefined;
  },
  
  readProxyProtocolPref: function (aProtocol, aIsPort)
  {
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value) {
      var pref = document.getElementById("network.proxy.http" + (aIsPort ? "_port" : ""));    
      return pref.value;
    }
    
    var backupPref = document.getElementById("network.proxy.backup." + aProtocol + (aIsPort ? "_port" : ""));
    return backupPref.hasUserValue ? backupPref.value : undefined;
  },

  reloadPAC: function ()
  {
    Components.classes["@mozilla.org/network/protocol-proxy-service;1"].
        getService().reloadPAC();
  },
  
  doAutoconfigURLFixup: function ()
  {
    var autoURL = document.getElementById("networkProxyAutoconfigURL");
    var autoURLPref = document.getElementById("network.proxy.autoconfig_url");
    var URIFixup = Components.classes["@mozilla.org/docshell/urifixup;1"]
                             .getService(Components.interfaces.nsIURIFixup);
    try {
      autoURLPref.value = autoURL.value = URIFixup.createFixupURI(autoURL.value, 0).spec;
	  Services.prefs.setCharPref("browser.proxyChange.lastProxyInfo.autoconfig_url",autoURLPref.value);
    } catch(ex) {}
  },

  sanitizeNoProxiesPref: function()
  {
    var noProxiesPref = document.getElementById("network.proxy.no_proxies_on");
    // replace substrings of ; and \n with commas if they're neither immediately
    // preceded nor followed by a valid separator character
    noProxiesPref.value = noProxiesPref.value.replace(/([^, \n;])[;\n]+(?![,\n;])/g, '$1,');
    // replace any remaining ; and \n since some may follow commas, etc. 
    noProxiesPref.value = noProxiesPref.value.replace(/[;\n]/g, '');
  },
  
  readHTTPProxyServer: function ()
  {
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value)
      this.updateProtocolPrefs();
    return undefined;
  },
  
  readHTTPProxyPort: function ()
  {
    var shareProxiesPref = document.getElementById("network.proxy.share_proxy_settings");
    if (shareProxiesPref.value)
      this.updateProtocolPrefs();
    return undefined;
  }
};