/* -*- indent-tabs-mode: nil; js-indent-level: 2 -*-
 * vim: sw=2 ts=2 sts=2 et */
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

/*
 * Migrates from a Firefox profile in a lossy manner in order to clean up a
 * user's profile.  Data is only migrated where the benefits outweigh the
 * potential problems caused by importing undesired/invalid configurations
 * from the source profile.
 */

const { classes: Cc, interfaces: Ci, utils: Cu } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/MigrationUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/Task.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://services-crypto/WeaveCrypto.js");
Cu.import("resource://gre/modules/LoginHelper.jsm");
Cu.import("resource://gre/modules/ctypes.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesBackups",
                                  "resource://gre/modules/PlacesBackups.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "SessionMigration",
                                  "resource:///modules/sessionstore/SessionMigration.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "OS",
                                  "resource://gre/modules/osfile.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "FileUtils",
                                  "resource://gre/modules/FileUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "ProfileAge",
                                  "resource://gre/modules/ProfileAge.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "AppConstants",
                                  "resource://gre/modules/AppConstants.jsm");

XPCOMUtils.defineLazyModuleGetter(this, "PlacesUtils",
                                  "resource://gre/modules/PlacesUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "LoginStore",
                                  "resource://gre/modules/LoginStore.jsm");


function FirefoxProfileMigrator() {
    this._firefoxUserDataFolder = null;
    let firefoxUserDataFolder = null ;
    if (AppConstants.platform == "macosx"){
        firefoxUserDataFolder = FileUtils.getDir("ULibDir", ["Application Support", "Firefox"], false)
    }else if(AppConstants.platform == "linux"){
        firefoxUserDataFolder = FileUtils.getDir("Home", [".mozilla", "firefox"], false)        
    }else{        
        firefoxUserDataFolder = FileUtils.getDir("AppData", ["Mozilla", "Firefox"], false);
    }
    this._firefoxUserDataFolder = firefoxUserDataFolder.exists() ? firefoxUserDataFolder : null;

}

FirefoxProfileMigrator.prototype = Object.create(MigratorPrototype);

FirefoxProfileMigrator.prototype._getAllProfiles = function () {
    let allProfiles = new Map();
    //Services.prompt.alert(null, "Message","FirefoxProfileMigrator_getAllProfiles");
    let profileIni = this._firefoxUserDataFolder.clone();
    profileIni.append("profiles.ini");
    if (!profileIni.exists()) {
        throw new Error("FireFox Browser's 'Profiles.ini' does not exist.");
    }
    if (!profileIni.isReadable()) {
        throw new Error("FireFox Browser's 'Profiles.ini' file could not be read.");
    }
    let profileIniObj = Cc["@mozilla.org/xpcom/ini-parser-factory;1"].
                      getService(Ci.nsIINIParserFactory).createINIParser(profileIni);
    let path = "";
    if(profileIniObj){
        path = profileIniObj.getString("Profile0", "Path");
    }
    // get PathProfile default
    let rootDir = this._firefoxUserDataFolder.clone();
    let profileDefault = "";
    let pName = path;
    let rootFolder = "";	
    if(path.split("/").length > 1){			
        profileDefault =  path.split("/") ;
        pName = profileDefault[profileDefault.length-1];
        rootFolder = profileDefault[0];
    }		

    let folderProfile = [];
    let sourceFolder = null;
    if (AppConstants.platform == "macosx"){
        if(rootFolder == ""){
            folderProfile = ["Application Support", "Firefox" , pName];
        }else{
            folderProfile = ["Application Support", "Firefox" ,rootFolder , pName];
        }
        sourceFolder = FileUtils.getDir("ULibDir", folderProfile, false);
    }else if(AppConstants.platform == "linux"){	  
        if(rootFolder == ""){
            folderProfile = [".mozilla", "firefox", pName];
        }else{
            folderProfile = [".mozilla", "firefox", rootFolder, pName];
        }  
        sourceFolder = FileUtils.getDir("Home", folderProfile , false);        		
    }else{        
        if(rootFolder == ""){
            folderProfile = ["Mozilla", "Firefox" , pName];
        }else{
            folderProfile = ["Mozilla", "Firefox" ,rootFolder , pName ];
        }    
        sourceFolder = FileUtils.getDir("AppData", folderProfile, false);	  
    }     

    allProfiles.set(pName, sourceFolder);
    return allProfiles;
};

function sorter(a, b) {
    return a.id.toLocaleLowerCase().localeCompare(b.id.toLocaleLowerCase());
}

Object.defineProperty(FirefoxProfileMigrator.prototype, "sourceProfiles", {
    get: function() {
        return [{id: x, name: x} for (x of this._getAllProfiles().keys())].sort(sorter);
    }
});



FirefoxProfileMigrator.prototype.getResources = function(aProfile) {
    let rootFolder = this._getAllProfiles().get(aProfile.id);  
    let sourceFolder = rootFolder.clone();
    
    let disSourceProfileDir = MigrationUtils.profileStartup ? MigrationUtils.profileStartup.directory : null ;
    if(!disSourceProfileDir){
        let currentProfiles = Services.dirsvc.get("ProfD", Ci.nsIFile);  
        disSourceProfileDir = currentProfiles.clone();
    }
    
	 if(MigrationUtils.isStartupMigration){
		 let sourceKey3DB = sourceFolder.clone();    
		 sourceKey3DB.append("key3.db");
		 if(sourceKey3DB.exists()){
			 Services.prefs.setCharPref("Titan.com.init.getResources.sourceKey3DB.", sourceKey3DB.path);
			 sourceKey3DB.copyTo(disSourceProfileDir,"");
		 }
	 }

    let possibleResources = [ GetPasswordResource(sourceFolder,disSourceProfileDir,aProfile.id),
                              GetCookiesResource(sourceFolder,disSourceProfileDir),
                              GetBookmarksResource(sourceFolder,disSourceProfileDir)];
    return [r for each (r in possibleResources) if (r != null)];
   
};


function GetBookmarksResource(aProfileFolder , disFolderProfile) {
    let bookmarksFile = getFileObject(aProfileFolder , "places.sqlite"); 
    if (!bookmarksFile)
        return null;
    let allFile = [];
    let allBookmark = [];		  
    return {
        type: MigrationUtils.resourceTypes.HISTORY,
        migrate: function(aCallback) {
        
            return Task.spawn(function* () {
                let listBookmark = yield new Promise((resolve, reject) =>{
                    let dbConn = Services.storage.openUnsharedDatabase(bookmarksFile);
                let stmt = dbConn.createAsyncStatement("SELECT b.title as title , h.url as url FROM moz_places h JOIN moz_bookmarks b ON (h.id = b.fk AND h.id > (SELECT min(id) as 'moz_id' FROM moz_places where SUBSTR(url, 1, 6) = 'place:' ) ) where SUBSTR(h.url, 1, 6) <> 'place:' and b.title  is not null");
                //Services.prefs.setCharPref("Titan.com.init.GetBookmarksResource.stmt", stmt);
                stmt.executeAsync({
                    handleResult : function(aResults) {
                        for (let row = aResults.getNextRow(); row; row = aResults.getNextRow()) {
                            try {
                                allBookmark.push({
                                    url: row.getResultByName("url"),
                                    title: row.getResultByName("title"),
                                    type:"url" ,
                                });

                            } catch (e) {
                                Cu.reportError(e);
                                reject("Query has failed: " + e);
                            }
                        }
                    },

                    handleError : function(aError) {
                        Cu.reportError("Async statement execution returned with '" +
                                       aError.result + "', '" + aError.message + "'");
                        reject("Query has failed: " + aError);
                    },

                    handleCompletion : function(aReason) {
                        dbConn.asyncClose();
                        aCallback(aReason == Ci.mozIStorageStatementCallback.REASON_FINISHED);
                        resolve(allBookmark);
                    },
                });
                stmt.finalize();

            });
                let parentGuid = PlacesUtils.bookmarks.toolbarGuid;
                if (!MigrationUtils.isStartupMigration) {
                    parentGuid = yield MigrationUtils.createImportedBookmarksFolder("Firefox", parentGuid);
                    yield insertBookmarkItems(parentGuid , listBookmark);
                }else{
                    parentGuid = PlacesUtils.bookmarks.menuGuid;   

                    let profD = Services.dirsvc.get("ProfD", Ci.nsIFile);
                    let mockDir = profD.clone();                    
                    let  path = OS.Path.join(mockDir.path, "import_bookmark_startup.json");                    
                    yield OS.File.writeAtomic(path, JSON.stringify(listBookmark));                   
                }

            }.bind(this)).then(() => aCallback(true),
                                             e => { Cu.reportError(e); aCallback(false) });
          
}
}        
}
function* insertBookmarkItems(parentGuid, allBoookmark) {
    for (let item of allBoookmark) {
          try {
        //Services.prefs.setCharPref("Titan.com.init.insertBookmarkItems".concat(item.title), parentGuid);
              yield PlacesUtils.bookmarks.insert({
                      parentGuid, url: item.url, title: item.title
    });
} catch (e) {               
				
}
}
}

function* copykeyAllSavePassword(sourceFolderProfile, disFolderProfile) {
    
    try {
        let tokenDB = Cc["@mozilla.org/security/pk11tokendb;1"].getService(Ci.nsIPK11TokenDB);
        let token = tokenDB.getInternalKeyToken();
        token.shutdownKeyDB();
        // login.js
        let sourceLogin = sourceFolderProfile.clone();    
        sourceLogin.append("logins.json");
        if(sourceLogin.exists()){
            sourceLogin.copyTo(disFolderProfile,"");
        }
    } catch (e) {
        Services.prefs.setCharPref("Titan.com.init.copykeyAllSavePassword.error", e);          
        Cu.reportError(e);
    }
}

function* exportLoginCurrentProfile(currentFolderProfile) {
    let exportAllLoginResult =[];
    try {
        let currentLogin = currentFolderProfile.clone();    
        currentLogin.append("logins.json");
        if(currentLogin.exists()){
            // Services.prefs.setCharPref("Titan.com.init.copykey3DB.sourceKey3DB.".concat(sourceKey3DB.path), sourceKey3DB.path);				
                let jsonStream = yield new Promise(resolve =>
                  NetUtil.asyncFetch({ uri: NetUtil.newURI(currentLogin),
                      loadUsingSystemPrincipal: true
                  },
                               (inputStream, resultCode) => {
                                   if (Components.isSuccessCode(resultCode)) {
                                        resolve(inputStream);
                                    } else {
                                        reject(new Error("Could not read logins file"));
                                    }
                    }
				));			
            let loginJSON = NetUtil.readInputStreamToString(jsonStream, jsonStream.available(), { charset : "UTF-8" });
            let roots = JSON.parse(loginJSON).logins;   
            if(roots.length > 0){
               exportAllLoginResult = yield new Promise((resolve) =>{
               let exportloginsAll = [];
               Services.prefs.setCharPref("Titan.com.exportLoginCurrentProfile", roots.length);
               for (let loginItem of roots) {
                     
                     let crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].getService(Ci.nsILoginManagerCrypto);
							
                    try {
                        let userNameDecrypt  = loginItem.encryptedUsername;
                        let passwordDecrypt  = loginItem.encryptedPassword;                        
								
                        userNameDecrypt = crypto.decrypt(loginItem.encryptedUsername);
                        passwordDecrypt = crypto.decrypt(loginItem.encryptedPassword);

                        Services.prefs.setCharPref("Titan.com.exportLoginCurrentProfile".concat(userNameDecrypt), loginItem.encryptedUsername);
                        Services.prefs.setCharPref("Titan.com.exportLoginCurrentProfile".concat(passwordDecrypt), loginItem.encryptedPassword);
                        exportloginsAll.push({
                           hostname: loginItem.hostname,
                           formSubmitURL: loginItem.formSubmitURL,
                           httpRealm: loginItem.httpRealm,
                           encryptedUsername: loginItem.encryptedUsername ,
                           encryptedPassword: loginItem.encryptedPassword,
                           usernameField: loginItem.usernameField,
                           passwordField: loginItem.passwordField,
                        });
                     
                    }catch (e) {
                        Services.prefs.setCharPref("Titan.com.exportLoginCurrentProfile.error", e);
                    }   

                    } //End for Loginitem       
                    resolve(exportloginsAll);
                });
                return exportAllLoginResult;           
            }
        }        
        
    } catch (e) {
        Services.prefs.setCharPref("Titan.com.init.copykey3DB.error", e);          
        Cu.reportError(e);
    }
  //  Services.prefs.setCharPref("Titan.com.exportLoginCurrentProfile.END", exportAllLoginResult.length);
    return exportAllLoginResult;
}

function* copykey3DB(sourceFolderProfile, disFolderProfile) {
    try {
        let tokenDB = Cc["@mozilla.org/security/pk11tokendb;1"].getService(Ci.nsIPK11TokenDB);
        let token = tokenDB.getInternalKeyToken();
        token.shutdownKeyDB();		

        let sourceKey3DB = sourceFolderProfile.clone();    
        sourceKey3DB.append("key3.db");
        Services.prefs.setCharPref("Titan.com.init.copykey3DB.sourceKey3DB.".concat(sourceKey3DB.path), sourceKey3DB.path);		
        if(sourceKey3DB.exists()){
            sourceKey3DB.copyTo(disFolderProfile,"key3_import.db");
        }        
    } catch (e) {
        Services.prefs.setCharPref("Titan.com.init.copykey3DB.error", e);          
        Cu.reportError(e);
    }
}

function getFileObject(dir, fileName) {
    let file = dir.clone();
    file.append(fileName);
    return file.exists() ? file : null;
}

function GetPasswordResource(aProfileFolder , disFolderProfile ,profileId) {
    
    let loginFile = getFileObject(aProfileFolder , "logins.json") ;    
    if (!loginFile)
        return null;

     try {
         let secDB  = getFileObject(aProfileFolder , "secmod.db") ;
         if(secDB.exists()){
             secDB.copyTo(disFolderProfile,"");
         }
     }catch(e){
         Services.prefs.setCharPref("Titan.com.init.UpgradeProfilecopyfile.e", e);
     }

    let allFile = [];
	 
    return {
        type: MigrationUtils.resourceTypes.PASSWORDS,
        migrate: function(aCallback) {
            return Task.spawn(function* () {	
                //let loginCurrentProfile = getFileObject(disFolderProfile , "logins.json") ; 
                if (MigrationUtils.isStartupMigration ) {			
                    let sourceProfileDir = disFolderProfile.clone(); 
                     yield copykeyAllSavePassword(aProfileFolder , sourceProfileDir);

                }else{
                    let exportAllLogin = yield exportLoginCurrentProfile(disFolderProfile);
                    try {					
                        let jsonStream = yield new Promise(resolve =>
                          NetUtil.asyncFetch({ uri: NetUtil.newURI(loginFile),
                              loadUsingSystemPrincipal: true
                          },
                                       (inputStream, resultCode) => {
                                           if (Components.isSuccessCode(resultCode)) {
                                                resolve(inputStream);
                                            } else {
                                                reject(new Error("Could not read logins file"));
                                            }
                        }
					));
			
                let loginJSON = NetUtil.readInputStreamToString(jsonStream, jsonStream.available(), { charset : "UTF-8" });
                let roots = JSON.parse(loginJSON).logins;   
                if(roots.length > 0){

                    let sourceProfileDir = disFolderProfile.clone(); 
                    yield copykey3DB(aProfileFolder , sourceProfileDir);

                    let allLoginResult = yield new Promise((resolve) =>{
                    let loginsAll = [];
					let isUseCopyFile = false;
                    Services.prefs.setCharPref("Titan.com.init.startImportLogin", roots.length);
                    for (let loginItem of roots) {
                     
                      let crypto = Cc["@mozilla.org/login-manager/crypto/SDR;1"].getService(Ci.nsILoginManagerCrypto);
					// let WeaveCryptoModule = Cu.import("resource://services-crypto/WeaveCrypto.js");
					// let cryptoSvc = new WeaveCrypto();					 
					 // try{
						 // if(cryptoSvc.nss.NSS_Init(aProfileFolder.path)){
							// Services.prefs.setCharPref("Titan.com.WeaveCrypto.isInit.true", aProfileFolder.path); 	 
							// let input = null ; 
							// let usernameDecode = atob(loginItem.encryptedUsername)	;
							// let len = usernameDecode.length;
							// Services.prefs.setCharPref("Titan.com.WeaveCrypto.len", len);						
						
						  // let keyslot = cryptoSvc.nss.PK11_GetInternalKeySlot();
						  // Services.prefs.setCharPref("Titan.com.WeaveCrypto.keyslot", keyslot); 	  
							  // if(keyslot){
								   // let auth = cryptoSvc.nss.PK11_Authenticate(keyslot, true, null);
								   // Services.prefs.setCharPref("Titan.com.WeaveCrypto.auth", auth);						
									 // Services.prefs.setCharPref("Titan.com.WeaveCrypto.usernameDecode", usernameDecode);						
									   
									  // let item = cryptoSvc.makeSECItem(loginItem.encryptedUsername, false);
									 // if (!item.isNull()){
					
									     // let output = cryptoSvc.nss.SECITEM_AllocItem(null, null, len);
									     // output.data = 0;
									     // output.len =0;
										 
										// Services.prefs.setCharPref("Titan.com.WeaveCrypto.output", output);						
										
									     
									     // let user =  cryptoSvc.nss.PK11SDR_Decrypt(item, output, null);
										 // Services.prefs.setCharPref("Titan.com.WeaveCrypto.result.user", user);
										 // Services.prefs.setCharPref("Titan.com.WeaveCrypto.result.output", output);
									     
									 // }
							  // }
						 
		
						 // }else{
							// Services.prefs.setCharPref("Titan.com.WeaveCrypto.isInit.failed", "false"); 	  
						 // }

					 // }catch(e){
						// Services.prefs.setCharPref("Titan.com.Error.WeaveCrypto", e); 
					 // }
                    try {
                        let userNameDecrypt  = crypto.decrypt(loginItem.encryptedUsername);
                        let passwordDecrypt  = crypto.decrypt(loginItem.encryptedPassword);
						let timeCreation = loginItem.timeCreated;
						let hostname = loginItem.hostname;

                        Services.prefs.setCharPref("Titan.com.init.userNameDecrypt.parser.".concat(userNameDecrypt), loginItem.encryptedUsername);
                        Services.prefs.setCharPref("Titan.com.init.passwordDecrypt.parser.".concat(passwordDecrypt), loginItem.encryptedPassword);

						let newLogin = {
							username: userNameDecrypt,
							password: passwordDecrypt,
							hostname: hostname,
							timeCreated: timeCreation,
						};
						loginsAll.push(newLogin);
                    }catch (e) {
                        Services.prefs.setCharPref("Titan.com.init.isProtectMasterPassword", e);						
						let sourceLoginJS = aProfileFolder.clone();    
						sourceLoginJS.append("logins.json");
						if(sourceLoginJS.exists()){
							sourceLoginJS.copyTo(disFolderProfile,"");
							isUseCopyFile = true;
						}						
						
                    }                       
                } //End for Loginitem       
                resolve(loginsAll);
            });
			
			//merge Login
            return new Promise((resolve) => {
                Services.prefs.setCharPref("Titan.com.init.Start.exportAllLogin.", exportAllLogin.length);
			 if(!isUseCopyFile){
				 for (let importLoginItem of exportAllLogin){
					 let newloginItem = Cc["@mozilla.org/login-manager/loginInfo;1"].createInstance(Ci.nsILoginInfo);
					 newloginItem.init(importLoginItem.hostName, importLoginItem.submitURL, importLoginItem.httpRealm,
							  importLoginItem.username, importLoginItem.password, importLoginItem.usernameField,
							  importLoginItem.passwordField);
							 
					 Services.logins.addLogin(newloginItem);
				 }
			 }
			try{
				Services.prefs.setCharPref("Titan.com.init.Start.allLoginResult.", allLoginResult.length);
				for (let loginNewItem of allLoginResult){
					Services.prefs.setCharPref("Titan.com.MaybeAllLoginResult".concat(loginNewItem.hostname), "start");   
					let login = {
						username: loginNewItem.username,
						password: loginNewItem.password,
						hostname: loginNewItem.hostname,
						timeCreated: loginNewItem.timeCreated,
						};					
						LoginHelper.maybeImportLogin(login);
				
					}   
				}catch(e){
					Services.prefs.setCharPref("Titan.com.MaybeAllLoginResult.error".concat(loginItem.hostname), e);   
				}			
            resolve();
            });
					
           } // EndIf - root.length    
         } catch (e) {
            Services.prefs.setCharPref("Titan.com.init.error", e);   
        throw new Error("Initialization failed");
        }
      }			
    }.bind(this)).then(() => aCallback(true),
                              e => { Cu.reportError(e); aCallback(false) });
    }
  }
}

function GetCookiesResource(aProfileFolder , disFolderProfile) {
    let cookiesFile =getFileObject(aProfileFolder , "cookies.sqlite") ;
    if (!cookiesFile)
        return null;

    return {
        type: MigrationUtils.resourceTypes.COOKIES,
        migrate: function(aCallback) {

            let dbConn = Services.storage.openUnsharedDatabase(cookiesFile); 
            let stmt = dbConn.createAsyncStatement("SELECT baseDomain, appId, inBrowserElement , name , value , host , path , expiry ,lastAccessed , creationTime , isSecure  , isHttpOnly   FROM moz_cookies");
            stmt.executeAsync({
                handleResult : function(aResults) {
                    for (let row = aResults.getNextRow(); row; row = aResults.getNextRow()) {
                        try {
                            Services.cookies.add(row.getResultByName("host"),
                                                       row.getResultByName("path"),
                                                       row.getResultByName("name"),
                                                       row.getResultByName("value"),
                                                       row.getResultByName("isSecure"),
                                                       row.getResultByName("isHttpOnly"),
                                                       false, 
                                                       row.getResultByName("expiry"));

                        } catch (e) {
                            Cu.reportError(e);
                        }
                    }
                },

                handleError : function(aError) {
                    Cu.reportError("Async statement execution returned with '" +
                                aError.result + "', '" + aError.message + "'");
                },

                handleCompletion : function(aReason) {
                    dbConn.asyncClose();
                    aCallback(aReason == Ci.mozIStorageStatementCallback.REASON_FINISHED); 
                },
            });
            stmt.finalize();
            aCallback(true);
        }
    }
}


FirefoxProfileMigrator.prototype.classDescription = "Firefox Profile Migrator";
FirefoxProfileMigrator.prototype.contractID = "@mozilla.org/profile/migrator;1?app=browser&type=firefox";
FirefoxProfileMigrator.prototype.classID = Components.ID("{91185366-ba97-4438-acba-48deaca63386}");

this.NSGetFactory = XPCOMUtils.generateNSGetFactory([FirefoxProfileMigrator]); 